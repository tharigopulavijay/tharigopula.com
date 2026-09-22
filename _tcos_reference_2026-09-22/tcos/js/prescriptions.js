/* =========================================================================
   Everything this clinic has issued.

   The search runs on the server rather than filtering a list in the browser,
   because "a medicine you wrote" means looking inside the lines of every
   prescription - and a clinic two years in has more of those than anyone
   wants to download to answer one question.
   ========================================================================= */
(async () => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = id => document.getElementById(id);
  const msg = (id, text, kind) => {
    el(id).innerHTML = text
      ? '<div class="notice ' + kind + '" style="max-width:none">' + text + '</div>' : '';
  };
  const iso = d => d.toISOString().slice(0, 10);
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
    msg('pageMsg', esc(error.message), 'error'); return;
  }
  TCOSNav.paint('prescriptions.html', me);

  const today = new Date();
  el('fromDate').value = iso(new Date(today - 89 * 864e5));
  el('toDate').value = iso(today);

  let rows = [];

  function paint(term) {
    el('listTitle').textContent = term ? 'Search results' : 'Issued prescriptions';
    el('rxCount').textContent = rows.length
      ? rows.length + (rows.length === 1 ? ' prescription' : ' prescriptions') : 'None';

    if (!rows.length) {
      el('rxTable').innerHTML = '<div class="empty">' + (term
        ? 'Nothing matches <b>' + esc(term) + '</b> in this period.'
        : 'Nothing issued in this period.') + '</div>';
      return;
    }

    el('rxTable').innerHTML = '<div class="rx-card-list">' + rows.map(r => {
        /* Superseding is recorded as a link between two rows, not as a status
           on either - there is no 'amended' status and checking for one meant
           a replaced prescription was being shown as the current one. Both
           documents were really handed to someone, so both say what they are. */
        const state = r.superseded_by
          ? '<span class="pill trial">Replaced by a later version</span>'
          : r.amends
            ? '<span class="pill info">Amended version</span>'
            : '<span class="pill active">Issued</span>';
        const meds = (r.medicines || '').split(', ').filter(Boolean);
        return '<article class="rx-card">' +
          '<div class="rx-card-patient"><span class="fallback">' +
            esc((r.full_name || '?').charAt(0).toUpperCase()) + '</span>' +
            '<div><b>' + esc(r.full_name) + '</b><small>' +
            esc(r.local_ref || r.mobile || '') + '</small></div></div>' +
          '<div class="rx-card-meta"><b class="mono">' + esc(r.rx_number || '—') + '</b><span>' + esc(prettyDate(r.issued_on)) + '</span>' + state + '</div>' +
          '<div class="rx-card-meds">' + (meds.length ? meds.slice(0,3).map(m => '<span>' + esc(m) + '</span>').join('') +
            (meds.length > 3 ? '<b>+' + (meds.length - 3) + ' more medicines</b>' : '') : '<span>No medicines</span>') + '</div>' +
          '<div class="rx-card-actions"><button class="btn btn-primary btn-sm" data-open-rx="' + esc(r.id) + '">Open prescription</button>' +
            '<a class="btn btn-ghost btn-sm" href="record.html?patient=' + encodeURIComponent(r.patient_id) + '">Patient chart</a></div></article>';
      }).join('') + '</div>';
    /* Opening a prescription takes her to the desk, not to a modal on top
       of a list. Vijay: "clicking on prescription it opens up and there
       only on left side she sees the list of customers and right side she
       sees the previous history... doctor need not hop onto anything."
       A dialog gives her the document with nothing around it - no way to
       switch patient, no earlier prescriptions, nowhere to go next. */
    document.querySelectorAll('[data-open-rx]').forEach(button =>
      button.addEventListener('click', () => {
        location.href = 'desk.html?rx=' + encodeURIComponent(button.dataset.openRx);
      }));
  }

  const rxDialog = el('rxDialog');
  const safeJson = value => { try { return JSON.parse(value || '{}'); } catch (_) { return {}; } };

  /* The examination she recorded that did not fit on the paper. Not an
     error and not an omission - it is in the record, searchable, and part
     of this consultation. It is simply not what the patient is holding. */
  const offSheet = entries => (entries && entries.length)
    ? '<div class="rx-off-sheet"><h4>Also recorded this visit ' +
        '<span>in the record · not on the printed prescription</span></h4><dl>' +
        entries.map(f => '<div><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>').join('') +
      '</dl></div>'
    : '';
  async function openPrescription(id) {
    el('rxDocument').innerHTML = '<div class="empty">Loading prescription…</div>';
    rxDialog.showModal();
    try {
      const rx = (await TCOSApi.getPrescription(id)).prescription;
      const vitals = safeJson(rx.vitals);

      /* THE SAME DOCUMENT THE PATIENT GETS.
       *
       * This used to build its own layout by hand - a THIRD design of one
       * object, after the doctor's and the patient's had already drifted
       * apart. Vijay opened it and said "I am seeing the same old thing",
       * which is exactly right: the shared renderer had landed on the
       * patient's link and this screen was still drawing its own.
       *
       * Audience 'doctor', so the investigation history appears here and
       * not in the copy the patient receives. */
      el('rxDocument').innerHTML = window.RxDocument.render({
        clinic: {
          name: rx.clinic_name, doctor: rx.doctor_name,
          /* Which of the three she practises. The ONLY thing it changes on
             the sheet is the accent colour - see css/rx-document.css. */
          product: rx.product,
          qualification: rx.qualification, registrationNo: rx.registration_no,
          tagline: rx.tagline || '', address: rx.address, phone: rx.clinic_phone || '',
          /* Letterhead is a print-time choice, and this is a preview of the
             record rather than the print itself. */
          letterhead: false
        },
        patient: {
          name: rx.full_name, sex: rx.sex, ref: rx.local_ref,
          age: rx.age == null ? null : rx.age,
          bloodGroup: rx.blood_group || null,
          allergy: rx.allergies || null
        },
        vitals: {
          bloodPressure: vitals.bp || '', weight: vitals.weight || '',
          height: vitals.height || '', bloodSugar: vitals.sugar || ''
        },
        issuedOn: rx.issued_on,
        rxNumber: rx.rx_number,
        complaints: rx.complaints || null,
        examination: rx.examination || null,
        /* The structured examination - Nadi, Jihva, Naabhi, and whatever
           else she named herself. Already cut to the six that fit by the
           server, so this screen and the patient's copy cannot disagree
           about what is on the paper. */
        findings: rx.findings || [],
        diagnosis: rx.diagnosis || null,
        items: (rx.items || []).map(item => ({
          name: item.medicine_name, system: item.system, dose: item.dose,
          frequency: item.frequency, duration: item.duration,
          instructions: item.instructions
        })),
        advice: rx.advice || null,
        followUp: rx.follow_up_on || null
      }, { audience: 'doctor' }) +
      /* Everything she recorded that the sheet had no room for. Vijay:
         "you can record in the data but it would not showup in the
         prescription... remaining all will be shown side space in the app
         not with the prescripton."

         Deliberately outside the .rx-sheet element, so it is visibly part
         of the screen and not part of the document - and so it cannot
         print. A doctor must never be unsure which of these she handed
         over. */
      offSheet(rx.findingsOffSheet);
    } catch (error) { el('rxDocument').innerHTML = '<div class="notice error">' + esc(error.message) + '</div>'; }
  }
  el('rxClose').addEventListener('click', () => rxDialog.close());
  el('rxDone').addEventListener('click', () => rxDialog.close());
  el('rxPrint').addEventListener('click', () => print());

  async function load() {
    const term = el('search').value.trim();
    el('rxTable').innerHTML = '<div class="empty">Loading…</div>';
    try {
      rows = (await TCOSApi.prescriptionList({
        from: el('fromDate').value, to: el('toDate').value, q: term || null
      })).prescriptions || [];
    } catch (error) { msg('pageMsg', esc(error.message), 'error'); return; }
    paint(term);
  }

  /* One request per pause in typing, not per keystroke. */
  let timer;
  const debounced = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
  el('search').addEventListener('input', debounced);
  el('fromDate').addEventListener('change', load);
  el('toDate').addEventListener('change', load);

  await load();
})();
