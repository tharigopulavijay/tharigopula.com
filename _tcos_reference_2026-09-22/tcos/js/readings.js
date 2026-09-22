/* =========================================================================
   Checking what the model read.

   This screen exists because of one sentence from Vijay: "one value here and
   there is a big 0 for us." Everything below follows from it.

   FOUR RULES THE SCREEN OBEYS:

   1. The document is always beside the numbers. Checking a transcription
      without the original in view is not checking, it is re-typing on trust.

   2. Low-confidence values are marked and counted, so she reads the doubtful
      ones first instead of forty numbers at one speed.

   3. Every value is editable, and confirming sends what is ON SCREEN - not
      what the model said. If she corrects a digit, the corrected digit is
      what gets saved. There is no path that copies the draft across.

   4. An unreadable page offers nothing to confirm. No partial read, no
      "save anyway" - just take the photograph again. A wrong number is
      worse than no number.
   ========================================================================= */

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let pending = [];
  let current = null;
  let openedUrl = null;          /* revoked when we move off a document */

  const say = (text, kind = 'error') => {
    $('pageMsg').innerHTML = text
      ? '<div class="notice ' + kind + '">' + esc(text) + '</div>' : '';
    if (text) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const rupees = paise => '₹' + (paise / 100).toFixed(2);

  /* ------------------------------------------------------------- queue --- */

  async function loadQueue() {
    try {
      const [waiting, done] = await Promise.all([
        TCOSApi.listDrafts({ status: 'pending' }),
        TCOSApi.listDrafts({ status: 'confirmed' })
      ]);
      pending = waiting.drafts || [];

      $('queue').innerHTML = pending.length
        ? pending.map(queueRow).join('')
        : '<div class="empty">Nothing waiting. Read a report to start.</div>';

      $('doneList').innerHTML = (done.drafts || []).length
        ? done.drafts.slice(0, 8).map(d =>
            '<div class="queue-item"><div><b>' + esc(d.reportName || 'Report') + '</b>' +
            '<small>Confirmed ' + esc((d.reviewedAt || '').slice(0, 10)) + '</small></div></div>').join('')
        : '<div class="empty">Nothing yet.</div>';

      for (const el of document.querySelectorAll('[data-draft]')) {
        el.addEventListener('click', () => show(el.dataset.draft));
      }
    } catch (error) {
      say(error.message || 'Could not load your readings.');
    }
  }

  const queueRow = d => {
    /* The count of doubtful values is the most useful thing in a list row:
       it tells her which one needs care before she opens it. */
    const flag = !d.legible
      ? '<span class="flag low">unreadable</span>'
      : d.lowConfidenceCount
        ? '<span class="flag low">' + d.lowConfidenceCount + ' to check</span>'
        : '<span class="flag high">clear</span>';
    return '<div class="queue-item' + (current === d.id ? ' active' : '') + '" data-draft="' + esc(d.id) + '">' +
      '<div style="flex:1;min-width:0"><b>' + esc(d.reportName || 'Untitled report') + '</b>' +
      '<small>' + esc(d.labName || 'Unknown lab') + ' · ' + esc(d.reportedOn || 'no date') + '</small></div>' +
      flag + '</div>';
  };

  /* ------------------------------------------------------------ detail --- */

  async function show(id) {
    current = id;
    for (const el of document.querySelectorAll('[data-draft]')) {
      el.classList.toggle('active', el.dataset.draft === id);
    }

    let draft;
    try { draft = (await TCOSApi.draft(id)).draft; }
    catch (error) { return say(error.message || 'Could not open that reading.'); }

    $('detail').innerHTML = draft.legible ? editorFor(draft) : unreadableFor(draft);
    wireDetail(draft);
    loadDocument(draft);
  }

  const unreadableFor = d =>
    '<div class="panel"><header><h2>This page could not be read</h2></header>' +
    '<div class="panel-body">' +
      '<div class="unreadable"><h3>' + esc(d.legibilityProblem || 'The page was not clear enough.') + '</h3>' +
      '<p>No values were taken from it. Photograph the report again in better light, ' +
      'straight on, with the whole page in frame.</p></div>' +
      '<div class="doc-pane" style="margin-top:16px"><div class="doc-frame" id="docFrame">' +
        '<div class="placeholder">Loading the document…</div></div></div>' +
      '<div class="form-actions" style="margin-top:16px">' +
        '<button class="btn btn-ghost" id="rejectBtn">Discard this reading</button></div>' +
    '</div></div>';

  const editorFor = d => {
    const warn = d.lowConfidenceCount
      ? '<div class="warn-strip"><strong>' + d.lowConfidenceCount + ' value' +
        (d.lowConfidenceCount > 1 ? 's are' : ' is') + ' marked uncertain</strong> — ' +
        'shaded below. Check ' + (d.lowConfidenceCount > 1 ? 'those' : 'that one') +
        ' against the document before you confirm.</div>'
      : '';

    /* Filing a report to the wrong chart is the second way this feature can
       hurt somebody, and unlike a misread digit nobody catches it by looking
       harder at the numbers. So the verdict is the loudest thing on screen
       when it is bad, and quiet when it is fine. */
    const nameCheck = nameStrip(d);

    /* Headings the model could see and transcribed nothing for. Showing this
       is what stops the screen looking complete when it is not. */
    const gaps = (d.missedHeadings || []).length
      ? '<div class="warn-strip" style="background:#FDECE8;border-color:#E3B2A6;color:#7A3325">' +
        '<strong>Not everything was transcribed.</strong> These sections are on the page but ' +
        'were not read: ' + esc(d.missedHeadings.join(', ')) + '. Add them by hand below, ' +
        'or photograph that part again.</div>'
      : '';

    return '<div class="panel"><header><h2>Check before saving</h2><div class="spacer"></div>' +
      '<span class="spend-note">' + esc(d.cost.model || '') + ' · ' + rupees(d.cost.paise || 0) + '</span></header>' +
      '<div class="panel-body">' +
        nameCheck + gaps + warn +
        pageFacts(d) +
        '<div class="field-row">' +
          '<label class="field"><span>Report name</span>' +
            '<input id="fName" value="' + esc(d.reportName || '') + '"></label>' +
          '<label class="field"><span>Date on the report</span>' +
            '<input id="fDate" type="date" value="' + esc(d.reportedOn || '') + '"></label>' +
        '</div>' +
        '<label class="field"><span>Lab</span>' +
          '<input id="fLab" value="' + esc(d.labName || '') + '"></label>' +

        sectionsHtml(d) +
        '<button class="btn btn-ghost btn-sm" id="addValue" style="margin-top:10px">+ Add a value it missed</button>' +
        otherHtml(d) +

        '<div class="form-actions" style="margin-top:20px">' +
          '<button class="btn btn-primary" id="confirmBtn">Confirm and save to the record</button>' +
          '<button class="btn btn-ghost" id="rejectBtn">Discard</button>' +
        '</div>' +
        '<p class="muted" style="margin-top:10px;font-size:.83rem">' +
          'Saving records the values exactly as they appear above, including any change you make.</p>' +
      '</div></div>' +

      '<div class="panel" style="margin-top:16px"><header><h2>The document</h2></header>' +
        '<div class="panel-body"><div class="doc-pane"><div class="doc-frame" id="docFrame">' +
          '<div class="placeholder">Loading the document…</div></div>' +
          '<div class="doc-tools"><span class="muted" style="font-size:.82rem">' +
            'Check the shaded values against this page.</span></div>' +
        '</div></div></div>';
  };

  /* The name verdict. Loud when it is wrong, quiet when it is right - a
     banner that always shouts stops being read after the first week. */
  function nameStrip(d) {
    const v = d.nameVerdict || (d.nameCheck && d.nameCheck.verdict) || 'not_checked';
    const note = (d.nameCheck && d.nameCheck.note) || '';
    const onPage = d.nameOnReport ? '<strong>' + esc(d.nameOnReport) + '</strong>' : 'no name';

    if (v === 'different_person') {
      return '<div class="warn-strip" style="background:#FCE4E0;border-color:#D89A8C;color:#7A2718">' +
        '<strong>This report may belong to someone else.</strong> The page is printed with ' +
        onPage + '. ' + esc(note) + ' Check before you save it to this patient.</div>';
    }
    if (v === 'spelling_variant') {
      return '<div class="warn-strip">The page is printed with ' + onPage +
        ' — read as the same person, spelled differently. ' + esc(note) + '</div>';
    }
    if (v === 'no_name_on_page') {
      return '<div class="warn-strip">No patient name is printed on this page, so it could not be ' +
        'checked against the record. Make sure it belongs to this patient.</div>';
    }
    if (v === 'same_person') {
      return '<div class="warn-strip" style="background:#E4F2E9;border-color:#A9CDB8;color:#1F5A3A">' +
        'The name on the page matches this patient.</div>';
    }
    return '';
  }

  /* What the page carried besides its numbers. Dropping these was the
     difference between a reader that looks complete and one that is. */
  function pageFacts(d) {
    const bits = [];
    const p = d.patient || {}, s = d.sample || {}, l = d.lab || {};
    const add = (label, value) => { if (value) bits.push([label, value]); };

    add('Age / sex', [p.age, p.sex].filter(Boolean).join(', '));
    add('Number on the report', p.id_on_report);
    add('Referred by', p.referred_by);
    add('Sample', [s.type, s.collected_at && ('collected ' + s.collected_at)].filter(Boolean).join(' · '));
    add('Accreditation', l.accreditation);
    add('Signed by', l.signed_by);

    if (!bits.length) return '';
    return '<div class="page-facts">' + bits.map(([k, v]) =>
      '<div><span>' + esc(k) + '</span>' + esc(v) + '</div>').join('') + '</div>';
  }

  /* Grouped the way the report groups them. A differential count under a
     blood count is not the same as a loose percentage. */
  function sectionsHtml(d) {
    const sections = (d.sections || []).length
      ? d.sections
      : [{ title: 'Values', rows: d.values || [] }];

    return sections.map(section =>
      '<h3 style="margin:20px 0 6px;font-size:.98rem">' + esc(section.title || 'Values') + '</h3>' +
      '<div class="val-row head"><span>Test</span><span>Result</span><span>Unit</span>' +
        '<span>Reference range</span><span></span></div>' +
      '<div class="section-rows" data-section="' + esc(section.title || '') + '">' +
        (section.rows || []).map(valueRow).join('') +
      '</div>').join('') ;
  }

  /* Everything printed on the page that is not a test result. Shown, not
     saved as values - a lab's interpretation is their words, and a
     handwritten margin note is not a result. */
  function otherHtml(d) {
    if (!(d.unrecognised || []).length) return '';
    return '<h3 style="margin:24px 0 6px;font-size:.98rem">Also printed on this page</h3>' +
      '<p class="muted" style="margin:0 0 10px;font-size:.83rem">Kept for the record. ' +
      'These are not saved as values.</p>' +
      d.unrecognised.map(item =>
        '<div class="other-item"><b>' + esc(item.label) + '</b>' +
        '<div>' + esc(item.text) + '</div></div>').join('');
  }

  const valueRow = v =>
    '<div class="val-row' + (v.confidence === 'low' ? ' low' : '') + '" data-value>' +
      '<input data-field="analyte" value="' + esc(v.analyte || '') + '">' +
      '<input data-field="value" value="' + esc(v.value || '') + '">' +
      '<input data-field="unit" value="' + esc(v.unit || '') + '">' +
      '<input data-field="reference" value="' + esc(v.reference || '') + '">' +
      '<button class="val-drop" data-remove title="Remove this row">×</button>' +
    '</div>';

  /* ----------------------------------------------------------- actions --- */

  function wireDetail(draft) {
    const reject = $('rejectBtn');
    if (reject) reject.addEventListener('click', async () => {
      const reason = prompt('Why are you discarding this? (kept so the reading can be improved)');
      if (reason === null) return;
      try {
        await TCOSApi.rejectDraft(draft.id, reason);
        current = null;
        $('detail').innerHTML = '<div class="panel"><div class="empty">Discarded.</div></div>';
        say('Discarded. The reading is kept so it can be looked at later.', 'success');
        loadQueue();
      } catch (error) { say(error.message || 'Could not discard that.'); }
    });

    const add = $('addValue');
    if (add) add.addEventListener('click', () => {
      /* Into the last section, which is where somebody adding a row the
         model missed is almost always looking. */
      const groups = document.querySelectorAll('.section-rows');
      const target = groups[groups.length - 1];
      if (!target) return;
      target.insertAdjacentHTML('beforeend',
        valueRow({ analyte: '', value: '', unit: '', reference: '', confidence: 'high' }));
      wireRows();
      target.lastElementChild.querySelector('input').focus();
    });

    const confirm = $('confirmBtn');
    if (confirm) confirm.addEventListener('click', () => save(draft, confirm));

    wireRows();
  }

  const wireRows = () => {
    for (const button of document.querySelectorAll('[data-remove]')) {
      button.onclick = () => button.closest('[data-value]').remove();
    }
  };

  /* Reads the DOM, not the draft. This is the line that makes the screen
     honest: what she sees is what gets saved. */
  function collect() {
    return [...document.querySelectorAll('.section-rows [data-value]')].map(row => {
      const field = name => row.querySelector('[data-field="' + name + '"]').value.trim();
      return {
        analyte: field('analyte'), value: field('value'),
        unit: field('unit') || null, reference: field('reference') || null
      };
    }).filter(v => v.analyte && v.value);
  }

  async function save(draft, button) {
    const values = collect();
    if (!values.length) return say('Add at least one value, or discard the reading.');

    const report = {
      patientId: draft.patientId,
      reportName: $('fName').value.trim(),
      reportedOn: $('fDate').value,
      labName: $('fLab').value.trim() || null,
      values
    };
    if (!report.reportName) return say('Give the report a name.');
    if (!report.reportedOn) return say('Set the date printed on the report.');

    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      await TCOSApi.confirmDraft(draft.id, report);
      current = null;
      $('detail').innerHTML = '<div class="panel"><div class="empty">Saved to the patient\'s record.</div></div>';
      say('Saved. ' + values.length + ' value' + (values.length > 1 ? 's are' : ' is') +
          ' now in the record.', 'success');
      loadQueue();
    } catch (error) {
      say(error.message || 'Could not save that.');
      button.disabled = false;
      button.textContent = 'Confirm and save to the record';
    }
  }

  /* ---------------------------------------------------------- document --- */

  async function loadDocument(draft) {
    const frame = $('docFrame');
    if (!frame || !draft.fileId) {
      if (frame) frame.innerHTML = '<div class="placeholder">The original document is not attached.</div>';
      return;
    }
    if (openedUrl) { URL.revokeObjectURL(openedUrl); openedUrl = null; }

    try {
      const opened = await TCOSApi.openFile(draft.fileId);
      openedUrl = opened.url;
      frame.innerHTML = opened.type === 'application/pdf'
        ? '<iframe src="' + opened.url + '" title="The report"></iframe>'
        : '<img src="' + opened.url + '" alt="The report as photographed">';
    } catch (_) {
      frame.innerHTML = '<div class="placeholder">The document could not be opened. ' +
        'Check the values against the paper copy instead.</div>';
    }
  }

  /* ------------------------------------------------------------ upload --- */

  function wireUpload() {
    const dialog = $('uploadDialog');
    const start = $('startReadBtn');

    $('uploadBtn').addEventListener('click', async () => {
      $('preflightResult').innerHTML = '';
      $('fileInput').value = '';
      start.style.display = '';
      start.disabled = false;
      start.textContent = 'Check patient and pages';
      dialog.showModal();
      try {
        const result = await TCOSApi.listPatients();
        const rows = result.patients || [];
        $('uploadPatient').innerHTML = '<option value="">Select a patient</option>' +
          rows.map(p => '<option value="' + esc(p.id) + '">' +
            esc(p.full_name) + (p.local_ref ? ' · ' + esc(p.local_ref) : '') +
            '</option>').join('');
      } catch (error) {
        $('uploadPatient').innerHTML = '<option value="">Could not load patients</option>';
        say(error.message || 'Could not load patients.');
      }
    });

    $('cancelUploadBtn').addEventListener('click', () => dialog.close());

    start.addEventListener('click', async () => {
      const patientId = $('uploadPatient').value;
      const file = $('fileInput').files && $('fileInput').files[0];
      if (!patientId) return modalMessage('Choose the patient first.');
      if (!file) return modalMessage('Choose a report to upload.');

      start.disabled = true;
      start.textContent = 'Uploading…';
      try {
        const uploaded = await TCOSApi.uploadFile(file,
          { kind: 'lab_report', patientId });
        start.textContent = 'Checking patient name…';
        const result = await TCOSApi.preflightReport(uploaded.file.id, patientId);
        showPreflight(result.preflight);
      } catch (error) {
        modalMessage(error.message || 'That document could not be checked.');
        start.disabled = false;
        start.textContent = 'Check patient and pages';
      }
    });
  }

  const modalMessage = text => {
    $('preflightResult').innerHTML = '<div class="warn-strip">' + esc(text) + '</div>';
  };

  function showPreflight(preflight) {
    const clinical = (preflight.clinicalPages || []).length;
    const excluded = (preflight.excludedPages || []).length;
    const plan = '<div class="page-plan">' +
      (preflight.pageCount ? preflight.pageCount + ' pages checked · ' : '') +
      clinical + ' clinical page' + (clinical === 1 ? '' : 's') + ' selected' +
      (excluded ? ' · ' + excluded + ' advertisement, cover or duplicate page' +
        (excluded === 1 ? '' : 's') + ' excluded' : '') + '</div>';

    if (!preflight.legible) {
      $('preflightResult').innerHTML = '<div class="identity-card danger"><b>Use a clearer copy</b>' +
        esc(preflight.legibilityProblem || 'The patient name or pages could not be read safely.') +
        plan + '</div>';
      $('startReadBtn').textContent = 'Upload a different document';
      $('startReadBtn').disabled = true;
      return;
    }

    if (preflight.status === 'approved') {
      $('preflightResult').innerHTML = '<div class="identity-card"><b>Name matched</b>' +
        'The document says ' + esc(preflight.nameOnDocument || preflight.registeredName) + '.' +
        plan + '</div>';
      return extract(preflight);
    }

    const different = preflight.nameVerdict === 'different_person';
    const noName = preflight.nameVerdict === 'no_name_on_document';
    const title = different ? 'This may be the wrong patient' :
      noName ? 'No patient name was found' : 'Please confirm the patient name';
    const comparison = 'TCOS patient: <strong>' + esc(preflight.registeredName) +
      '</strong><br>Document: <strong>' + esc(preflight.nameOnDocument || 'No name visible') +
      '</strong><br><span class="muted">' + esc(preflight.nameReason) + '</span>';
    $('preflightResult').innerHTML = '<div class="identity-card' + (different ? ' danger' : '') + '">' +
      '<b>' + esc(title) + '</b>' + comparison + plan +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:14px;font-size:.86rem">' +
        '<input type="checkbox" id="identityConfirmed" style="margin-top:3px">' +
        '<span>I checked the original document and confirm it belongs to this patient.</span></label>' +
      '<div class="form-actions" style="margin-top:12px">' +
        '<button class="btn btn-primary" id="continueReadBtn" disabled>Confirm and read report</button>' +
        '<button class="btn btn-ghost" id="wrongPatientBtn">Stop — wrong patient</button>' +
      '</div></div>';
    $('startReadBtn').style.display = 'none';

    const checkbox = $('identityConfirmed');
    const proceed = $('continueReadBtn');
    checkbox.addEventListener('change', () => { proceed.disabled = !checkbox.checked; });
    proceed.addEventListener('click', async () => {
      proceed.disabled = true;
      proceed.textContent = 'Recording confirmation…';
      try {
        const result = await TCOSApi.approvePreflight(preflight.id,
          'Clinician checked the original and confirmed this document belongs to the selected patient.');
        await extract(result.preflight);
      } catch (error) {
        modalMessage(error.message || 'Could not record the confirmation.');
      }
    });
    $('wrongPatientBtn').addEventListener('click', async () => {
      try {
        await TCOSApi.rejectPreflight(preflight.id, 'Stopped because the document belongs to another patient.');
      } catch (_) {}
      $('uploadDialog').close();
      say('Stopped before reading any clinical values. Choose the correct patient and document.', 'success');
    });
  }

  async function extract(preflight) {
    const start = $('startReadBtn');
    start.style.display = '';
    start.disabled = true;
    start.textContent = 'Reading clinical pages…';
    try {
      const result = await TCOSApi.readReport(preflight.id);
      $('uploadDialog').close();
      await loadQueue();
      show(result.draft.id);
      say(result.draft.legible
        ? 'Read. Compare every value with the original before saving.'
        : 'The clinical values were not clear enough to transcribe. See below.',
        result.draft.legible ? 'success' : 'error');
    } catch (error) {
      modalMessage(error.message || 'The clinical pages could not be read.');
      start.disabled = false;
      start.textContent = 'Try reading again';
    }
  }

  /* --------------------------------------------------------------- go --- */

  document.addEventListener('DOMContentLoaded', async () => {
    if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }
    try {
      const me = await TCOSApi.me();
      TCOSNav.paint('readings.html', me);
      /* Readings already confirmed stay on the chart. Sending another
         report to be read is what the plan covers. */
      window.TCOSGate.apply(me, {
        feature: 'lab_reports',
        actions: ['#uploadBtn']
      });
    } catch (error) {
      if (error.status === 401) { location.href = 'tcos-login.html'; return; }
      say(error.message || 'Could not load your clinic identity.');
      return;
    }
    wireUpload();
    loadQueue();
  });
})();
