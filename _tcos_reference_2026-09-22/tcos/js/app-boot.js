/* =========================================================================
   The first three seconds, and the promise that the screen always resolves.

   Vijay, having installed the app on his phone: "the time i open app i am
   getting tcos. its been 15 min i am seeing the same screen, white screen
   showing TCOS, nothing is working. see tcos logo should be visible only
   till 3 seconds then enter into the platform. people dont have that much
   time right."

   WHAT WAS ACTUALLY HAPPENING
   ---------------------------
   Reproduced in a real browser: a phone whose stored session the server has
   since stopped honouring sends the app and the sign-in screen bouncing off
   each other - tcos-clinic decides she is signed in and asks the server,
   the sign-in screen decides she is signed in and sends her back - and
   neither page ever finishes painting. The renderer spins so hard it will
   not even run script. On Android the install splash (white, with the TCOS
   mark) stays up the whole time, which is the white screen he sat in front
   of for fifteen minutes.

   The loop was one way to get there. It was not the only one. EVERY failure
   on this path ended in a blank screen: an API call that never settles, a
   script that fails to load on bad 4G, a session that expires mid-flight.
   There was no deadline anywhere, so "not working yet" and "never going to
   work" looked identical, forever.

   SO THIS FILE MAKES TWO PROMISES.

     1. THE SCREEN ALWAYS RESOLVES. Three seconds after the app opens it is
        either painted, or she is looking at something that says what went
        wrong and what to press. Never a blank page, whatever broke.

     2. THE BOUNCE CANNOT REPEAT. The app and the sign-in screen may hand
        her to each other once. The second time is a disagreement they are
        not going to settle, so the session is cleared and she is put on
        the sign-in screen with a sentence explaining it.

   It is loaded FIRST on every app page, before the API client, so the
   overlay is already on screen when anything else starts - and it carries
   its own styles rather than waiting for a stylesheet, because a splash
   that needs a stylesheet to load is a splash that cannot cover a
   stylesheet failing to load.
   ========================================================================= */
