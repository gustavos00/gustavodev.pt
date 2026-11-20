// Vercel Routing Middleware: everything on eu.gustavodev.pt (and /eu/*, /vida/* on any host) needs a
// signed-in Vida session, checked here before any page is served, and refreshed here when its hour-long
// access token has expired. Only the sign-in page and the quotes report (no personal data) are open.
// The session is the one assets/eu-auth.js keeps in the gd-auth.* cookies on .gustavodev.pt.

const SUPABASE_URL = 'https://fdmhaiwrechavluumeym.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TC_D6gGODob7Tp7Ea-zWXg_Rwh7HJX1';
const PROTECTED_HOSTS = new Set(['eu.gustavodev.pt']);
const OPEN_PATHS = new Set(['/entrar', '/eu/entrar', '/relatorio', '/eu/relatorio']);
// Private pages whose path is also a public page's. Vercel serves a matching file before it reads the
// rewrites in vercel.json, so on the portal host these are rewritten here, ahead of the file system.
const PRIVATE_TWINS = new Map([['/toque', '/eu/toque']]);
const COOKIE_CHUNK = 3000;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const config = {
  matcher: ['/((?!assets/|favicon).*)'],
};

function readCookies(header) {
  const cookies = new Map();

  for (const part of (header || '').split(/;\s*/)) {
    const index = part.indexOf('=');

    if (index > 0) {
      cookies.set(part.slice(0, index), decodeURIComponent(part.slice(index + 1)));
    }
  }

  return cookies;
}

function readSession(request) {
  const cookies = readCookies(request.headers.get('cookie'));
  const count = Number(cookies.get('gd-auth.n'));

  if (!count || count > 10) {
    return null;
  }

  let value = '';

  for (let index = 0; index < count; index += 1) {
    const part = cookies.get(`gd-auth.${index}`);

    if (part === undefined) {
      return null;
    }

    value += part;
  }

  try {
    const session = JSON.parse(value);

    return session && typeof session === 'object' ? session : null;
  } catch {
    return null;
  }
}

async function isAccessTokenValid(token) {
  if (typeof token !== 'string') {
    return false;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });

  return response.ok;
}

async function refreshSession(refreshToken) {
  if (typeof refreshToken !== 'string') {
    return null;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    return null;
  }

  const session = await response.json();

  if (typeof session.access_token !== 'string') {
    return null;
  }

  if (typeof session.expires_at !== 'number' && typeof session.expires_in === 'number') {
    session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in;
  }

  return session;
}

// The same cookies assets/eu-auth.js and Vida's web build write: the session as JSON, split into parts.
function buildSessionCookies(session, oldCount) {
  const value = JSON.stringify(session);
  const count = Math.ceil(value.length / COOKIE_CHUNK);
  const attributes = `; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Domain=.gustavodev.pt; Secure`;
  const cookies = [];

  for (let index = 0; index < count; index += 1) {
    cookies.push(`gd-auth.${index}=${encodeURIComponent(value.slice(index * COOKIE_CHUNK, (index + 1) * COOKIE_CHUNK))}${attributes}`);
  }

  for (let index = count; index < oldCount; index += 1) {
    cookies.push(`gd-auth.${index}=; Path=/; Max-Age=0; SameSite=Lax; Domain=.gustavodev.pt; Secure`);
  }

  cookies.push(`gd-auth.n=${count}${attributes}`);

  return cookies;
}

/**
 * The signed-in session's cookies to send back: [] when the access token is still good, the
 * refreshed session's when it had expired, or null when there is no session to keep. Access
 * tokens last an hour and only an open page refreshes them, so without the refresh here anyone
 * who came back after an hour away was sent to the sign-in page.
 */
async function checkSession(request) {
  const session = readSession(request);

  if (!session) {
    return null;
  }

  if (await isAccessTokenValid(session.access_token)) {
    return [];
  }

  const refreshed = await refreshSession(session.refresh_token);

  if (!refreshed) {
    return null;
  }

  const cookies = readCookies(request.headers.get('cookie'));

  return buildSessionCookies(refreshed, Number(cookies.get('gd-auth.n')) || 0);
}

function buildHeaders(entries, cookies) {
  const headers = new Headers(entries);

  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie);
  }

  return headers;
}

function continueRequest(cookies = []) {
  return new Response(null, { headers: buildHeaders({ 'x-middleware-next': '1' }, cookies) });
}

function rewriteRequest(url, pathname, cookies = []) {
  return new Response(null, {
    headers: buildHeaders({ 'x-middleware-rewrite': new URL(pathname, url).toString() }, cookies),
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const isPortalHost = PROTECTED_HOSTS.has(url.hostname);
  const isPortalPath = ['/eu', '/vida'].some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  );

  if ((!isPortalHost && !isPortalPath) || OPEN_PATHS.has(url.pathname)) {
    return continueRequest();
  }

  const sessionCookies = await checkSession(request);

  if (sessionCookies) {
    const twin = isPortalHost ? PRIVATE_TWINS.get(url.pathname) : undefined;

    return twin ? rewriteRequest(url, twin, sessionCookies) : continueRequest(sessionCookies);
  }

  const signIn = new URL('https://eu.gustavodev.pt/entrar');
  signIn.searchParams.set('next', isPortalHost ? url.pathname : url.pathname.replace(/^\/eu(?=\/|$)/, '') || '/');

  return Response.redirect(signIn, 302);
}
