/* =========================================================================
   Finding a patient by their number, and opening what other clinics hold.

   The privacy shape, which is the whole design:

     - Typing a number shows the doctor THEIR OWN patients on it, by name.
     - Records held elsewhere show as a count and nothing else. A doctor
       typing numbers must not be able to learn who is a patient where.
     - Names, visits, medicines and reports from another clinic appear only
       after the patient approves with a code sent to their own phone, and
       confirms which person on the number they are.
     - Every record opened that way is logged for the patient to see.

   That last point is why this is a feature rather than a breach: the patient
   holds the key, and can see who used it.
   ========================================================================= */
(async () => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = id => document.getElementById(id);
  const msg = (id, text, kind) => {
    el(id).innerHTML = text
      ? '<div class="notice ' + kind + '" style="max-width:none">' + text + '</div>' : '';
  };
  const prettyDate = v => {
    if (!v) return '—';
    const [y, m, d] = String(v).slice(0, 10).split('-').map(Number);
    if (!y) return v;
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      .format(new Date(y, m - 1, d));
  };

  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }

  let me;
  try { me = await TCOSApi.me(); }
  catch (error) {
    if (error.status === 401) { location.replace('tcos-login.html'); return; }
    msg('pageMsg', esc(error.message), 'error');
    return;
  }
  TCOSRail.paint(me);

  let currentMobile = null;

  /* Arriving from the Patients search: she has already typed the number once
     and it came back empty there. Carry it over and run the search, rather
     than making her type it a third time. */
  const carried = new URLSearchParams(location.search).get('mobile');
  if (carried) el('mobile').value = carried;

  async function search() {
    const raw = el('mobile').value.trim();
    if (!raw) return;
    msg('pageMsg', '');
    el('results').innerHTML = '<div class="empty">Searching…</div>';
    try {
      const found = await TCOSApi.lookupHousehold(raw);
      currentMobile = found.mobile;
      render(found);
    } catch (error) {
      el('results').innerHTML = '';
      msg('pageMsg', esc(error.message), 'error');
    }
  }

  function render(found) {
    const mine = found.mine || [];

    const household = mine.length
      ? '<div class="panel">' +
          '<header><h2>On this number, in your clinic</h2>' +
            '<div class="spacer"></div>' +
            '<span class="muted">' + mine.length + ' ' +
            (mine.length === 1 ? 'person' : 'people') + '</span></header>' +
          '<div class="people">' + mine.map(p =>
            '<div class="person">' +
              '<div class="who"><b>' + esc(p.full_name) + '</b>' +
                '<small>' + esc([p.relation, p.sex, p.date_of_birth].filter(Boolean).join(' · ')) +
                ' · ' + esc(p.patient_code) + '</small></div>' +
              '<span class="seen">' + (p.last_seen_on
                ? 'Last seen ' + esc(prettyDate(p.last_seen_on)) : 'Not yet seen') + '</span>' +
              '<a class="btn btn-ghost btn-sm" href="record.html?patient=' +
                encodeURIComponent(p.id) + '">Record</a> ' +
              '<a class="btn btn-primary btn-sm" href="consult.html?patient=' +
                encodeURIComponent(p.id) + '">Open visit</a>' +
            '</div>').join('') + '</div>' +
        '</div>'
      : '<div class="panel"><div class="empty">Nobody on this number is on your list yet.</div></div>';

    /* A count, never a name. */
    const elsewhere = found.elsewhere > 0
      ? '<div class="elsewhere">' +
          '<div class="head"><b>' + found.elsewhere + ' record' +
            (found.elsewhere === 1 ? '' : 's') + ' held at another clinic</b>' +
            '<span>Names and history are not shown until the patient approves.</span></div>' +
          '<button class="btn btn-primary" id="askConsent">Ask the patient to approve</button>' +
        '</div>'
      : '<div class="elsewhere none">' +
          '<div class="head"><b>No records at other clinics on TCOS</b>' +
          '<span>Nothing to bring in for this number.</span></div></div>';

    const addNew = '<div class="panel add-new"><div class="body">' +
      '<b>Someone new on this number?</b>' +
      '<p>Adding a person here creates their own record. It never merges them ' +
      'with anyone already registered on the number.</p>' +
      '<a class="btn btn-ghost btn-sm" href="patients.html">Add a patient</a>' +
      '</div></div>';

    el('results').innerHTML = household + elsewhere + addNew + '<div id="shared"></div>';

    const ask = el('askConsent');
    if (ask) ask.addEventListener('click', openConsent);
  }

  /* ---------------- consent ---------------- */

  const dialog = el('consentDialog');

  function openConsent() {
    msg('consentMsg', '');
    el('consentStep1').hidden = false;
    el('consentStep2').hidden = true;
    el('cName').value = '';
    el('cCode').value = '';
    el('sentTo').textContent = 'A code will be sent to ' + currentMobile + '.';
    dialog.showModal();
  }

  el('sendCode').addEventListener('click', async () => {
    const button = el('sendCode');
    button.disabled = true;
    try {
      const sent = await TCOSApi.requestConsent(currentMobile);
      el('consentStep1').hidden = true;
      el('consentStep2').hidden = false;
      msg('consentMsg', esc(sent.note), 'info');
      el('cName').focus();
    } catch (error) {
      msg('consentMsg', esc(error.message), 'error');
    } finally {
      button.disabled = false;
    }
  });

  el('consentForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const granted = await TCOSApi.approveConsent(
        currentMobile, el('cCode').value.trim(), el('cName').value.trim());
      dialog.close();
      msg('pageMsg', 'Approved by <b>' + esc(granted.patient.name) +
        '</b>. Access expires ' + esc(prettyDate(granted.expiresAt)) + '.', 'ok');
      await showSharedHistory(granted.patient);
    } catch (error) {
      msg('consentMsg', esc(error.message), 'error');
    }
  });

  el('consentCancel').addEventListener('click', () => dialog.close());
  el('consentClose').addEventListener('click', () => dialog.close());

  async function showSharedHistory(person) {
    const host = el('shared');
    host.innerHTML = '<div class="empty">Opening their history…</div>';
    try {
      const history = await TCOSApi.sharedHistory(person.id);
      const section = (title, rows, empty) =>
        '<div class="shared-block"><h3>' + esc(title) + '</h3>' +
        (rows.length ? rows.join('') : '<p class="none">' + esc(empty) + '</p>') + '</div>';

      host.innerHTML =
        '<div class="panel shared">' +
          '<header><h2>' + esc(person.name) + ' — history from other clinics</h2>' +
            '<div class="spacer"></div>' +
            '<span class="pill trial-pill">Approved until ' +
              esc(prettyDate(history.grantExpiresAt)) + '</span></header>' +
          '<div class="body">' +
            section('Visits', (history.visits || []).map(v =>
              '<div class="entry"><time>' + esc(prettyDate(v.visited_on)) + '</time>' +
                '<div><b>' + esc(v.diagnosis || v.complaints || 'Consultation') + '</b>' +
                '<span>' + esc(v.clinic_name) + '</span>' +
                (v.advice ? '<span class="advice">' + esc(v.advice) + '</span>' : '') +
              '</div></div>'), 'No visits recorded elsewhere.') +

            section('Medicines prescribed elsewhere', (history.medicines || []).map(m =>
              '<div class="entry"><time>' + esc(prettyDate(m.issued_on)) + '</time>' +
                '<div><b>' + esc(m.medicine_name) + '</b>' +
                '<span>' + esc([m.dose, m.frequency, m.duration].filter(Boolean).join(' · ')) +
                '</span><span class="clinic">' + esc(m.clinic_name) + '</span>' +
              '</div></div>'), 'No medicines recorded elsewhere.') +

            section('Investigations', (history.labs || []).map(l =>
              '<div class="entry"><time>' + esc(prettyDate(l.reported_on)) + '</time>' +
                '<div><b>' + esc(l.analyte || l.report_name) + '</b>' +
                '<span>' + esc([l.value, l.unit].filter(Boolean).join(' ')) +
                (l.reference ? ' (ref ' + esc(l.reference) + ')' : '') + '</span>' +
                '<span class="clinic">' + esc(l.clinic_name) + '</span>' +
              '</div></div>'), 'No investigations recorded elsewhere.') +
            '<p class="logged">This patient can see that your clinic opened these records.</p>' +
          '</div>' +
        '</div>';
      host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      host.innerHTML = '';
      msg('pageMsg', esc(error.message), 'error');
    }
  }

  el('searchBtn').addEventListener('click', search);
  el('mobile').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  el('signOutBtn').addEventListener('click', async () => {
    await TCOSApi.signOut(); location.href = 'tcos-login.html';
  });
  el('mobile').focus();
  /* The handlers are bound above, so a carried number can now run itself. */
  if (carried) search();
})();
