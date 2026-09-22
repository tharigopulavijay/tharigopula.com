/* Platform console API client. Kept separate from js/tcos-api.js on purpose:
   a different protected cookie/legacy key and a different endpoint set.
   Mixing them is how an admin credential ends up on a doctor screen. */
(() => {
  const STAGING_APP_HOST = 'staging.tcos.tharigopula.com';
  /* MOVED 20 Sep 2026, off the hostname Cloudflare Access guards.
   *
     Vijay, from his phone: "no passkeys available - there arent any
     passkeys for tharigopula.cloudflareaccess.com on this device." Access
     sits in front of admin.tcos.tharigopula.com at the EDGE, so no Worker
     setting can move it, and its login had begun demanding a passkey he
     does not have on that device. The console now answers on an address
     Access was never placed in front of. */
  /* console.tharigopula.com was the intent, and Cloudflare accepted the
     custom domain but never published its DNS - twenty minutes and a
     second triggers deploy later, 1.1.1.1 still says NXDOMAIN. This host
     resolves today, serves the console AND its API from one origin, and
     has no Access application in front of it. One line to move back. */
  const PRODUCTION_ADMIN_HOST = 'tcos-api.hello-tharigopula.workers.dev';
  const ON_OLD_STAGING = location.hostname === 'tcos-staging.pages.dev' ||
    location.hostname.endsWith('.tcos-staging.pages.dev');
  /* Addresses that cannot serve the console themselves - the Pages host
     cannot receive the Worker's host-only cookie, and the old address is
     behind Cloudflare Access. Both are sent to the one that works. */
  const ON_LEGACY_PRODUCTION = location.hostname === 'tcos.pages.dev' ||
    location.hostname.endsWith('.tcos.pages.dev') ||
    location.hostname === 'admin.tcos.tharigopula.com';
  /* The legacy Pages hostname cannot receive the Worker's host-only cookie.
     Keep old bookmarks useful, but never run the platform console there. */
  if (ON_OLD_STAGING) {
    location.replace('https://' + STAGING_APP_HOST +
      location.pathname + location.search + location.hash);
  } else if (ON_LEGACY_PRODUCTION) {
    location.replace('https://' + PRODUCTION_ADMIN_HOST +
      location.pathname + location.search + location.hash);
  }
  /* Resolved the same way js/tcos-api.js resolves it, so the console and
     the app can never end up talking to different workers. It was pinned to
     tcos-demo-api, which no longer answers - so the console could not be
     opened locally at all, and in production would have been reading demo
     data. Overridable for local work with
     localStorage.setItem('tcos-api-base', 'http://127.0.0.1:8787'). */
  const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const DEFAULT_BASE = IS_LOCAL
    ? 'http://127.0.0.1:8787'
    : (location.hostname === STAGING_APP_HOST || ON_OLD_STAGING)
      ? 'https://' + STAGING_APP_HOST
      : 'https://' + PRODUCTION_ADMIN_HOST;
  const base = () => {
    try {
      if (IS_LOCAL) return localStorage.getItem('tcos-api-base') || DEFAULT_BASE;
      localStorage.removeItem('tcos-api-base');
      return DEFAULT_BASE;
    }
    catch (_) { return DEFAULT_BASE; }
  };
  const KEY = 'tcos-admin-token';
  const SESSION_MARKER_KEY = 'tcos-admin-session-present';
  const CSRF_KEY = 'tcos-admin-csrf';

  const getToken = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
  const getCsrf = () => { try { return localStorage.getItem(CSRF_KEY); } catch (_) { return null; } };
  const hasSessionMarker = () => {
    try { return localStorage.getItem(SESSION_MARKER_KEY) === '1'; } catch (_) { return false; }
  };
  const clearSession = () => {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(SESSION_MARKER_KEY);
      localStorage.removeItem(CSRF_KEY);
    } catch (_) {}
  };
  const acceptSession = result => {
    try {
      if (result.token) localStorage.setItem(KEY, result.token);
      else localStorage.removeItem(KEY);
      localStorage.setItem(SESSION_MARKER_KEY, '1');
      if (result.csrfToken) localStorage.setItem(CSRF_KEY, result.csrfToken);
    } catch (_) {}
  };

  class AdminError extends Error {
    constructor(code, message, status) { super(message); this.code = code; this.status = status; }
  }

  async function request(method, path, payload) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    const csrf = getCsrf();
    if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      headers['X-CSRF-Token'] = csrf;
    }
    let response;
    try {
      response = await fetch(base() + path, {
        method, headers, body: payload === undefined ? undefined : JSON.stringify(payload),
        credentials: 'include'
      });
    } catch (_) {
      /* When an Access cookie expires, Cloudflare redirects this fetch to its
         login domain. The browser correctly blocks that cross-origin redirect
         and exposes only a generic TypeError, which used to be misreported as
         an internet outage. Reloading the protected page starts the outer
         Access sign-in again and is the safe recovery. */
      if (!IS_LOCAL && path.startsWith('/admin/')) {
        throw new AdminError('access_session_expired',
          'Your secure Cloudflare Access session expired. Reload this page, complete secure sign-in, then try again.');
      }
      throw new AdminError('offline', 'Could not reach TCOS. Check your connection and try again.');
    }
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      if (response.status === 401 || data.error === 'csrf_failed') clearSession();
      throw new AdminError(data.error || 'error', data.message || 'Something went wrong.', response.status);
    }
    return data;
  }

  window.AdminApi = {
    AdminError,
    baseUrl: base,
    isSignedIn: () => !!getToken() || hasSessionMarker(),
    bootstrap: (email, password, turnstileToken) =>
      request('POST', '/admin/bootstrap', { email, password, turnstileToken }),
    recoverOwner: (email, password, turnstileToken) =>
      request('POST', '/admin/recover', { email, password, turnstileToken }),

    /* A code to the account's own email. Works from any device, needs no
       Cloudflare dashboard and no passkey - which is the point. */
    resetStart: email => request('POST', '/admin/reset/start', { email }),
    resetVerify: (email, code, newPassword) =>
      request('POST', '/admin/reset/verify', { email, code, newPassword }),
    async signIn(email, password, turnstileToken) {
      const result = await request('POST', '/admin/signin', { email, password, turnstileToken });
      acceptSession(result);
      return result;
    },
    reauthenticate: (password, turnstileToken) =>
      request('POST', '/admin/reauth', { password, turnstileToken }),

    /* ---- passkeys ----
       `post` is what js/passkeys.js calls; everything else here is the
       console's own vocabulary for the same endpoints. */
    post: (path, payload) => request('POST', path, payload),
    /* One customer in full - people, devices, plan, usage. Counts only;
       nothing clinical crosses this. */
    clinicOverview: id =>
      request('GET', '/admin/doctors/' + encodeURIComponent(id) + '/overview'),

    listPasskeys: () => request('GET', '/admin/passkeys'),
    removePasskey: id => request('DELETE', '/admin/passkeys/' + encodeURIComponent(id)),
    async signInWithPasskey() {
      const result = await window.TCOSPasskeys.signIn(window.AdminApi, {
        challenge: '/admin/passkeys/signin/challenge',
        verify: '/admin/passkeys/signin'
      });
      acceptSession(result);
      return result;
    },
    enrolPasskey: label => window.TCOSPasskeys.enrol(window.AdminApi, {
      challenge: '/admin/passkeys/challenge',
      register: '/admin/passkeys'
    }, label),
    async signOut() {
      try { await request('POST', '/admin/signout'); } catch (_) {}
      clearSession();
    },
    me: () => request('GET', '/admin/me'),
    changePassword: (currentPassword, newPassword) =>
      request('POST', '/admin/change-password', { currentPassword, newPassword }),
    listDoctors: () => request('GET', '/admin/doctors'),
    listPatients: () => request('GET', '/admin/patients'),
    patient: id => request('GET', '/admin/patients/' + encodeURIComponent(id)),
    healthAnalytics: () => request('GET', '/admin/analytics/health'),
    dashboard: () => request('GET', '/admin/dashboard'),
    domains: () => request('GET', '/admin/domains'),
    setDomainAllowed: (id, allowed) => request('POST', '/admin/domains/' + encodeURIComponent(id), { allowed }),
    listCoupons: () => request('GET', '/admin/coupons'),
    createCoupon: details => request('POST', '/admin/coupons', details),
    updateCoupon: (id, patch) => request('PATCH', '/admin/coupons/' + encodeURIComponent(id), patch),
    deleteCoupon: id => request('DELETE', '/admin/coupons/' + encodeURIComponent(id)),
    couponRedemptions: id => request('GET', '/admin/coupons/' + encodeURIComponent(id) + '/redemptions'),
    /* Revenue against estimated cost, per clinic and in total. */
    costs: month => request('GET', '/admin/costs' + (month ? '?month=' + encodeURIComponent(month) : '')),
    updateRate: (id, paisePerUnit) =>
      request('PATCH', '/admin/costs/rates/' + encodeURIComponent(id), { paisePerUnit }),
    addCost: cost => request('POST', '/admin/costs', cost),
    archiveCost: id => request('DELETE', '/admin/costs/' + encodeURIComponent(id)),
    subscriptions: () => request('GET', '/admin/subscriptions'),
    syncSubscriptionPlans: () => request('POST', '/admin/subscriptions/sync-plans'),
    /* Onboarding queue. approve() is the call that creates the account and
       returns the temporary password exactly once - it is not stored in
       readable form anywhere, so it has to be handed over there and then. */
    listApplications: status => request('GET',
      '/admin/applications' + (status ? '?status=' + encodeURIComponent(status) : '')),
    updateApplication: (id, patch) =>
      request('PATCH', '/admin/applications/' + encodeURIComponent(id), patch),
    approveApplication: (id, overrides) =>
      request('POST', '/admin/applications/' + encodeURIComponent(id) + '/approve', overrides || {}),
    /* Whether messages can actually go out. Read-only: it sends nothing and
       spends nothing, so it can be checked as often as you like. */
    smsHealth: () => request('GET', '/admin/sms-health'),
    listSupport: () => request('GET', '/admin/support'),
    support: id => request('GET', '/admin/support/' + encodeURIComponent(id)),
    updateSupport: (id, patch) => request('PATCH', '/admin/support/' + encodeURIComponent(id), patch),
    replySupport: (id, message, internal) => request('POST',
      '/admin/support/' + encodeURIComponent(id) + '/messages', { message, internal }),
    inviteDoctor: details => request('POST', '/admin/doctors', details),
    reissuePassword: id => request('POST', '/admin/doctors/' + encodeURIComponent(id) + '/reissue'),
    updateDoctor: (id, patch) => request('PATCH', '/admin/doctors/' + encodeURIComponent(id), patch),
    /* ---- twelve demonstration clinics ----
       One call per clinic: each password hash is ~10ms of CPU and a Worker
       request has 10ms of it, so twelve in one call is killed rather than
       slow. The console loops and shows each as it lands. */
    /* Who Cloudflare Access authenticated, read before sign-in so the form
       can say it rather than asking him to retype it. */
    accessIdentity: () => request('GET', '/admin/access-identity'),

    demoClinics: () => request('GET', '/admin/demo-clinics'),
    createDemoClinic: (key, password) => request('POST',
      '/admin/demo-clinics/' + encodeURIComponent(key), { password }),
    removeDemoClinics: () => request('DELETE', '/admin/demo-clinics'),

    listTeam: () => request('GET', '/admin/team'),
    addTeam: member => request('POST', '/admin/team', member),
    updateTeam: (email, patch) => request('PATCH',
      '/admin/team/' + encodeURIComponent(email), patch),
    removeTeam: email => request('DELETE', '/admin/team/' + encodeURIComponent(email))
  };
})();
