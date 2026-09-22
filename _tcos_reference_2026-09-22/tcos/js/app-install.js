/* =========================================================================
   Making TCOS an app on a doctor's phone.

   A doctor using the product asked for two things: that it be installable
   like an app, and that it be workable with a thumb rather than a mouse.
   This file does the first and js/nav.js draws the second.

   WHERE THE BUTTON LIVES, AND WHY IT MOVED
   ----------------------------------------
   It used to be wired in js/nav.js, which only ever runs once a doctor is
   signed in. Vijay: "why do we have install button inside the signed in
   page, lets keep it outside, from the time of creating account till end
   it should be available."

   He is right, and the old reasoning was wrong rather than merely narrow.
   The objection to offering it on the public pages was that installing the
   landing page would give her an icon that opens an advert - but the
   manifest's start_url is /tcos-clinic.html, so the icon opens the APP no
   matter which page she added it from. There was never anything to protect
   against. So the wiring lives here, next to the mechanism, and ANY page
   can offer it by putting data-tcos-install on a button.

   FOUR JOBS, AND THEY ARE DELIBERATELY SMALL:

     1. Point the page at the manifest. Every page now carries a static
        <link rel="manifest"> as well, because Chrome decides installability
        while the page loads and an injected one usually arrives too late.
        This stays as the belt to that pair of braces.

     2. Register the service worker - see sw.js, which caches almost
        nothing on purpose.

     3. Catch Android's install prompt and offer it as a button, because
        the browser's own banner appears once, in its own time, and a
        doctor who dismisses it by accident has no way back to it.

     4. Wire every install button on the page, and tell her the taps for
        her own browser when there is no prompt to fire.

   iOS DOES NOT FIRE beforeinstallprompt AND NEVER WILL. Safari installs
   through Share -> Add to Home Screen, with no API to trigger it. So on an
   iPhone the button explains that instead of pretending to be able to do
   it - a dead button is worse than a sentence.
   ========================================================================= */
