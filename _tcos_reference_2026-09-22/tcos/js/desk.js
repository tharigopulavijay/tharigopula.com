/* =========================================================================
   The consultation desk.

   Vijay: "here doctor just uses this prescription page only and there only
   he works, he should not go to other page which makes him worst."

   So this screen holds the whole consultation. Who is waiting on the left,
   the prescription in the middle, what was prescribed before on the right.
   No navigating away to add a patient, look up a previous visit, or turn a
   form into a document.

   THE DOCTOR WRITES INTO THE SHEET THAT PRINTS.
   The middle pane is not a form that becomes a prescription afterwards - it
   IS the prescription, using the same classes js/rx-document.js renders, so
   what she is looking at is what comes out of the printer and what the
   patient opens on her phone. That is the whole point of there being one
   renderer: three hand-built designs of this document had already drifted
   apart before it existed.

   WHERE THE FIELDS ACTUALLY LIVE
   The clinical narrative - complaints, examination, diagnosis, advice,
   follow-up, vitals - belongs to the VISIT. The medicines belong to the
   PRESCRIPTION, which references that visit. So saving is two calls, and
   this file keeps one visit per patient per day rather than making a new
   one every time she saves.
   ========================================================================= */
(async () => {
  'use strict';

  const el = id => document.getElementById(id);
  const esc = window.RxDocument.esc;
  const todayIso = () => new Date().toISOString().slice(0, 10);

  const msg = (text, kind) => {
    el('deskMsg').className = text ? 'notice ' + (kind || 'info') : '';
    el('deskMsg').textContent = text || '';
  };

  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }

  let me = null;
  try { me = await TCOSApi.me(); }
  catch (_) { TCOSBoot.toSignIn('expired'); return; }
  /* No rail on this screen, so nothing else would ever tell the boot
     overlay the desk is up. */
  TCOSBoot.ready();

  /* ------------------------------------------------- the plan editor --- */

  /* These live ABOVE the state that uses them, and that is not tidiness.
     `state` calls emptyPlan() while it is being built, and a `const`
     declared further down is in its temporal dead zone at that moment - so
     the whole script threw before rendering anything, the patient list sat
     on "Loading…" for ever and every button was dead. `node --check` passes
     that happily, because it is valid syntax. test/desk-boot.test.js now
     runs the file instead of parsing it. */

  /* Each part of the plan is a list the doctor types, one line each. A
     textarea rather than repeating rows: she is writing advice, and making
     her click "add" for every line is how a five-line plan becomes a
     two-line one. Lines in, lines out. */
  const linesToList = text => String(text || '').split('\n')
    .map(line => line.trim()).filter(Boolean);
  const listToLines = list => (list || []).join('\n');

  /* Meals and exercises carry more than one column each, so they travel as
     "Breakfast | Vegetable upma" and are split back on the pipe. Same
     reason: one box she can type into beats a grid she has to tab through. */
  const linesToPairs = (text, keys) => linesToList(text).map(line => {
    const parts = line.split('|').map(p => p.trim());
    const row = {};
    keys.forEach((key, index) => { row[key] = parts[index] || ''; });
    return row;
  });
  const pairsToLines = (list, keys) => (list || [])
    .map(row => keys.map(key => row[key] || '').join(' | ').replace(/(\s*\|\s*)+$/, ''))
    .join('\n');

  const emptyPlan = () => ({
    meals: [], prefer: [], avoid: [], routine: [], exercises: [], precautions: []
  });

  /* --------------------------------------------------------- the state --- */

  /* One consultation in progress. `dirty` is what makes the Save button
     mean something: a doctor who has typed nothing should not be told she
     has unsaved work, and one who has should not lose it silently. */
  const state = {
    patient: null,
    visitId: null,
    prescriptionId: null,
    issued: false,
    dirty: false,
    doc: null,
    plan: emptyPlan(),
    planDirty: false,
    alerts: '',
    alertsDirty: false,
    patients: [],
    queue: [],
    /* Registered themselves at the counter, not patients yet. */
    waiting: [],

    /* Patients with a half-written sheet waiting behind their name.
       patientId -> the time it was last typed into. Filled from the server,
       so it survives this browser, this machine and this person. */
    drafts: new Map(),
    /* The pending autosave, and whether one is in flight. Two writes racing
       would be the same row twice with the later one winning anyway, but a
       second request while the first is unanswered is pure noise. */
    autosaveTimer: null,
    autosaving: false
  };

  const clinicFromMe = () => ({
    name: me.clinicName || '', doctor: me.fullName || '',
    /* Her product, so the sheet wears its accent. Nothing else about the
       document changes with it - see css/rx-document.css. */
    product: me.product || '',
    qualification: me.qualification || '', registrationNo: me.registrationNo || '',
    tagline: me.tagline || '', address: me.address || '', phone: me.mobile || '',
    letterhead: false
  });

  const emptyDoc = patient => ({
    clinic: clinicFromMe(),
    patient: {
      name: patient.full_name, sex: patient.sex || '',
      ref: patient.local_ref || null, age: patient.age == null ? null : patient.age,
      bloodGroup: patient.blood_group || null, allergy: patient.allergies || null
    },
    vitals: { bloodPressure: '', weight: '', height: '', bloodSugar: '' },
    issuedOn: todayIso(),
    rxNumber: null,
    complaints: '', examination: '', diagnosis: '', advice: '', followUp: '',
    items: []
  });

  /* ---------------------------------------------------------- the queue --- */

  function queueRow(patient) {
    const initials = String(patient.full_name || '?').trim().split(/\s+/)
      .slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const detail = [patient.local_ref, patient.sex,
      patient.age == null ? '' : patient.age + 'y'].filter(Boolean).join(' · ');
    const current = state.patient && state.patient.id === patient.id;

    /* A consultation she started and did not save. It goes in the detail
       line rather than in the tag slot beside the name: the rail is 250px
       wide, and a second tag there pushed the name and the patient number
       onto two lines. It is put FIRST so that it is the part that survives
       when the line is too long to fit - and it is one short word for the
       same reason, because "Unfinished" ate the patient number after it. */
    const unfinished = state.drafts.has(patient.id)
      ? '<em class="desk-unfinished">Draft</em>' + (detail ? ' · ' : '') : '';
    return '<button type="button" class="desk-person' + (current ? ' current' : '') +
      '" data-patient="' + esc(patient.id) + '">' +
      '<span class="desk-initials">' + esc(initials) + '</span>' +
      '<span class="desk-person-body"><b>' + esc(patient.full_name) + '</b>' +
      '<small title="' + (unfinished ? 'Started and not saved' : '') + '">' +
        unfinished + esc(detail) + '</small></span>' +
      (patient.queueLabel
        ? '<span class="desk-tag">' + esc(patient.queueLabel) + '</span>' : '') +
      '</button>';
  }

  function paintQueue(term) {
    const needle = String(term || '').trim().toLowerCase();
    const rows = needle
      ? state.patients.filter(p =>
          String(p.full_name || '').toLowerCase().includes(needle) ||
          String(p.mobile || '').includes(needle) ||
          String(p.local_ref || '').toLowerCase().includes(needle))
      : /* No search: today's appointments first, because that is who is
           actually in the room, then everyone else. */
        [...state.queue, ...state.patients.filter(p =>
          !state.queue.some(q => q.id === p.id))];

    /* People who registered themselves at the counter and are not patients
       yet. They sit ABOVE the list, because somebody is sitting in the room
       waiting to be called and everybody below them has already been seen
       today or is not here at all. */
    const waiting = needle ? [] : state.waiting;
    const waitingHtml = waiting.length
      ? '<div class="desk-waiting"><h3>Waiting to be registered</h3>' +
        waiting.map(request =>
          '<button type="button" class="desk-person desk-person-new" ' +
            'data-request="' + esc(request.id) + '">' +
            '<span class="desk-initials new">+</span>' +
            '<span class="desk-person-body"><b>' + esc(request.full_name) + '</b>' +
            '<small>' + esc([
              request.visit_type === 'follow-up' ? 'Been before' : 'First visit',
              request.age_years ? request.age_years + 'y' : '',
              request.sex || ''
            ].filter(Boolean).join(' · ')) + '</small></span>' +
            /* The server matched the number against this clinic's list at
               submission. Staff see it; she never did. */
            (request.matched_patient_id
              ? '<span class="desk-tag match">Has a record</span>'
              : '<span class="desk-tag new">New</span>') +
          '</button>').join('') + '</div>'
      : '';

    el('deskQueue').innerHTML = waitingHtml + (rows.length
      ? rows.map(queueRow).join('')
      : (waitingHtml ? '' : '<div class="empty">Nobody matches that.</div>'));

    el('deskQueue').querySelectorAll('[data-patient]').forEach(button =>
      button.addEventListener('click', () => choosePatient(button.dataset.patient)));
    el('deskQueue').querySelectorAll('[data-request]').forEach(button =>
      button.addEventListener('click', () => admit(button.dataset.request)));
  }

  /* Turning somebody who filled in the form into a patient. This is the
     existing accept flow - it creates the person, adds them to the list and
     books the appointment in one step, and it already refuses to attach a
     patient id that is not on the submitted number. Nothing new is being
     trusted here. */
  async function admit(requestId) {
    const request = state.waiting.find(r => r.id === requestId);
    if (!request) return;
    if (!confirm('Register ' + request.full_name + ' and start a consultation?' +
      (request.matched_patient_id
        ? '\n\nThis number already has a record here. Check at the counter that ' +
          'this is the same person before you continue.' : ''))) return;
    try {
      const { patient } = await TCOSApi.acceptRequest(requestId, {});
      await loadPeople();
      choosePatient(patient.id);
      msg('');
    } catch (error) { msg(error.message, 'error'); }
  }

  async function loadPeople() {
    const [list, appointments, requests, open] = await Promise.all([
      TCOSApi.listPatients().catch(() => ({ patients: [] })),
      TCOSApi.appointments(todayIso()).catch(() => ({ appointments: [] })),
      /* Front-desk capability, which a practitioner may not hold - so a
         failure here must not empty the patient list beside it. */
      TCOSApi.listRequests().catch(() => ({ requests: [] })),
      /* Whose consultation is half written. Same reasoning: a marker on a
         name is worth having and never worth losing the list over. */
      TCOSApi.openConsultationDrafts().catch(() => ({ drafts: [] }))
    ]);
    state.waiting = requests.requests || [];
    state.patients = list.patients || [];
    state.drafts = new Map((open.drafts || []).map(d => [d.patientId, d.updatedAt]));

    /* An appointment tells us who is expected today and what has happened
       to them so far. It is the same person as in the patient list, so the
       row is enriched rather than duplicated. */
    const byId = new Map(state.patients.map(p => [p.id, p]));
    state.queue = (appointments.appointments || [])
      .map(appointment => {
        const patient = byId.get(appointment.patient_id);
        if (!patient) return null;
        return { ...patient, queueLabel: appointment.status === 'arrived' ? 'Waiting'
          : appointment.status === 'in_consultation' ? 'In consultation'
          : appointment.status === 'done' ? 'Seen'
          : appointment.scheduled_at || 'Today' };
      })
      .filter(Boolean);
    paintQueue(el('deskSearch').value);
  }

  /* ------------------------------------------------------- the history --- */

  async function loadHistory(patientId) {
    el('deskHistory').innerHTML = '<div class="empty">Loading…</div>';
    try {
      /* Issued prescriptions only - listForDoctor excludes drafts, which is
         right: an earlier consultation means one that was actually given.

         Filtered here rather than by the API because GET /prescriptions
         takes from/to/q and has no patient filter. `q` matches the name,
         so it narrows the fetch, and the id comparison is what actually
         decides - a name search would also pull in her relatives, who
         share a mobile and often a surname. */
      const patient = state.patients.find(p => p.id === patientId);
      const { prescriptions } = await TCOSApi.prescriptionList(
        patient && patient.full_name ? { q: patient.full_name } : {});
      const mine = (prescriptions || []).filter(rx => rx.patient_id === patientId);
      el('deskHistory').innerHTML = mine.length
        ? mine.map(rx => {
            const meds = (rx.medicines || rx.summary || '').toString();
            return '<button type="button" class="desk-past" data-rx="' + esc(rx.id) + '">' +
              '<b>' + esc(window.RxDocument.prettyDate(rx.issued_on) || 'Draft') + '</b>' +
              '<span class="desk-past-state">' + esc(rx.status || '') + '</span>' +
              (meds ? '<small>' + esc(meds) + '</small>' : '') + '</button>';
          }).join('')
        : '<div class="empty">No issued prescription for them yet.</div>';
      el('deskHistory').querySelectorAll('[data-rx]').forEach(button =>
        button.addEventListener('click', () => openPast(button.dataset.rx)));
    } catch (error) {
      /* Said "—" before, which is what an empty history looks like. A
         patient with prescriptions who appears to have none is worse than
         an error, because nobody goes looking. */
      el('deskHistory').innerHTML =
        '<div class="notice error">Could not load earlier prescriptions. ' +
        esc(error.message) + '</div>';
    }
  }

  /* Read-only. Opening an earlier prescription must never become a way to
     edit an issued one - issued documents are immutable, and a patient is
     holding paper that has to keep matching the record. */
  async function openPast(id) {
    try {
      const { prescription } = await TCOSApi.getPrescription(id);
      const doc = fromPrescription(prescription);
      el('deskSheet').innerHTML =
        '<div class="desk-past-banner">Viewing an earlier prescription. ' +
        '<button type="button" class="linkish" id="backToDraft">Back to today</button></div>' +
        window.RxDocument.render(doc, { audience: 'doctor' });
      el('backToDraft').addEventListener('click', () => paintSheet());
    } catch (error) { msg(error.message, 'error'); }
  }

  function fromPrescription(rx) {
    let vitals = {};
    try { vitals = JSON.parse(rx.vitals || '{}'); } catch (_) { vitals = {}; }
    return {
      clinic: clinicFromMe(),
      patient: {
        name: rx.full_name, sex: rx.sex, ref: rx.local_ref,
        age: rx.age == null ? null : rx.age,
        bloodGroup: rx.blood_group || null, allergy: rx.allergies || null
      },
      vitals: {
        bloodPressure: vitals.bp || '', weight: vitals.weight || '',
        height: vitals.height || '', bloodSugar: vitals.sugar || ''
      },
      issuedOn: rx.issued_on, rxNumber: rx.rx_number,
      complaints: rx.complaints || '', examination: rx.examination || '',
      diagnosis: rx.diagnosis || '', advice: rx.advice || '',
      followUp: rx.follow_up_on || '',
      items: (rx.items || []).map(item => ({
        name: item.medicine_name, system: item.system, dose: item.dose,
        frequency: item.frequency, duration: item.duration,
        instructions: item.instructions
      }))
    };
  }

  /* ------------------------------------------------------- the sheet --- */

  const field = (key, value, placeholder, tag) =>
    '<' + (tag || 'input') + ' class="rx-in" data-field="' + key + '" ' +
    'placeholder="' + esc(placeholder) + '"' +
    (tag === 'textarea' ? ' rows="2">' + esc(value || '') + '</textarea>'
      : ' value="' + esc(value || '') + '">');

  function medicineRow(item, index) {
    return '<tr data-row="' + index + '">' +
      '<td class="rx-n">' + (index + 1) + '</td>' +
      '<td class="rx-name">' + field('name.' + index, item.name, 'Medicine and strength') + '</td>' +
      '<td>' + field('dose.' + index, item.dose, 'Dose') + '</td>' +
      '<td>' + field('frequency.' + index, item.frequency, 'Timing') + '</td>' +
      '<td class="rx-days">' + field('duration.' + index, item.duration, 'Days') + '</td>' +
      '<td>' + field('instructions.' + index, item.instructions, 'Instructions') + '</td>' +
      '<td class="rx-drop"><button type="button" class="desk-drop" data-drop="' + index +
        '" title="Remove this medicine">&times;</button></td>' +
    '</tr>';
  }

  /* The editable sheet. Same classes as the printed document, with inputs
     where the values go - so the doctor is looking at the real thing and
     not at a form that will become one. */
  function paintSheet() {
    if (!state.patient) return;
    const doc = state.doc;
    const p = doc.patient;

    const strip = [
      '<b>Patient:</b> ' + esc(p.name),
      [p.age ? p.age : '', p.sex].filter(Boolean).join(' / ') || '—',
      '<b>Allergy:</b> ' + (p.allergy
        ? esc(p.allergy) : '<span class="rx-unknown">Not recorded</span>')
    ].filter(Boolean);

    el('deskSheet').innerHTML =
      '<article class="rx-sheet rx-editing">' +
        '<header class="rx-head">' +
          '<div class="rx-head-clinic">' +
            '<h1>' + esc(doc.clinic.name) + '</h1>' +
            (doc.clinic.tagline ? '<p class="rx-tagline">' + esc(doc.clinic.tagline) + '</p>' : '') +
            '<p class="rx-credentials">' + esc(doc.clinic.doctor) +
              (doc.clinic.qualification ? ' &nbsp;|&nbsp; ' + esc(doc.clinic.qualification) : '') +
              (doc.clinic.registrationNo ? ' &nbsp;|&nbsp; Reg. No. ' + esc(doc.clinic.registrationNo) : '') +
            '</p>' +
          '</div>' +
          '<div class="rx-head-meta">' +
            (p.ref ? '<div><b>UHID:</b> ' + esc(p.ref) + '</div>' : '') +
            '<div><b>Visit:</b> ' + esc(window.RxDocument.prettyDate(doc.issuedOn)) + '</div>' +
            (doc.rxNumber ? '<div><b>Rx No:</b> ' + esc(doc.rxNumber) + '</div>' : '') +
          '</div>' +
        '</header>' +

        '<div class="rx-strip">' + strip.map(c => '<span>' + c + '</span>').join('<i>|</i>') +
          '<i>|</i><span><b>BP</b> ' + field('vitals.bloodPressure', doc.vitals.bloodPressure, '—') + '</span>' +
          '<i>|</i><span><b>Wt</b> ' + field('vitals.weight', doc.vitals.weight, '—') + '</span>' +
        '</div>' +

        '<div class="rx-body">' +
          '<div class="rx-pair">' +
            '<section class="rx-panel"><h2>Complaint &amp; examination</h2>' +
              '<div class="rx-panel-body">' +
                field('complaints', doc.complaints, 'What she came in saying', 'textarea') +
                field('examination', doc.examination, 'What you found', 'textarea') +
              '</div></section>' +
            '<section class="rx-panel"><h2>Assessment</h2>' +
              '<div class="rx-panel-body">' +
                field('diagnosis', doc.diagnosis, 'Diagnosis. Separate several with a semicolon.', 'textarea') +
              '</div></section>' +
          '</div>' +

          '<section class="rx-panel rx-panel-flush"><h2>Prescription / medicines</h2>' +
            '<div class="rx-panel-body">' +
              '<table class="rx-meds"><thead><tr>' +
                '<th class="rx-n">#</th><th>Medicine / strength</th><th>Dose</th>' +
                '<th>Timing</th><th class="rx-days">Days</th><th>Instructions</th><th class="rx-drop"></th>' +
              '</tr></thead><tbody id="deskMeds">' +
                doc.items.map(medicineRow).join('') +
              '</tbody></table>' +
              '<button type="button" class="desk-addmed" id="deskAddMed">+ Add a medicine</button>' +
            '</div></section>' +

          '<div class="rx-pair">' +
            '<section class="rx-panel"><h2>Advice</h2><div class="rx-panel-body">' +
              field('advice', doc.advice, 'What she should do', 'textarea') +
            '</div></section>' +
            '<section class="rx-panel"><h2>Next visit</h2><div class="rx-panel-body">' +
              '<input class="rx-in" type="date" data-field="followUp" value="' + esc(doc.followUp || '') + '">' +
            '</div></section>' +
          '</div>' +
        '</div>' +

        '<footer class="rx-foot"><div class="rx-sign-row">' +
          '<div class="rx-credit"><div class="rx-contact">' +
            (doc.clinic.address ? '<span>' + esc(doc.clinic.address) + '</span>' : '') +
            (doc.clinic.phone ? '<span>' + esc(doc.clinic.phone) + '</span>' : '') +
          '</div><div class="rx-powered">Powered by Tharigopula Technologies &middot; TCOS</div></div>' +
          '<div class="rx-sign"><div class="rx-sign-line"></div><b>' + esc(doc.clinic.doctor) +
            '</b><span>Doctor&rsquo;s signature / stamp</span></div>' +
        '</div></footer>' +
      '</article>' +

      /* ---- below the sheet: things that are not part of the document ---- */

      /* Alerts used to sit here, between the prescription sheet and the
         plan. Vijay: "this is looking hidden between pages." He is right -
         it made the one thing a doctor must read before prescribing the
         easiest thing on the screen to scroll past. It now has a fixed
         half of the right rail, beside the sheet rather than buried in it,
         and it is wired once in desk.html rather than being rebuilt on
         every repaint. */

      planSheet(doc) +

      /* Diagnostics, read-only, from the clinic's own verified reports. */
      '<section class="desk-labs" id="deskLabs"></section>';

    wireSheet();
  }

  /* THE PLAN, AS THE PAGE IT PRINTS AS.
   *
   * This was six textareas on a grey background - a form. Vijay: "no this
   * is not what I want, the design we have created, the presentation we
   * have created, that is what matters."
   *
   * He is right, and it was my own inconsistency: I wrote that the doctor
   * should edit inside the sheet that prints, did it for the prescription,
   * and then put the plan in a form beside it. It is now the same page the
   * renderer produces - masthead, green panel headings, meal and exercise
   * tables, the coloured prefer/avoid boxes - with the values as inputs
   * dressed to disappear.
   */
  function planSheet(doc) {
    /* The tables GROW. Vijay: "it should be like it is variable right,
       doctor can add n number of things... movement and exercise also
       there will be many asanas."
     *
       So there is always exactly one blank row at the foot, and typing in
       it adds the next one - the list is as long as the advice, and she
       never runs out of lines or hunts for a button mid-sentence. The
       explicit "+ Add" is there too, because a row that appears on its own
       is only obvious once you have seen it happen. */
    const rows = (list, keys, placeholders, kind) => {
      const all = [...(list || []), {}];
      return all.map((row, index) =>
        planRow(kind, index, keys, placeholders, row)).join('');
    };

    const listBox = (key, title, tone) =>
      '<div class="rx-list rx-list-' + tone + '"><h4>' + esc(title) + '</h4>' +
      '<textarea class="rx-in rx-list-in" data-plan="' + key + '" rows="4" ' +
      'placeholder="One per line">' + esc(listToLines(state.plan[key])) + '</textarea></div>';

    return '<article class="rx-sheet rx-editing rx-plan-sheet">' +
      '<header class="rx-head">' +
        '<div class="rx-head-clinic">' +
          '<h1>' + esc(doc.clinic.name) + '</h1>' +
          (doc.clinic.tagline ? '<p class="rx-tagline">' + esc(doc.clinic.tagline) + '</p>' : '') +
          '<p class="rx-credentials">' + esc(doc.clinic.doctor) +
            (doc.clinic.qualification ? ' &nbsp;|&nbsp; ' + esc(doc.clinic.qualification) : '') +
          '</p>' +
        '</div>' +
        '<div class="rx-head-meta">' +
          (doc.patient.ref ? '<div><b>UHID:</b> ' + esc(doc.patient.ref) + '</div>' : '') +
          '<div><b>Visit:</b> ' + esc(window.RxDocument.prettyDate(doc.issuedOn)) + '</div>' +
        '</div>' +
      '</header>' +

      '<h3 class="rx-small-head">Diet, lifestyle and exercise' +
        '<span>Prepared for this consultation</span></h3>' +

      '<div class="rx-body"><div class="rx-pair rx-pair-top">' +
        '<div>' +
          '<section class="rx-panel rx-panel-flush"><h2>Daily meal plan</h2>' +
            '<div class="rx-panel-body"><table class="rx-meals"><thead><tr>' +
              '<th>Time</th><th>Plan</th></tr></thead><tbody data-plan-body="meals">' +
              rows(state.plan.meals, ['when', 'plan'],
                ['Breakfast', 'Vegetable upma or oats'], 'meals') +
            '</tbody></table>' +
            '<button type="button" class="desk-addmed" data-add-plan="meals">+ Add a meal</button>' +
            '</div></section>' +
          listBox('prefer', 'Prefer', 'good') +
          listBox('avoid', 'Limit or avoid', 'avoid') +
          listBox('routine', 'Hydration and routine', 'plain') +
        '</div>' +
        '<div>' +
          '<section class="rx-panel rx-panel-flush"><h2>Movement and exercise</h2>' +
            '<div class="rx-panel-body"><table class="rx-meals"><thead><tr>' +
              '<th>Practice</th><th>How much</th><th>When</th></tr></thead><tbody data-plan-body="exercises">' +
              rows(state.plan.exercises, ['name', 'amount', 'when'],
                ['Chin tucks', '10 repetitions', 'Twice daily'], 'exercises') +
            '</tbody></table>' +
            '<button type="button" class="desk-addmed" data-add-plan="exercises">+ Add a practice</button>' +
            '</div></section>' +
          listBox('precautions', 'Precautions', 'warn') +
        '</div>' +
      '</div></div>' +

      '<footer class="rx-foot"><div class="rx-sign-row">' +
        '<div class="rx-credit"><div class="rx-contact">' +
          (doc.clinic.address ? '<span>' + esc(doc.clinic.address) + '</span>' : '') +
          (doc.clinic.phone ? '<span>' + esc(doc.clinic.phone) + '</span>' : '') +
        '</div></div>' +
        '<div class="rx-sign"><div class="rx-sign-line"></div><b>' + esc(doc.clinic.doctor) +
          '</b><span>Doctor&rsquo;s signature / stamp</span></div>' +
      '</div></footer>' +
    '</article>';
  }

  const planCell = (key, value, placeholder) =>
    '<input class="rx-in" data-plan-cell="' + esc(key) + '" ' +
    'placeholder="' + esc(placeholder || '') + '" value="' + esc(value) + '">';

  /* One row of a growing table. Kept separate from the sheet markup so a
     new row can be appended in place - repainting the whole sheet on every
     keystroke would take the cursor with it. */
  const PLAN_TABLES = {
    meals: { keys: ['when', 'plan'], hints: ['Breakfast', 'Vegetable upma or oats'] },
    exercises: { keys: ['name', 'amount', 'when'],
                 hints: ['Chin tucks', '10 repetitions', 'Twice daily'] }
  };

  const planRow = (kind, index, keys, hints, row) =>
    '<tr data-plan-row="' + kind + '.' + index + '">' +
      keys.map((key, column) =>
        '<td>' + planCell(kind + '.' + index + '.' + key, (row || {})[key] || '',
          hints[column]) + '</td>').join('') +
    '</tr>';

  /* Adds a blank row to the foot of a plan table and hands back its first
     cell, so the caller can decide whether to move the cursor there. */
  function addPlanRow(kind, focus) {
    const table = PLAN_TABLES[kind];
    const body = el('deskSheet').querySelector('[data-plan-body="' + kind + '"]');
    if (!table || !body) return;
    const index = body.querySelectorAll('[data-plan-row]').length;
    body.insertAdjacentHTML('beforeend',
      planRow(kind, index, table.keys, table.hints, {}));
    const added = body.querySelector('[data-plan-row="' + kind + '.' + index + '"]');
    added.querySelectorAll('[data-plan-cell]').forEach(wirePlanCell);
    if (focus) added.querySelector('[data-plan-cell]').focus();
  }

  function wirePlanCell(cell) {
    cell.addEventListener('input', () => {
      const [kind, index, key] = cell.dataset.planCell.split('.');
      const list = state.plan[kind] || (state.plan[kind] = []);
      while (list.length <= Number(index)) list.push({});
      list[Number(index)][key] = cell.value;
      state.planDirty = true;
      markDirty();

      /* Typing in the last row means she has more to say, so give her the
         next line before she asks for it. */
      const body = cell.closest('tbody');
      const rowsNow = body.querySelectorAll('[data-plan-row]');
      const isLast = rowsNow[rowsNow.length - 1].dataset.planRow === kind + '.' + index;
      if (isLast && cell.value.trim()) addPlanRow(kind, false);
    });
  }

  function wireSheet() {
    el('deskSheet').querySelectorAll('[data-field]').forEach(input =>
      input.addEventListener('input', () => {
        const [key, index] = input.dataset.field.split('.');
        if (key === 'vitals') state.doc.vitals[index] = input.value;
        else if (index === undefined) state.doc[key] = input.value;
        else state.doc.items[Number(index)][key] = input.value;
        markDirty();
      }));

    const add = el('deskAddMed');
    if (add) add.addEventListener('click', () => {
      state.doc.items.push({ name: '', dose: '', frequency: '', duration: '', instructions: '' });
      markDirty();
      paintSheet();
      const rows = el('deskMeds').querySelectorAll('[data-field^="name."]');
      if (rows.length) rows[rows.length - 1].focus();
    });

    el('deskSheet').querySelectorAll('[data-drop]').forEach(button =>
      button.addEventListener('click', () => {
        state.doc.items.splice(Number(button.dataset.drop), 1);
        markDirty();
        paintSheet();
      }));

    /* The lists stay line-per-item: she is writing advice, and a box she
       can type five lines into beats five rows she has to add. */
    el('deskSheet').querySelectorAll('[data-plan]').forEach(box =>
      box.addEventListener('input', () => {
        state.plan[box.dataset.plan] = linesToList(box.value);
        state.planDirty = true;
        markDirty();
      }));

    /* Meals and exercises are real table cells, each writing into its own
       row, and the table grows as she fills the last one. Rows left blank
       in every column are dropped on save. */
    el('deskSheet').querySelectorAll('[data-plan-cell]').forEach(wirePlanCell);

    el('deskSheet').querySelectorAll('[data-add-plan]').forEach(button =>
      button.addEventListener('click', () => addPlanRow(button.dataset.addPlan, true)));

  }

  /* ---------------------------------------------- keeping her typing --- */

  /* Vijay: "already i have opened this abcd patient's prescription, now it
     should be saved as a draft ... if he is not saving within 24 hours this
     draft should disappear."

     So the sheet is kept as she types, and a closed laptop, a flat battery
     or a patient who walks in mid-sentence costs nothing. What is kept is a
     SCRATCHPAD - see worker/consultationdraft.js. It is not a visit and not
     a draft prescription, nothing in the chart can see it, and it removes
     itself after a day. Only Save and Issue put anything in the record.

     Three seconds, because that is about the length of a pause between
     thoughts: long enough that a sentence is one save rather than forty,
     short enough that what is lost to a crash is a few words. */
  const AUTOSAVE_MS = 3000;

  /* What she actually typed. The clinic block and the patient block are
     rebuilt from `me` and the patient row on restore, so storing them would
     only be a way of putting yesterday's address back on the sheet. */
  const draftPayload = () => ({
    v: 1,
    doc: {
      vitals: state.doc.vitals,
      complaints: state.doc.complaints, examination: state.doc.examination,
      diagnosis: state.doc.diagnosis, advice: state.doc.advice,
      followUp: state.doc.followUp,
      items: state.doc.items
    },
    plan: state.plan,
    alerts: state.alerts
  });

  /* An empty sheet is not a draft. A doctor who types a word and deletes it
     must not leave a row behind that offers to restore nothing. */
  const hasTyping = payload => {
    const d = payload.doc;
    if ([d.complaints, d.examination, d.diagnosis, d.advice, d.followUp,
         payload.alerts].some(value => String(value || '').trim())) return true;
    if (Object.values(d.vitals || {}).some(value => String(value || '').trim())) return true;
    if ((d.items || []).some(item => String(item.name || '').trim())) return true;
    return Object.values(payload.plan || {}).some(list =>
      (list || []).some(entry => typeof entry === 'string'
        ? entry.trim()
        : Object.values(entry || {}).some(cell => String(cell || '').trim())));
  };

  const draftNote = at => {
    const when = at ? new Date(at) : new Date();
    return 'Draft kept ' + when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  async function autosave() {
    state.autosaveTimer = null;
    if (!state.patient || state.issued) return;
    /* One in flight already - come back rather than dropping this round,
       or a doctor who types one word and stops loses that word. */
    if (state.autosaving) { scheduleAutosave(); return; }
    const patientId = state.patient.id;
    const payload = draftPayload();
    state.autosaving = true;
    try {
      if (hasTyping(payload)) {
        await TCOSApi.saveConsultationDraft(patientId, payload);
        state.drafts.set(patientId, new Date().toISOString());
        if (state.patient && state.patient.id === patientId && state.dirty) {
          el('deskSaved').textContent = draftNote();
        }
      } else if (state.drafts.has(patientId)) {
        await TCOSApi.clearConsultationDraft(patientId);
        state.drafts.delete(patientId);
      } else {
        return;
      }
      paintQueue(el('deskSearch').value);
    } catch (_) {
      /* Deliberately silent. This is a safety net, not the save she asked
         for - and a red banner every three seconds because the wifi dipped
         would train her to ignore the banner that matters. The Save button
         is still lit and still says Unsaved. */
    } finally { state.autosaving = false; }
  }

  const scheduleAutosave = () => {
    if (state.autosaveTimer) clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(autosave, AUTOSAVE_MS);
  };

  /* Whatever is pending, now. Leaving the tab is exactly the moment the
     three-second wait is too long. */
  function flushDraft() {
    if (!state.autosaveTimer) return;
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    autosave();
  }

  /* The scratchpad has done its job the moment the consultation is a real
     record. Leaving it would mean the screen offering to restore something
     already saved, which is how two versions of one consultation start. */
  async function dropDraft(patientId) {
    if (state.autosaveTimer) { clearTimeout(state.autosaveTimer); state.autosaveTimer = null; }
    if (!state.drafts.has(patientId)) return;
    try {
      await TCOSApi.clearConsultationDraft(patientId);
      state.drafts.delete(patientId);
      paintQueue(el('deskSearch').value);
    } catch (_) { /* it expires by itself; nothing is lost by failing here */ }
  }

  function markDirty() {
    state.dirty = true;
    el('deskSaved').textContent = 'Unsaved';
    el('deskSave').disabled = false;
    scheduleAutosave();
  }

  /* ------------------------------------------------------ choosing one --- */

  async function choosePatient(id) {
    if (state.dirty && !confirm('This consultation has unsaved changes. Leave it?')) return;
    const patient = state.patients.find(p => p.id === id);
    if (!patient) return;

    /* Whatever was pending for the person she is leaving goes now, against
       her own id - not after the switch, when state.patient is somebody
       else and the sheet would be filed under the wrong name. */
    flushDraft();

    state.patient = patient;
    state.visitId = null;
    state.prescriptionId = null;
    state.issued = false;
    state.dirty = false;
    state.doc = emptyDoc(patient);

    el('deskPatient').textContent = patient.full_name;
    el('deskPatientMeta').textContent =
      [patient.local_ref, patient.sex, patient.mobile].filter(Boolean).join(' · ');
    el('deskStatus').hidden = false;
    el('deskStatus').textContent = 'Draft';
    el('deskStatus').className = 'desk-status draft';
    el('deskSaved').textContent = '';
    el('deskSave').disabled = true;
    el('deskIssue').disabled = true;
    el('deskPrint').disabled = false;
    el('deskUpload').disabled = false;
    msg('');

    state.plan = emptyPlan();
    state.planDirty = false;
    state.alerts = patient.allergies || '';
    el('deskAlerts').value = state.alerts;
    el('deskAlerts').disabled = false;
    state.alertsDirty = false;

    paintQueue(el('deskSearch').value);
    paintSheet();
    loadHistory(id);
    loadLabs(id);
    restoreDraft(patient);
  }

  /* Anything she had already typed for this person and not saved. Painted
     over the blank sheet rather than instead of it, so a draft that is
     missing, expired or unreadable leaves her with an empty consultation
     and not with an error where the sheet should be.

     What comes back is UNSAVED, and the screen says so: Save is lit, and
     leaving still warns. The first version of this restored the sheet with
     Save greyed out, on the reasoning that she had not just typed it - and
     that left a doctor looking at a full consultation she could not commit
     without first typing a character to wake the button up. The scratchpad
     is a safety net, not a save; the screen must not blur the two. */
  async function restoreDraft(patient) {
    let draft;
    try { ({ draft } = await TCOSApi.consultationDraft(patient.id)); }
    catch (_) { return; }
    /* She has moved on, or started typing, while that was in the air. Her
       current sheet wins - it is newer than anything on the server. */
    if (!draft || !draft.payload || state.dirty ||
        !state.patient || state.patient.id !== patient.id) return;

    const kept = draft.payload.doc || {};
    state.doc = {
      ...state.doc,
      vitals: { ...state.doc.vitals, ...(kept.vitals || {}) },
      complaints: kept.complaints || '', examination: kept.examination || '',
      diagnosis: kept.diagnosis || '', advice: kept.advice || '',
      followUp: kept.followUp || '',
      items: Array.isArray(kept.items) ? kept.items : []
    };
    /* The plan and the alerts each save through their own call and each has
       its own dirty flag, so restoring them without setting those flags
       would put a diet chart on the screen that Save then quietly skipped -
       the doctor would see it, save, and lose it. */
    const plan = draft.payload.plan;
    if (plan && Object.values(plan).some(list => (list || []).length)) {
      state.plan = { ...emptyPlan(), ...plan };
      state.planDirty = true;
    }
    if (draft.payload.alerts && draft.payload.alerts !== (patient.allergies || '')) {
      state.alerts = draft.payload.alerts;
      el('deskAlerts').value = state.alerts;
      state.alertsDirty = true;
    }
    state.drafts.set(patient.id, draft.updatedAt);

    paintSheet();

    /* Unsaved, and shown as unsaved. Save is lit because committing this
       consultation is the next thing she will want to do. */
    state.dirty = true;
    el('deskSave').disabled = false;
    el('deskSaved').textContent = draftNote(draft.updatedAt) + ' · not saved';

    /* Said plainly, because the alternative is her wondering whether the
       consultation in front of her is in the record or not. It is not. */
    msg('Picked up where you left off. This was kept automatically and is ' +
      'not in ' + patient.full_name + '\'s record yet — save it to keep it.', 'info');
  }

  /* The clinic's own verified readings, grouped one row per analyte so a
     trend reads across. Read-only here: a value enters the record from a
     report a clinician confirmed, never from this screen. */
  async function loadLabs(patientId) {
    const box = el('deskLabs');
    if (!box) return;
    box.innerHTML = '<h3>Diagnostics <span>Loading…</span></h3>';
    try {
      const { series } = await TCOSApi.labSeries(patientId);
      const byAnalyte = new Map();
      (series || []).forEach(row => {
        if (!byAnalyte.has(row.analyte)) {
          byAnalyte.set(row.analyte, { name: row.analyte, reference: row.reference, readings: [] });
        }
        byAnalyte.get(row.analyte).readings.push({
          on: row.reported_on, value: row.value, unit: row.unit, flag: row.flag
        });
      });
      const tests = [...byAnalyte.values()];
      state.doc.investigations = tests;

      /* The same sheet as everything else on this screen, empty or not.
         Vijay found this one still sitting as a bare table on grey after
         the plan had been fixed - the third time the same inconsistency
         has shown up, so it now goes through the renderer in BOTH states
         rather than having a hand-built empty case beside it. */
      box.innerHTML =
        window.RxDocument.render({ ...state.doc, investigations: tests },
          { audience: 'doctor', only: ['investigations'], showEmpty: true });
    } catch (error) {
      box.innerHTML = '<h3>Diagnostics</h3><div class="notice error">' +
        esc(error.message) + '</div>';
    }
  }

  /* Stored against the patient, not against this consultation: a report
     belongs to the person and is still theirs at the next visit and at the
     next clinic. Nothing is read out of it here - a value enters the record
     only when a clinician confirms it. */
  async function uploadReport(file) {
    if (!file) return;
    if (!state.patient) { msg('Pick a patient first.', 'error'); return; }
    msg('Uploading ' + file.name + '…', 'info');
    try {
      await TCOSApi.uploadFile(file, { kind: 'lab', patientId: state.patient.id });
      msg('Uploaded for ' + state.patient.full_name +
        '. Confirm the values on the Reports screen before they enter the record.', 'ok');
      loadLabs(state.patient.id);
    } catch (error) {
      msg(error.message, 'error');
    }
  }

  /* ---------------------------------------------------------- saving --- */

  /* HER OWN DISCIPLINE, NOT ALLOPATHY.
   *
     This said `item.system || 'allopathy'`, so every medicine written on the
     desk by an Ayurvedic doctor or a homeopath was stored as allopathic -
     and the patient's copy then printed her churna as "English medicine".
     Nobody had reported it because nobody reads their own demo prescriptions
     closely; it surfaced while taking the system dropdown off the
     consultation screen, which is where the same assumption lived.
   *
     js/products.js already holds which system each product leads with, so
     the answer was always available - it was simply not asked for. */
  const ownSystem = () => {
    const product = window.TCOSProducts && window.TCOSProducts.resolve(me);
    return (product && product.medicineFirst) || 'allopathy';
  };

  const usableItems = () => state.doc.items
    .filter(item => String(item.name || '').trim())
    .map(item => ({
      medicineName: item.name.trim(), system: item.system || ownSystem(),
      dose: item.dose || '', frequency: item.frequency || '',
      duration: item.duration || '', instructions: item.instructions || ''
    }));

  async function save() {
    if (!state.patient) return;
    el('deskSave').disabled = true;
    el('deskSaved').textContent = 'Saving…';
    try {
      /* One visit per patient per day. Saving twice must not leave two
         consultations in the record for one sitting. */
      if (!state.visitId) {
        const { visit } = await TCOSApi.createVisit({
          patientId: state.patient.id,
          visitedOn: state.doc.issuedOn,
          complaints: state.doc.complaints || null,
          findings: state.doc.examination || null,
          diagnosis: state.doc.diagnosis || null,
          advice: state.doc.advice || null,
          followUpOn: state.doc.followUp || null,
          vitals: JSON.stringify({
            bp: state.doc.vitals.bloodPressure || '',
            weight: state.doc.vitals.weight || ''
          }),
          idempotencyKey: 'desk:' + state.patient.id + ':' + state.doc.issuedOn
        });
        state.visitId = visit.id;
      }

      const items = usableItems();
      if (!state.prescriptionId) {
        const { prescription } = await TCOSApi.createPrescription({
          patientId: state.patient.id, visitId: state.visitId, items,
          idempotencyKey: 'desk-rx:' + state.patient.id + ':' + state.doc.issuedOn
        });
        state.prescriptionId = prescription.id;
      } else {
        await TCOSApi.savePrescriptionItems(state.prescriptionId, items, state.visitId);
      }

      /* The plan hangs off the visit, so it can only be saved once the
         visit exists - which is why it comes after, not alongside. */
      if (state.planDirty) {
        /* The spare rows at the foot of each table are ruled lines, not
           advice. A row with nothing in any column is dropped rather than
           saved as an empty instruction. */
        const filled = list => (list || []).filter(row =>
          Object.values(row || {}).some(value => String(value || '').trim()));
        await TCOSApi.saveCarePlan(state.visitId, {
          ...state.plan,
          meals: filled(state.plan.meals),
          exercises: filled(state.plan.exercises)
        });
        state.planDirty = false;
      }

      /* Alerts belong to the PATIENT and are saved whether or not this
         consultation is. A doctor who types "penicillin allergy" and then
         abandons the draft must not lose it - it was never about the
         draft. */
      if (state.alertsDirty) {
        await TCOSApi.setAllergies(state.patient.id, state.alerts);
        state.alertsDirty = false;
        const known = state.patients.find(p => p.id === state.patient.id);
        if (known) known.allergies = state.alerts || null;
      }

      state.dirty = false;
      el('deskSaved').textContent = 'Saved';
      el('deskIssue').disabled = items.length === 0;
      /* It is in the record now. The scratchpad copy would only be a second
         version of the same consultation waiting to be restored over it. */
      dropDraft(state.patient.id);
      loadHistory(state.patient.id);
    } catch (error) {
      el('deskSave').disabled = false;
      el('deskSaved').textContent = '';
      msg(error.message, 'error');
    }
  }

  async function issue() {
    if (!state.prescriptionId) { msg('Save the draft first.', 'error'); return; }
    if (!confirm('Issue this prescription? It cannot be edited afterwards — ' +
      'a mistake is corrected by amending it, with a reason.')) return;
    try {
      const { prescription } = await TCOSApi.issuePrescription(state.prescriptionId);
      state.issued = true;
      dropDraft(state.patient.id);
      state.doc.rxNumber = prescription.rx_number;
      el('deskStatus').textContent = 'Issued ' + (prescription.rx_number || '');
      el('deskStatus').className = 'desk-status issued';
      el('deskSave').disabled = true;
      el('deskIssue').disabled = true;
      /* Read-only from here: the patient is holding paper that has to keep
         matching the record. */
      el('deskSheet').innerHTML = window.RxDocument.render(state.doc, { audience: 'doctor' });
      msg('Issued. The patient\'s copy is available from their record.', 'ok');
      loadHistory(state.patient.id);
    } catch (error) { msg(error.message, 'error'); }
  }

  /* ------------------------------------------------------ adding a person --- */

  el('deskAddNew').addEventListener('click', () => {
    el('deskNewForm').hidden = !el('deskNewForm').hidden;
    if (!el('deskNewForm').hidden) el('newName').focus();
  });
  el('newCancel').addEventListener('click', () => { el('deskNewForm').hidden = true; });

  el('deskNewForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const { patient } = await TCOSApi.addPatient({
        fullName: el('newName').value.trim(),
        mobile: el('newMobile').value.trim(),
        sex: el('newSex').value || null,
        dateOfBirth: el('newDob').value || null
      });
      el('deskNewForm').reset();
      el('deskNewForm').hidden = true;
      msg('');
      await loadPeople();
      choosePatient(patient.id);
    } catch (error) { msg(error.message, 'error'); }
  });

  /* ------------------------------------------------------------ wiring --- */

  /* Upload sits in the top bar beside Save draft. Vijay: "make it handy
     beside save draft, so it is easy for him to add." It was buried under
     the diagnostics table, which is the one place she is not looking when
     she has a report in her hand.
   *
     It opens a dialog rather than a file picker, because the doctor
     usually does NOT hold the report - the patient does, as photos on her
     phone. So the first thing offered is a code to scan; attaching a file
     from this computer is the second. */
  const uploadDialog = el('uploadDialog');

  el('deskUpload').addEventListener('click', async () => {
    if (!state.patient) return;
    el('uploadBody').innerHTML = '<div class="empty">Preparing a code…</div>';
    uploadDialog.showModal();
    try {
      const link = await TCOSApi.createUploadLink(state.patient.id);
      /* Drawn here rather than fetched from a CDN: the CSP allows scripts
         from ourselves and nowhere else, and widening it product-wide so
         one dialog can draw a square is a bad trade. */
      el('uploadBody').innerHTML =
        '<div class="desk-qr">' + window.TCOSQr.svg(link.url, { scale: 6 }) + '</div>' +
        '<p class="desk-qr-help"><b>' + esc(state.patient.full_name) +
          '</b> can scan this with her phone camera and send photos of the ' +
          'report straight into her record.</p>' +
        '<p class="desk-qr-help">Hold the screen up to her, or scan it ' +
          'yourself if you are holding her phone.</p>' +
        '<div class="desk-qr-link">' +
          '<input readonly id="uploadUrl" value="' + esc(link.url) + '">' +
          '<button type="button" class="btn btn-ghost" id="uploadCopy">Copy</button>' +
        '</div>' +
        '<p class="desk-qr-note">The code stops working in ' +
          esc(String(link.expiresInMinutes)) + ' minutes, and takes up to 12 ' +
          'pages. Nothing she sends enters the record until you confirm it.</p>';

      el('uploadCopy').addEventListener('click', () => {
        const box = el('uploadUrl');
        box.select();
        navigator.clipboard.writeText(box.value)
          .then(() => { el('uploadCopy').textContent = 'Copied'; })
          .catch(() => { el('uploadCopy').textContent = 'Press Ctrl+C'; });
      });
    } catch (error) {
      el('uploadBody').innerHTML = '<div class="notice error">' + esc(error.message) + '</div>';
    }
  });

  el('uploadClose').addEventListener('click', () => uploadDialog.close());
  el('uploadDone').addEventListener('click', () => {
    uploadDialog.close();
    if (state.patient) loadLabs(state.patient.id);
  });

  el('deskLabFile').addEventListener('change', event => {
    uploadReport(event.target.files[0]);
    /* Cleared so the same file can be picked twice - a change event does
       not fire for an identical value. */
    event.target.value = '';
  });

  /* Alerts live in the rail rather than in the sheet, so they are wired
     once here instead of on every repaint - and the box keeps whatever is
     being typed when the sheet redraws underneath it, which it did not
     when it was rebuilt each time. */
  /* THE STANDING REGISTRATION CODE. Vijay: "a QR code at the attender,
     patient opens that link and the customer form gets, and till he waits
     he can fill up his details."
   *
     One code per clinic, not per patient - it is printed once and stood on
     the counter, so it must not expire and must not identify anybody. It
     carries the clinic's public slug, which is on her website anyway. */
  const codeDialog = el('codeDialog');

  el('deskShowCode').addEventListener('click', async () => {
    el('codeBody').innerHTML = '<div class="empty">Preparing…</div>';
    codeDialog.showModal();
    try {
      const settings = await TCOSApi.publicPageSettings();
      if (!settings.slug) {
        el('codeBody').innerHTML = '<div class="notice info">This clinic has no web ' +
          'address yet. Set one under My practice, and the code appears here.</div>';
        return;
      }
      const url = location.origin + '/r.html#' + settings.slug;
      el('codeBody').innerHTML =
        '<div class="desk-qr">' + window.TCOSQr.svg(url, { scale: 6 }) + '</div>' +
        '<p class="desk-qr-help">Print this and stand it on the counter. A ' +
          'patient scans it and fills in her own details while she waits.</p>' +
        '<div class="desk-qr-link">' +
          '<input readonly id="codeUrl" value="' + esc(url) + '">' +
          '<button type="button" class="btn btn-ghost" id="codeCopy">Copy</button>' +
        '</div>' +
        '<p class="desk-qr-note">It does not expire and it identifies nobody. ' +
          'What she sends arrives here as someone waiting, for the desk to ' +
          'check before any record is created.</p>';
      el('codeCopy').addEventListener('click', () => {
        el('codeUrl').select();
        navigator.clipboard.writeText(el('codeUrl').value)
          .then(() => { el('codeCopy').textContent = 'Copied'; })
          .catch(() => { el('codeCopy').textContent = 'Press Ctrl+C'; });
      });
    } catch (error) {
      el('codeBody').innerHTML = '<div class="notice error">' + esc(error.message) + '</div>';
    }
  });

  el('codeClose').addEventListener('click', () => codeDialog.close());
  el('codeDone').addEventListener('click', () => codeDialog.close());

  el('deskAlerts').addEventListener('input', () => {
    state.alerts = el('deskAlerts').value;
    state.alertsDirty = true;
    markDirty();
  });

  el('deskSave').addEventListener('click', save);
  el('deskIssue').addEventListener('click', issue);
  el('deskPrint').addEventListener('click', () => window.print());

  let timer;
  el('deskSearch').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => paintQueue(el('deskSearch').value), 180);
  });

  /* The warning stays. The scratchpad means her typing survives a closed
     laptop, but it is NOT the record - leaving without saving still leaves
     the consultation out of the chart, and she should be told so rather
     than reassured by an autosave that saves somewhere she cannot see. */
  window.addEventListener('beforeunload', event => {
    if (!state.dirty) return;
    flushDraft();
    event.preventDefault();
    event.returnValue = '';
  });

  /* Switching tabs, locking the screen, or the phone going to sleep. This
     is the moment a three-second wait is too long, and on mobile it is
     often the last callback a page gets. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDraft();
  });

  await loadPeople();

  /* Arriving from the Prescriptions list with ?rx=<id>: select that patient
     and show the prescription she clicked, with the queue and her earlier
     prescriptions around it. That is the difference between opening a
     document and opening a consultation. */
  const wanted = new URLSearchParams(location.search).get('rx');
  if (wanted) {
    try {
      const { prescription } = await TCOSApi.getPrescription(wanted);
      await choosePatient(prescription.patient_id);
      openPast(wanted);
    } catch (error) { msg(error.message, 'error'); }
  }
})();
