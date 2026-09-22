/* =========================================================================
   Telling a doctor what her plan does not include, on the screen where she
   was about to use it.

   Vijay: "let's show all the tabs, but it should be functional if they are
   on the package. If they are not it will not be functional - grey out, so
   they will know what they are missing. Or clicking, 'you don't have
   access, you need to upgrade for this'."

   The screens are all still REACHABLE and everything already recorded is
   still readable - a clinic that drops to Free keeps its stock list, its
   expiry dates and its old invoices, because those are its records. What
   changes is that the buttons which would add something are off, and the
   reason is on the screen rather than hidden behind a click that fails.

   THIS IS PRESENTATION, NEVER PERMISSION. Every action it greys out is
   refused again by the Worker with a 402, whatever the browser was told -
   see worker/entitlements.js. A disabled button is a courtesy, not a lock,
   and anyone who removes the `disabled` attribute in devtools gets the same
   refusal from the server.

   Why greyed and explained rather than hidden: a doctor who cannot see the
   pharmacy does not know TCOS has one. The whole point of showing it is
   that she can see what the next plan up would give her, at the moment she
   wanted it. A hidden feature sells nothing.
   ========================================================================= */
(() => {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* What each gated capability is called on screen, and the shortest true
     description of what it lets her do. */
  const WHAT = {
    pharmacy: ['Pharmacy', 'add medicines, receive stock or dispense'],
    billing: ['Invoicing', 'raise a bill or record a payment'],
    lab_reports: ['Lab reports', 'add a report or have one read'],
    patient_portal: ['The patient portal', 'share a record with a patient'],
    website_connect: ['Website booking', 'take bookings from your own site'],
    reports: ['Monthly reports', 'see practice reports'],
    ai_summary: ['History summaries', 'summarise a patient history'],
    insights: ['Practice insights', 'see insights and anomaly alerts'],
    automation_basic: ['Follow-up rules', 'set follow-up and reminder rules'],
    multi_location: ['Branches', 'run more than one location']
  };

  /* The plan's features as resolved by the Worker and sent on /me. An older
     session that predates this field reports nothing, and the honest
     response to "I do not know" is to leave the screen alone - the server
     is still the one that decides. */
  const has = (me, feature) => {
    if (!feature) return true;
    if (!me || !Array.isArray(me.features)) return true;
    return me.features.includes(feature);
  };

  /* Turn off the controls that would write, and say why.

     `actions` are selectors for the buttons that add something. Reads are
     never touched: the table below them still fills, because she is still
     entitled to her own records. */
  function apply(me, { feature, actions = [], into = 'pageMsg' } = {}) {
    if (has(me, feature)) return true;

    const [name, verb] = WHAT[feature] || [feature, 'use this'];

    const slot = document.getElementById(into);
    if (slot) {
      const notice = document.createElement('div');
      notice.className = 'notice warn plan-gate';
      notice.innerHTML =
        '<div><b>' + esc(name) + ' is not included on your plan.</b> ' +
        'Everything already here stays readable &mdash; you just cannot ' +
        esc(verb) + ' until you move up.</div>' +
        '<a class="btn btn-primary btn-sm" href="subscription.html">See plans</a>';
      slot.appendChild(notice);
    }

    for (const selector of actions) {
      document.querySelectorAll(selector).forEach(node => {
        node.disabled = true;
        node.classList.add('is-locked');
        node.title = name + ' is not on your plan. Move up a plan to ' + verb + '.';
      });
    }
    return false;
  }

  /* For the case the server refuses anyway - an older page, a stale tab, or
     somebody who turned the button back on. Turns the 402 into the same
     explanation rather than a red error nobody can act on. */
  function explain(error, into = 'pageMsg') {
    if (!error || error.code !== 'plan_feature') return false;
    const slot = document.getElementById(into);
    if (!slot) return false;
    slot.innerHTML =
      '<div class="notice warn plan-gate"><div>' + esc(error.message) + '</div>' +
      '<a class="btn btn-primary btn-sm" href="subscription.html">See plans</a></div>';
    return true;
  }

  window.TCOSGate = { has, apply, explain };
})();
