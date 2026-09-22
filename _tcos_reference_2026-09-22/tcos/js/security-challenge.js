/* One small adapter for Cloudflare Turnstile. Every protected form names an
   action, and the Worker verifies the same action and the TCOS hostname.
   When rollout is disabled the adapter is a no-op, so staging can receive
   the code before a site key or secret is configured. */
(() => {
  const states = new Map();
  let loader = null;

  const loadScript = () => {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (loader) return loader;
    loader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => window.turnstile ? resolve(window.turnstile) :
        reject(new Error('The security check did not load. Refresh and try again.'));
      script.onerror = () => reject(new Error(
        'The security check could not load. Check your connection and refresh.'));
      document.head.appendChild(script);
    });
    return loader;
  };

  async function setup(elementId, action, apiBase) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const state = { action, enabled: false, token: null, widgetId: null, ready: null };
    states.set(action, state);

    state.ready = (async () => {
      const response = await fetch(apiBase.replace(/\/+$/, '') + '/security/challenge', {
        headers: { Accept: 'application/json' }
      });
      const config = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(config.message || 'The security check is unavailable.');
      if (!config.enabled) { element.hidden = true; return; }
      if (!config.siteKey) throw new Error('The security check is not configured.');

      state.enabled = true;
      element.hidden = false;
      const turnstile = await loadScript();
      state.widgetId = turnstile.render(element, {
        sitekey: config.siteKey,
        action,
        callback: token => { state.token = token; },
        'expired-callback': () => { state.token = null; },
        'error-callback': () => { state.token = null; }
      });
    })();
    return state.ready;
  }

  async function token(action) {
    const state = states.get(action);
    if (!state) return null;
    await state.ready;
    if (!state.enabled) return null;
    if (!state.token) throw new Error('Complete the security check and try again.');
    return state.token;
  }

  function reset(action) {
    const state = states.get(action);
    if (!state || !state.enabled) return;
    state.token = null;
    if (window.turnstile && state.widgetId != null) window.turnstile.reset(state.widgetId);
  }

  window.TCOSChallenge = { setup, token, reset };
})();
