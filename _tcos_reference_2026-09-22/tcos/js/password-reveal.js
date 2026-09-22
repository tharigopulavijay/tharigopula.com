/* =========================================================================
   Let her see what she typed.

   Vijay: "give me option to see the password, means see and hide password."

   He asked for this in the middle of reporting, for the fourth time, that a
   sign-in refused a password he was certain of. That is not a coincidence:
   a password field on a phone is a row of dots typed on a keyboard that
   moves the letters around, and being unable to look at it is why "I am
   sure it is right" and "it is not right" can both be true.

   ONE SCRIPT, EVERY FIELD. There are fourteen password inputs across the
   sign-in screen, the owner console and the change-password dialog, and
   some of them do not exist until a dialog is opened. Adding a button to
   each by hand would mean fourteen chances to add it to thirteen. This
   finds them, including the ones that appear later.

   It never changes the value, the name or the autocomplete attribute, so
   password managers behave exactly as they did.
   ========================================================================= */
(() => {
  'use strict';

  const WIRED = 'pwRevealWired';

  /* The eye is drawn in SVG rather than an emoji or a glyph font: an emoji
     renders as a different picture on every platform and a font may not
     have arrived yet, and a button whose label has not loaded is a button
     nobody presses. */
  const EYE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M1.6 12S5.5 5 12 5s10.4 7 10.4 7-3.9 7-10.4 7S1.6 12 1.6 12Z"/>' +
      '<circle cx="12" cy="12" r="3"/>' +
    '</svg>';
  const EYE_OFF =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M9.9 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10.4 7 10.4 7a17.9 17.9 0 0 1-3.6 4.4"/>' +
      '<path d="M6.3 6.8A17.6 17.6 0 0 0 1.6 12S5.5 19 12 19a9.9 9.9 0 0 0 4.2-.9"/>' +
      '<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>' +
      '<path d="M3 3l18 18"/>' +
    '</svg>';

  function wire(input) {
    if (!input || input.dataset[WIRED] === 'yes') return;
    /* A field the browser has already filled and a field she is typing into
       are the same field; nothing here depends on which. */
    input.dataset[WIRED] = 'yes';

    if (!input.parentElement) return;

    /* THE INPUT GETS ITS OWN WRAPPER, rather than the button being pinned
       to the <label> around it. A field with help text under it is taller
       than its input, so anything positioned against the label lands below
       the box on some fields and inside it on others. A wrapper is exactly
       the size of the input, always, with no arithmetic. */
    const wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    input.insertAdjacentElement('beforebegin', wrap);
    wrap.appendChild(input);
    input.classList.add('has-reveal');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pw-reveal';
    button.innerHTML = EYE;
    button.setAttribute('aria-label', 'Show password');
    button.title = 'Show password';
    /* Out of the tab order on purpose. Tab from the password field should
       reach Sign in, not a decoration between them. It is still reachable
       by touch, by mouse, and by a screen reader's own controls. */
    button.tabIndex = -1;

    button.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.innerHTML = showing ? EYE : EYE_OFF;
      const label = showing ? 'Show password' : 'Hide password';
      button.setAttribute('aria-label', label);
      button.title = label;
      button.setAttribute('aria-pressed', String(!showing));
      /* Put the caret back where she left it. Changing `type` moves it to
         the end in some browsers, which rewrites what she types next. */
      const at = input.value.length;
      input.focus();
      try { input.setSelectionRange(at, at); } catch (_) { /* number-ish inputs */ }
    });

    wrap.appendChild(button);
  }

  const wireAll = () => document.querySelectorAll('input[type="password"]').forEach(wire);

  /* A revealed password must never survive the screen it was typed on. */
  window.addEventListener('pagehide', () => {
    document.querySelectorAll('input.has-reveal[type="text"]')
      .forEach(input => { input.type = 'password'; });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireAll);
  } else {
    wireAll();
  }

  /* The change-password dialog is built by js/nav.js long after this ran,
     and the owner console swaps whole panels in and out. Watching the
     document is what keeps this one script true for all of them. */
  if (window.MutationObserver) {
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches('input[type="password"]')) wire(node);
          if (node.querySelectorAll) {
            node.querySelectorAll('input[type="password"]').forEach(wire);
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  window.TCOSPasswordReveal = { wireAll };
})();
