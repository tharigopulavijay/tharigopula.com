/* =========================================================================
   The frame every signed-in screen sits in: the rail, and the bar across
   the top.

   It is built here rather than written into each page for one reason that
   matters more than tidiness. The rail must show only what the person
   signed in may actually open, and a navigation copied into seven files
   drifts. One of those copies eventually offers a receptionist a link to
   the clinical records - the click is refused by the server, but she has
   been told the door exists, and being refused feels like a fault rather
   than a rule.

   So: one list, filtered by the capabilities the API reports.

   This hides doors. It does NOT grant anything. Every route is gated on the
   server, and test/staff.test.js proves it - hiding a link is presentation,
   never permission.
   ========================================================================= */
(() => {
  const svg = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

  /* The product decides the mark in the rail and a handful of words. If
     products.js has not loaded (a page that predates it), fall back to the
     platform logo rather than rendering an empty corner. */
  /* Read at paint time, not at load. paint() reconciles the remembered
     product against the signed-in doctor's, and a constant captured up here
     would still hold whatever was guessed before we knew who she was. */
  const currentProduct = () =>
    window.TCOSProduct ||
    (window.TCOSProducts ? window.TCOSProducts.resolve(null) : null);

  /* ---------------- the bottom tab bar, for a thumb ----------------

     A doctor using TCOS on his phone, through Vijay: "he is using mobile,
     he is saying it is difficulty to manage through mobile... easy access
     having buttons on below switching tabs."

     He is describing the thing every phone app does and this one did not.
     The rail is a column down the left, which on a 375px screen is either
     in the way or hidden behind a menu - and either way the four things he
     does all day are three taps deep.

     FOUR TABS, AND FOUR IS THE POINT. Five is where a tab bar starts
     becoming a menu, and the whole value of it is that the target is big
     enough to hit without looking. The rest of the rail is still there
     under "More", and the rail itself is unchanged on a desktop.

     They are chosen from the SAME list the rail is built from, filtered by
     the same capabilities - so a receptionist never gets a tab to a screen
     the server would refuse her, and adding a screen in one place does not
     leave the phone showing a stale set. */
  const TAB_ORDER = ['tcos-clinic.html', 'patients.html', 'desk.html', 'prescriptions.html'];

  function paintTabBar(me, may, included) {
    let bar = document.querySelector('nav.tabbar');
    if (!bar) {
      bar = document.createElement('nav');
      bar.className = 'tabbar';
      bar.setAttribute('aria-label', 'Main');
      document.body.appendChild(bar);
    }

    const items = navItems().filter(([, , , cap]) => may(cap));
    const byHref = new Map(items.map(item => [item[0], item]));
    const chosen = TAB_ORDER.map(href => byHref.get(href)).filter(Boolean).slice(0, 4);

    /* Fewer than four she may open - a pharmacist, say - so the bar is
       filled from whatever is left rather than showing two lonely tabs. */
    for (const item of items) {
      if (chosen.length >= 4) break;
      if (!chosen.includes(item)) chosen.push(item);
    }

    /* data-icon, exactly as the rail does it. The icons are CSS masks keyed
       off that attribute, so the tab bar gets the same set for free - and a
       second copy of twelve inline SVGs would be a second set to keep in
       step with the first. */
    const here = location.pathname.split('/').pop() || 'tcos-clinic.html';
    bar.innerHTML = chosen.map(([href, icon, label, , feature]) =>
      '<a href="' + href + '" data-icon="' + icon + '"' +
        (href === here ? ' class="active" aria-current="page"' : '') +
        (included(feature) ? '' : ' data-off-plan="1"') + '>' +
        '<span>' + escape_(label) + '</span></a>').join('') +
      '<button type="button" class="tabbar-more" data-icon="more" id="tabbarMore" ' +
        'aria-label="More screens"><span>More</span></button>';

    /* "More" opens the full rail as a sheet rather than navigating - the
       rail already lists everything she may open, correctly filtered, and a
       second copy of that list would be the drift this file exists to
       prevent. */
    const more = bar.querySelector('#tabbarMore');
    if (more) more.addEventListener('click', () => {
      document.body.classList.toggle('rail-open');
    });

    /* Tapping the backdrop closes it. Without this the only way out of the
       sheet is the More button, which is now behind it. */
    if (!document.querySelector('.rail-scrim')) {
      const scrim = document.createElement('div');
      scrim.className = 'rail-scrim';
      scrim.addEventListener('click', () => document.body.classList.remove('rail-open'));
      document.body.appendChild(scrim);
    }
  }

  /* ---------------- "Install app" ----------------------------------------

     THE WIRING MOVED TO js/app-install.js on 20 Sep 2026.

     Vijay: "why do we have install button inside the signed in page, lets
     keep it outside, from the time of creating account till end it should
     be available."

     It lived here, and this file only runs once a doctor is signed in - so
     the offer did not exist on the landing page, the application form or
     the sign-in screen, which is most of the time she spends deciding.
     app-install.js wires every [data-tcos-install] button on any page it
     runs on; the rail just draws one like everybody else. */

  const platformLogo = () => {
    const p = currentProduct();
    return p
      ? '<img class="tcos-logo" src="' + p.logo + '" alt="' + p.name + ' — ' + p.full + '">'
      : '<img class="tcos-logo" src="assets/tcos-logo.png" alt="TCOS — Clinical Operating System">';
  };

  const word = (key, fallback) => (window.TCOSProducts
    ? window.TCOSProducts.label(currentProduct(), key, fallback)
    : fallback);

  /* href, icon key, label, and the capability it needs. `null` means anyone
     signed in - which is only ever their own account. */
  const navItems = () => [
    ['tcos-clinic.html',   'today',    'Today',         'appointments'],
    ['patients.html',      'patients', 'Patients',      'patients'],
    /* The consultation desk: queue, prescription and history on one screen.
       It needs WRITE_NOTES because opening it is opening a consultation -
       front desk and pharmacy have no business there. Sits above the
       Prescriptions list because this is where a doctor works and that is
       where she looks things up. */
    ['desk.html',          'rx',       'Consultation',  'write_notes'],
    ['prescriptions.html', 'rx',       'Prescriptions', 'read_notes'],
    ['pharmacy.html',      'pharmacy', 'Pharmacy',      'pharmacy',   'pharmacy'],
    ['billing.html',       'billing',  'Billing',       'billing',    'billing'],
    /* This screen is the clinic's diagnostic history, so every treating
       doctor may open it. `reports` is reserved for owner-level practice
       analytics (money and aggregate activity), not patient results. */
    ['reports.html',       'reports',  word('reports', 'Reports'),   'read_notes'],
    /* Sits beside Reports because that is what a confirmed reading becomes.
       Gated on read_notes, not patients: front desk may photograph and
       upload a report, but what the model read is clinical content. */
    ['readings.html',      'reports',  'Readings to check', 'read_notes', 'lab_reports'],
    /* Gated on patients, not read_notes: this is the front desk's evening
       job, and it shows a name, a time and the reminder wording - nothing
       clinical. Gating it behind notes would put it out of reach of the
       only people who would ever open it. */
    ['reminders.html',     'today',    'Reminders',     'patients'],
    /* Her own page on the web. Vijay: "keep this button as WEB and let us
       give this option to doctors - it is real right, everyone wants their
       thing to be real." It was buried inside Clinic setup below the
       working hours, which is where a doctor never found it. */
    ['website.html',      'web',      'Web',           'settings',   'website_connect'],
    ['practice.html',      'practice', word('practice', 'My practice'), 'settings'],
    ['subscription.html',  'billing',  'Plan & payment', 'settings'],
    ['team.html',          'team',     'Team',          'team']
  ];

  const initialsOf = name => String(name || '?')
    .replace(/^(Dr\.?|Prof\.?)\s+/i, '')      /* "Dr. Anita" is A, not D */
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('') || '?';

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function paint(currentPage, me) {
    /* The signed-in doctor's product is the truth; the remembered one is a
       guess made before we knew who she was. Reconcile here, or a stale
       value - from a ?product= demo, or the last doctor on a shared clinic
       computer - leaves her looking at another product's logo above her own
       clinic's name. */
    if (me && me.product && window.TCOSProducts &&
        (!window.TCOSProduct || window.TCOSProduct.id !== me.product)) {
      window.TCOSProducts.remember(me.product);
    }

    /* The static HTML titles predate the three products. Once the signed-in
       clinic is known, the browser title must follow that clinic too. */
    const page = navItems().find(([href]) => href === currentPage);
    const product = currentProduct();
    if (page && product) document.title = page[2] + ' | ' + product.name;

    const who = me.me || { name: me.fullName, roleLabel: 'Doctor', isDoctor: true, can: null };
    /* An older session, before staff accounts, reports no capability list.
       It belongs to the doctor herself, so everything stays open. */
    const allowed = who.can ? new Set(who.can) : null;
    const may = cap => !cap || !allowed || allowed.has(cap);

    /* What her PLAN includes, resolved by the Worker and sent on /me.
       Separate from `can`, which is what her ROLE allows - a front desk
       user and a Free clinic are refused for different reasons and the
       distinction matters when explaining it.

       Vijay: "Vijay Hospital is on Free, why is she getting all the
       options?" She was, because nothing here knew about the plan.

       A screen not on the plan is still LISTED and still opens - a
       downgrade must never hide records she already entered - but it is
       marked, and the writes behind it are refused by the Worker. Hiding it
       would be presentation pretending to be permission, and would also
       lock a clinic out of its own pharmacy history the day it dropped to
       Free. */
    const onPlan = me.features ? new Set(me.features) : null;
    const included = feature => !feature || !onPlan || onPlan.has(feature);

    /* ---------------- the rail ---------------- */
    const rail = document.querySelector('nav.rail');
    if (rail) {
      const links = navItems().filter(([, , , cap]) => may(cap))
        .map(([href, icon, label, , feature]) => {
          /* One class list, built once. Writing two class attributes - which
             an earlier version of this line did - means the browser keeps
             the first and silently drops the second. */
          const classes = [
            href === currentPage ? 'active' : '',
            included(feature) ? '' : 'not-on-plan'
          ].filter(Boolean).join(' ');
          return '<a href="' + href + '" data-icon="' + icon + '"' +
            (classes ? ' class="' + classes + '"' : '') +
            (included(feature) ? ''
              : ' title="Not included on your plan — you can still read what is there"') +
            '>' + label + '</a>';
        }).join('');

      /* Collapse to icons. Vijay: "the side navigation panel should shrink
         to the icon view so they have good space, and doctor still has
         option to navigate."
       *
         The choice is remembered per browser, because a doctor who works
         collapsed wants it collapsed tomorrow too - and it is a display
         preference, so localStorage failing (a private window, blocked site
         data) must leave the rail open rather than break the page. */
      const COLLAPSE_KEY = 'tcos-rail-collapsed';
      let collapsed = false;
      try { collapsed = localStorage.getItem(COLLAPSE_KEY) === '1'; } catch (_) { collapsed = false; }
      document.body.classList.toggle('rail-collapsed', collapsed);

      rail.innerHTML =
        '<div class="rail-brand">' + platformLogo() + '</div>' +
        '<button type="button" class="rail-toggle" id="railToggle" ' +
          'aria-label="Show or hide the menu labels" title="Collapse the menu">' +
          '<span aria-hidden="true">&#9776;</span></button>' +
        links +
        '<div class="rail-foot">' +
          '<div class="rail-who"><span class="avatar">' + initialsOf(who.name) + '</span>' +
          '<div><b>' + escape_(me.clinicName || 'Your clinic') + '</b>' +
          '<small>' + escape_(who.name || '') +
          (who.isDoctor ? '' : ' · ' + escape_(who.roleLabel || '')) + '</small></div></div>' +
          '<button type="button" class="btn btn-ghost btn-sm btn-full" id="installAppBtn" ' +
            'data-tcos-install hidden>' +
            'Install app' +
          '</button>' +
          '<button class="btn btn-ghost btn-sm btn-full" id="signOutBtn">Sign out</button>' +
        '</div>';

      /* The rail is drawn long after app-install.js finished wiring the
         page, so the button it just rendered has to be handed over. Every
         other install button on the site is found automatically. */
      if (window.TCOSInstall) window.TCOSInstall.wireAll();

      /* Every link keeps its label as a tooltip, so a collapsed rail is
         still navigable by someone who does not yet know the icons. */
      rail.querySelectorAll('a[data-icon]').forEach(link => {
        if (!link.title) link.title = link.textContent.trim();
      });

      const toggle = rail.querySelector('#railToggle');
      if (toggle) toggle.addEventListener('click', () => {
        collapsed = !document.body.classList.contains('rail-collapsed');
        document.body.classList.toggle('rail-collapsed', collapsed);
        try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (_) { /* fine */ }
      });

    }

    /* OUTSIDE the rail branch, deliberately. The consultation screen has no
       rail - it is a focused full-width workspace with its own top bar - and
       that is the screen a doctor spends his day in. A tab bar that appeared
       everywhere EXCEPT there would miss the one place it is needed. */
    paintTabBar(me, may, included);

    /* ---------------- the bar across the top ----------------

       The clinic, a search, what is waiting, and who you are.

       The search is the reason this bar exists. A doctor's most common act is
       "find this person" - a patient is standing in front of her saying a
       number - and until now that meant going to the Patients screen first,
       from wherever she happened to be. Now it is one box on every screen. */
    const workspace = document.querySelector('main.workspace');
    if (workspace && !document.querySelector('.topbar')) {
      const bar = document.createElement('div');
      bar.className = 'topbar';
      bar.innerHTML =
        '<div class="topbar-clinic">' +
          svg('<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4"/>') +
          '<span>' + escape_(me.clinicName || 'Your clinic') + '</span></div>' +
        (may('patients')
          ? '<div class="topbar-search">' +
            svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>') +
            '<input id="globalSearch" autocomplete="off" ' +
            'placeholder="Search patient, TCOS number or mobile">' +
            '<div class="topbar-results" id="globalResults" hidden></div></div>'
          : '') +
        '<div class="spacer"></div>' +
        (may('appointments')
          ? '<a class="topbar-bell" href="tcos-clinic.html" id="topbarBell" title="Waiting for you">' +
            svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>') +
            '<span class="dot" id="topbarDot" hidden></span></a>'
          : '') +
        '<span class="topbar-avatar" title="' + escape_(who.name || '') + '">' +
          initialsOf(who.name) + '</span>';
      workspace.insertBefore(bar, workspace.firstChild);
      if (may('patients')) wireSearch();
    }

    const out = document.getElementById('signOutBtn');
    if (out) {
      out.addEventListener('click', async () => {
        await TCOSApi.signOut();
        /* Clinic computers are shared. The next person to reach this screen
           should see the neutral sign-in page, not the last doctor's product. */
        if (window.TCOSProducts) window.TCOSProducts.forget();
        location.href = 'tcos-login.html';
      });
    }

    /* Somebody on a temporary password has not finished signing in. Nothing
       else on the screen matters until they have chosen their own. */
    if (who.mustChangePassword) forcePasswordChange(who);
  }

  /* ------------------------- global patient search ---------------------

     The list is fetched once and searched here rather than asking the server
     on every keystroke: a single doctor's patient list is small, it does not
     change while she is typing, and a request per keypress would make the
     box feel slower than her hands.

     Matching is the same three things the Patients screen accepts - name,
     TCOS number, and any run of digits from the mobile - because a patient
     reads their number out in whatever way they remember it. */
  let roster = null;

  function wireSearch() {
    const box = document.getElementById('globalSearch');
    const panel = document.getElementById('globalResults');
    if (!box || !panel) return;

    const digitsOf = v => String(v || '').replace(/\D/g, '');

    const close = () => { panel.hidden = true; panel.innerHTML = ''; };

    async function run() {
      const term = box.value.trim().toLowerCase();
      if (term.length < 2) { close(); return; }

      if (!roster) {
        try { roster = (await TCOSApi.listPatients()).patients || []; }
        catch (_) { roster = []; }
      }

      const digits = digitsOf(term);
      const hits = roster.filter(p =>
        (p.full_name || '').toLowerCase().includes(term) ||
        (p.local_ref || '').toLowerCase().includes(term) ||
        (digits.length >= 3 && digitsOf(p.mobile).includes(digits))
      ).slice(0, 7);

      panel.hidden = false;
      panel.innerHTML = hits.length
        ? hits.map(p =>
            '<a href="record.html?patient=' + encodeURIComponent(p.id) + '">' +
            '<span class="face">' + escape_((p.full_name || '?').charAt(0).toUpperCase()) + '</span>' +
            '<div><b>' + escape_(p.full_name) + '</b><small>' +
            escape_([p.local_ref, p.mobile].filter(Boolean).join(' · ')) + '</small></div></a>').join('')
        : '<div class="none">Nobody on your list matches that.</div>';
    }

    let timer;
    box.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 140); });
    box.addEventListener('focus', run);
    box.addEventListener('keydown', event => {
      if (event.key === 'Escape') { box.blur(); close(); }
      /* Enter opens the first match, so she never has to reach for the mouse. */
      if (event.key === 'Enter') {
        const first = panel.querySelector('a');
        if (first) location.href = first.getAttribute('href');
      }
    });
    /* Clicking away closes it, but not while the click is landing on a result. */
    document.addEventListener('click', event => {
      if (!event.target.closest('.topbar-search')) close();
    });
  }

  /* Count of things waiting, shown on the bell. Called by whichever screen
     already knows the number, so this never makes a request of its own. */
  function waiting(count) {
    const dot = document.getElementById('topbarDot');
    if (!dot) return;
    dot.hidden = !count;
    dot.textContent = count > 9 ? '9+' : String(count || '');
  }

  function escape_(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ------------------------- first sign-in ------------------------------ */

  function forcePasswordChange(who) {
    if (document.getElementById('mustChangeDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'mustChangeDialog';
    dialog.innerHTML =
      '<header><h3>Choose your own password</h3></header>' +
      '<div class="body">' +
        '<p class="explain">Welcome, ' + escape_(who.name) + '. You signed in with a ' +
        'temporary password the doctor gave you. Choose your own before you ' +
        'start - nobody else will know it, including us.</p>' +
        '<div id="mcMsg"></div>' +
        '<label class="field"><span>The temporary password</span>' +
        '<input id="mcCurrent" type="password" required autocomplete="current-password"></label>' +
        '<label class="field"><span>Your new password</span>' +
        '<input id="mcNew" type="password" required autocomplete="new-password">' +
        '<small>At least 8 characters, with letters and numbers.</small></label>' +
        '<label class="field"><span>Type it again</span>' +
        '<input id="mcAgain" type="password" required autocomplete="new-password"></label>' +
      '</div>' +
      '<footer><button class="btn btn-primary btn-full" id="mcSave">Save and continue</button></footer>';
    document.body.appendChild(dialog);
    dialog.showModal();
    /* No escape hatch: closing this without setting a password would leave
       them inside on a password their employer knows. */
    dialog.addEventListener('cancel', event => event.preventDefault());

    document.getElementById('mcSave').addEventListener('click', async () => {
      const note = (text, kind) => {
        document.getElementById('mcMsg').innerHTML =
          '<div class="notice ' + kind + '" style="max-width:none">' + escape_(text) + '</div>';
      };
      const next = document.getElementById('mcNew').value;
      if (next !== document.getElementById('mcAgain').value) {
        note('Those two do not match.', 'error'); return;
      }
      document.getElementById('mcSave').disabled = true;
      try {
        await TCOSApi.changePassword(document.getElementById('mcCurrent').value, next);
        dialog.close();
        location.reload();
      } catch (error) {
        note(error.message, 'error');
        document.getElementById('mcSave').disabled = false;
      }
    });
  }

  /* Which page we are on, as the NAV list spells it.

     Cloudflare Pages serves /tcos-clinic, not /tcos-clinic.html, so matching
     the raw filename meant nothing was ever marked active on the live site -
     the rail highlighted correctly on a local file and nowhere else. */
  function currentPage() {
    const last = location.pathname.split('/').pop() || 'index.html';
    if (last.endsWith('.html')) return last;
    return last ? last + '.html' : 'index.html';
  }

  /* PAINTING IS WHAT ENDS THE SPLASH.
   *
     Hooked here rather than in each of the twelve screens that call paint(),
     because "the app is on screen" is exactly what this function means and
     a screen that forgot to say so would sit behind the boot overlay until
     its deadline - which is the bug this replaced, in a new costume. */
  const painted = (page, me) => {
    paint(page, me);
    if (window.TCOSBoot) window.TCOSBoot.ready();
  };

  window.TCOSNav = { paint: (page, me) => painted(page || currentPage(), me), waiting };
  /* The old name, kept so screens written before this file keep working. */
  window.TCOSRail = { paint: me => painted(currentPage(), me) };
})();