(() => {
  'use strict';

  /* The patient pages are not hers at all - a patient must never be offered
     a clinic to install. Everything else may be: the public pages because
     the manifest's start_url is the app (see above), and the owner console
     because it declares a manifest of its own, /owner.webmanifest, and
     installs as a separate navy-iconed app. */
  const NOT_THE_APP = ['/p.html', '/u.html'];
  const path = location.pathname;
  if (NOT_THE_APP.includes(path)) return;

  /* ---- 1. the manifest ---- */
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.appendChild(link);
  }

  /* The colour behind the status bar once installed. Matches the manifest's
     theme_color; test/mobile-app.test.js holds the two equal. */
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#00707C';
    document.head.appendChild(meta);
  }

  /* iOS ignores the manifest for the home-screen name and icon and reads
     these instead. Cheap, and without them an installed TCOS on an iPhone
     is called whatever the <title> says and wears a screenshot. */
  const appleTags = [
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-title', content: 'TCOS' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }],
    ['link', { rel: 'apple-touch-icon', href: '/assets/app/icon-192.png' }]
  ];
  for (const [tag, attrs] of appleTags) {
    const selector = tag + (attrs.name ? '[name="' + attrs.name + '"]' : '[rel="' + attrs.rel + '"]');
    if (document.querySelector(selector)) continue;
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    document.head.appendChild(node);
  }

  /* ---- 2. the service worker ---- */
  /* Registration failing must never take a screen down with it. A doctor
     mid-consultation does not care that a cache could not be set up. */
  /* A service worker needs a secure context, which means https OR localhost -
     and localhost matters, because excluding it means the one thing nobody
     can test before it reaches a doctor's phone is the piece of code sitting
     between the app and the network. */
  const secureContext = location.protocol === 'https:' ||
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  if ('serviceWorker' in navigator && secureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* not fatal */ });
    });
  }

  /* ---- 3. the install button ---- */

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  let deferred = null;

  window.addEventListener('beforeinstallprompt', event => {
    /* Chrome shows its own banner unless this is called. Taken over so the
       offer sits on a button she can find again, rather than a strip that
       appears once and is gone. */
    event.preventDefault();
    deferred = event;
    window.TCOSInstall.refresh();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    window.TCOSInstall.refresh();
  });

  const isAndroid = () => /android/i.test(navigator.userAgent);
  /* Firefox and Safari on a desktop cannot install at all; Chrome and Edge
     can. Worth separating, because telling somebody to look for an icon
     that their browser does not have is worse than saying it cannot. */
  const isChromium = () => !!window.chrome || /edg\//i.test(navigator.userAgent);

  const escape_ = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  window.TCOSInstall = {
    isStandalone,

    /* Is there anything worth offering? Already installed: no. */
    available: () => !isStandalone() && (!!deferred || isIOS()),

    /* iOS cannot be prompted, so it is told instead. */
    needsManualSteps: () => !deferred,

    /* What to actually do, for the browser he is in.
     *
       This exists because "install the app" is three different gestures on
       three platforms and none of them is discoverable. A doctor who taps a
       button and is shown nothing concludes the app does not work - which
       is exactly the message that prompted this. */
    steps() {
      if (isIOS()) {
        return {
          title: 'Add TCOS to your iPhone',
          steps: [
            'Tap the Share button at the bottom of Safari — the square with an arrow.',
            'Scroll down and tap "Add to Home Screen".',
            'Tap Add. TCOS appears with your other apps.'
          ]
        };
      }
      if (isAndroid()) {
        return {
          title: 'Add TCOS to your phone',
          steps: [
            'Tap the ⋮ menu at the top right of Chrome.',
            'Tap "Install app", or "Add to Home screen" if that is what it says.',
            'Confirm. TCOS appears with your other apps.'
          ]
        };
      }
      if (isChromium()) {
        return {
          title: 'Install TCOS on this computer',
          steps: [
            'Look for the install icon at the right-hand end of the address bar.',
            'If it is not there, open the ⋮ menu and choose "Cast, save and share" → "Install page as app".',
            'It opens in its own window, without browser tabs.'
          ]
        };
      }
      return {
        title: 'Installing TCOS',
        steps: [
          'This browser cannot install web apps.',
          'Open TCOS in Chrome, Edge or Safari and the option appears.',
          'Everything works here in the meantime — installing only removes the browser bar.'
        ]
      };
    },

    async prompt() {
      if (deferred) {
        deferred.prompt();
        const choice = await deferred.userChoice.catch(() => null);
        /* The event is single-use: Chrome will fire a fresh one later if
           she declines, so holding a spent one would give her a button
           that does nothing. */
        deferred = null;
        window.TCOSInstall.refresh();
        return choice && choice.outcome === 'accepted';
      }
      return false;
    },

    /* ---- wiring ----

       THE BUTTON IS ALWAYS SHOWN unless the app is already installed.
       Hiding it until Chrome fires beforeinstallprompt is what a tidy
       implementation does and it is wrong here: Safari never fires it,
       Chrome fires it on its own schedule, and a doctor told there is an
       app would find nothing and conclude the product is broken. When
       there is no prompt to fire, the button says how to do it by hand
       for the browser she is actually in. */
    wire(button) {
      if (!button || button.dataset.installWired === 'yes') return;
      button.dataset.installWired = 'yes';

      if (isStandalone()) { button.hidden = true; return; }
      button.hidden = false;
      button.textContent = this.needsManualSteps() ? 'How to install' : 'Install app';

      button.addEventListener('click', async () => {
        /* No prompt available - Safari, or Chrome has not offered one yet.
           Telling her the taps is the whole point of the button existing. */
        const done = await window.TCOSInstall.prompt();
        if (done) { button.hidden = true; return; }
        showInstallSteps(window.TCOSInstall.steps());
      });
    },

    /* Every button on the page, including ones added after it loaded - the
       application form replaces itself with a panel that carries one. */
    wireAll() {
      document.querySelectorAll('[data-tcos-install]')
        .forEach(button => window.TCOSInstall.wire(button));
    },

    /* nav.js may register a redraw of its own; the labels are refreshed
       here either way, because Android often decides the app qualifies a
       second or two after the page has painted. */
    onChange: null,
    refresh() {
      const installed = isStandalone();
      const label = this.needsManualSteps() ? 'How to install' : 'Install app';
      document.querySelectorAll('[data-tcos-install]').forEach(button => {
        button.hidden = installed;
        button.textContent = label;
      });
      if (typeof this.onChange === 'function') this.onChange();
    }
  };

  function showInstallSteps(steps) {
    let dialog = document.getElementById('installHelp');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'installHelp';
      document.body.appendChild(dialog);
    }
    const list = (steps && steps.steps) || [];
    dialog.innerHTML =
      '<header><h3>' + escape_((steps && steps.title) || 'Add TCOS to your home screen') +
        '</h3><button type="button" id="installHelpClose" aria-label="Close">&times;</button></header>' +
      '<div class="body"><ol class="install-steps">' +
        list.map(s => '<li>' + escape_(s) + '</li>').join('') +
      '</ol><p class="muted">It opens without a browser bar, like any other app, ' +
        'and signs you in the same way.</p></div>' +
      '<footer><button type="button" class="btn btn-primary" id="installHelpDone">Got it</button></footer>';
    dialog.querySelector('#installHelpClose').addEventListener('click', () => dialog.close());
    dialog.querySelector('#installHelpDone').addEventListener('click', () => dialog.close());
    dialog.showModal();
  }

  /* Public pages carry their button in the markup, so wire them as soon as
     there is a body to look in. The app's rail is drawn later by nav.js and
     calls wireAll() itself. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.TCOSInstall.wireAll());
  } else {
    window.TCOSInstall.wireAll();
  }
})();
