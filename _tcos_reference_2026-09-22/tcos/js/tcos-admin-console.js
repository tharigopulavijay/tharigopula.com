/* Platform console. Everything here reads across doctors, which is exactly
   what the console is for - but note it only ever shows names, plans and
   counts. No diagnosis, no prescription line, no lab value reaches this
   screen, because the API does not return them. */
(async () => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const note = (id, text, kind) => {
    document.getElementById(id).innerHTML = text
      ? '<div class="notice ' + kind + '" style="max-width:none">' + text + '</div>' : '';
  };
  const el = id => document.getElementById(id);

  const gate = document.getElementById('gate');
  const consoleEl = document.getElementById('console');

  /* ---- who does Cloudflare Access think you are? ----------------------
     Vijay, three times: "my user id is correct password also correct still
     not working." He was right every time, and the password was never
     reached: POST /admin/signin refuses outright unless the email typed
     here matches the one Access authenticated - and hello@tharigopula.com,
     hello.tharigopula@gmail.com and vijaytharigopula14@gmail.com are three
     addresses nobody can tell apart at a glance.

     The answer was in a request header the whole time and this page never
     showed it. It asked him to retype an address it already knew, then
     refused him for getting it wrong. So now it says it, fills it in, and
     - if no console account exists for that address - says THAT too,
     which is the sentence that ends the guessing. */
  (async () => {
    const box = el('accessIdentity');
    const field = el('adminEmail');
    if (!box || !field) return;
    let identity = null;
    try { identity = await AdminApi.accessIdentity(); }
    catch (_) { return; }          /* not behind Access, or offline: leave the form alone */

    /* WITH ACCESS OFF, OWNER RECOVERY CANNOT RUN AT ALL.
     *
       POST /admin/recover refuses outright unless Cloudflare Access is
       enforcing, so leaving the button on screen offers a way in that can
       only fail - and it is sitting directly under the one that works.
       Vijay has lost days to sign-in screens that were confidently wrong
       about what they could do; this is the same mistake in miniature.
       The emailed reset code above it replaces it entirely. */
    if (identity && identity.enforced === false) {
      const hint = el('bootstrapHint');
      const form = el('bootstrapForm');
      if (hint) hint.hidden = true;
      if (form) form.hidden = true;
    }

    if (!identity || !identity.enforced || !identity.email) return;

    field.value = identity.email;
    /* Read-only rather than disabled: a disabled input is not submitted,
       and the server needs this value to compare against. */
    field.readOnly = true;

    /* The RECOVERY form is filled in the same way and for the same reason.
       It also insists on matching the Access identity, so leaving it blank
       invited exactly the mistake the notice above exists to prevent - and
       recovery is the screen somebody reaches when they are already stuck. */
    const bootField = el('bootEmail');
    if (bootField) { bootField.value = identity.email; bootField.readOnly = true; }

    box.hidden = false;
    box.innerHTML = identity.hasAccount
      ? 'Cloudflare Access signed you in as <b>' + esc(identity.email) +
        '</b>. Enter the password for that account.'
      : 'Cloudflare Access signed you in as <b>' + esc(identity.email) +
        '</b>, but there is no console account for that address. ' +
        'No password will work here until one is created for it, or until ' +
        'you sign in to Access with the address your console account uses.';
  })();

  /* The fingerprint button on the gate. Shown only where the device can
     actually do it - see js/passkeys.js. */
  (async () => {
    const row = el('adminPasskeyRow');
    const button = el('adminPasskeySignIn');
    if (!row || !button || !window.TCOSPasskeys) return;
    if (!await TCOSPasskeys.platformAvailable()) return;
    row.hidden = false;
    button.addEventListener('click', async () => {
      note('gateMsg', 'Confirm with your fingerprint, face or device PIN…', 'info');
      button.disabled = true;
      try {
        await AdminApi.signInWithPasskey();
        location.reload();
      } catch (error) {
        note('gateMsg', esc(error.message), 'error');
      } finally { button.disabled = false; }
    });
  })();

  TCOSChallenge.setup('adminSignInChallenge', 'platform_signin', AdminApi.baseUrl())
    .catch(error => note('gateMsg', esc(error.message), 'error'));
  TCOSChallenge.setup('adminRecoveryChallenge', 'platform_recover', AdminApi.baseUrl())
    .catch(error => note('gateMsg', esc(error.message), 'error'));
  TCOSChallenge.setup('adminReauthChallenge', 'platform_reauth', AdminApi.baseUrl())
    .catch(error => note('reauthMsg', esc(error.message), 'error'));

  const reauthDialog = document.getElementById('reauthDialog');
  let reauthWait = null;
  let resolveReauth = null;
  let rejectReauth = null;

  function cancelReauth() {
    if (!reauthWait) return;
    reauthDialog.close();
    document.getElementById('reauthPassword').value = '';
    const reject = rejectReauth;
    reauthWait = resolveReauth = rejectReauth = null;
    reject(new AdminApi.AdminError('cancelled', 'Change cancelled.', 0));
  }

  function askForReauthentication() {
    if (reauthWait) return reauthWait;
    note('reauthMsg', '', '');
    reauthWait = new Promise((resolve, reject) => {
      resolveReauth = resolve;
      rejectReauth = reject;
    });
    reauthDialog.showModal();
    document.getElementById('reauthPassword').focus();
    return reauthWait;
  }

  async function runSensitive(operation) {
    try { return await operation(); }
    catch (error) {
      if (error.code !== 'reauth_required') throw error;
      await askForReauthentication();
      return operation();
    }
  }

  document.getElementById('reauthForm').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = document.getElementById('reauthSubmit');
    submit.disabled = true;
    try {
      await AdminApi.reauthenticate(
        document.getElementById('reauthPassword').value,
        await TCOSChallenge.token('platform_reauth'));
      const resolve = resolveReauth;
      reauthDialog.close();
      document.getElementById('reauthPassword').value = '';
      note('reauthMsg', '', '');
      reauthWait = resolveReauth = rejectReauth = null;
      resolve();
    } catch (error) {
      note('reauthMsg', esc(error.message), 'error');
      TCOSChallenge.reset('platform_reauth');
      document.getElementById('reauthPassword').select();
    } finally {
      submit.disabled = false;
    }
  });
  document.getElementById('reauthClose').addEventListener('click', cancelReauth);
  document.getElementById('reauthCancel').addEventListener('click', cancelReauth);
  reauthDialog.addEventListener('cancel', event => {
    event.preventDefault();
    cancelReauth();
  });

  /* ---------------- sign in ---------------- */

  document.getElementById('gateForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('gateSubmit');
    button.disabled = true;
    try {
      await AdminApi.signIn(
        document.getElementById('adminEmail').value.trim(),
        document.getElementById('adminPassword').value,
        await TCOSChallenge.token('platform_signin'));
      await open();
    } catch (error) {
      note('gateMsg', esc(error.message), 'error');
    } finally {
      TCOSChallenge.reset('platform_signin');
      button.disabled = false;
    }
  });

  document.getElementById('showBootstrap').addEventListener('click', () => {
    document.getElementById('bootstrapForm').hidden = false;
    document.getElementById('bootstrapHint').hidden = true;
  });

  /* ---- reset by emailed code ----

     Vijay: "what happens if the pc is lost or not working - i do nothing
     right?" This is the answer that depends on no device: a code to the
     address the account already has. */
  (() => {
    const hint = el('resetHint');
    const startForm = el('resetStartForm');
    const verifyForm = el('resetVerifyForm');
    const gateForm = el('gateForm');
    if (!hint || !startForm || !verifyForm) return;

    const show = which => {
      hint.hidden = which !== 'hint';
      startForm.hidden = which !== 'start';
      verifyForm.hidden = which !== 'verify';
      if (gateForm) gateForm.hidden = which === 'start' || which === 'verify';
    };

    el('showReset').addEventListener('click', () => {
      show('start');
      el('resetEmail').value = el('adminEmail').value || '';
      el('resetEmail').focus();
    });
    el('resetCancel').addEventListener('click', () => { show('hint'); note('gateMsg', ''); });

    startForm.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const result = await AdminApi.resetStart(el('resetEmail').value.trim());
        /* The same words whether or not the address is a console account,
           so this cannot be used to find out who is on the team. */
        note('gateMsg', 'If that address has a console account, a code is on its way to ' +
          esc(result.sentTo) + '.', 'success');
        show('verify');
        el('resetCode').focus();
      } catch (error) { note('gateMsg', esc(error.message), 'error'); }
    });

    verifyForm.addEventListener('submit', async event => {
      event.preventDefault();
      const password = el('resetNewPassword').value;
      if (password !== el('resetNewPasswordAgain').value) {
        return note('gateMsg', 'Those two passwords are not the same.', 'error');
      }
      try {
        await AdminApi.resetVerify(el('resetEmail').value.trim(),
          el('resetCode').value.trim(), password);
        note('gateMsg', 'That is set. Sign in with your new password.', 'success');
        show('hint');
        el('adminEmail').value = el('resetEmail').value.trim();
        el('adminPassword').focus();
      } catch (error) { note('gateMsg', esc(error.message), 'error'); }
    });
  })();

  document.getElementById('bootstrapForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const password = document.getElementById('bootPassword').value;
      if (password !== document.getElementById('bootPasswordConfirm').value) {
        throw new AdminApi.AdminError('password_mismatch', 'The two passwords do not match.', 400);
      }
      await AdminApi.recoverOwner(
        document.getElementById('bootEmail').value.trim(), password,
        await TCOSChallenge.token('platform_recover'));
      document.getElementById('bootstrapForm').hidden = true;
      note('gateMsg', 'Owner access recovered. Every old owner session was signed out.', 'ok');
      document.getElementById('adminEmail').value = document.getElementById('bootEmail').value;
      document.getElementById('adminPassword').focus();
    } catch (error) {
      note('gateMsg', esc(error.message), 'error');
    } finally {
      TCOSChallenge.reset('platform_recover');
    }
  });

  document.getElementById('adminSignOut').addEventListener('click', async () => {
    await AdminApi.signOut();
    location.reload();
  });

  /* ---------------- console ---------------- */

  let doctors = [];
  let adminMe = null;
  let platformTeam = [];
  const may = capability => adminMe &&
    (adminMe.role === 'owner' || (adminMe.capabilities || []).includes(capability));
  const platformPasswordDialog = document.getElementById('platformPasswordDialog');

  document.getElementById('platformPasswordForm').addEventListener('submit', async event => {
    event.preventDefault();
    const current = document.getElementById('platformCurrentPassword').value;
    const next = document.getElementById('platformNewPassword').value;
    if (next !== document.getElementById('platformNewPasswordAgain').value) {
      note('platformPasswordMsg', 'The two new passwords do not match.', 'error');
      return;
    }
    try {
      await AdminApi.changePassword(current, next);
      platformPasswordDialog.close();
      document.getElementById('platformPasswordForm').reset();
      await open();
    } catch (error) { note('platformPasswordMsg', esc(error.message), 'error'); }
  });

  async function open() {
    const me = await AdminApi.me();
    adminMe = me;
    document.getElementById('whoami').innerHTML =
      esc(me.name) + '<br><span style="opacity:.6">' + esc(me.role) + '</span>';
    gate.hidden = true;
    consoleEl.hidden = false;
    if (me.mustChangePassword) {
      if (!platformPasswordDialog.open) platformPasswordDialog.showModal();
      return;
    }
    const viewCapability = {
      applications: 'applications', doctors: 'doctors', patients: 'patients',
      business: 'analytics',
      webdomains: 'money',
      coupons: 'money',
      insights: 'analytics', money: 'money', subscriptions: 'subscriptions',
      delivery: 'delivery', support: 'support', team: 'team'
    };
    document.querySelectorAll('.rail button.nav').forEach(button => {
      button.hidden = !may(viewCapability[button.dataset.view]);
    });
    const allowed = Array.from(document.querySelectorAll('.rail button.nav:not([hidden])'));
    document.querySelectorAll('.rail button.nav').forEach(button => button.classList.remove('active'));
    document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = true; });

    /* THE SCREEN IN THE ADDRESS BAR.
       Vijay: "i want fixed link for everything."

       Every view now has its own URL - /admin#doctors, /admin#applications -
       so a screen can be bookmarked, reopened where he left it, and sent to
       somebody. It also means signing back in returns him to the screen he
       was on instead of dropping him on Business every time. */
    /* Built AFTER the rail has been filtered by capability, so a teammate
       never gets a tab to a screen the rail itself refuses to show. */
    paintTabBar();

    const asked = (location.hash || '').replace(/^#/, '');
    const start = allowed.find(b => b.dataset.view === asked) || allowed[0];
    if (start) showView(start.dataset.view, { silent: true });
    document.getElementById('costMonth').value = new Date().toISOString().slice(0, 7);
    document.getElementById('syncPaymentPlans').hidden = !may('subscriptions');
    document.getElementById('addCostBtn').hidden = !may('money');
    document.getElementById('addTeamBtn').hidden = !may('team');
    const loaders = [
      ['analytics', loadBusiness],
      ['money', loadCoupons],
      ['money', loadDomains],
      ['applications', loadApplications], ['doctors', loadDoctors],
      ['patients', loadPatients], ['analytics', loadInsights], ['money', loadCosts],
      ['subscriptions', loadSubscriptions], ['support', loadSupport],
      ['team', loadTeam], ['delivery', loadDelivery]
    ];
    await Promise.all(loaders.filter(([capability]) => may(capability))
      .map(([, loader]) => loader()));
  }

  document.getElementById('deliveryRefresh')
    .addEventListener('click', loadDelivery);
  document.getElementById('subscriptionRefresh')
    .addEventListener('click', loadSubscriptions);
  document.getElementById('syncPaymentPlans')
    .addEventListener('click', syncPaymentPlans);

  /* ---- one screen, one URL, and it stays fresh by itself --------------

     Two complaints, one mechanism:

       "i want fixed link for everything"           -> the hash is the view
       "the time something comes i shoudl get       -> the visible view
        directly not like i need to relogin"           reloads itself

     WHAT REFRESHES AND WHEN. Only the view actually on screen, and only
     while the tab is in front. A console left open on a second monitor all
     day would otherwise spend thousands of Workers requests a day on
     redrawing a screen nobody is looking at - and this account is on the
     free plan, where that budget is shared with every doctor's clinic.

     The moment he looks BACK at the tab it reloads immediately, which is
     what "directly" means in practice: you glance over and it is already
     right, rather than fresh every thirty seconds whether you are there or
     not. */
  const VIEW_LOADERS = {
    business: () => loadBusiness(),
    applications: () => loadApplications(),
    doctors: () => loadDoctors(),
    patients: () => loadPatients(),
    insights: () => loadInsights(),
    money: () => loadCosts(),
    subscriptions: () => loadSubscriptions(),
    webdomains: () => loadDomains(),
    coupons: () => loadCoupons(),
    delivery: () => loadDelivery(),
    support: () => loadSupport(),
    team: () => loadTeam()
  };

  let currentView = 'business';
  const REFRESH_MS = 30000;
  let refreshTimer = null;

  function showView(view, options) {
    const button = document.querySelector('.rail button.nav[data-view="' + view + '"]');
    if (!button || button.hidden) return;
    currentView = view;

    document.querySelectorAll('.rail button.nav').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    document.querySelectorAll('[data-panel]').forEach(panel => {
      panel.hidden = panel.dataset.panel !== view;
    });

    /* replaceState rather than assigning location.hash: assigning it pushes
       a history entry, so Back would walk him through every screen he had
       looked at instead of leaving the console. */
    if (location.hash !== '#' + view) {
      history.replaceState(null, '', location.pathname + location.search + '#' + view);
    }

    markTabBar();

    /* `silent` is the first paint, where everything has just been loaded in
       parallel and reloading it again would double every request. */
    if (!(options && options.silent)) refreshNow();
    scheduleRefresh();
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    if (document.hidden) return;
    refreshTimer = setTimeout(async () => {
      await refreshNow();
      scheduleRefresh();
    }, REFRESH_MS);
  }

  async function refreshNow() {
    /* Not signed in: the gate is showing and every call would be a 401.
       Polling a sign-in screen is how a console fills the log with noise. */
    if (!consoleEl || consoleEl.hidden) return;
    const loader = VIEW_LOADERS[currentView];
    if (!loader) return;
    /* Failures are swallowed on purpose. A background reload that pops an
       error banner over the screen he is reading - because the wifi blinked -
       is worse than a screen that is thirty seconds stale. A refresh he
       ASKED for still reports its errors; this one is not one of those. */
    try { await loader(); } catch (_) { /* the next tick tries again */ }
  }

  /* ---------------- the console on a phone ----------------

     Vijay, after finally getting in: "the app is worst, i am not even
     understanding what to do, and also i am not able to see the tabs,
     nothing. build like a real mobile app."

     He was looking at a screen with NO NAVIGATION AT ALL. Measured at
     375px: the rail sits at left:-292px - css/tcos.css turns it into a
     slide-out sheet below 760px - and the console never drew anything to
     open it. Twelve screens, all off the left edge, no handle. One panel
     showing and no way to reach the other eleven.

     Every piece needed for this already existed in css/tcos.css and has
     since the doctor app got its phone layout: .tabbar, the rail-as-sheet,
     body.rail-open, .rail-scrim, 56px targets, the home-indicator inset.
     The console simply never used them, because all of that is drawn by
     js/nav.js and the console does not load it.

     So the bar is built from THE RAIL'S OWN BUTTONS rather than a second
     list. A screen added to the rail appears here; one removed disappears.
     A hand-written copy would be right today and wrong by the next
     screen. */

  /* Four, then More. Five across is the most a 375px bar holds before the
     labels start being cut, and these are the four an owner opens daily:
     the business, who is waiting to be approved, the clinics themselves,
     and the money. Everything else lives one tap away under More. */
  const TAB_VIEWS = ['business', 'applications', 'doctors', 'money'];
  const TAB_ICONS = {
    business: 'reports', applications: 'today',
    doctors: 'patients', money: 'billing'
  };

  function paintTabBar() {
    if (document.querySelector('.tabbar')) return;

    /* The scrim closes the sheet by tapping beside it, which is what
       everybody tries first. */
    if (!document.querySelector('.rail-scrim')) {
      const scrim = document.createElement('div');
      scrim.className = 'rail-scrim';
      scrim.addEventListener('click', () => document.body.classList.remove('rail-open'));
      document.body.appendChild(scrim);
    }

    const bar = document.createElement('nav');
    bar.className = 'tabbar';
    bar.setAttribute('aria-label', 'Console sections');

    for (const view of TAB_VIEWS) {
      const source = document.querySelector('.rail button.nav[data-view="' + view + '"]');
      /* Hidden means this teammate's capabilities do not include it. A tab
         to a screen the rail refuses to show would be a button that opens
         nothing - showView returns early on a hidden button. */
      if (!source || source.hidden) continue;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.dataset.view = view;
      tab.dataset.icon = TAB_ICONS[view] || 'more';
      /* The rail button carries a count badge; the label is its text
         without that. */
      const label = (source.childNodes[0] && source.childNodes[0].textContent || view).trim();
      tab.innerHTML = '<span></span>';
      tab.querySelector('span').textContent = label;
      tab.addEventListener('click', () => {
        document.body.classList.remove('rail-open');
        showView(view);
      });
      bar.appendChild(tab);
    }

    /* More opens the rail itself - the same twelve, in the same order, so
       there is one list and it cannot drift from this bar. */
    const more = document.createElement('button');
    more.type = 'button';
    more.dataset.icon = 'more';
    more.innerHTML = '<span></span>';
    more.querySelector('span').textContent = 'More';
    more.addEventListener('click', () => document.body.classList.toggle('rail-open'));
    bar.appendChild(more);

    document.body.appendChild(bar);
    markTabBar();
  }

  /* Which tab is lit. A screen reached from More lights More, because that
     is where it was found. */
  function markTabBar() {
    const bar = document.querySelector('.tabbar');
    if (!bar) return;
    const tabs = [...bar.querySelectorAll('button')];
    tabs.forEach(tab => tab.classList.remove('active'));
    const hit = tabs.find(tab => tab.dataset.view === currentView);
    (hit || tabs[tabs.length - 1]).classList.add('active');
  }

  document.querySelectorAll('.rail button.nav').forEach(button =>
    button.addEventListener('click', () => {
      /* Chosen from the sheet: close it, or the screen he asked for is
         behind the thing he asked from. */
      document.body.classList.remove('rail-open');
      showView(button.dataset.view);
    }));

  /* Back, Forward, and a pasted link all land on the right screen. */
  window.addEventListener('hashchange', () => {
    const view = (location.hash || '').replace(/^#/, '');
    if (view && view !== currentView) showView(view);
  });

  /* Coming back to the tab is the signal that he wants to see it now. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(refreshTimer); return; }
    refreshNow();
    scheduleRefresh();
  });

  /* ---------------- delivery ----------------
     Names which of three different problems you have, because they have
     three different fixes: a key that is wrong, a wallet that is empty, and
     a DLT template that was never registered. "SMS is not working" is none
     of those, and is what somebody debugging this at 9pm would otherwise
     have to work from. */
  async function loadDelivery() {
    const body = document.getElementById('deliveryBody');
    body.innerHTML = '<div class="empty">Asking the provider…</div>';

    let health;
    try {
      health = await AdminApi.smsHealth();
    } catch (error) {
      note('deliveryMsg', esc(error.message), 'error');
      body.innerHTML = '<div class="empty">Could not check.</div>';
      return;
    }
    note('deliveryMsg', '', '');

    /* A balance we could not read is shown as unknown, never as zero. The
       MSG91 dashboard is the authority on how much money there is, and
       printing a nought here once told Vijay his payment had failed when
       ₹3,800 was sitting in the wallet. */
    const mail = health.email || {};

    /* Email first, deliberately. While DLT is pending it is the only route
       a verification code has, so it is the more urgent of the two - and
       putting SMS at the top made it look like the one that mattered. */
    const rows = [
      ['Email — Resend', mail.ok ? 'Ready' : 'Not ready', mail.reason || '', ''],
      ['SMS — MSG91', health.ok ? 'Ready' : 'Not ready', health.reason,
        health.balanceRupees != null ? '₹' + health.balanceRupees : 'see MSG91']
    ];

    /* Every message needs its own DLT-registered template, and the operator
       drops an unregistered one without telling anybody. So a missing
       template is shown before it is needed rather than discovered after. */
    Object.entries(health.templates || {}).forEach(([key, state]) => {
      rows.push(['· template: ' + key, state === 'ready' ? 'Ready' : 'Missing',
        state === 'ready' ? 'Registered.' : state, '']);
    });

    body.innerHTML =
      '<table><thead><tr><th>Channel</th><th>State</th><th>What it means</th>' +
      '<th style="text-align:right">Balance</th></tr></thead><tbody>' +
      rows.map(([name, state, reason, balance]) =>
        '<tr><td>' + esc(name) + '</td><td>' + esc(state) + '</td>' +
        '<td>' + esc(reason || '') + '</td>' +
        '<td style="text-align:right">' + esc(balance) + '</td></tr>').join('') +
      '</tbody></table>';
  }

  /* ---- twelve demonstration clinics ---------------------------------
     Three products by four packages. Built ONE AT A TIME on purpose: each
     password is 100,000 PBKDF2 rounds, about 10ms of CPU, and a Workers
     request has 10ms of it on the free plan. Twelve in one call is killed
     rather than slow.

     Doing it one at a time also means he watches twelve rows tick over
     instead of staring at a spinner, and a run that fails on the ninth has
     made eight real clinics rather than none. */
  async function loadDemoClinics() {
    const table = el('demoTable');
    if (!table) return;
    let clinics = [];
    try {
      clinics = (await AdminApi.demoClinics()).clinics || [];
    } catch (error) {
      table.innerHTML = '<div class="empty">' + esc(error.message) + '</div>';
      return;
    }

    const made = clinics.filter(c => c.exists).length;
    el('demoCount').textContent = made + ' of ' + clinics.length + ' created';

    const PRODUCT = { ayurcos: 'AyurCOS', homeocos: 'HomeoCOS', allocos: 'AlloCOS' };
    /* The set is a column rather than two tables. They are built by one
       button with one password, and splitting them would suggest two
       buttons that do not exist - but a row he is going to sign in to
       himself should not read as a fictional demonstration either. */
    table.innerHTML = '<table class="table"><thead><tr>' +
      '<th>Set</th><th>Product</th><th>Package</th><th>Clinic</th><th>Doctor</th>' +
      '<th>Sign in with</th><th>State</th></tr></thead><tbody>' +
      clinics.map(c =>
        '<tr data-demo-row="' + esc(c.key) + '">' +
          '<td>' + esc(c.setWord || 'Demonstration') + '</td>' +
          '<td>' + esc(PRODUCT[c.product] || c.product) + '</td>' +
          '<td>' + esc(c.planWord) + '</td>' +
          '<td>' + esc(c.clinicName) + '</td>' +
          '<td>' + esc(c.fullName) + '</td>' +
          /* The bare ten digits, because that is what he types into the
             sign-in box - not the +91 form the database stores. */
          '<td><code>' + esc(String(c.mobile).replace('+91', '')) + '</code></td>' +
          '<td class="demo-state">' + (c.exists
            ? (c.planMatches ? 'Ready' : 'Package changed by hand')
            : 'Not created') + '</td>' +
        '</tr>').join('') + '</tbody></table>';

    return clinics;
  }

  async function buildDemoClinics() {
    const password = el('demoPassword').value;
    if (!password || password.length < 10) {
      note('demoMsg', 'Choose a password of at least 10 characters. These are ' +
        'real accounts on the live system — only the clinics are made up.', 'error');
      return;
    }
    const clinics = await loadDemoClinics();
    if (!clinics) return;

    el('demoBuild').disabled = true;
    el('demoRemove').disabled = true;
    let done = 0, failed = 0;

    for (const clinic of clinics) {
      const row = document.querySelector('[data-demo-row="' + clinic.key + '"]');
      const cell = row && row.querySelector('.demo-state');
      if (cell) cell.textContent = 'Creating…';
      try {
        /* runSensitive handles the admin re-authentication prompt. It is
           asked for once and then held, so this does not stop twelve
           times. */
        await runSensitive(() => AdminApi.createDemoClinic(clinic.key, password));
        done++;
        if (cell) cell.textContent = 'Ready';
      } catch (error) {
        failed++;
        if (cell) cell.textContent = error.message;
      }
      note('demoMsg', done + ' of ' + clinics.length + ' ready' +
        (failed ? ', ' + failed + ' failed' : '') + '…', failed ? 'error' : 'info');
    }

    el('demoBuild').disabled = false;
    el('demoRemove').disabled = false;
    el('demoPassword').value = '';
    await loadDemoClinics();
    await loadDoctors();
    note('demoMsg', failed
      ? done + ' created, ' + failed + ' failed. Press again to finish the rest.'
      : 'All ' + done + ' ready. Sign in at the doctor app with the mobile ' +
        'number shown and the password you just set.', failed ? 'error' : 'ok');
  }

  if (el('demoBuild')) {
    el('demoBuild').addEventListener('click', buildDemoClinics);
    el('demoRemove').addEventListener('click', async () => {
      if (!confirm('Remove every seeded clinic?\n\n' +
        'That is the twelve demonstrations AND the three Vijay Hospital ' +
        'test accounts. Their patients, visits and prescriptions go with ' +
        'them. Real clinics are not touched.')) return;
      try {
        const result = await runSensitive(() => AdminApi.removeDemoClinics());
        note('demoMsg', 'Removed ' + result.removed + '.', 'ok');
        await loadDemoClinics();
        await loadDoctors();
      } catch (error) { note('demoMsg', esc(error.message), 'error'); }
    });
  }

  /* ---- approving one application --------------------------------------
     The package and the account type are both decisions taken at this exact
     moment and nowhere else, so both are asked for here. Anything preset is
     preset from what she actually applied for, because the reviewer is
     reading her application on the screen behind this box. */
  const approveDialog = el('approveDialog');
  let approving = null;

  const PLAN_FROM_MESSAGE = [
    [/\bpro_plus\b|\bGROUP\b/i, 'pro_plus'],
    [/\bpro\b|\bCLINIC package\b/i, 'pro'],
    [/\bstarter\b|\bPRACTICE\b/i, 'starter'],
    [/\bbasic\b|\bFREE\b/i, 'basic']
  ];

  function openApprove(application) {
    if (!application) return;
    approving = application;
    note('approveMsg', '');

    el('approveWho').innerHTML =
      '<b>' + esc(application.full_name) + '</b> · ' + esc(application.clinic_name) +
      '<br>Registration <b>' + esc(application.registration_no || 'none given') + '</b>' +
      ' · ' + esc(application.mobile || '') +
      '<br>Applying for <b>' + esc((application.discipline || '').toUpperCase()) + '</b>';

    /* If the application names a package - ours do, and a real doctor's
       message sometimes does - start there rather than making him read it
       off the row and pick it again. He can still change it. */
    const said = String(application.message || '');
    const guess = (PLAN_FROM_MESSAGE.find(([pattern]) => pattern.test(said)) || [])[1];
    el('appPlan').value = guess || 'basic';

    /* Live every time the box opens. Demo has to be chosen deliberately:
       the cost of a wrong 'live' is a doctor who is billed and complains,
       and the cost of a wrong 'demo' is a paying clinic that is never
       charged and nobody notices for months. */
    document.querySelector('input[name="approveAccountType"][value="live"]').checked = true;
    el('appRegisterChecked').checked = false;

    approveDialog.showModal();
  }

  if (approveDialog) {
    const closeApprove = () => { approveDialog.close(); approving = null; };
    el('approveClose').addEventListener('click', closeApprove);
    el('approveCancel').addEventListener('click', closeApprove);

    el('approveForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (!approving) return;
      const application = approving;
      const accountType = (document.querySelector(
        'input[name="approveAccountType"]:checked') || {}).value || 'live';

      el('approveGo').disabled = true;
      note('approveMsg', 'Creating the account…', 'info');
      try {
        const result = await runSensitive(() =>
          AdminApi.approveApplication(application.id, {
            plan: el('appPlan').value,
            accountType,
            registerChecked: el('appRegisterChecked').checked
          }));
        closeApprove();
        await loadApplications();
        await loadDoctors();
        /* The temporary password is shown ONCE and is not stored in
           readable form, so the handover box opens before anything else
           can take the screen. */
        showHandover(application.clinic_name, application.mobile, result.temporaryPassword);
      } catch (error) {
        note('approveMsg', esc(error.message), 'error');
      } finally { el('approveGo').disabled = false; }
    });
  }

  /* ---------------- one customer, opened ----------------

     Vijay: "i want to look into his account full access, like how many
     doctors and how many devices he is logging in and how many staffs he
     added, soo on. if doctor says this is not working we will have access
     to check."

     A support call is almost never answered by a patient's record. It is
     answered by: which package is she on, is she suspended, does the person
     complaining actually hold the capability, is she signed in anywhere,
     and did the thing she says she pressed leave a trace. All of that is
     here and none of it is clinical - patients, visits and prescriptions
     are counts, never rows. */
  const when = value => value
    ? new Date(value).toLocaleString('en-IN',
        { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

  /* A user agent is unreadable and she will not recognise it. The make of
     the thing is what she would say on the phone. */
  const deviceName = ua => {
    const s = String(ua || '');
    if (!s) return 'Unknown device';
    const os = /iPhone/i.test(s) ? 'iPhone' : /iPad/i.test(s) ? 'iPad'
      : /Android/i.test(s) ? 'Android' : /Macintosh/i.test(s) ? 'Mac'
      : /Windows/i.test(s) ? 'Windows' : 'Other';
    const browser = /Edg\//i.test(s) ? 'Edge' : /Chrome\//i.test(s) ? 'Chrome'
      : /Safari\//i.test(s) ? 'Safari' : /Firefox\//i.test(s) ? 'Firefox' : '';
    return browser ? os + ' · ' + browser : os;
  };

  const readableSize = bytes => {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return Math.round(n / 1024) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  };

  const rows = (items, draw) => items.length
    ? items.map(draw).join('')
    : '<div class="empty">None.</div>';

  for (const id of ['clinicClose', 'clinicDone']) {
    const control = el(id);
    if (control) control.addEventListener('click', () => el('clinicDialog').close());
  }

  async function openClinic(id) {
    const dialog = el('clinicDialog');
    const body = el('clinicBody');
    if (!dialog || !body) return;
    body.innerHTML = '<div class="empty">Loading…</div>';
    el('clinicTitle').textContent = 'Clinic';
    if (!dialog.open) dialog.showModal();

    let data;
    try { data = await AdminApi.clinicOverview(id); }
    catch (error) { body.innerHTML = '<div class="empty">' + esc(error.message) + '</div>'; return; }

    const c = data.clinic;
    const u = data.usage || {};
    el('clinicTitle').textContent = c.clinic_name || 'Clinic';

    const tiles = [
      ['Package', TCOSPlans.PLANS[c.plan] ? TCOSPlans.PLANS[c.plan].name : c.plan],
      ['Status', c.status],
      ['Account', c.account_type || 'live'],
      ['Product', (c.product || '').toUpperCase()],
      ['Patients', u.patients || 0],
      ['Visits', u.visits || 0],
      ['Prescriptions', u.prescriptions || 0],
      ['Invoices', u.invoices || 0],
      ['Appointments', u.appointments || 0],
      ['Lab reports', u.lab_reports || 0],
      ['Pharmacy items', u.stock_items || 0],
      ['Storage', readableSize(u.storage_bytes)]
    ];

    body.innerHTML =
      '<div class="stat-row">' + tiles.map(([label, value]) =>
        '<div class="stat"><div class="stat-text"><b>' + esc(value) +
        '</b><span>' + esc(label) + '</span></div></div>').join('') + '</div>' +

      '<div class="panel"><header><h2>The account</h2></header><div class="body">' +
        '<table class="grid"><tbody>' +
        [['Doctor', c.full_name + (c.qualification ? ' · ' + c.qualification : '')],
         ['Mobile', c.mobile + (c.mobile_verified ? ' (verified)' : '')],
         ['Email', c.email || '— none on file, so no password reset is possible'],
         ['Registration', (c.registration_no || '—') + (c.council ? ' · ' + c.council : '')],
         ['Verified', c.verification_status + (c.verified_at ? ' · ' + when(c.verified_at) : '')],
         ['Paid until', c.plan_paid_until || '— no clock running'],
         ['Plan set by', c.plan_source === 'payment' ? 'A payment'
            : c.plan_source === 'manual_override' ? 'Manual override · ' + (c.plan_override_reason || '')
            : 'Existing account'],
         ['Joined', when(c.created_at)],
         ['Last sign-in', when(c.last_sign_in_at)],
         ['Public page', c.public_page_on ? (c.public_slug || 'on') : 'off'],
         ['Own domain', c.custom_domain ? c.custom_domain + ' · ' + (c.custom_domain_status || '') : '—'],
         ['Clinical modules', (c.practicePacks || []).join(', ') || '— none, so her examination card is empty'],
         ...(c.status === 'suspended' ? [['Suspended because', c.suspended_reason || '—']] : [])
        ].map(([k, v]) => '<tr><td style="white-space:nowrap;color:var(--muted)">' + esc(k) +
          '</td><td>' + esc(v) + '</td></tr>').join('') +
        '</tbody></table></div></div>' +

      '<div class="panel"><header><h2>People in this clinic</h2>' +
        '<div class="spacer"></div><span class="muted" style="font-size:.8rem">' +
        esc(data.people.length) + ' added by her</span></header><div class="body">' +
        rows(data.people, p =>
          '<div class="row-line"><div><b>' + esc(p.full_name) + '</b>' +
          '<small>' + esc(p.role.replace(/_/g, ' ')) +
          (p.registration_no ? ' · ' + esc(p.registration_no) : '') +
          ' · ' + esc((p.capabilities || []).join(', ') || 'no areas ticked') + '</small></div>' +
          '<span class="pill ' + esc(p.status || 'active') + '">' + esc(p.status || 'active') + '</span>' +
          '<small style="color:var(--muted)">' +
          (p.last_sign_in_at ? 'in ' + esc(when(p.last_sign_in_at)) : 'never signed in') +
          (p.must_change_password ? ' · still on a temporary password' : '') +
          '</small></div>') +
        '</div></div>' +

      '<div class="panel"><header><h2>Devices signed in now</h2>' +
        '<div class="spacer"></div><span class="muted" style="font-size:.8rem">' +
        esc(data.devices.length) + ' live</span></header><div class="body">' +
        rows(data.devices, d =>
          '<div class="row-line"><div><b>' + esc(deviceName(d.user_agent)) + '</b>' +
          '<small>' + esc(d.user_id ? 'a staff member' : 'the doctor herself') +
          ' · since ' + esc(when(d.created_at)) + '</small></div>' +
          '<small style="color:var(--muted)">until ' + esc(when(d.expires_at)) + '</small></div>') +
        (data.passkeys.length
          ? '<p class="muted" style="margin:14px 0 6px;font-size:.82rem">Fingerprint set up on ' +
            esc(data.passkeys.length) + ' device' + (data.passkeys.length === 1 ? '' : 's') + '</p>' +
            data.passkeys.map(k => '<div class="row-line"><div><b>' + esc(k.label || 'Device') +
            '</b><small>added ' + esc(when(k.created_at)) + '</small></div>' +
            '<small style="color:var(--muted)">' +
            (k.last_used_at ? 'used ' + esc(when(k.last_used_at)) : 'never used') +
            '</small></div>').join('')
          : '') +
        '</div></div>' +

      '<div class="panel"><header><h2>Money</h2></header><div class="body">' +
        (data.subscription
          ? '<p style="margin-top:0">' + esc(data.subscription.provider) + ' · ' +
            esc(data.subscription.status) + ' · to ' + esc(when(data.subscription.current_end)) + '</p>'
          : '<p class="muted" style="margin-top:0">No subscription.</p>') +
        rows(data.payments, p =>
          '<div class="row-line"><div><b>₹' + esc(((p.amount_paise || 0) / 100).toFixed(2)) +
          '</b><small>' + esc(p.provider) + ' · ' + esc(p.status) +
          (p.method ? ' · ' + esc(p.method) : '') +
          (p.reference || p.provider_payment_id
            ? ' · ' + esc(p.reference || p.provider_payment_id) : '') + '</small></div>' +
          '<small style="color:var(--muted)">' + esc(when(p.occurred_at)) + '</small></div>') +
        '</div></div>' +

      '<div class="panel"><header><h2>What has happened here</h2>' +
        '<div class="spacer"></div><span class="muted" style="font-size:.8rem">' +
        'actions only — no record is opened</span></header><div class="body">' +
        rows(data.activity, a =>
          '<div class="row-line"><div><b>' + esc(a.action.replace(/_/g, ' ')) + '</b>' +
          '<small>' + esc(a.actor) + (a.detail ? ' · ' + esc(a.detail) : '') + '</small></div>' +
          '<small style="color:var(--muted)">' + esc(when(a.created_at)) + '</small></div>') +
        '</div></div>' +

      (data.support.length
        ? '<div class="panel"><header><h2>She has asked us</h2></header><div class="body">' +
          data.support.map(s => '<div class="row-line"><div><b>' +
            esc(String(s.message || '').slice(0, 120)) + '</b><small>' + esc(s.status) +
            '</small></div><small style="color:var(--muted)">' + esc(when(s.created_at)) +
            '</small></div>').join('') + '</div></div>'
        : '');
  }

  async function loadDoctors() {
    try {
      doctors = (await AdminApi.listDoctors()).doctors || [];
    } catch (error) {
      note('adminMsg', esc(error.message), 'error');
      return;
    }
    /* Loaded here rather than on page load: before sign-in this call is a
       401, and a table full of "Unauthorised" is not a useful first thing
       to see on a console you have not signed into yet. */
    loadDemoClinics();

    const totals = doctors.reduce((sum, d) => {
      sum.patients += d.patient_count || 0;
      sum.rx += d.rx_count || 0;
      if (d.status === 'active') sum.active++;
      if (d.plan !== 'basic') sum.paying++;
      return sum;
    }, { patients: 0, rx: 0, active: 0, paying: 0 });

    document.getElementById('adminStats').innerHTML = [
      ['Doctors', doctors.length],
      ['Active', totals.active],
      ['On a paid plan', totals.paying],
      ['Patients', totals.patients],
      ['Prescriptions', totals.rx]
    ].map(([label, value]) =>
      '<div class="stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>').join('');

    document.getElementById('doctorTable').innerHTML = doctors.length
      ? '<table class="grid"><thead><tr><th>Doctor</th><th>Package</th><th>Status</th>' +
        '<th>Patients</th><th>Rx</th><th>Last sign-in</th><th></th></tr></thead><tbody>' +
        doctors.map(d =>
          '<tr>' +
            '<td><div class="clinic-cell"><span class="fallback">' +
              esc((d.clinic_name || '?').charAt(0)) + '</span><div><b>' + esc(d.clinic_name) +
              '</b><small>' + esc(d.full_name) +
              (d.qualification ? ' · ' + esc(d.qualification) : '') + '</small></div></div></td>' +
             '<td><select data-plan-for="' + esc(d.id) + '">' +
              ['basic', 'starter', 'pro', 'pro_plus'].map(p =>
                '<option value="' + p + '"' + (d.plan === p ? ' selected' : '') + '>' +
                esc(TCOSPlans.PLANS[p].name) + '</option>').join('') + '</select>' +
              '<br><small>' + esc(d.plan_source === 'payment' ? 'Automatic from payment' :
                d.plan_source === 'manual_override' ? 'Manual override' : 'Existing account') + '</small></td>' +
            '<td><span class="pill ' + esc(d.status) + '">' + esc(d.status) + '</span></td>' +
            '<td>' + esc(d.patient_count) + '</td>' +
            '<td>' + esc(d.rx_count) + '</td>' +
            '<td style="font-size:.8rem;color:var(--muted)">' +
              esc(d.last_sign_in_at ? new Date(d.last_sign_in_at).toLocaleDateString('en-IN') : 'Never') + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn btn-primary btn-sm" data-open-clinic="' + esc(d.id) + '">Open</button> ' +
              '<button class="btn btn-ghost btn-sm" data-reissue="' + esc(d.id) + '">New password</button> ' +
              '<button class="btn btn-ghost btn-sm" data-toggle="' + esc(d.id) + '">' +
                (d.status === 'suspended' ? 'Reactivate' : 'Suspend') + '</button>' +
            '</td>' +
          '</tr>').join('') + '</tbody></table>'
      : '<div class="empty">No doctors yet. Onboard your first one.</div>';

    document.querySelectorAll('[data-open-clinic]').forEach(button =>
      button.addEventListener('click', () => openClinic(button.dataset.openClinic)));

    document.querySelectorAll('[data-plan-for]').forEach(select =>
      select.addEventListener('change', async () => {
        const doctor = doctors.find(item => item.id === select.dataset.planFor);
        const reason = prompt('Why are you overriding ' + doctor.clinic_name + ' to ' +
          TCOSPlans.PLANS[select.value].name + '?\n\nA signed payment update will become authoritative again.');
        if (reason === null || !reason.trim()) { await loadDoctors(); return; }
        try {
          await runSensitive(() => AdminApi.updateDoctor(
            select.dataset.planFor, { plan: select.value, planReason: reason.trim() }));
          await loadDoctors();
        } catch (error) {
          if (error.code === 'cancelled') await loadDoctors();
          else note('adminMsg', esc(error.message), 'error');
        }
      }));

    document.querySelectorAll('[data-toggle]').forEach(button =>
      button.addEventListener('click', async () => {
        const doctor = doctors.find(d => d.id === button.dataset.toggle);
        const next = doctor.status === 'suspended' ? 'active' : 'suspended';
        if (next === 'suspended' && !confirm(
          'Suspend ' + doctor.clinic_name + '?\n\nThey are signed out immediately and cannot sign back in.')) return;
        try {
          await runSensitive(() => AdminApi.updateDoctor(doctor.id, { status: next }));
          await loadDoctors();
        }
        catch (error) { note('adminMsg', esc(error.message), 'error'); }
      }));

    document.querySelectorAll('[data-reissue]').forEach(button =>
      button.addEventListener('click', async () => {
        const doctor = doctors.find(d => d.id === button.dataset.reissue);
        if (!confirm('Issue a new temporary password for ' + doctor.clinic_name +
          '?\n\nTheir current password stops working and they are signed out.')) return;
        try {
          const result = await runSensitive(() => AdminApi.reissuePassword(doctor.id));
          showHandover(doctor.clinic_name, doctor.mobile || doctor.email, result.temporaryPassword);
          await loadDoctors();
        } catch (error) { note('adminMsg', esc(error.message), 'error'); }
      }));
  }

  /* ---- his devices ----

     Vijay: "as an owner i can login from anywhere - my tab or pc or laptop
     or phone - and we have multiple email ids ... remove that dependency."

     One passkey per device, each unlocked by that device's own fingerprint,
     face or PIN. Nothing here is shared between machines, which is exactly
     the point: no address has to be the same anywhere. */
  const shortDate = value => value
    ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  async function loadPasskeys() {
    const list = document.getElementById('passkeyList');
    const button = document.getElementById('addPasskeyBtn');
    if (!list) return;

    /* Offered only where the device really has a sensor or a PIN. A button
       that cannot work is worse than no button. */
    if (button && window.TCOSPasskeys && await TCOSPasskeys.platformAvailable()) {
      button.hidden = false;
      if (!button.dataset.wired) {
        button.dataset.wired = 'yes';
        button.addEventListener('click', async () => {
          note('passkeyMsg', 'Confirm with your fingerprint, face or device PIN…', 'info');
          button.disabled = true;
          try {
            const added = await AdminApi.enrolPasskey(TCOSPasskeys.deviceName());
            note('passkeyMsg', esc(added.label) + ' can now sign you in. ' +
              'Do the same on every other device you use.', 'success');
            await loadPasskeys();
          } catch (error) {
            note('passkeyMsg', esc(error.message), 'error');
          } finally { button.disabled = false; }
        });
      }
    }

    try {
      const devices = (await AdminApi.listPasskeys()).passkeys || [];
      list.innerHTML = devices.length
        ? '<table class="grid"><thead><tr><th>Device</th><th>Added</th><th>Last used</th>' +
          '<th></th></tr></thead><tbody>' +
          devices.map(d =>
            '<tr><td><b>' + esc(d.label || 'Device') + '</b></td>' +
            '<td style="font-size:.8rem;color:var(--muted)">' + esc(shortDate(d.created_at)) + '</td>' +
            '<td style="font-size:.8rem;color:var(--muted)">' +
            esc(d.last_used_at ? shortDate(d.last_used_at) : 'Not yet') + '</td>' +
            '<td style="text-align:right"><button class="btn btn-ghost btn-sm" ' +
            'data-remove-passkey="' + esc(d.id) + '">Remove</button></td></tr>').join('') +
          '</tbody></table>'
        : '<div class="empty">No device is set up yet. ' +
          'Press "Set up this device" to use your fingerprint here.</div>';

      list.querySelectorAll('[data-remove-passkey]').forEach(control => {
        control.addEventListener('click', async () => {
          /* Removing the last one would leave only the password, which is
             the situation he is trying to leave. Worth a sentence. */
          if (devices.length === 1 &&
              !confirm('This is your only device. Remove it and you will need your password again. Continue?')) return;
          try {
            await AdminApi.removePasskey(control.dataset.removePasskey);
            note('passkeyMsg', 'That device can no longer sign in.', 'success');
            await loadPasskeys();
          } catch (error) { note('passkeyMsg', esc(error.message), 'error'); }
        });
      });
    } catch (error) {
      list.innerHTML = '<div class="empty">' + esc(error.message) + '</div>';
    }
  }

  async function loadTeam() {
    loadPasskeys();
    try {
      const list = (await AdminApi.listTeam()).team || [];
      platformTeam = list;
      document.getElementById('teamTable').innerHTML =
        '<table class="grid"><thead><tr><th>Person</th><th>Starting role</th><th>Allowed areas</th>' +
        '<th>Last sign-in</th><th></th></tr></thead><tbody>' +
        list.map(m =>
          '<tr><td><b>' + esc(m.full_name) + '</b><br><small style="color:var(--muted)">' +
          esc(m.email) + '</small></td>' +
          '<td><span class="pill ' + (m.role === 'owner' ? 'active' : 'trial') + '">' +
          esc(m.role) + '</span></td>' +
          '<td><small>' + esc((m.capabilities || []).map(value => value.replace('_', ' ')).join(' · ') || 'None') + '</small></td>' +
          '<td style="font-size:.8rem;color:var(--muted)">' +
          esc(m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleString('en-IN') : 'Never') +
          '</td><td style="white-space:nowrap">' + (m.role === 'owner' ? '' :
            '<button class="btn btn-ghost btn-sm" data-team-edit="' + esc(m.email) + '">Access</button> ' +
            '<button class="btn btn-ghost btn-sm" data-team-remove="' + esc(m.email) + '">Remove</button>') +
          '</td></tr>').join('') + '</tbody></table>';
      document.querySelectorAll('[data-team-edit]').forEach(button =>
        button.addEventListener('click', () => openTeamDialog(
          list.find(member => member.email === button.dataset.teamEdit))));
      document.querySelectorAll('[data-team-remove]').forEach(button =>
        button.addEventListener('click', async () => {
          const member = list.find(item => item.email === button.dataset.teamRemove);
          if (!confirm('Remove ' + member.full_name + ' from the TCOS platform console?\n\nTheir active TCOS sessions will be revoked. Also remove the email from Cloudflare Access.')) return;
          try {
            await runSensitive(() => AdminApi.removeTeam(member.email));
            await loadTeam();
          } catch (error) { note('adminMsg', esc(error.message), 'error'); }
        }));
    } catch (error) {
      document.getElementById('teamTable').innerHTML =
        '<div class="empty">' + esc(error.message) + '</div>';
    }
  }

  const PLATFORM_ACCESS = {
    applications: 'Applications', doctors: 'Doctors & onboarding',
    patients: 'Patient operations', analytics: 'Health insights', money: 'Money',
    subscriptions: 'Subscriptions', delivery: 'Communications',
    support: 'Support desk', team: 'Team access'
  };
  const PLATFORM_PRESETS = {
    admin: Object.keys(PLATFORM_ACCESS),
    support: ['applications', 'doctors', 'patients', 'delivery', 'support'],
    finance: ['money', 'subscriptions'], viewer: ['applications', 'doctors']
  };
  const teamDialog = document.getElementById('teamDialog');

  function paintTeamCapabilities(selected) {
    document.getElementById('teamCapabilities').innerHTML =
      Object.entries(PLATFORM_ACCESS).map(([key, label]) =>
        '<label class="toggle' + (selected.includes(key) ? ' on' : '') + '">' +
        '<input type="checkbox" value="' + esc(key) + '"' +
        (selected.includes(key) ? ' checked' : '') + '><span>' + esc(label) + '</span></label>').join('');
    document.querySelectorAll('#teamCapabilities input').forEach(input =>
      input.addEventListener('change', () =>
        input.closest('.toggle').classList.toggle('on', input.checked)));
  }

  function openTeamDialog(member) {
    document.getElementById('teamForm').reset();
    note('teamMsg', '', '');
    teamDialog.dataset.email = member ? member.email : '';
    teamDialog.querySelector('h3').textContent = member ? 'Change employee access' : 'Add platform employee';
    document.getElementById('teamName').value = member ? member.full_name : '';
    document.getElementById('teamEmail').value = member ? member.email : '';
    document.getElementById('teamName').disabled = !!member;
    document.getElementById('teamEmail').disabled = !!member;
    document.getElementById('teamRole').value = member ? member.role : 'support';
    paintTeamCapabilities(member ? member.capabilities || [] : PLATFORM_PRESETS.support);
    teamDialog.showModal();
  }

  document.getElementById('addTeamBtn').addEventListener('click', () => openTeamDialog(null));
  document.getElementById('teamRole').addEventListener('change', event =>
    paintTeamCapabilities(PLATFORM_PRESETS[event.target.value] || []));
  document.getElementById('teamClose').addEventListener('click', () => teamDialog.close());
  document.getElementById('teamCancel').addEventListener('click', () => teamDialog.close());
  document.getElementById('teamForm').addEventListener('submit', async event => {
    event.preventDefault();
    const capabilities = Array.from(
      document.querySelectorAll('#teamCapabilities input:checked')).map(input => input.value);
    const role = document.getElementById('teamRole').value;
    try {
      const email = teamDialog.dataset.email;
      if (email) {
        await runSensitive(() => AdminApi.updateTeam(email, { role, capabilities }));
        teamDialog.close();
      } else {
        const result = await runSensitive(() => AdminApi.addTeam({
          email: document.getElementById('teamEmail').value.trim(),
          fullName: document.getElementById('teamName').value.trim(), role, capabilities
        }));
        teamDialog.close();
        showHandover('Platform employee', result.member.email, result.temporaryPassword,
          'Add this email to the Cloudflare Access allow policy before handover.');
      }
      await loadTeam();
    } catch (error) { note('teamMsg', esc(error.message), 'error'); }
  });

  /* ---------------- applications ----------------
     The onboarding queue. Approving is the only thing in this console that
     creates a doctor, so it is the only place a temporary password appears -
     once, from the server, never stored in readable form. */
  const PRODUCT_LABEL = { ayurcos: 'AyurCOS', homeocos: 'HomeoCOS', allocos: 'AlloCOS' };
  /* Several doctors sharing a place is a different sale from one doctor with
     staff - different pricing, and more than one workspace to set up. */
  const FACILITY_LABEL = {
    clinic: 'Single-doctor clinic',
    multi_doctor: 'Several doctors',
    hospital: 'Hospital / multi-speciality'
  };

  async function loadApplications() {
    const table = document.getElementById('applicationTable');
    try {
      const list = (await AdminApi.listApplications()).applications || [];
      const waiting = list.filter(a => a.status === 'new').length;
      const reviewing = list.filter(a => a.status === 'reviewing').length;
      const approved = list.filter(a => a.status === 'approved').length;

      const badge = document.getElementById('applicationsCount');
      badge.textContent = waiting || '';
      badge.hidden = !waiting;

      document.getElementById('applicationStats').innerHTML = [
        ['Waiting', waiting], ['Being checked', reviewing],
        ['Approved', approved], ['Rejected', list.filter(a => a.status === 'rejected').length]
      ].map(([label, value]) =>
        '<div class="stat"><b>' + value + '</b><span>' + label + '</span></div>').join('');

      if (!list.length) {
        table.innerHTML = '<div class="empty">No applications yet. They arrive from the Create account form on the home page.</div>';
        return;
      }

      table.innerHTML =
        '<table class="grid"><thead><tr><th>Doctor</th><th>Registration</th>' +
        '<th>Clinic</th><th>Applying for</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(a => {
          const decided = a.status === 'approved' || a.status === 'rejected';
          return '<tr><td><b>' + esc(a.full_name) + '</b><br><small>' +
              esc(a.mobile) + (a.email ? ' · ' + esc(a.email) : '') + '</small>' +
              (a.message ? '<br><small style="color:var(--muted)">' + esc(a.message) + '</small>' : '') +
            '</td>' +
            '<td>' + esc(a.registration_no || '—') + '<br><small>' +
              esc(a.qualification || '—') + (a.council ? ' · ' + esc(a.council) : '') + '</small></td>' +
            '<td><b>' + esc(a.clinic_name) + '</b><br><small>' +
              esc([a.city, a.state].filter(Boolean).join(', ') || '—') + '</small>' +
              '<br><small>' + esc(FACILITY_LABEL[a.facility_type] || 'Not stated') +
              ' · ' + esc(a.doctor_count || '?') + ' doctor' +
              (Number(a.doctor_count) === 1 ? '' : 's') +
              ' · ' + esc(a.staff_count == null ? '?' : a.staff_count) + ' staff</small></td>' +
            '<td>' + esc(PRODUCT_LABEL[a.discipline] || a.discipline) + '</td>' +
            '<td><span class="pill ' +
              (a.status === 'approved' ? 'active' : a.status === 'rejected' ? 'suspended' : 'trial') +
              '">' + esc(a.status) + '</span>' +
              (a.reviewed_by ? '<br><small>' + esc(a.reviewed_by) + '</small>' : '') + '</td>' +
            '<td style="white-space:nowrap">' + (decided ? '' :
              '<button class="btn btn-primary btn-sm" data-approve="' + esc(a.id) + '">Approve</button> ' +
              '<button class="btn btn-ghost btn-sm" data-reject="' + esc(a.id) + '">Reject</button>') +
            '</td></tr>';
        }).join('') + '</tbody></table>';

      /* Approving is where the package and the account type are decided.
         This used to be a confirm() that sent {} - so every doctor approved
         through this console landed on Free whatever her application asked
         for, and there was nowhere to say "this one is a demo". */
      table.querySelectorAll('[data-approve]').forEach(button =>
        button.addEventListener('click', () => {
          const application = list.find(a => a.id === button.dataset.approve);
          openApprove(application);
        }));

      table.querySelectorAll('[data-reject]').forEach(button =>
        button.addEventListener('click', async () => {
          const reason = prompt('Why is this being rejected?\n\nWrite what you would tell the doctor.');
          if (reason === null) return;
          try {
            await runSensitive(() => AdminApi.updateApplication(button.dataset.reject,
              { status: 'rejected', rejectionReason: reason.trim() || 'No reason given.' }));
            await loadApplications();
          } catch (error) { note('adminMsg', esc(error.message), 'error'); }
        }));
    } catch (error) {
      table.innerHTML = '<div class="empty">' + esc(error.message) + '</div>';
    }
  }

  /* ---------------- money ----------------
     Revenue against what a clinic costs to run. The two numbers this exists
     to make undeniable: storage is a rounding error, and fixed costs matter
     enormously at three customers and not at all at three hundred. */
  const rupees = paise => '₹' + (Number(paise || 0) / 100)
    .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Set once, the first time Money is loaded, so a later deliberate choice
     of an empty month is not overridden underneath the user. */
  let monthAutoPicked = false;

  async function loadCosts() {
    const field = document.getElementById('costMonth');
    let report;
    try { report = await AdminApi.costs(field.value); }
    catch (error) {
      document.getElementById('costTable').innerHTML =
        '<div class="empty">' + esc(error.message) + '</div>';
      return;
    }

    /* The screen opens on the current month. In the first days of a month -
       or before a clinic has done anything - that is a page of zeroes, and
       it reads as a broken screen rather than a quiet month. So on the FIRST
       load only, fall back to the most recent month that has activity. */
    const active = report.monthsWithActivity || [];
    if (!monthAutoPicked) {
      monthAutoPicked = true;
      const empty = !report.totals || !report.totals.revenuePaise;
      if (empty && active.length && !active.includes(field.value)) {
        field.value = active[0];
        return loadCosts();
      }
    }

    const t = report.totals;
    document.getElementById('moneyStats').innerHTML = [
      ['Billed this month', rupees(t.revenuePaise)],
      ['Leaves the bank', rupees(t.cashCostPaise)],
      ['Your time / imputed', rupees(t.imputedCostPaise)],
      ['True total cost', rupees(t.costPaise)],
      ['Left over', rupees(t.marginPaise)],
      ['Margin', t.marginPercent == null ? '—' : t.marginPercent + '%'],
      ['Paying clinics', t.payingClinics + ' of ' + t.activeClinics]
    ].map(([label, value]) =>
      '<div class="stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>').join('');

    /* Categories as bars, because the point is the RATIO between them - that
       messaging dwarfs storage - and a column of numbers hides that. */
    const cats = Object.entries(report.byCategory).sort((a, b) => b[1] - a[1]);
    const biggest = Math.max(1, ...cats.map(c => c[1]));
    document.getElementById('costCategories').innerHTML = cats.length
      ? cats.map(([name, paise]) =>
          '<div class="cost-bar"><span class="cost-name">' + esc(name) + '</span>' +
          '<span class="cost-track"><span class="cost-fill" style="width:' +
            Math.max(2, Math.round((paise / biggest) * 100)) + '%"></span></span>' +
          '<span class="cost-value">' + esc(rupees(paise)) + '</span></div>').join('')
      /* Naming the months that DO have activity is the difference between
         "this is broken" and "nothing happened in September". */
      : '<div class="empty">No usage recorded in ' + esc(field.value) + '.' +
        (active.length ? ' Activity exists in: ' + esc(active.join(', ')) + '.' : '') +
        '</div>';

    document.getElementById('costTable').innerHTML = report.clinics.length
      ? '<table class="grid"><thead><tr><th>Clinic</th><th>Plan</th><th>Patients</th>' +
        '<th>Billed</th><th>Costs</th><th>Left</th><th>Margin</th></tr></thead><tbody>' +
        report.clinics.map(c => {
          const losing = c.marginPaise < 0;
          return '<tr>' +
            '<td><b>' + esc(c.clinicName) + '</b><br><small>' + esc(c.doctor) +
              ' · ' + esc(c.product || '') + '</small></td>' +
            '<td>' + esc(c.plan) + '</td>' +
            '<td>' + esc(c.patients) + '</td>' +
            '<td>' + esc(rupees(c.revenuePaise)) + '</td>' +
            '<td>' + esc(rupees(c.costPaise)) +
              '<br><small>' + esc(rupees(c.fixedSharePaise)) + ' fixed</small></td>' +
            '<td class="' + (losing ? 'money-bad' : '') + '">' + esc(rupees(c.marginPaise)) + '</td>' +
            '<td>' + (c.marginPercent == null
              ? '<span class="pill trial">Free</span>'
              : '<span class="pill ' + (losing ? 'suspended' : 'active') + '">' +
                c.marginPercent + '%</span>') + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table>'
      : '<div class="empty">No clinics yet.</div>';

    const business = report.businessCosts || [];
    document.getElementById('businessCostTable').innerHTML = business.length
      ? '<table class="grid"><thead><tr><th>Cost</th><th>Scope</th><th>Type</th><th>This month</th><th></th></tr></thead><tbody>' +
        business.map(item => '<tr><td><b>' + esc(item.label) + '</b><br><small>' +
          esc([item.vendor, item.category, item.cadence].filter(Boolean).join(' · ')) + '</small></td>' +
          '<td>' + esc(item.scope === 'clinic' ? item.clinic_name || 'Clinic' :
            item.scope === 'shared' ? 'Shared · ' + item.allocation_percent + '% to TCOS' : 'TCOS') + '</td>' +
          '<td>' + esc(item.cash_type === 'cash' ? 'Leaves the bank' : 'Time / opportunity') + '</td>' +
          '<td>' + esc(rupees(item.monthlyPaise)) + '</td><td>' +
          '<button class="btn btn-ghost btn-sm" data-cost-archive="' + esc(item.id) + '">Archive</button></td></tr>').join('') +
        '</tbody></table>'
      : '<div class="empty">No salaries, subscriptions or other business costs have been added for this month yet.</div>';
    document.querySelectorAll('[data-cost-archive]').forEach(button =>
      button.addEventListener('click', async () => {
        if (!confirm('Archive this cost? It will stop affecting future months; historical reporting remains auditable.')) return;
        try {
          await runSensitive(() => AdminApi.archiveCost(button.dataset.costArchive));
          await loadCosts();
        } catch (error) { note('adminMsg', esc(error.message), 'error'); }
      }));

    document.getElementById('rateTable').innerHTML =
      '<table class="grid"><thead><tr><th>What</th><th>Category</th><th>Per</th>' +
      '<th>Rate (₹)</th><th></th></tr></thead><tbody>' +
      report.rates.map(r =>
        '<tr><td><b>' + esc(r.label) + '</b><br><small>' + esc(r.note || '') + '</small></td>' +
        '<td>' + esc(r.category) + '</td><td>' + esc(r.unit.replace(/_/g, ' ')) + '</td>' +
        '<td><input class="rate-input" type="number" min="0" step="0.01" data-rate="' +
          esc(r.id) + '" value="' + (r.paise_per_unit / 100).toFixed(2) + '"></td>' +
        '<td><button class="btn btn-ghost btn-sm" data-save-rate="' + esc(r.id) + '">Save</button></td>' +
        '</tr>').join('') + '</tbody></table>';

    document.querySelectorAll('[data-save-rate]').forEach(button =>
      button.addEventListener('click', async () => {
        const input = document.querySelector('[data-rate="' + button.dataset.saveRate + '"]');
        button.disabled = true;
        try {
          await runSensitive(() => AdminApi.updateRate(button.dataset.saveRate,
            Math.round(Number(input.value) * 100)));
          await loadCosts();
        } catch (error) { note('adminMsg', esc(error.message), 'error'); button.disabled = false; }
      }));
  }

  document.getElementById('costMonth').addEventListener('change', loadCosts);

  const costDialog = document.getElementById('costDialog');
  const closeCost = () => costDialog.close();
  document.getElementById('addCostBtn').addEventListener('click', () => {
    document.getElementById('costForm').reset();
    document.getElementById('costAllocation').value = '100';
    document.getElementById('costStarts').value = new Date().toISOString().slice(0, 10);
    document.getElementById('costClinic').innerHTML = doctors.map(doctor =>
      '<option value="' + esc(doctor.id) + '">' + esc(doctor.clinic_name) + '</option>').join('');
    document.getElementById('costClinicField').hidden = true;
    note('costMsg', '', '');
    costDialog.showModal();
  });
  document.getElementById('costClose').addEventListener('click', closeCost);
  document.getElementById('costCancel').addEventListener('click', closeCost);
  document.getElementById('costScope').addEventListener('change', event => {
    document.getElementById('costClinicField').hidden = event.target.value !== 'clinic';
    document.getElementById('costAllocation').disabled = event.target.value === 'clinic';
    if (event.target.value === 'clinic') document.getElementById('costAllocation').value = '100';
  });
  document.getElementById('costForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await runSensitive(() => AdminApi.addCost({
        label: document.getElementById('costLabel').value.trim(),
        vendor: document.getElementById('costVendor').value.trim(),
        category: document.getElementById('costCategory').value,
        scope: document.getElementById('costScope').value,
        doctorId: document.getElementById('costScope').value === 'clinic'
          ? document.getElementById('costClinic').value : null,
        amountPaise: Math.round(Number(document.getElementById('costAmount').value) * 100),
        cadence: document.getElementById('costCadence').value,
        cashType: document.getElementById('costCashType').value,
        allocationPercent: Number(document.getElementById('costAllocation').value),
        startsOn: document.getElementById('costStarts').value,
        endsOn: document.getElementById('costEnds').value || null,
        note: document.getElementById('costNote').value.trim()
      }));
      closeCost();
      await loadCosts();
    } catch (error) { note('costMsg', esc(error.message), 'error'); }
  });

  /* ---------------- subscriptions ----------------
     This is deliberately separate from the accounting estimate above.
     Money answers "is TCOS profitable?"; this answers "did a real payment
     grant the right clinic access, and which renewal needs attention?" */
  async function loadSubscriptions() {
    const table = document.getElementById('subscriptionTable');
    table.innerHTML = '<div class="empty">Checking payment state…</div>';
    let result;
    try { result = await AdminApi.subscriptions(); }
    catch (error) {
      table.innerHTML = '<div class="empty">' + esc(error.message) + '</div>';
      return;
    }

    const health = result.health || {};
    const syncButton = document.getElementById('syncPaymentPlans');
    syncButton.disabled = !health.configured;
    syncButton.title = health.configured ? '' : 'Add the three Razorpay Worker secrets first.';
    document.getElementById('paymentHealth').innerHTML = health.configured
      ? '<b>Razorpay credentials are configured.</b> Activation is automatic after a signed webhook or a doctor status refresh.'
      : '<b>Online payments are not ready.</b> Missing Worker secrets: ' +
        esc((health.missing || []).join(', ') || 'configuration unknown') +
        '. Existing clinic access is unchanged.';

    const rows = result.subscriptions || [];
    const active = rows.filter(row => row.status === 'active');
    const attention = rows.filter(row => ['pending', 'halted', 'paused'].includes(row.status));
    const setup = rows.filter(row => ['created', 'authenticated'].includes(row.status));
    const ending = rows.filter(row => row.cancel_at_cycle_end);
    const mrrPaise = active.reduce((sum, row) => sum +
      (row.cadence === 'yearly' ? Math.round(row.price_paise / 12) : row.price_paise), 0);
    document.getElementById('subscriptionStats').innerHTML = [
      ['Active paid clinics', active.length],
      ['Monthly recurring value', rupees(mrrPaise)],
      ['Needs payment attention', attention.length],
      ['Checkout not finished', setup.length],
      ['Stopping renewal', ending.length]
    ].map(([label, value]) =>
      '<div class="stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>').join('');

    const planName = id => TCOSPlans.PLANS[id] ? TCOSPlans.PLANS[id].name : id;
    const when = value => value
      ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    table.innerHTML = rows.length
      ? '<table class="grid"><thead><tr><th>Clinic</th><th>Plan</th><th>Payment state</th>' +
        '<th>Amount</th><th>Access / renewal</th></tr></thead><tbody>' +
        rows.map(row => {
          const good = row.status === 'active';
          const risk = ['pending', 'halted', 'paused'].includes(row.status);
          return '<tr><td><b>' + esc(row.clinic_name) + '</b><br><small>' + esc(row.full_name) + '</small></td>' +
            '<td>' + esc(planName(row.plan)) + '</td>' +
            '<td><span class="pill ' + (good ? 'active' : risk ? 'trial' : '') + '">' +
              esc(row.status) + '</span></td>' +
            '<td>' + esc(rupees(row.price_paise)) + '<br><small>' + esc(row.cadence) + '</small></td>' +
            '<td>' + esc(when(row.access_until || row.current_end)) + '<br><small>' +
              (row.cancel_at_cycle_end ? 'Renewal will stop' : risk ? 'Three-day reserve applies' : 'Automatic renewal') +
              '</small></td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="empty">No clinic has started online billing yet.</div>';
  }

  async function syncPaymentPlans() {
    if (!adminMe || !['owner', 'admin'].includes(adminMe.role)) return;
    const button = document.getElementById('syncPaymentPlans');
    button.disabled = true;
    note('subscriptionMsg', 'Checking the six TCOS price records with Razorpay…', 'info');
    try {
      const result = await runSensitive(() => AdminApi.syncSubscriptionPlans());
      note('subscriptionMsg', esc((result.synced || []).length) +
        ' payment plans are ready. Existing subscribers were not changed.', 'ok');
      await loadSubscriptions();
    } catch (error) {
      note('subscriptionMsg', esc(error.message), 'error');
    } finally { button.disabled = false; }
  }

  async function loadPatients() {
    try {
      const list = (await AdminApi.listPatients()).patients || [];
      document.getElementById('patientTable').innerHTML = list.length
        ? '<table class="grid"><thead><tr><th>Patient</th><th>Contact</th><th>Clinic</th><th>Last seen</th></tr></thead><tbody>' +
          list.map(p => '<tr data-patient-detail="' + esc(p.id) + '" style="cursor:pointer"><td><b>' + esc(p.full_name) + '</b><br><small>' + esc(p.patient_code || '—') + '</small></td>' +
            '<td>' + esc(p.mobile) + '</td><td>' + esc(p.clinics || '—') +
            (Number(p.clinic_count) > 1 ? '<br><small>' + esc(p.clinic_count) + ' connected clinics</small>' : '') + '</td>' +
            '<td>' + esc(p.last_seen_on || 'No completed visit yet') + '</td></tr>').join('') + '</tbody></table>'
        : '<div class="empty">No patients yet.</div>';
      document.querySelectorAll('[data-patient-detail]').forEach(row =>
        row.addEventListener('click', () => openPatientDetail(row.dataset.patientDetail)));
    } catch (error) { document.getElementById('patientTable').innerHTML = '<div class="empty">' + esc(error.message) + '</div>'; }
  }

  const patientDetailDialog = document.getElementById('patientDetailDialog');
  document.getElementById('patientDetailClose').addEventListener('click', () => patientDetailDialog.close());
  document.getElementById('patientDetailDone').addEventListener('click', () => patientDetailDialog.close());
  async function openPatientDetail(id) {
    const body = document.getElementById('patientDetailBody');
    body.innerHTML = '<div class="empty">Loading patient operations…</div>';
    patientDetailDialog.showModal();
    try {
      const result = await AdminApi.patient(id);
      const p = result.patient;
      body.innerHTML =
        '<div class="notice info">Clinical notes, diagnoses, prescriptions and lab values remain with the patient and treating clinic. This view is for identity, routing and access support.</div>' +
        '<dl class="detail-grid"><div><dt>Patient</dt><dd>' + esc(p.full_name) + '</dd></div>' +
        '<div><dt>TCOS ID</dt><dd>' + esc(p.patient_code || '—') + '</dd></div>' +
        '<div><dt>Mobile</dt><dd>' + esc(p.mobile) + '</dd></div>' +
        '<div><dt>Date of birth</dt><dd>' + esc(p.date_of_birth || 'Not recorded') + '</dd></div>' +
        '<div><dt>Connected clinics</dt><dd>' + esc(p.clinic_count) + '</dd></div>' +
        '<div><dt>Record-link opens</dt><dd>' + esc(p.link_opens || 0) + '</dd></div></dl>' +
        '<h3 style="margin-top:20px">Clinic connections</h3>' +
        '<table class="grid"><thead><tr><th>Clinic</th><th>Clinic patient no.</th><th>Dates</th><th>Activity counts</th></tr></thead><tbody>' +
        (result.connections || []).map(c => '<tr><td><b>' + esc(c.clinic_name) + '</b><br><small>' +
          esc(c.doctor_name) + ' · ' + esc(c.product) + '</small></td><td>' + esc(c.local_ref || '—') +
          '</td><td>' + esc(c.first_seen_on || '—') + ' → ' + esc(c.last_seen_on || '—') +
          '</td><td>' + esc(c.visit_count) + ' visits · ' + esc(c.prescription_count) +
          ' prescriptions · ' + esc(c.report_count) + ' reports</td></tr>').join('') +
        '</tbody></table>';
    } catch (error) { body.innerHTML = '<div class="notice error">' + esc(error.message) + '</div>'; }
  }

  /* The business on one screen. Every figure is counted server-side from a
     real table; this only arranges them. */
  const PLAN_NAME = { basic: 'Free', starter: 'Practice', pro: 'Clinic',
    clinic: 'Clinic', pro_plus: 'Group' };

  /* Bytes as a doctor's storage bill, not as a number nobody can picture.
     Decimal units, because that is what "1 GB included" on the plans screen
     means - showing 0.93 GB against a 1 GB allowance starts a support call. */
  const size = bytes => {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1e6) return (n / 1e3).toFixed(1) + ' KB';
    if (n < 1e9) return (n / 1e6).toFixed(1) + ' MB';
    return (n / 1e9).toFixed(2) + ' GB';
  };

  /* Vijay: "anjan has reset the password, thats it — that doesn't mean you
     are resetting his usage data."

     It did, and the label was half the reason: a column headed "Using it"
     with "0d ago" under it reads as a full day's clinic when all that
     happened was a locked-out doctor getting back in. The state now comes
     from work recorded, and the two dates are printed apart and named, so
     neither can ever be mistaken for the other again. */
  const USE_LABEL = {
    active: ['Using it', 'active'],
    new: ['Just joined', 'info'],
    slipping: ['Going quiet', 'trial'],
    dormant: ['Stopped', 'suspended'],
    never: ['Never signed in', 'suspended']
  };

  /* "today", "yesterday", "3d ago" - and null is never silently a zero. */
  const ago = days => {
    if (days == null) return null;
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    return days + 'd ago';
  };

  async function loadBusiness() {
    const fail = message => {
      ['bizPlans', 'bizEngagement', 'bizClinics'].forEach(id => {
        document.getElementById(id).innerHTML = '<div class="empty">' + esc(message) + '</div>';
      });
    };
    try {
      const data = await AdminApi.dashboard();
      const t = data.totals;

      /* Attrition is null until there are enough clinics to divide by. A
         dashboard that prints "0% churn" over two customers is lying with
         arithmetic, so it says so instead. */
      const churn = data.attrition.meaningful
        ? data.attrition.rate + '%'
        : data.attrition.suspended + ' lost';

      document.getElementById('bizStats').innerHTML = [
        ['Clinics', t.active],
        ['Paying', t.paying],
        ['On Free', t.free],
        ['New this month', data.joiners.last30],
        ['Attrition', churn],
        ['Patients', t.patients.toLocaleString('en-IN')],
        ['Storage', size(t.storageBytes)],
        ['Messages', t.messages.toLocaleString('en-IN')]
      ].map(([label, value]) =>
        '<div class="stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>').join('');

      const plans = Object.entries(data.byPlan).sort((a, b) => b[1] - a[1]);
      document.getElementById('bizPlans').innerHTML = plans.length
        ? '<table class="grid"><thead><tr><th>Package</th><th>Clinics</th><th>Share</th></tr></thead><tbody>' +
          plans.map(([plan, n]) => '<tr><td><b>' + esc(PLAN_NAME[plan] || plan) + '</b></td>' +
            '<td>' + esc(n) + '</td><td>' +
            esc(t.clinics ? Math.round(n / t.clinics * 100) + '%' : '—') + '</td></tr>').join('') +
          '</tbody></table>'
        : '<div class="empty">No clinics yet.</div>';

      const e = data.engagement;
      document.getElementById('bizEngagement').innerHTML =
        '<div class="stat-row">' + [
          ['Using it', e.active], ['Just joined', e.settling],
          ['Going quiet', e.slipping],
          ['Stopped', e.dormant], ['Never signed in', e.never]
        ].map(([label, value]) =>
          '<div class="stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>').join('') +
        '</div>';

      document.getElementById('bizClinics').innerHTML = data.clinics.length
        ? '<table class="grid"><thead><tr><th>Clinic</th><th>Package</th><th>Activity</th>' +
          '<th>Patients</th><th>Storage</th><th>Messages</th><th>Visits 30d</th>' +
          '<th>Own domain</th></tr></thead><tbody>' +
          data.clinics.map(c => {
            const [label, tone] = USE_LABEL[c.state] || USE_LABEL.never;
            /* Two separate facts, each said in full. "Worked" is what she
               recorded; "opened" is only that the app was unlocked. */
            const worked = ago(c.daysSinceWork);
            const opened = ago(c.daysSinceSignIn);
            return '<tr><td><b>' + esc(c.clinicName || c.name) + '</b><br><small>' +
              esc(c.name) + (c.status !== 'active' ? ' · ' + esc(c.status) : '') + '</small></td>' +
              '<td>' + esc(PLAN_NAME[c.plan] || c.plan) + '</td>' +
              '<td><span class="pill ' + tone + '">' + esc(label) + '</span>' +
                '<br><small>' + esc(worked ? 'Worked ' + worked : 'Nothing recorded yet') +
                '</small>' +
                (opened ? '<br><small class="muted">Opened ' + esc(opened) + '</small>' : '') +
                '</td>' +
              '<td>' + esc(c.patients) + '</td>' +
              '<td>' + esc(size(c.storageBytes)) + '</td>' +
              '<td>' + esc(c.messages.total) + '</td>' +
              '<td>' + esc(c.visits30d) + '</td>' +
              '<td>' + (c.customDomain
                ? esc(c.customDomain) + '<br><small>' + esc(c.customDomainStatus || '') + '</small>'
                : '<span class="muted">—</span>') + '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<div class="empty">No clinics yet.</div>';
    } catch (error) {
      fail(error.message);
    }
  }

  /* ---------------- web & domains ----------------
     custom_domain is in no plan, so a clinic only has it because somebody
     granted it here. This screen is the grant queue, the list of who has it,
     and the one number that says whether ₹50 covers what Cloudflare bills. */

  /* `rupees` is already defined higher up for the Money screen - one
     formatter, so ₹50 never appears two different ways on two screens. */

  const DOMAIN_STATE = {
    none: ['Not set up', 'trial'],
    pending: ['Waiting for her DNS', 'trial'],
    verifying: ['Waiting for her DNS', 'trial'],
    issuing: ['Certificate issuing', 'trial'],
    active: ['Live', 'active'],
    failed: ['Needs attention', 'suspended']
  };

  async function loadDomains() {
    try {
      const data = await AdminApi.domains();
      const m = data.money;
      const u = data.usage || {};

      /* The number he asked for: what we charge against what it costs. */
      document.getElementById('domainStats').innerHTML = [
        ['Waiting', data.requests.length],
        ['Switched on', m.clinics],
        ['We charge', rupees(m.revenuePaise) + '/mo'],
        ['Cloudflare cost', 'See provider bill'],
        ['Margin', 'Revenue less bill'],
        ['Hostnames', u.configured === false ? 'not set up'
          : (u.total == null ? '—' : u.total + ' / ' + (u.allocated || '—') + ' quota')]
      ].map(([label, value]) =>
        '<div class="stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>').join('');

      const count = document.getElementById('domainRequestCount');
      count.textContent = data.requests.length;
      count.hidden = data.requests.length === 0;

      document.getElementById('domainRequests').innerHTML = data.requests.length
        ? '<table class="grid"><thead><tr><th>Clinic</th><th>Package</th><th>Asked</th>' +
          '<th></th></tr></thead><tbody>' +
          data.requests.map(r =>
            '<tr><td><b>' + esc(r.clinicName || r.name) + '</b><br><small>' +
              esc(r.name) + '</small></td>' +
            '<td>' + esc(PLAN_NAME[r.plan] || r.plan) + '</td>' +
            '<td><small>' + esc((r.askedAt || '').slice(0, 10)) + '</small></td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn btn-primary btn-sm" data-domain-grant="' + esc(r.doctorId) + '">' +
                'Switch on (' + rupees(m.addonPaise) + '/mo)</button></td></tr>').join('') +
          '</tbody></table>'
        : '<div class="empty">Nobody is waiting.</div>';

      document.getElementById('domainGranted').innerHTML = data.connected.length
        ? '<table class="grid"><thead><tr><th>Clinic</th><th>Domain</th><th>State</th>' +
          '<th>Live since</th><th></th></tr></thead><tbody>' +
          data.connected.map(c => {
            const [label, tone] = DOMAIN_STATE[c.status] || DOMAIN_STATE.none;
            return '<tr><td><b>' + esc(c.clinicName || c.name) + '</b></td>' +
              '<td>' + (c.domain ? '<code>' + esc(c.domain) + '</code>'
                /* Paying ₹50 for something she never set up. A refund
                   conversation is cheaper than a complaint. */
                : '<span class="muted">not connected yet</span>') + '</td>' +
              '<td><span class="pill ' + tone + '">' + esc(label) + '</span>' +
                (c.error ? '<br><small>' + esc(c.error) + '</small>' : '') + '</td>' +
              '<td><small>' + esc((c.liveSince || '').slice(0, 10) || '—') + '</small></td>' +
              '<td><button class="btn btn-ghost btn-sm" data-domain-revoke="' +
                esc(c.doctorId) + '">Switch off</button></td></tr>';
          }).join('') + '</tbody></table>'
        : '<div class="empty">No clinic has this switched on.</div>';

      if (u.error) {
        note('domainMsgAdmin',
          'Cloudflare could not be reached for usage: ' + esc(u.error), 'warn');
      } else if (u.pending) {
        /* Billed from creation, serving nobody - usually a doctor who gave
           up halfway through her DNS. Worth chasing. */
        note('domainMsgAdmin', esc(u.pending) +
          ' hostname(s) are being billed but are not live yet.', 'info');
      } else {
        note('domainMsgAdmin', '', '');
      }
    } catch (error) {
      document.getElementById('domainRequests').innerHTML =
        '<div class="empty">' + esc(error.message) + '</div>';
    }
  }

  document.querySelector('[data-panel="webdomains"]')
    .addEventListener('click', async event => {
      const grant = event.target.closest('[data-domain-grant]');
      const revoke = event.target.closest('[data-domain-revoke]');
      if (!grant && !revoke) return;
      const id = grant ? grant.dataset.domainGrant : revoke.dataset.domainRevoke;
      if (revoke && !confirm('Switch off their own domain? Their TCOS address keeps working.')) return;
      try {
        await runSensitive(() => AdminApi.setDomainAllowed(id, !!grant));
        await loadDomains();
      } catch (error) {
        if (error.code !== 'cancelled') note('domainMsgAdmin', esc(error.message), 'error');
      }
    });

  /* ---------------- coupons ----------------
     The discount is Razorpay's offer, not our percentage - so the list shows
     plainly whether each coupon is actually usable and why not, rather than
     a tick that might mean nothing. */

  const couponDialog = document.getElementById('couponDialog');
  const closeCoupon = () => couponDialog.close();
  let couponRows = [];

  function openCoupon(coupon) {
    document.getElementById('couponForm').reset();
    note('couponFormMsg', '', '');
    document.getElementById('couponDialogTitle').textContent =
      coupon ? 'Edit ' + coupon.code : 'New coupon';
    document.getElementById('couponId').value = coupon ? coupon.id : '';
    document.getElementById('couponCode').value = coupon ? coupon.code : '';
    document.getElementById('couponLabel').value = coupon ? (coupon.label || '') : '';
    document.getElementById('couponPercent').value = coupon ? coupon.percentOff : '';
    document.getElementById('couponOffer').value = coupon ? (coupon.providerOfferId || '') : '';
    document.getElementById('couponStarts').value = coupon ? (coupon.startsOn || '') : '';
    document.getElementById('couponEnds').value = coupon ? (coupon.endsOn || '') : '';
    document.getElementById('couponMax').value = coupon && coupon.maxRedemptions != null
      ? coupon.maxRedemptions : '';
    document.getElementById('couponOnce').checked = !!(coupon && coupon.oncePerClinic);
    document.getElementById('couponNote').value = coupon ? (coupon.note || '') : '';
    couponDialog.showModal();
  }

  document.getElementById('addCouponBtn')
    .addEventListener('click', () => openCoupon(null));
  document.getElementById('couponCancel').addEventListener('click', closeCoupon);

  document.getElementById('couponSave').addEventListener('click', async () => {
    const id = document.getElementById('couponId').value;
    const payload = {
      code: document.getElementById('couponCode').value,
      label: document.getElementById('couponLabel').value,
      percentOff: document.getElementById('couponPercent').value,
      providerOfferId: document.getElementById('couponOffer').value,
      startsOn: document.getElementById('couponStarts').value || null,
      endsOn: document.getElementById('couponEnds').value || null,
      maxRedemptions: document.getElementById('couponMax').value || null,
      oncePerClinic: document.getElementById('couponOnce').checked,
      note: document.getElementById('couponNote').value
    };
    try {
      await runSensitive(() => id
        ? AdminApi.updateCoupon(id, payload)
        : AdminApi.createCoupon(payload));
      closeCoupon();
      await loadCoupons();
    } catch (error) {
      if (error.code !== 'cancelled') note('couponFormMsg', esc(error.message), 'error');
    }
  });

  async function loadCoupons() {
    try {
      couponRows = (await AdminApi.listCoupons()).coupons || [];
      document.getElementById('couponTable').innerHTML = couponRows.length
        ? '<table class="grid"><thead><tr><th>Code</th><th>Discount</th><th>Live</th>' +
          '<th>Used</th><th>Window</th><th></th></tr></thead><tbody>' +
          couponRows.map(c =>
            '<tr><td><b>' + esc(c.code) + '</b>' +
              (c.label ? '<br><small>' + esc(c.label) + '</small>' : '') + '</td>' +
            '<td>' + esc(c.percentOff) + '%' +
              (c.providerOfferId ? '' :
                '<br><small class="muted">no Razorpay offer</small>') + '</td>' +
            /* The state, and when it is not usable, WHY. "Off" with no reason
               is the message that generates the support ticket. */
            '<td><span class="pill ' + (c.usable ? 'active' : 'suspended') + '">' +
              (c.usable ? 'Live' : 'Not live') + '</span>' +
              (c.reason ? '<br><small>' + esc(c.reason) + '</small>' : '') + '</td>' +
            '<td>' + esc(c.timesRedeemed) +
              (c.maxRedemptions != null ? ' / ' + esc(c.maxRedemptions) : '') + '</td>' +
            '<td><small>' + esc(c.startsOn || 'any time') + ' → ' +
              esc(c.endsOn || 'no end') + '</small></td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn btn-ghost btn-sm" data-coupon-toggle="' + esc(c.id) + '">' +
                (c.active ? 'Switch off' : 'Switch on') + '</button> ' +
              '<button class="btn btn-ghost btn-sm" data-coupon-edit="' + esc(c.id) + '">Edit</button> ' +
              '<button class="btn btn-ghost btn-sm" data-coupon-delete="' + esc(c.id) + '">Delete</button>' +
            '</td></tr>').join('') + '</tbody></table>'
        : '<div class="empty">No coupons yet.</div>';
    } catch (error) {
      document.getElementById('couponTable').innerHTML =
        '<div class="empty">' + esc(error.message) + '</div>';
    }
  }

  document.getElementById('couponTable').addEventListener('click', async event => {
    const toggle = event.target.closest('[data-coupon-toggle]');
    const edit = event.target.closest('[data-coupon-edit]');
    const remove = event.target.closest('[data-coupon-delete]');
    const find = id => couponRows.find(c => c.id === id);
    try {
      if (edit) return openCoupon(find(edit.dataset.couponEdit));
      if (toggle) {
        const coupon = find(toggle.dataset.couponToggle);
        await runSensitive(() =>
          AdminApi.updateCoupon(coupon.id, { active: !coupon.active }));
        note('couponMsg', '', '');
        return loadCoupons();
      }
      if (remove) {
        const coupon = find(remove.dataset.couponDelete);
        if (!confirm('Delete ' + coupon.code + '?')) return;
        const result = await runSensitive(() => AdminApi.deleteCoupon(coupon.id));
        /* A used coupon is switched off rather than deleted, so its
           redemptions survive. Say so instead of leaving her wondering why
           the row is still there. */
        note('couponMsg', result.message ? esc(result.message) : '',
          result.deleted ? 'ok' : 'info');
        return loadCoupons();
      }
    } catch (error) {
      if (error.code !== 'cancelled') note('couponMsg', esc(error.message), 'error');
    }
  });

  async function loadInsights() {
    const render = (id, rows, empty) => {
      document.getElementById(id).innerHTML = rows.length
        ? '<table class="grid"><thead><tr><th>Group</th><th>Patients</th><th>Recorded events</th></tr></thead><tbody>' +
          rows.map(row => '<tr><td><b>' + esc(row.label) + '</b></td><td>' +
            esc(row.patients) + '</td><td>' + esc(row.events) + '</td></tr>').join('') + '</tbody></table>'
        : '<div class="empty">' + esc(empty) + '</div>';
    };
    try {
      const data = await AdminApi.healthAnalytics();
      const totalVisits = (data.monthly || []).reduce((sum, row) => sum + Number(row.visits || 0), 0);
      document.getElementById('insightStats').innerHTML = [
        ['Visits in last 12 months', totalVisits],
        ['Diagnosis groups visible', data.diagnoses.length],
        ['Test groups visible', data.tests.length],
        ['Privacy floor', data.minimumCohort + ' patients']
      ].map(([label, value]) => '<div class="stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>').join('');
      const suppressed = 'No group has reached the privacy floor of ' + data.minimumCohort + ' different patients yet.';
      render('diagnosisInsights', data.diagnoses || [], suppressed);
      render('testInsights', data.tests || [], suppressed);
      render('labInsights', data.laboratories || [], suppressed);
    } catch (error) {
      ['diagnosisInsights', 'testInsights', 'labInsights'].forEach(id => {
        document.getElementById(id).innerHTML = '<div class="empty">' + esc(error.message) + '</div>';
      });
    }
  }

  async function loadSupport() {
    try {
      const list = (await AdminApi.listSupport()).requests || [];
      const open = list.filter(r => r.status !== 'resolved').length;
      const urgent = list.filter(r => r.priority === 'urgent' && r.status !== 'resolved').length;
      document.getElementById('supportStats').innerHTML = [
        ['Open requests', open], ['Urgent', urgent], ['Resolved', list.length - open]
      ].map(([label, value]) => '<div class="stat"><b>' + value + '</b><span>' + label + '</span></div>').join('');
      document.getElementById('supportTable').innerHTML = list.length
        ? '<table class="grid"><thead><tr><th>Clinic</th><th>Request</th><th>Owner</th><th>Priority</th><th>Status</th></tr></thead><tbody>' +
          list.map(r => '<tr data-support-open="' + esc(r.id) + '" style="cursor:pointer"><td><b>' + esc(r.clinic_name) + '</b><br><small>' + esc(r.doctor_name) + '</small></td>' +
            '<td><b>' + esc(r.subject) + '</b><br><small>' + esc(r.category) + ' · ' + esc(r.message).slice(0, 140) +
            (String(r.message || '').length > 140 ? '…' : '') + '</small><br><small>' + esc(r.message_count || 1) + ' message' + (Number(r.message_count) === 1 ? '' : 's') + '</small></td>' +
            '<td>' + esc(r.assigned_to || 'Unassigned') + '</td>' +
            '<td><span class="pill ' + (r.priority === 'urgent' ? 'suspended' : 'trial') + '">' + esc(r.priority) + '</span></td>' +
            '<td><span class="pill ' + (r.status === 'resolved' ? 'active' : 'trial') + '">' + esc(r.status.replace('_', ' ')) + '</span></td></tr>').join('') + '</tbody></table>'
        : '<div class="empty">No support requests.</div>';
      document.querySelectorAll('[data-support-open]').forEach(row =>
        row.addEventListener('click', () => openSupport(row.dataset.supportOpen)));
    } catch (error) { document.getElementById('supportTable').innerHTML = '<div class="empty">' + esc(error.message) + '</div>'; }
  }

  const supportDetailDialog = document.getElementById('supportDetailDialog');
  let openSupportId = null;
  const closeSupport = () => { supportDetailDialog.close(); openSupportId = null; };
  document.getElementById('supportDetailClose').addEventListener('click', closeSupport);
  document.getElementById('supportDetailDone').addEventListener('click', closeSupport);

  async function openSupport(id) {
    openSupportId = id;
    note('supportDetailMsg', '', '');
    document.getElementById('supportThread').innerHTML = '<div class="empty">Loading the complete conversation…</div>';
    if (!supportDetailDialog.open) supportDetailDialog.showModal();
    try {
      const data = await AdminApi.support(id);
      const request = data.request;
      document.getElementById('supportDetailTitle').textContent = request.subject;
      document.getElementById('supportDetailMeta').innerHTML =
        '<div class="notice info"><b>' + esc(request.clinic_name) + '</b> · ' +
        esc(request.doctor_name) + '<br>' + esc(request.category) + ' · ' + esc(request.priority) +
        ' · opened ' + esc(new Date(request.created_at).toLocaleString('en-IN')) + '</div>';
      document.getElementById('supportDetailStatus').value = request.status;
      document.getElementById('supportAssignee').innerHTML = '<option value="">Unassigned</option>' +
        (data.assignees || [])
          .map(member => '<option value="' + esc(member.email) + '"' +
            (request.assigned_to === member.email ? ' selected' : '') + '>' + esc(member.full_name) + '</option>').join('');
      document.getElementById('supportThread').innerHTML = (data.messages || []).map(message =>
        '<article class="panel" style="margin:10px 0"><div class="body"><b>' +
        esc(message.author_type === 'platform' ? message.author_ref : request.clinic_name) + '</b>' +
        (message.internal ? ' <span class="pill trial">internal</span>' : '') +
        '<small style="display:block;color:var(--muted)">' +
        esc(new Date(message.created_at).toLocaleString('en-IN')) + '</small><p style="white-space:pre-wrap">' +
        esc(message.body) + '</p></div></article>').join('') || '<div class="empty">No messages.</div>';
    } catch (error) {
      document.getElementById('supportThread').innerHTML = '<div class="notice error">' + esc(error.message) + '</div>';
    }
  }

  document.getElementById('supportAssignee').addEventListener('change', async event => {
    if (!openSupportId) return;
    try {
      await AdminApi.updateSupport(openSupportId, { assignedTo: event.target.value || null });
      await loadSupport();
    } catch (error) { note('supportDetailMsg', esc(error.message), 'error'); }
  });
  document.getElementById('supportDetailStatus').addEventListener('change', async event => {
    if (!openSupportId) return;
    try {
      await AdminApi.updateSupport(openSupportId, { status: event.target.value });
      await loadSupport();
    } catch (error) { note('supportDetailMsg', esc(error.message), 'error'); }
  });
  document.getElementById('supportReplyForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!openSupportId) return;
    try {
      await AdminApi.replySupport(openSupportId,
        document.getElementById('supportReply').value.trim(),
        document.getElementById('supportInternal').checked);
      document.getElementById('supportReplyForm').reset();
      await openSupport(openSupportId);
      await loadSupport();
    } catch (error) { note('supportDetailMsg', esc(error.message), 'error'); }
  });

  /* ---------------- onboarding ---------------- */

  const inviteDialog = document.getElementById('inviteDialog');
  const handoverDialog = document.getElementById('handoverDialog');

  document.getElementById('inviteBtn').addEventListener('click', () => {
    note('inviteMsg', '');
    document.getElementById('inviteForm').reset();
    document.getElementById('invPacks').innerHTML =
      Object.entries(ClinicRegistry.PRACTICE_PACKS).map(([key, pack]) =>
        '<label class="toggle"><input type="checkbox" value="' + esc(key) + '">' +
        '<span>' + esc(pack.label) + '</span></label>').join('');
    document.querySelectorAll('#invPacks input').forEach(input =>
      input.addEventListener('change', () =>
        input.closest('.toggle').classList.toggle('on', input.checked)));
    inviteDialog.showModal();
  });

  document.getElementById('inviteCancel').addEventListener('click', () => inviteDialog.close());
  document.getElementById('inviteClose').addEventListener('click', () => inviteDialog.close());

  document.getElementById('inviteForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('inviteSave');
    button.disabled = true;
    try {
      const result = await runSensitive(() => AdminApi.inviteDoctor({
        identifier: document.getElementById('invIdentifier').value.trim(),
        fullName: document.getElementById('invName').value.trim(),
        qualification: document.getElementById('invQual').value.trim(),
        clinicName: document.getElementById('invClinic').value.trim(),
        registrationNo: document.getElementById('invReg').value.trim(),
        council: document.getElementById('invCouncil').value.trim(),
        address: document.getElementById('invAddress').value.trim(),
        plan: document.getElementById('invPlan').value,
        patientPrefix: document.getElementById('invPrefix').value.trim().toUpperCase(),
        practicePacks: Array.from(document.querySelectorAll('#invPacks input:checked')).map(i => i.value)
      }));
      inviteDialog.close();
      showHandover(document.getElementById('invClinic').value.trim(),
        result.identifier, result.temporaryPassword);
      await loadDoctors();
    } catch (error) {
      note('inviteMsg', esc(error.message), 'error');
    } finally {
      button.disabled = false;
    }
  });

  function showHandover(clinic, identifier, password, extraNote) {
    document.getElementById('handoverDetail').innerHTML =
      '<div class="field"><span>Clinic</span><div style="font-weight:600">' + esc(clinic) + '</div></div>' +
      '<div class="field"><span>Sign in with</span><div style="font-family:ui-monospace,monospace;font-size:1.05rem">' +
        esc(identifier) + '</div></div>' +
      '<div class="field"><span>Temporary password</span>' +
        '<div style="font-family:ui-monospace,monospace;font-size:1.35rem;font-weight:700;letter-spacing:.06em">' +
        esc(password) + '</div></div>' +
      '<p style="font-size:.82rem;color:var(--muted)">' +
        esc(extraNote || ('Sign-in page: ' + location.origin + '/tcos-login.html')) + '</p>';
    handoverDialog.showModal();

    document.getElementById('copyHandover').onclick = () => {
      const loginPath = extraNote ? '/admin' : '/tcos-login.html';
      const text = 'TCOS sign-in\n' + location.origin + loginPath + '\n\n' +
        'User: ' + identifier + '\nTemporary password: ' + password +
        '\n\nYou will be asked to choose your own password on first sign-in.';
      navigator.clipboard.writeText(text).then(
        () => { document.getElementById('copyHandover').textContent = 'Copied'; },
        () => { document.getElementById('copyHandover').textContent = 'Copy failed'; });
    };
  }

  document.getElementById('handoverDone').addEventListener('click', () => {
    handoverDialog.close();
    document.getElementById('copyHandover').textContent = 'Copy';
  });

  /* Already signed in? Skip the gate. */
  if (AdminApi.isSignedIn()) {
    try { await open(); } catch (_) { /* stale token, show the gate */ }
  }
})();
