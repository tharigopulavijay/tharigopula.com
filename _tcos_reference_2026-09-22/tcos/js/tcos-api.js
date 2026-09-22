/* =========================================================================
   TCOS API client.

   Replaces the localStorage prototype (js/tcos-store.js) for everything a
   doctor does. The function names deliberately match what the prototype
   exposed, so the screens read the same.

   Secure same-origin deployments keep the opaque credential in a host-only
   HttpOnly cookie; JavaScript keeps only a non-secret CSRF value and a UI
   marker. The legacy bearer path remains temporarily for production. The
   server stores only hashes, and the browser never decides which doctor it
   is.
   ========================================================================= */
(() => {
  const STAGING_APP_HOST = 'staging.tcos.tharigopula.com';
  const ON_OLD_STAGING = location.hostname === 'tcos-staging.pages.dev' ||
    location.hostname.endsWith('.tcos-staging.pages.dev');
  /* The old Pages address cannot receive the host-only Worker cookie. Keep it
     as a redirect only so bookmarks move to the secure, same-origin app. */
  if (ON_OLD_STAGING) {
    location.replace('https://' + STAGING_APP_HOST +
      location.pathname + location.search + location.hash);
  }
  const DEFAULT_BASE = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://127.0.0.1:8787'
    /* Pages branch aliases are subdomains of the project hostname, e.g.
       main.tcos-staging.pages.dev. Checking only the bare project hostname
       silently sent branch previews to production. */
    : (location.hostname === STAGING_APP_HOST || ON_OLD_STAGING)
      ? 'https://' + STAGING_APP_HOST
    /* The real API. It was pointed at the AyurCOS *demo* worker during the
       fork, which meant a production build talked to demo data. */
      : 'https://tcos-api.hello-tharigopula.workers.dev';

  const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

  /* Overridable only while developing locally:

       localStorage.setItem('tcos-api-base', 'http://127.0.0.1:8787')

     A past support session left this value in a real browser. Because
     localStorage survives deployments, that browser kept calling a dead
     development address and every valid login appeared offline. A public
     TCOS page must always use the API selected by its hostname. */
  const base = () => {
    try {
      if (IS_LOCAL) return localStorage.getItem('tcos-api-base') || DEFAULT_BASE;
      localStorage.removeItem('tcos-api-base');
      return DEFAULT_BASE;
    }
    catch (_) { return DEFAULT_BASE; }
  };

  const TOKEN_KEY = 'tcos-token';
  const SESSION_MARKER_KEY = 'tcos-session-present';
  const CSRF_KEY = 'tcos-csrf';
  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; } };
  const getCsrf = () => { try { return localStorage.getItem(CSRF_KEY); } catch (_) { return null; } };
  const hasSessionMarker = () => {
    try { return localStorage.getItem(SESSION_MARKER_KEY) === '1'; } catch (_) { return false; }
  };
  const clearSession = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_MARKER_KEY);
      localStorage.removeItem(CSRF_KEY);
    } catch (_) {}
  };
  const acceptSession = result => {
    try {
      if (result.token) localStorage.setItem(TOKEN_KEY, result.token);
      else localStorage.removeItem(TOKEN_KEY);
      localStorage.setItem(SESSION_MARKER_KEY, '1');
      if (result.csrfToken) localStorage.setItem(CSRF_KEY, result.csrfToken);
    } catch (_) {}
  };

  /* One place where every request is shaped, so the Authorization header can
     never be forgotten on a new call. */
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
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
        credentials: 'include'
      });
    } catch (_) {
      throw new ApiClientError('offline',
        /* Named by the product the visitor is actually looking at, so the
           message does not mention a product they have never heard of. */
        'Could not reach ' +
        ((window.TCOSProduct && window.TCOSProduct.name) || 'the server') +
        '. Check your connection and try again.');
    }

    let data = {};
    try { data = await response.json(); } catch (_) { /* empty body is fine */ }

    if (!response.ok) {
      if (response.status === 401 || data.error === 'csrf_failed') clearSession();
      throw new ApiClientError(data.error || 'error',
        data.message || 'Something went wrong. Try again.', response.status);
    }
    return data;
  }

  /* Files go up as multipart, so this cannot reuse request() above: setting
     Content-Type by hand on a FormData body omits the boundary the browser
     generates, and the server then cannot parse a single field. Letting
     fetch set it is the whole trick. */
  async function upload(path, formData, onProgress) {
    const token = getToken();

    /* XHR rather than fetch, only because fetch still cannot report upload
       progress - and a doctor sending a 10MB scan on clinic wifi needs to
       see that something is happening. */
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', base() + path);
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      const csrf = getCsrf();
      if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);
      xhr.withCredentials = true;

      if (onProgress) {
        xhr.upload.addEventListener('progress', event => {
          if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
        });
      }

      xhr.addEventListener('load', () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
        if (xhr.status === 401 || data.error === 'csrf_failed') clearSession();
        reject(new ApiClientError(data.error || 'error',
          data.message || 'That upload did not go through.', xhr.status));
      });
      xhr.addEventListener('error', () => reject(new ApiClientError('offline',
        'Could not reach the server. Check your connection and try again.')));

      xhr.send(formData);
    });
  }

  class ApiClientError extends Error {
    constructor(code, message, status) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }

  const get = path => request('GET', path);
  /* Drops empty values, so an unset filter never becomes "?from=" - which
     the server would read as a date and reject. */
  const query = params => {
    const pairs = Object.entries(params || {}).filter(([, v]) => v != null && v !== '');
    return pairs.length ? '?' + new URLSearchParams(pairs).toString() : '';
  };
  const post = (path, payload) => request('POST', path, payload);

  const TCOSApi = {
    ApiClientError,
    baseUrl: base,
    isSignedIn: () => !!getToken() || hasSessionMarker(),

    /* ---- joining ----
       apply() is how a doctor actually joins: it records an application for
       a human to verify and creates nothing she can sign into. The two
       signup* calls below are the old self-signup path; the server now
       refuses both, and they are kept only so an old cached page shows an
       explanation rather than failing silently. */
    apply: details => post('/apply', details),

    signupStart: identifier => post('/auth/signup/start', { identifier }),
    signupVerify: details => post('/auth/signup/verify', details),

    /* ---- sign in ---- */
    /* ---- passkeys: her phone's own fingerprint, face or lock ----
       `post` is what js/passkeys.js calls. */
    post: (path, payload) => post(path, payload),
    listPasskeys: () => get('/passkeys'),
    removePasskey: id => request('DELETE', '/passkeys/' + encodeURIComponent(id)),
    async signInWithPasskey() {
      const result = await window.TCOSPasskeys.signIn(window.TCOSApi, {
        challenge: '/auth/passkey/challenge',
        verify: '/auth/passkey'
      });
      acceptSession(result);
      return result;
    },
    enrolPasskey: label => window.TCOSPasskeys.enrol(window.TCOSApi, {
      challenge: '/passkeys/challenge',
      register: '/passkeys'
    }, label),

    /* rememberDevice keeps her signed in on this device for a month instead
       of twelve hours. Her choice, and off unless the box was ticked. */
    async signIn(identifier, password, turnstileToken, rememberDevice) {
      const result = await post('/auth/signin', {
        identifier, password, turnstileToken, rememberDevice: rememberDevice === true
      });
      acceptSession(result);
      return result;
    },

    async signOut() {
      try { await post('/auth/signout'); } catch (_) { /* leaving anyway */ }
      clearSession();
    },

    /* ---- password reset by OTP ---- */
    resetStart: (identifier, turnstileToken) =>
      post('/auth/reset/start', { identifier, turnstileToken }),
    resetVerify: (identifier, code, newPassword) =>
      post('/auth/reset/verify', { identifier, code, newPassword }),

    /* ---- the signed-in doctor ---- */
    me: () => get('/me'),

    /* ---- TCOS plan payment ----
       Checkout is hosted by Razorpay. The browser receives only the hosted
       URL; mandate and card details never pass through TCOS. */
    subscription: () => get('/subscription'),
    startSubscription: selected => post('/subscription/checkout', selected),
    refreshSubscription: () => post('/subscription/refresh'),
    cancelSubscription: () => post('/subscription/cancel'),

    /* --- money --- */
    invoices: params => get('/invoices' + query(params)),
    invoice: id => get('/invoices/' + encodeURIComponent(id)),
    createInvoice: payload => post('/invoices', payload),
    updateInvoice: (id, payload) => request('PATCH', '/invoices/' + encodeURIComponent(id), payload),
    issueInvoice: id => post('/invoices/' + encodeURIComponent(id) + '/issue'),
    cancelInvoice: (id, reason) => post('/invoices/' + encodeURIComponent(id) + '/cancel', { reason }),
    addPayment: (id, payment) => post('/invoices/' + encodeURIComponent(id) + '/payments', payment),
    addFee: fee => post('/fees', fee),
    removeFee: id => request('DELETE', '/fees/' + encodeURIComponent(id)),

    /* --- everything issued, and how the practice is doing --- */
    prescriptionList: params => get('/prescriptions' + query(params)),
    reports: params => get('/reports' + query(params)),
    diagnostics: () => get('/diagnostics'),

    /* --- who else may use this clinic --- */
    team: () => get('/team'),
    addStaff: person => post('/team', person),
    resetStaffPassword: id => post('/team/' + encodeURIComponent(id) + '/reset'),
    setStaffStatus: (id, status) => post('/team/' + encodeURIComponent(id) + '/status', { status }),
    setStaffCapabilities: (id, capabilities) => request('PATCH',
      '/team/' + encodeURIComponent(id) + '/capabilities', { capabilities }),
    async changePassword(currentPassword, newPassword) {
      const result = await post('/auth/change-password', { currentPassword, newPassword });
      /* The server still revokes every session opened with the OLD password -
         a stolen token has to die the moment the password changes - but it
         now issues a replacement for this one in the same response. So this
         stores the new token rather than clearing and bouncing her to the
         sign-in screen.
       *
         It used to clearSession() here, matching a server that left her with
         nothing. That made the forced first-login password change throw every
         new doctor straight back out: she set a password and the next click
         said "sign in again", however many times she tried. */
      if (result && (result.token || result.csrfToken)) acceptSession(result);
      else clearSession();
      return result;
    },

    /* The medicine catalogue she types against. Shared reference data, not
       her own records, so nothing here is scoped to her clinic. */
    searchDrugs: (term, system) => get('/drugs?q=' + encodeURIComponent(term) +
      (system ? '&system=' + encodeURIComponent(system) : '')),
    updateMe: patch => request('PATCH', '/me', patch),
    supportRequests: () => get('/support'),
    createSupportRequest: details => post('/support', details),
    supportRequest: id => get('/support/' + encodeURIComponent(id)),
    replySupportRequest: (id, message) => post(
      '/support/' + encodeURIComponent(id) + '/messages', { message }),

    /* ---- patients ---- */
    listPatients: () => get('/patients'),
    lookupHousehold: mobile => get('/patients/lookup?mobile=' + encodeURIComponent(mobile)),
    addPatient: patient => post('/patients', patient),
    getPatient: id => get('/patients/' + encodeURIComponent(id)),
    setAbha: (id, abha) =>
      request('PUT', '/patients/' + encodeURIComponent(id) + '/abha', abha),
    setWhatsappConsent: (id, agreed) =>
      request('PUT', '/patients/' + encodeURIComponent(id) + '/whatsapp', { agreed }),
    /* ---- the scribe ----
       Consent is a route call, not a client-side flag: the row exists before
       the microphone opens, so there is no path that records without one. */
    startConsultNote: patientId => post('/consult-notes', { patientId }),
    consultNote: id => get('/consult-notes/' + encodeURIComponent(id)),
    /* The recording is sent, transcribed and DELETED inside this one call.
       It is deliberately not stored anywhere the browser can re-send it. */
    sendConsultAudio: (id, blob, seconds, onProgress) => {
      const form = new FormData();
      form.append('audio', blob, 'consultation.webm');
      form.append('seconds', String(Math.round(seconds)));
      return upload('/consult-notes/' + encodeURIComponent(id) + '/audio', form, onProgress);
    },
    discardConsultNote: id =>
      post('/consult-notes/' + encodeURIComponent(id) + '/reject'),
    listMessages: () => get('/messages'),
    /* Tomorrow's list with a wa.me link per patient, for the front desk to
       tap through before the WhatsApp API is approved. */
    reminderLinks: day => get('/messages/links' + (day ? '?day=' + encodeURIComponent(day) : '')),
    sendReminders: day => post('/messages/reminders', { day }),
    sendRecordReady: (patientId, what) =>
      post('/messages/record-ready', { patientId, what }),
    sharePatient: (id, ttlDays) => post('/patients/' + encodeURIComponent(id) + '/share', { ttlDays }),
    listShareLinks: id => get('/patients/' + encodeURIComponent(id) + '/share'),
    revokeShareLink: (id, linkId) =>
      post('/patients/' + encodeURIComponent(id) + '/share/' + encodeURIComponent(linkId) + '/revoke'),

    /* ---- consent: the patient unlocks their own history ---- */
    requestConsent: patientMobile => post('/consent/request', { patientMobile }),
    approveConsent: (patientMobile, code, patientName) =>
      post('/consent/approve', { patientMobile, code, patientName }),
    sharedHistory: patientId => get('/patients/' + encodeURIComponent(patientId) + '/shared-history'),

    /* ---- visits and prescriptions ---- */
    createVisit: visit => post('/visits', visit),

    /* The diet, lifestyle and exercise plan for one consultation. */
    carePlan: visitId => get('/visits/' + encodeURIComponent(visitId) + '/care-plan'),
    saveCarePlan: (visitId, plan) =>
      request('PUT', '/visits/' + encodeURIComponent(visitId) + '/care-plan', plan),
    /* A short-lived, write-only link the patient scans to send photos of
       a report into her own record. */
    createUploadLink: patientId =>
      post('/patients/' + encodeURIComponent(patientId) + '/upload-link'),
    setAllergies: (patientId, allergies) =>
      request('PUT', '/patients/' + encodeURIComponent(patientId) + '/allergies', { allergies }),

    /* The half-written consultation. A scratchpad the desk writes as she
       types and clears the moment she saves properly - never a record, and
       gone by itself after a day. */
    consultationDraft: patientId =>
      get('/patients/' + encodeURIComponent(patientId) + '/consultation-draft'),
    saveConsultationDraft: (patientId, payload) =>
      request('PUT', '/patients/' + encodeURIComponent(patientId) + '/consultation-draft',
        { payload }),
    clearConsultationDraft: patientId =>
      request('DELETE', '/patients/' + encodeURIComponent(patientId) + '/consultation-draft'),
    openConsultationDrafts: () => get('/consultation-drafts'),

    createPrescription: rx => post('/prescriptions', rx),
    getPrescription: id => get('/prescriptions/' + encodeURIComponent(id)),
    savePrescriptionItems: (id, items, visitId) => request(
      'PATCH', '/prescriptions/' + encodeURIComponent(id), { items, visitId }),
    issuePrescription: id => post('/prescriptions/' + encodeURIComponent(id) + '/issue'),
    amendPrescription: (id, reason, items) => post('/prescriptions/' + encodeURIComponent(id) + '/amend', { reason, items }),
    dispensingFor: id => get('/prescriptions/' + encodeURIComponent(id) + '/dispensing'),

    /* ---- public page ---- */
    publicPageSettings: () => get('/me/public-page'),

    /* ---- files ----
       The bytes are served through the authenticated API rather than from a
       public R2 URL. */
    uploadFile: (file, { kind, patientId, labReportId } = {}, onProgress) => {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind || 'attachment');
      if (patientId) form.append('patientId', patientId);
      if (labReportId) form.append('labReportId', labReportId);
      return upload('/files', form, onProgress);
    },
    listFiles: params => get('/files' + query(params)),
    removeFile: (id, reason) =>
      request('DELETE', '/files/' + encodeURIComponent(id), { reason }),

    /* Fetched with the Authorization header and turned into a blob URL,
       rather than putting the session token in a query string where it
       would end up in browser history, referrer headers and any log between
       here and Cloudflare. The caller revokes the URL when done. */
    async openFile(id) {
      const token = getToken();
      const response = await fetch(base() + '/files/' + encodeURIComponent(id), {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        credentials: 'include'
      });
      if (!response.ok) {
        let data = {};
        try { data = await response.json(); } catch (_) {}
        throw new ApiClientError(data.error || 'error',
          data.message || 'That file could not be opened.', response.status);
      }
      const blob = await response.blob();
      return { url: URL.createObjectURL(blob), type: blob.type, size: blob.size };
    },

    /* ---- reading a report with AI ----
       readReport returns a DRAFT and writes nothing to the chart.
       confirmDraft is what creates the record, and it sends the values the
       doctor has AFTER correcting them - never the draft copied across on
       trust. That asymmetry is the whole design; keep it visible here. */
    preflightReport: (fileId, patientId) => post('/ai/preflight', { fileId, patientId }),
    approvePreflight: (id, note) =>
      post('/ai/preflights/' + encodeURIComponent(id) + '/approve', { note }),
    rejectPreflight: (id, note) =>
      post('/ai/preflights/' + encodeURIComponent(id) + '/reject', { note }),
    readReport: preflightId => post('/ai/read-report', { preflightId }),
    listDrafts: params => get('/ai/drafts' + query(params)),
    draft: id => get('/ai/drafts/' + encodeURIComponent(id)),
    confirmDraft: (id, report) => post('/ai/drafts/' + encodeURIComponent(id) + '/confirm', report),
    rejectDraft: (id, reason) => post('/ai/drafts/' + encodeURIComponent(id) + '/reject', { reason }),

    /* ---- when the clinic is open ----
       Closures are separate from the weekly pattern on purpose: an exception
       expires by itself, an edited pattern does not. */
    listClosures: () => get('/me/closures'),
    addClosure: details => post('/me/closures', details),
    removeClosure: id => request('DELETE', '/me/closures/' + encodeURIComponent(id)),

    /* ---- her own examination fields ----
       The practice packs are our guess at what a doctor examines. These are
       hers: unlimited, added from inside a consultation, and separate from
       rxLayout, which is the six of them that fit on the paper. */
    clinicFields: () => get('/me/fields'),
    addClinicField: label => post('/me/fields', { label }),
    removeClinicField: id => request('DELETE', '/me/fields/' + encodeURIComponent(id)),
    setRxLayout: fields => request('PUT', '/me/rx-layout', { fields }),

    /* ---- her own web address ----
       The free subdomain always works; the custom domain is additional and
       only serves once its DNS resolves. */
    domain: () => get('/me/domain'),
    claimDomain: domain => post('/me/domain', { domain }),
    checkDomain: () => post('/me/domain/check', {}),
    releaseDomain: () => request('DELETE', '/me/domain'),
    savePublicPage: settings => post('/me/public-page', settings),
    listRequests: () => get('/requests'),
    acceptRequest: (id, payload) => post('/requests/' + encodeURIComponent(id) + '/accept', payload || {}),
    declineRequest: id => post('/requests/' + encodeURIComponent(id) + '/decline'),

    /* ---- appointments ---- */
    appointments: day => get('/appointments' + (day ? '?day=' + encodeURIComponent(day) : '')),
    bookAppointment: appointment => post('/appointments', appointment),
    setAppointmentStatus: (id, status, reason) =>
      post('/appointments/' + encodeURIComponent(id) + '/status', { status, reason }),
    rescheduleAppointment: (id, scheduledOn, scheduledAt) =>
      post('/appointments/' + encodeURIComponent(id) + '/reschedule', { scheduledOn, scheduledAt }),
    patientAppointments: id => get('/patients/' + encodeURIComponent(id) + '/appointments'),

    /* ---- lab reports ---- */
    addLabReport: report => post('/lab-reports', report),
    getLabReport: id => get('/lab-reports/' + encodeURIComponent(id)),
    verifyLabReport: id => post('/lab-reports/' + encodeURIComponent(id) + '/verify'),
    labSeries: patientId => get('/patients/' + encodeURIComponent(patientId) + '/lab-series'),

    /* ---- pharmacy ---- */
    stock: () => get('/stock'),
    addStockItem: item => post('/stock/items', item),
    batchesFor: id => get('/stock/items/' + encodeURIComponent(id) + '/batches'),
    receiveBatch: batch => post('/stock/batches', batch),
    dispense: payload => post('/stock/dispense', payload),
    quarantineBatch: (id, reason, idempotencyKey) =>
      post('/stock/batches/' + encodeURIComponent(id) + '/quarantine', { reason, idempotencyKey }),
    writeOffBatch: (id, reason, idempotencyKey) =>
      post('/stock/batches/' + encodeURIComponent(id) + '/write-off', { reason, idempotencyKey }),

    health: () => get('/health')
  };




  window.TCOSApi = TCOSApi;
})();
