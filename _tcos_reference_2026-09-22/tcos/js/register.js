/* =========================================================================
   The patient registering herself while she waits.

   She has scanned a code at the front desk. She is standing in a queue, on
   her own phone, and wants to sit down. So:

     - six fields, four of them optional
     - it submits with half of them blank, because a form that refuses is a
       form she abandons and joins the queue to speak to somebody instead,
       which is the exact thing this exists to remove
     - no account, no password, no explanation of what TCOS is

   It tells her NOTHING about the clinic's patients. Not whether her number
   is known, not who else is on it. This page is reached by a code anybody
   can photograph, so anything it reveals, it reveals to everybody. The
   number IS matched - on the server, at submission - and the answer goes
   to the front desk, who were going to ask her name at the counter anyway.
   ========================================================================= */
(async () => {
  'use strict';

  const API = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://127.0.0.1:8787'
    : (location.hostname === 'tcos-staging.pages.dev' ||
       location.hostname.endsWith('.tcos-staging.pages.dev'))
      ? 'https://tcos-api-staging.hello-tharigopula.workers.dev'
      : 'https://tcos-api.hello-tharigopula.workers.dev';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wrap = document.getElementById('wrap');

  /* The clinic's slug, from the hash. A clinic's public slug is not a
     secret - it is on her website - but the hash keeps it out of logs for
     the same reason every other token here lives there. */
  const slug = location.hash.replace(/^#/, '') ||
    new URLSearchParams(location.search).get('c') || '';

  const fail = (title, detail) => {
    wrap.innerHTML = '<div class="card message"><h1>' + esc(title) + '</h1>' +
      '<p>' + esc(detail) + '</p></div>';
  };

  if (!slug) {
    fail('This code is incomplete', 'Scan the code at the front desk again.');
    return;
  }

  let clinic;
  try {
    const response = await fetch(API + '/clinic/' + encodeURIComponent(slug));
    clinic = await response.json();
    if (!response.ok) {
      fail('This code is not working', clinic.message || 'Ask at the front desk.');
      return;
    }
  } catch (_) {
    fail('Could not connect', 'Check your internet, or give your details at the desk.');
    return;
  }

  const clinicName = clinic.clinicName || clinic.clinic_name || 'the clinic';

  function form() {
    wrap.innerHTML =
      '<header class="head">' +
        '<h1>Register</h1>' +
        '<p>At <b>' + esc(clinicName) + '</b>. Fill this in while you wait &mdash; ' +
          'the front desk will call you.</p>' +
      '</header>' +

      '<form id="reg" novalidate>' +

        '<fieldset class="card">' +
          '<legend>Is this your first visit here?</legend>' +
          '<div class="choices">' +
            '<label><input type="radio" name="visitType" value="first" checked>' +
              '<span>First visit</span></label>' +
            '<label><input type="radio" name="visitType" value="follow-up">' +
              '<span>I have been before</span></label>' +
          '</div>' +
        '</fieldset>' +

        '<div class="card">' +
          '<label class="f"><span>Your name</span>' +
            '<input id="name" autocomplete="name" required></label>' +
          '<label class="f"><span>Mobile number</span>' +
            '<input id="mobile" inputmode="tel" autocomplete="tel" required></label>' +
          '<p class="hint">If you have been here before, use the same number ' +
            'and the desk will find your record.</p>' +

          '<div class="two">' +
            '<label class="f"><span>Age</span>' +
              '<input id="age" inputmode="numeric" autocomplete="off"></label>' +
            '<label class="f"><span>Sex</span>' +
              '<select id="sex"><option value="">&mdash;</option>' +
              '<option>Female</option><option>Male</option><option>Other</option>' +
              '</select></label>' +
          '</div>' +

          '<label class="f"><span>What brings you in today?</span>' +
            '<textarea id="reason" rows="3" ' +
              'placeholder="In your own words. A line is enough."></textarea></label>' +
        '</div>' +

        '<div id="note" class="note"></div>' +
        '<button type="submit" class="pick" id="go">Send to the front desk</button>' +

        '<p class="small">Only the clinic sees this. Nothing here is ' +
          'published, and you are not creating an account.</p>' +
      '</form>' +

      '<footer><p class="credit">TCOS &middot; A Tharigopula Technologies product</p></footer>';

    document.getElementById('reg').addEventListener('submit', submit);
  }

  const note = (text, kind) => {
    const box = document.getElementById('note');
    if (!box) return;
    box.className = 'note ' + (kind || '');
    box.textContent = text || '';
  };

  async function submit(event) {
    event.preventDefault();
    const value = id => document.getElementById(id).value.trim();
    const name = value('name');
    const mobile = value('mobile');

    /* The only two that are actually required. Everything else is a
       convenience for the front desk, and refusing over a blank age would
       send her to the counter to say it out loud instead. */
    if (!name) { note('Please put your name in.', 'bad'); return; }
    if (!mobile) { note('The clinic needs a number to call you on.', 'bad'); return; }

    const go = document.getElementById('go');
    go.disabled = true;
    go.textContent = 'Sending…';
    note('');

    try {
      const response = await fetch(API + '/clinic/' + encodeURIComponent(slug) + '/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name,
          mobile,
          ageYears: value('age') || null,
          sex: document.getElementById('sex').value || null,
          reason: value('reason') || null,
          visitType: (document.querySelector('[name="visitType"]:checked') || {}).value || null
        })
      });
      const answer = await response.json().catch(() => ({}));
      if (!response.ok) {
        go.disabled = false;
        go.textContent = 'Send to the front desk';
        note(answer.message || 'That could not be sent. Give your details at the desk.', 'bad');
        return;
      }
      done(name);
    } catch (_) {
      go.disabled = false;
      go.textContent = 'Send to the front desk';
      note('Could not connect. Give your details at the desk.', 'bad');
    }
  }

  /* The end of her part. She is told what happens next and what she does
     NOT have to do, because the commonest worry at this point is whether
     she still has to go and repeat everything at the counter. */
  function done(name) {
    wrap.innerHTML =
      '<div class="card message done">' +
        '<h1>Thank you, ' + esc(String(name).split(/\s+/)[0]) + '.</h1>' +
        '<p>The front desk has your details. Please take a seat &mdash; ' +
          'they will call you.</p>' +
        '<p class="small">You do not need to fill anything in again. If you ' +
          'have reports with you, bring them to the desk and they will be ' +
          'added to your record.</p>' +
      '</div>' +
      '<footer><p class="credit">TCOS &middot; A Tharigopula Technologies product</p></footer>';
  }

  form();
})();
