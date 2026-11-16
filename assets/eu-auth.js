// Single sign-on for *.gustavodev.pt with Vida's Supabase account. The session lives in cookies on
// .gustavodev.pt (not localStorage), so every subdomain that loads this file shares one sign-in.
// The publishable key is public by design: row-level security protects the data.
(function () {
  var SUPABASE_URL = 'https://fdmhaiwrechavluumeym.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_TC_D6gGODob7Tp7Ea-zWXg_Rwh7HJX1';
  var CHUNK = 3000;
  var isGustavodev = /(^|\.)gustavodev\.pt$/.test(location.hostname);
  var domain = isGustavodev ? '; Domain=.gustavodev.pt' : '';
  var secure = location.protocol === 'https:' ? '; Secure' : '';

  function readCookie(name) {
    var prefix = name + '=';
    var parts = document.cookie.split('; ');

    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].indexOf(prefix) === 0) {
        return decodeURIComponent(parts[i].slice(prefix.length));
      }
    }

    return null;
  }

  function writeCookie(name, value, maxAge) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax' + domain + secure;
  }

  // Cookies hold about 4 KB each, so a session is split across numbered cookies.
  var cookieStorage = {
    getItem: function (key) {
      var count = Number(readCookie(key + '.n'));

      if (!count) {
        return null;
      }

      var value = '';

      for (var i = 0; i < count; i += 1) {
        var part = readCookie(key + '.' + i);

        if (part === null) {
          return null;
        }

        value += part;
      }

      return value;
    },
    setItem: function (key, value) {
      cookieStorage.removeItem(key);
      var count = Math.ceil(value.length / CHUNK);

      for (var i = 0; i < count; i += 1) {
        writeCookie(key + '.' + i, value.slice(i * CHUNK, (i + 1) * CHUNK), 60 * 60 * 24 * 30);
      }

      writeCookie(key + '.n', String(count), 60 * 60 * 24 * 30);
    },
    removeItem: function (key) {
      var count = Number(readCookie(key + '.n')) || 0;

      for (var i = 0; i < count; i += 1) {
        writeCookie(key + '.' + i, '', 0);
      }

      writeCookie(key + '.n', '', 0);
    },
  };

  window.euClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage: cookieStorage,
      storageKey: 'gd-auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  /** Resolves with the signed-in session, or sends the visitor to the portal's sign-in page. */
  window.requireSession = async function () {
    var result = await window.euClient.auth.getSession();
    var session = result.data.session;

    if (!session) {
      location.replace('/entrar?next=' + encodeURIComponent(location.pathname));
      return null;
    }

    return session;
  };
})();
