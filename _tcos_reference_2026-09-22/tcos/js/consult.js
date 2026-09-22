/* =========================================================================
   The consultation screen - where a doctor actually spends their day.

   Design decisions, and why:

   - Form on the left, live prescription on the right. A doctor needs to see
     what the patient will be handed while typing it, not after.
   - Draft stays editable. Issue freezes it and allocates the number. That is
     the moment paper leaves the room.
   - Medicines can be picked from the doctor's own pharmacy, which links the
     line to a stock item so dispensing decrements the right batch. Anything
     not stocked is still just typed - most prescriptions include both.
   - Nothing here decides which doctor this is. The session does.
   ========================================================================= */
(async () => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = id => document.getElementById(id);
  const msg = (text, kind) => {
    el('pageMsg').innerHTML = text
      ? '<div class="bar-notice ' + kind + '">' + text + '</div>' : '';
  };

  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }

  const patientId = new URLSearchParams(location.search).get('patient');
  if (!patientId) { location.replace('patients.html'); return; }

  let me, record, stockItems = [];
  let prescriptionId = null;
  let issued = null;
  /* Reused until this screen succeeds. If a response is lost after the
     database commits, clicking again returns the same visit and draft. */
  const visitAttemptKey = crypto.randomUUID();
  const prescriptionAttemptKey = crypto.randomUUID();

  try {
    me = await TCOSApi.me();
    record = await TCOSApi.getPatient(patientId);
  } catch (error) {
    if (error.status === 401) { TCOSBoot.toSignIn('expired'); return; }
    TCOSBoot.failed(error.message);
    msg(esc(error.message), 'error');
    return;
  }
  /* This screen draws no rail, so nothing else here would ever tell the boot
     overlay the app is up - it would sit until its deadline and then claim
     the app had failed, on a screen that was working perfectly. */
  TCOSBoot.ready();
  try { stockItems = (await TCOSApi.stock()).items || []; } catch (_) { /* pharmacy optional */ }

  const product = window.TCOSProducts.remember(me.product);
  document.title = 'Consultation | ' + product.name;

  /* The clinic owns the workspace; the signed-in clinician owns the work.
     A practitioner therefore signs with their own verified identity, while
     the owner keeps the historical top-level fields for compatibility. */
  function clinician() {
    if (issued && issued.doctor_name) {
      return {
        name: issued.doctor_name,
        qualification: issued.qualification,
        registrationNo: issued.registration_no,
        verified: issued.practitioner_verification_status === 'verified'
      };
    }
    const actor = me.me || {};
    return {
      name: actor.name || me.fullName,
      qualification: actor.qualification || me.qualification,
      registrationNo: actor.registrationNo || me.registrationNo,
      verified: typeof actor.verified === 'boolean'
        ? actor.verified : !!(me.verification && me.verification.verified)
    };
  }

  const patient = record.patient;
  el('patientName').textContent = patient.full_name;
  el('patientInitial').textContent = (patient.full_name || '?').charAt(0).toUpperCase();
  /* Her patient number belongs here: it is what she reads out on the phone,
     and what the chart is filed under. */
  /* Her locality sits here with the number and the blood group: a doctor
     planning a follow-up needs to know she travels in from Warangal before
     he says "come back on Thursday". */
  el('patientMeta').textContent =
    [record.patient.local_ref, patient.mobile, patient.sex, patient.blood_group,
     patient.locality]
      .filter(Boolean).join(' · ');
  el('visitedOn').value = new Date().toISOString().slice(0, 10);

  el('stockList').innerHTML = stockItems.map(item =>
    '<option value="' + esc(item.medicine_name) + '">').join('');

  /* ---- the examination form -------------------------------------------

     Two sources, one form. Our practice packs are a good guess at what a
     doctor examines; they are still a guess. A real Ayurvedic examination
     has Naabhi and ANG in it and neither is in any pack we wrote, so she
     adds her own and they sit in the same grid as ours.

     Beside every field, whether it prints. Six fit on the sheet - see
     worker/clinicfields.js - and the rest are recorded, kept and shown
     here, just not on the paper. Marking them on the form is what stops
     "where did my Naabhi go" being a support call: she can see, while she
     is typing into it, that this one stays in the record. */
  const registry = window.ClinicRegistry;
  const activePacks = Array.from(new Set(me.practicePacks || []));
  const packSections = activePacks
    .map(id => registry.PRACTICE_PACKS[id]).filter(Boolean)
    .flatMap(pack => pack.sections);

  /* Her own fields and her print list. A failure here must not take the
     consultation down with it: the packs still work, and an examination
     screen that refuses to open because a settings call timed out is worse
     than one missing three fields. */
  let ownFields = [], printFields = null, printMax = 6;
  try {
    const layout = await TCOSApi.clinicFields();
    ownFields = layout.fields || [];
    printFields = layout.printFields || null;
    printMax = layout.max || 6;
  } catch (_) { /* her own fields are unavailable; the packs are not */ }

  const prints = key => !printFields || printFields.includes(key);

  function paintFields() {
    const packInputs = packSections.flatMap(section =>
      section.fields.map(field => ({
        key: section.id + '.' + field, label: field, own: null
      })));
    const ownInputs = ownFields.map(f => ({ key: f.slug, label: f.label, own: f.id }));
    const all = packInputs.concat(ownInputs);

    if (!all.length) { el('packCard').hidden = true; return; }

    el('packCard').hidden = false;
    el('packTitle').textContent = 'Examination & therapy';
    el('packHint').textContent = printFields
      ? printFields.length + ' of these print on the prescription · the rest stay in the record'
      : 'From your practice packs · every filled field prints today';

    /* Values already typed survive a repaint - she may add a field halfway
       through an examination and nothing she has entered may be lost by it. */
    const typed = {};
    document.querySelectorAll('[data-finding]').forEach(input => {
      if (input.value) typed[input.dataset.finding] = input.value;
    });

    el('packFields').innerHTML = all.map(f =>
      '<label class="field' + (prints(f.key) ? '' : ' field-off-sheet') + '">' +
        '<span>' + esc(f.label) +
          (prints(f.key) ? '' : '<i class="off-sheet-tag" title="Recorded in the record. ' +
            'Not printed on the prescription.">record only</i>') +
          (f.own ? '<button type="button" class="field-drop" data-drop-field="' +
            esc(f.own) + '" title="Remove this field from your form">&times;</button>' : '') +
        '</span>' +
        '<input data-finding="' + esc(f.key) + '" value="' +
          esc(typed[f.key] || '') + '"></label>').join('');

    /* Rebound because the inputs are new elements. */
    el('packFields').querySelectorAll('input')
      .forEach(input => input.addEventListener('input', paint));
    el('packFields').querySelectorAll('[data-drop-field]')
      .forEach(button => button.addEventListener('click', () => dropField(button.dataset.dropField)));
  }

  async function dropField(id) {
    const field = ownFields.find(f => f.id === id);
    if (!field) return;
    if (!confirm('Remove "' + field.label + '" from your examination form?\n\n' +
      'Values already recorded under it are kept — this only takes it off the form.')) return;
    try {
      await TCOSApi.removeClinicField(id);
      ownFields = ownFields.filter(f => f.id !== id);
      if (printFields) printFields = printFields.filter(k => k !== field.slug);
      paintFields(); paint();
    } catch (error) { el('addFieldNote').textContent = error.message; }
  }

  paintFields();

  /* ---- adding one, without leaving the patient ---- */
  const addForm = el('addFieldForm');
  const showAdd = show => {
    addForm.hidden = !show;
    el('addFieldBtn').hidden = show;
    if (show) { el('addFieldLabel').value = ''; el('addFieldLabel').focus(); }
    el('addFieldNote').textContent = '';
  };
  el('addFieldBtn').addEventListener('click', () => showAdd(true));
  el('addFieldCancel').addEventListener('click', () => showAdd(false));
  el('addFieldLabel').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); el('addFieldSave').click(); }
    if (event.key === 'Escape') showAdd(false);
  });
  el('addFieldSave').addEventListener('click', async () => {
    const label = el('addFieldLabel').value.trim();
    if (!label) return;
    el('addFieldSave').disabled = true;
    try {
      const { field } = await TCOSApi.addClinicField(label);
      if (!ownFields.some(f => f.id === field.id)) ownFields.push(field);
      showAdd(false);
      paintFields();
      /* Honest about where it went. A new field does NOT join the printed
         six by itself - she has six slots and we do not spend one for her
         and we do not silently drop one of hers to make room. */
      el('addFieldNote').textContent = printFields
        ? '"' + field.label + '" added. It is recorded, not printed — ' +
          'put it on the sheet from My practice → prescription layout.'
        : '"' + field.label + '" added.';
      const fresh = el('packFields').querySelector('[data-finding="' + field.slug + '"]');
      if (fresh) fresh.focus();
      paint();
    } catch (error) {
      el('addFieldNote').textContent = error.message;
    } finally { el('addFieldSave').disabled = false; }
  });

  /* ---- medicine rows ---- */
  const systems = registry.medicineSystemsFor(product);

  /* What a medicine is assumed to be when nothing else says otherwise.
   *
     medicineSystemsFor() puts her own discipline first, so this is Ayurveda
     for an AyurCOS doctor and homeopathy for a homeopath. It used to be
     whichever option happened to be first in the <select>, and on the
     consultation desk it was hardcoded to 'allopathy' - which meant an
     Ayurvedic doctor's churna was printed on her patient's copy as "English
     medicine". A compounded preparation no catalogue will ever contain is
     exactly the case this has to get right, because that is the one where
     nothing else can fill it in. */
  const defaultSystem = (systems[0] && systems[0].id) || 'allopathy';

  /* ----------------------------------------------------------------------
     Typing a medicine.

     Two sources feed the same box. Her own pharmacy stock comes first,
     because a medicine she can hand over now beats one she cannot. Behind it
     sits the catalogue: 1,272 molecules and 360 herbs.

     Choosing a name fills that row's dose list with the strengths the
     molecule is actually sold in, so 650mg is picked, never typed from
     memory at the end of a long day.

     None of this constrains her. The box is a plain input with a datalist -
     anything she types that is not in either list is accepted exactly as
     typed, which matters for a compounded preparation that no catalogue
     will ever contain. */
  let drugSeq = 0;
  const drugCache = new Map();   // lowercased name -> catalogue entry

  const remember = list => list.forEach(d => drugCache.set(d.name.toLowerCase(), d));

  async function suggestDrugs(term, listEl) {
    const q = (term || '').trim();
    if (q.length < 2) return;
    const mine = ++drugSeq;
    let found = [];
    try { found = (await TCOSApi.searchDrugs(q)).drugs || []; }
    catch (_) { return; }             /* offline: the stock list still works */
    if (mine !== drugSeq) return;     /* a later keystroke already answered */
    remember(found);

    listEl.innerHTML =
      stockItems.map(item =>
        '<option value="' + esc(item.medicine_name) + '">In your pharmacy</option>').join('') +
      found.map(d =>
        '<option value="' + esc(d.name) + '">' +
        esc(d.detail || (d.system === 'ayurveda' ? 'Ayurveda' : 'Allopathy')) +
        '</option>').join('');
  }

  const debounce = (fn, ms) => {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  };

  let rowSeq = 0;

  function addMedRow(values) {
    const row = document.createElement('div');
    row.className = 'med-row';
    /* Each row needs its own two lists: the names it is offering, and the
       strengths for whatever name it currently holds. */
    const uid = 'r' + (rowSeq++);
    row.innerHTML =
      '<input class="m-name" list="names-' + uid + '" placeholder="Medicine" autocomplete="off" value="' +
        esc(values && values.medicineName || '') + '">' +
      '<datalist id="names-' + uid + '"></datalist>' +
      '<datalist id="doses-' + uid + '"></datalist>' +
      /* WHICH SYSTEM A MEDICINE BELONGS TO IS NOT A QUESTION FOR HER.
       *
         This was a dropdown on every row. A doctor gave us the feedback
         plainly: "he is entering the medicine, it is asking allopathy homeo
         so on - why do i need to enter this all, it is increasing the time,
         rather i go for just manual prescription."
       *
         He is right, and the field was never really his to fill: the
         catalogue knows what Ashwagandha is, and her own pharmacy knows what
         is on her shelf. Both already set this automatically - the dropdown
         was a third source of truth that only existed to be wrong.
       *
         The VALUE stays, because the patient's copy tags each medicine for
         her and because a homeopath has to be able to see that her patient
         is on allopathic thyroxine. What goes is the asking. */
      '<input type="hidden" class="m-system" value="' +
        esc((values && values.system) || defaultSystem) + '">' +
      '<input class="m-dose" list="doses-' + uid + '" placeholder="1 tablet" autocomplete="off" value="' +
        esc(values && values.dose || '') + '">' +
      '<input class="m-freq" placeholder="Twice daily" value="' + esc(values && values.frequency || '') + '">' +
      '<input class="m-dur" placeholder="30 days" value="' + esc(values && values.duration || '') + '">' +
      '<input class="m-qty" type="number" min="0" step="any" placeholder="—" title="Quantity to dispense from your pharmacy" value="' +
        esc(values && values.dispenseQuantity != null ? values.dispenseQuantity : '') + '">' +
      '<button type="button" class="m-del" title="Remove">×</button>' +
      '<input class="m-note" placeholder="Instructions, e.g. after food / with water / when required" value="' + esc(values && values.instructions || '') + '">';
    el('medRows').appendChild(row);

    row.querySelector('.m-del').addEventListener('click', () => { row.remove(); paint(); });
    row.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('input', paint);
      input.addEventListener('change', paint);
    });

    const nameInput = row.querySelector('.m-name');
    const nameList = row.querySelector('#names-' + uid);
    const doseList = row.querySelector('#doses-' + uid);

    /* Fills the dose list from whatever name is currently in the box. */
    function paintDoses() {
      const drug = drugCache.get(nameInput.value.trim().toLowerCase());
      if (!drug) { doseList.innerHTML = ''; return; }
      doseList.innerHTML = (drug.strengths || []).map(s =>
        '<option value="' + esc(s.strength + (s.form ? ' ' + s.form : '')) + '">').join('');
      /* An Ayurvedic entry says so; she should not have to set it herself. */
      const match = systems.find(x => x.id === drug.system);
      if (match) row.querySelector('.m-system').value = drug.system;
    }

    /* Her pharmacy is offered before she types anything, and stays offered if
       the catalogue call fails. Losing the network should not cost her the
       list of what is on her own shelf. */
    const stockOptions = () => stockItems.map(item =>
      '<option value="' + esc(item.medicine_name) + '">In your pharmacy</option>').join('');
    nameList.innerHTML = stockOptions();

    const ask = debounce(async value => {
      await suggestDrugs(value, nameList);
      paintDoses();
    }, 180);

    nameInput.addEventListener('input', () => ask(nameInput.value));

    /* Typing a stocked medicine name links the line to that stock item, so
       dispensing later decrements the right thing. */
    nameInput.addEventListener('change', event => {
      paintDoses();
      const match = stockItems.find(i =>
        i.medicine_name.toLowerCase() === event.target.value.trim().toLowerCase());
      row.dataset.stockItemId = match ? match.id : '';
      if (match) {
        row.querySelector('.m-system').value = match.system;
        row.classList.add('stocked');
        row.querySelector('.m-name').title = 'In your pharmacy: ' + match.on_hand + ' on hand';
      } else {
        row.classList.remove('stocked');
        row.querySelector('.m-name').title = 'Not in your pharmacy - stock will not change';
      }
      paint();
    });
    if (values && values.stockItemId) row.dataset.stockItemId = values.stockItemId;
    return row;
  }

  const readMedicines = () => Array.from(document.querySelectorAll('.med-row'))
    .map(row => ({
      medicineName: row.querySelector('.m-name').value.trim(),
      system: row.querySelector('.m-system').value,
      dose: row.querySelector('.m-dose').value.trim(),
      frequency: row.querySelector('.m-freq').value.trim(),
      duration: row.querySelector('.m-dur').value.trim(),
      instructions: row.querySelector('.m-note').value.trim(),
      dispenseQuantity: row.querySelector('.m-qty').value === ''
        ? null : Number(row.querySelector('.m-qty').value),
      stockItemId: row.dataset.stockItemId || null
    }))
    .filter(item => item.medicineName);

  el('addMed').addEventListener('click', () => { addMedRow(); paint(); });
  for (let i = 0; i < 3; i++) addMedRow();

  /* ---- the live sheet ---- */

  const readFindings = () => {
    const findings = {};
    document.querySelectorAll('[data-finding]').forEach(input => {
      if (input.value.trim()) findings[input.dataset.finding] = input.value.trim();
    });
    return findings;
  };

  /* What of the examination reaches the paper.

     EVERYTHING she typed is saved by readFindings() above. This is only
     about the sheet, which is one side of one page: six fields, in the
     order she chose them, and a field she has not filled this visit is
     skipped rather than printed empty.

     A clinic that has never opened the setting gets what it always got -
     every filled field. Treating "not configured" as "print nothing" would
     shorten the next prescription of a doctor who never asked us to. */
  function sheetFindings() {
    const values = readFindings();
    const labelOf = key => {
      const own = ownFields.find(f => f.slug === key);
      return own ? own.label : key.split('.').slice(1).join('.') || key;
    };
    const keys = printFields
      ? printFields.filter(key => values[key])
      : Object.keys(values);
    return keys.map(key => ({ label: labelOf(key), value: values[key] }));
  }

  function paint() {
    const meds = readMedicines();
    const signer = clinician();
    const systemLabel = Object.fromEntries(systems.map(s => [s.id, s.label]));
    const dateText = new Intl.DateTimeFormat('en-GB',
      { day: '2-digit', month: 'short', year: 'numeric' })
      .format(new Date(el('visitedOn').value || Date.now()));

    const row = (label, value) => value
      ? '<p><b>' + esc(label) + '</b><span>' + esc(value) + '</span></p>' : '';

    el('sheet').innerHTML =
      '<header class="rx-header">' +
        '<div class="logo-fallback">' + esc((me.clinicName || '?').charAt(0)) + '</div>' +
        '<div class="identity">' +
          '<h1>' + esc(me.clinicName) + '</h1>' +
          (me.tagline ? '<p class="tagline">' + esc(me.tagline) + '</p>' : '') +
          '<p class="doctor">' + esc(signer.name) +
            (signer.qualification ? ' — ' + esc(signer.qualification) : '') + '</p>' +
          /* Only a checked number prints - see rx.html and migration 014. */
          ((signer.verified && signer.registrationNo)
            ? '<p class="reg">' + esc(signer.registrationNo) + '</p>' : '') +
        '</div>' +
        '<div class="meta">' +
          (issued && issued.rx_number
            ? '<div><b>Rx No:</b> ' + esc(issued.rx_number) + '</div>' : '') +
          '<div><b>Date:</b> ' + esc(dateText) + '</div>' +
        '</div>' +
      '</header>' +
      '<div class="rule"></div>' +
      '<div class="patient-strip">' +
        '<p><b>Patient</b><span>' + esc(patient.full_name) + '</span></p>' +
        '<p><b>Sex</b><span>' + esc(patient.sex || '—') + '</span></p>' +
        '<p><b>Weight</b><span>' + esc(el('vWeight').value || '—') + '</span></p>' +
        '<p><b>Mobile</b><span>' + esc(patient.mobile) + '</span></p>' +
      '</div>' +
      '<div class="rx-body">' +
        (el('complaints').value || el('diagnosis').value ? '<section><h2>Complaints &amp; Diagnosis</h2>' +
          '<div class="field-grid single">' +
          row('Complaints', el('complaints').value) +
          row('Diagnosis', el('diagnosis').value) + '</div></section>' : '') +
        (sheetFindings().length ? '<section><h2>Examination</h2><div class="field-grid">' +
          sheetFindings().map(f => row(f.label, f.value)).join('') + '</div></section>' : '') +
        (meds.length ? '<section><h2>Medicines</h2>' +
          '<table class="med"><thead><tr><th>#</th><th>Medicine</th><th>Dose</th>' +
          '<th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>' +
          meds.map((m,index) => '<tr><td>' + (index+1) + '</td><td><b>' + esc(m.medicineName) + '</b><small>' + esc(systemLabel[m.system] || m.system) + '</small></td>' +
            '<td>' + esc(m.dose) + '</td><td>' + esc(m.frequency) + '</td>' +
            '<td>' + esc(m.duration) + '</td><td>' + esc(m.instructions || '—') + '</td></tr>').join('') +
          '</tbody></table></section>' : '') +
        (el('investigations').value || el('referrals').value ? '<section><h2>Investigations &amp; Referrals</h2>' +
          '<div class="field-grid single">' + row('Investigations advised', el('investigations').value) +
          row('Referral / co-management', el('referrals').value) + '</div></section>' : '') +
        (el('advice').value ? '<section><h2>Advice</h2><div class="field-grid single">' +
          row('Advice', el('advice').value) + '</div></section>' : '') +
        (el('followUpOn').value ? '<section><h2>Follow-up</h2><div class="field-grid single">' +
          row('Next review', el('followUpOn').value) + '</div></section>' : '') +
      '</div>' +
      '<div class="signature"><div><i></i><b>' + esc(signer.name) + '</b>' +
        '<small>' + esc(signer.qualification || '') + '</small></div></div>' +
      (me.address ? '<footer class="clinic-footer"><span>' + esc(me.address) + '</span></footer>' : '') +
      '<div class="platform-credit"><span class="mark">T</span>' + esc(product.name) +
        ' · A Tharigopula Technologies product</div>';
  }

  /* Examination inputs are excluded: paintFields() binds them itself, and
     it rebuilds them whenever she adds or removes a field. Binding them
     here as well would run paint() twice on every keystroke. */
  document.querySelectorAll('#formCol input:not([data-finding]), #formCol textarea, #formCol select')
    .forEach(input => input.addEventListener('input', paint));
  paint();

  /* ---- saving, issuing, amending ---- */

  function setState(state) {
    const badge = el('rxState');
    badge.textContent = state === 'issued' ? 'Issued' : 'Draft';
    badge.className = 'state ' + state;
    el('issueBtn').hidden = state === 'issued';
    el('saveBtn').hidden = state === 'issued';
    el('amendBtn').hidden = state !== 'issued';
    el('printBtn').hidden = state !== 'issued';
    /* The examination form freezes with everything else once the paper has
       left the room: adding a field to an issued prescription would be a
       field with nowhere to go. */
    document.querySelectorAll('#formCol input, #formCol textarea, #formCol select, ' +
      '.m-del, #addMed, #addFieldBtn, #addFieldSave, .field-drop')
      .forEach(control => { control.disabled = state === 'issued'; });
  }

  async function saveDraft(visitId) {
    const items = readMedicines();
    if (!items.length) throw new TCOSApi.ApiClientError('empty', 'Add at least one medicine.');
    if (!prescriptionId) {
      const created = await TCOSApi.createPrescription({
        patientId, visitId, items, idempotencyKey: prescriptionAttemptKey
      });
      prescriptionId = created.prescription.id;
    } else {
      await TCOSApi.savePrescriptionItems(prescriptionId, items, visitId);
    }
    return prescriptionId;
  }

  async function saveVisit() {
    return (await TCOSApi.createVisit({
      patientId,
      idempotencyKey: visitAttemptKey,
      visitedOn: el('visitedOn').value,
      visitType: el('visitType').value,
      complaints: el('complaints').value.trim() || null,
      diagnosis: el('diagnosis').value.trim() || null,
      advice: el('advice').value.trim() || null,
      followUpOn: el('followUpOn').value || null,
      vitals: {
        bp: el('vBp').value.trim(), pulse: el('vPulse').value.trim(),
        weight: el('vWeight').value.trim(), temperature: el('vTemp').value.trim()
      },
      findings: Object.assign(readFindings(), {
        'care.investigations': el('investigations').value.trim(),
        'care.referrals': el('referrals').value.trim()
      })
    })).visit;
  }

  el('saveBtn').addEventListener('click', async () => {
    el('saveBtn').disabled = true;
    try { await saveDraft(); msg('Draft saved.', 'ok'); }
    catch (error) { msg(esc(error.message), 'error'); }
    finally { el('saveBtn').disabled = false; }
  });

  el('issueBtn').addEventListener('click', async () => {
    if (!confirm('Issue this prescription?\n\nIt gets its number and can no longer be edited. ' +
      'A correction after this creates an amended version.')) return;
    el('issueBtn').disabled = true;
    try {
      const visit = await saveVisit();
      await saveDraft(visit.id);
      issued = (await TCOSApi.issuePrescription(prescriptionId)).prescription;
      setState('issued');
      paint();
      msg('Issued as <b>' + esc(issued.rx_number) + '</b>. This record is now fixed.', 'ok');
      setTimeout(() => print(), 400);
    } catch (error) {
      msg(esc(error.message), 'error');
    } finally {
      el('issueBtn').disabled = false;
    }
  });

  el('printBtn').addEventListener('click', () => print());

  const amendDialog = el('amendDialog');
  el('amendBtn').addEventListener('click', () => amendDialog.showModal());
  el('amendCancel').addEventListener('click', () => amendDialog.close());
  el('amendClose').addEventListener('click', () => amendDialog.close());

  el('amendForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const amended = await TCOSApi.amendPrescription(
        prescriptionId, el('amendReason').value.trim());
      amendDialog.close();
      prescriptionId = amended.prescription.id;
      issued = null;
      setState('draft');
      msg('New draft created, amending ' + esc(amended.prescription.amends) +
        '. The original is unchanged.', 'info');
      paint();
    } catch (error) {
      msg(esc(error.message), 'error');
    }
  });

  /* ---------------- the scribe ----------------

     Records the consultation, has it transcribed, and drops the result into
     the boxes above for the doctor to correct. It saves nothing itself: she
     still presses Save draft, and what is saved is whatever is in the boxes
     at that moment, not what the model said.

     The microphone cannot open until the consent line is ticked, and the
     consent is registered SERVER-SIDE first - a row exists before any audio
     does, so there is no path that records without one. */
  (function scribe() {
    const box = el('scribeBox');
    if (!box) return;

    /* A missing microphone should leave the doctor with the ordinary typed
       form, not a broken panel. */
    const canRecord = typeof MediaRecorder !== 'undefined' &&
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (!canRecord) return;
    box.hidden = false;

    let recorder = null, chunks = [], stream = null;
    let noteId = null, startedAt = 0, ticker = null;

    const say = (text, kind) => {
      el('scribeMsg').innerHTML = text
        ? '<div class="notice ' + (kind || 'info') + '" style="max-width:none">' + text + '</div>' : '';
    };
    const state = text => { el('scribeState').textContent = text; };

    el('scribeConsent').addEventListener('change', event => {
      el('scribeStart').disabled = !event.target.checked;
    });

    function stopTicker() { clearInterval(ticker); ticker = null; }

    /* Whatever happens, let go of the microphone. A tab quietly holding an
       open mic after a consultation is its own privacy problem. */
    function release() {
      stopTicker();
      if (stream) stream.getTracks().forEach(track => track.stop());
      stream = null; recorder = null;
    }

    function armAgain() {
      el('scribeConsent').disabled = false;
      el('scribeConsent').checked = false;
      el('scribeStart').disabled = true;
    }

    el('scribeStart').addEventListener('click', async () => {
      if (!patientId) { say('Open this visit from a patient first.', 'error'); return; }
      el('scribeStart').disabled = true;
      say('');
      try {
        /* Consent is recorded before the microphone is even asked for. */
        noteId = (await TCOSApi.startConsultNote(patientId)).note.id;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        el('scribeStart').disabled = false;
        say(esc(error.name === 'NotAllowedError'
          ? 'The browser blocked the microphone. Allow it for this site and try again.'
          : error.message), 'error');
        release();
        return;
      }

      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.addEventListener('dataavailable', e => { if (e.data.size) chunks.push(e.data); });
      recorder.start();
      startedAt = Date.now();

      el('scribeStop').hidden = false;
      el('scribeConsent').disabled = true;
      state('Recording');
      ticker = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        el('scribeTimer').textContent =
          String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      }, 500);
    });

    el('scribeStop').addEventListener('click', () => {
      if (!recorder) return;
      const seconds = (Date.now() - startedAt) / 1000;
      el('scribeStop').hidden = true;
      state('Writing the note…');
      stopTicker();

      recorder.addEventListener('stop', async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        release();
        try {
          showDraft((await TCOSApi.sendConsultAudio(noteId, blob, seconds)).note);
          state('Ready to check');
        } catch (error) {
          state('Could not write it');
          say(esc(error.message) +
            ' Nothing was saved and the recording has been deleted.', 'error');
          armAgain();
        }
        /* The blob only ever existed in this tab; dropping the reference is
           the last copy going. */
        chunks = [];
      }, { once: true });

      recorder.stop();
    });

    const SECTIONS = [
      ['complaints', 'What they came in with'],
      ['history', 'History mentioned'],
      ['examination', 'Examination described'],
      ['advice', 'Advice given'],
      ['follow_up', 'Follow-up']
    ];

    function showDraft(note) {
      /* An empty section is shown as empty and labelled so, rather than
         hidden. A doctor should SEE that no examination was heard - that is
         information, and hiding it invites her to assume one was captured. */
      el('scribeSections').innerHTML = SECTIONS.map(([key, label]) =>
        '<label class="field"><span>' + esc(label) + '</span>' +
        '<textarea rows="2" data-scribe="' + key + '" placeholder="Nothing was said about this">' +
        esc((note[key] || '').trim()) + '</textarea></label>').join('');
      el('scribeDraft').hidden = false;

      /* Who it thought was talking, and how sure it was.

         The transcript has no speaker labels, so the roles are worked out
         from what was said - one person asks the questions and names the
         medicines, the other describes what is wrong. That is more robust
         than a voice print, which fails on the day the doctor has a cold.

         But it can be wrong, so when it is unsure it says so as a WARNING
         and not a footnote: a complaint recorded as advice, or advice
         recorded as a complaint, is a wrong entry in a medical record. */
      const bits = [];
      if (note.language) bits.push('Heard mostly in ' + esc(note.language) + '.');
      if (note.speakers) bits.push(esc(note.speakers));

      const sure = note.speaker_confidence || 'unclear';
      if (sure === 'unclear') {
        bits.push('<b>It could not reliably tell who was speaking.</b> ' +
          'Read the sections carefully before using them.');
      } else if (sure === 'mixed') {
        bits.push('Parts of the conversation were hard to attribute.');
      }
      say(bits.join(' '), sure === 'unclear' ? 'warn' : 'info');
    }

    /* Appends rather than replaces. She may already have typed while the
       patient was talking, and overwriting that would be the worst thing
       this feature could do. */
    function into(id, text) {
      if (!text) return;
      const field = el(id);
      const existing = field.value.trim();
      field.value = existing ? existing + '\n' + text : text;
    }

    el('scribeApply').addEventListener('click', () => {
      const edited = {};
      el('scribeSections').querySelectorAll('[data-scribe]').forEach(t => {
        edited[t.dataset.scribe] = t.value.trim();
      });
      into('complaints', edited.complaints);
      into('advice', [edited.examination, edited.advice, edited.history]
        .filter(Boolean).join('\n'));
      /* A date is a clinical commitment, so it is reported and not set. */
      if (edited.follow_up) {
        say('Follow-up heard as "' + esc(edited.follow_up) +
          '" — set the Next review date yourself.', 'info');
      }
      el('scribeDraft').hidden = true;
      state('Added to the form');
      armAgain();
      paint();
    });

    el('scribeDiscard').addEventListener('click', async () => {
      el('scribeDraft').hidden = true;
      state('Discarded');
      armAgain();
      try { if (noteId) await TCOSApi.discardConsultNote(noteId); } catch (_) {}
      noteId = null;
    });

    window.addEventListener('beforeunload', release);
  })();

  setState('draft');
})();