(() => {
  'use strict';

  /* Three seconds, because he named three seconds and he is right: it is
     about as long as somebody will look at a logo before deciding an app is
     broken. It is a DEADLINE, not a delay - the app appears the instant it
     is ready, usually well inside this. */
  const DEADLINE_MS = 3000;

  const BOUNCE_KEY = 'tcos-boot-bounce';
  const SIGN_IN = 'tcos-login.html';

  const read = key => { try { return sessionStorage.getItem(key); } catch (_) { return null; } };
  const write = (key, value) => { try { sessionStorage.setItem(key, value); } catch (_) { /* private mode */ } };
  const drop = key => { try { sessionStorage.removeItem(key); } catch (_) { /* fine */ } };

  let settled = false;
  let timer = null;

  /* ---------------- the splash ---------------- */

  const overlay = document.createElement('div');
  overlay.id = 'tcosBoot';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML =
    '<style>' +
      '#tcosBoot{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;' +
        'background:#fff;font-family:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,sans-serif;' +
        'color:#0B2432;padding:24px;text-align:center}' +
      '#tcosBoot .inner{max-width:330px;display:grid;justify-items:center;gap:14px}' +
      '#tcosBoot img{width:132px;height:auto}' +
      '#tcosBoot .spin{width:26px;height:26px;border:3px solid #E2F4F5;border-top-color:#00707C;' +
        'border-radius:50%;animation:tcosSpin .9s linear infinite}' +
      '@keyframes tcosSpin{to{transform:rotate(360deg)}}' +
      '@media(prefers-reduced-motion:reduce){#tcosBoot .spin{animation:none}}' +
      '#tcosBoot h2{font-size:18px;margin:4px 0 0;letter-spacing:-.02em}' +
      '#tcosBoot p{font-size:14.5px;line-height:1.5;color:#42586A;margin:0}' +
      '#tcosBoot .acts{display:grid;gap:9px;width:100%;margin-top:6px}' +
      '#tcosBoot button,#tcosBoot a{display:block;width:100%;padding:12px 18px;border-radius:10px;' +
        'font:600 15px inherit;text-decoration:none;cursor:pointer;border:1px solid transparent}' +
      '#tcosBoot .primary{background:#008796;color:#fff}' +
      '#tcosBoot .ghost{background:#fff;color:#0B2432;border-color:#E4E9F0}' +
    '</style>' +
    '<div class="inner">' +
      '<img src="assets/tcos-logo.png" alt="TCOS">' +
      '<div class="spin" id="tcosBootSpin"></div>' +
    '</div>';

  const mount = () => {
    if (document.body) document.body.appendChild(overlay);
    else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
  };
  mount();

  /* ---------------- resolving it ---------------- */

  function hide() {
    if (timer) { clearTimeout(timer); timer = null; }
    settled = true;
    overlay.remove();
    /* The screen painted, so whatever bounce brought her here is over. */
    drop(BOUNCE_KEY);
  }

  /* What she sees when three seconds pass and the app is not up. Two
     buttons, because there are only two useful things to do. */
  function stall(title, detail) {
    if (settled) return;
    settled = true;
    if (timer) { clearTimeout(timer); timer = null; }
    const inner = overlay.querySelector('.inner');
    const spin = overlay.querySelector('#tcosBootSpin');
    if (spin) spin.remove();
    const box = document.createElement('div');
    box.innerHTML =
      '<h2></h2><p></p>' +
      '<div class="acts">' +
        '<button type="button" class="primary" id="tcosBootRetry">Try again</button>' +
        '<a class="ghost" href="' + SIGN_IN + '">Sign in again</a>' +
      '</div>';
    /* textContent, not innerHTML: a server message must never be markup. */
    box.querySelector('h2').textContent = title;
    box.querySelector('p').textContent = detail;
    inner.appendChild(box);
    box.querySelector('#tcosBootRetry').addEventListener('click', () => location.reload());
  }

  timer = setTimeout(() => {
    stall('This is taking longer than it should',
      'TCOS could not finish loading. Check your internet connection and try again.');
  }, DEADLINE_MS);

  /* ---------------- the bounce breaker ----------------

     The app and the sign-in screen are allowed to hand her over ONCE. A
     second hand-over in the same visit is a disagreement they will not
     settle by repeating it, so it is stopped here. */
  function bounces() { return Number(read(BOUNCE_KEY) || 0); }

  window.TCOSBoot = {
    /* Called by the navigation once a screen has actually painted. */
    ready: hide,

    /* Called instead of location.replace('tcos-login.html') anywhere that
       decides she is not signed in. */
    toSignIn(reason) {
      const n = bounces() + 1;
      write(BOUNCE_KEY, String(n));
      if (n > 2) {
        /* Enough. Whatever the two screens think, she is not getting in by
           being sent round again. */
        drop(BOUNCE_KEY);
        try {
          localStorage.removeItem('tcos-token');
          localStorage.removeItem('tcos-session-present');
        } catch (_) { /* private mode */ }
        location.replace(SIGN_IN + '?stuck=1');
        return;
      }
      location.replace(SIGN_IN + (reason ? '?why=' + encodeURIComponent(reason) : ''));
    },

    /* A screen that failed for a reason worth naming - the server said no,
       the network is down - says so rather than waiting out the deadline. */
    failed(message) {
      stall('TCOS could not open',
        message || 'Something went wrong while loading your clinic.');
    },

    /* So the sign-in screen can decline to bounce her straight back. */
    bounced: () => bounces() > 0,
    clearBounce: () => drop(BOUNCE_KEY)
  };

  /* A script that fails to load leaves the page blank with no error anybody
     sees. The deadline already covers it, but naming it is better. */
  window.addEventListener('error', event => {
    if (event && event.target && event.target.tagName === 'SCRIPT' && !settled) {
      stall('TCOS could not open',
        'Part of the app did not load. This is usually a weak connection.');
    }
  }, true);
})();
