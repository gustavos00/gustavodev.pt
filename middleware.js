// Vercel Routing Middleware: everything on eu.gustavodev.pt (and /eu/*, /vida/* on any host) needs a
// signed-in Vida session, checked here before any page is served. Only the sign-in page is open.
// The session is the one assets/eu-auth.js keeps in the gd-auth.* cookies on .gustavodev.pt.

const SUPABASE_URL = 'https://fdmhaiwrechavluumeym.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TC_D6gGODob7Tp7Ea-zWXg_Rwh7HJX1';
const PROTECTED_HOSTS = new Set(['eu.gustavodev.pt']);
const OPEN_PATHS = new Set(['/entrar', '/eu/entrar']);

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

function readAccessToken(request) {
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

    return typeof session.access_token === 'string' ? session.access_token : null;
  } catch {
    return null;
  }
}

async function isSignedIn(request) {
  const token = readAccessToken(request);

  if (!token) {
    return false;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });

  return response.ok;
}

function continueRequest() {
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
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

  if (await isSignedIn(request)) {
    return continueRequest();
  }

  const signIn = new URL('https://eu.gustavodev.pt/entrar');
  signIn.searchParams.set('next', isPortalHost ? url.pathname : url.pathname.replace(/^\/eu(?=\/|$)/, '') || '/');

  return Response.redirect(signIn, 302);
}
