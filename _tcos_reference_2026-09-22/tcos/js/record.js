/* =========================================================================
   The patient's record, as the doctor sees it.

   Two jobs, in this order:

     1. Show what needs attention. Anything out of range surfaces at the top,
        because a doctor should not hunt for the abnormal value across four
        panels of thirty rows.
     2. Show how a number has MOVED. A single HbA1c is a fact; three of them
        is the whole conversation with the patient. That is what "health
        patterns" actually means at this scale - not a chart library, a
        column showing the last three readings and the direction of travel.

   Entering a report is built around panels for one reason: a doctor will not
   type twenty-five analyte names and reference ranges off a printout. Pick a
   panel, type five numbers.
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
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
      .format(new Date(y, m - 1, d));
  };

  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }

  const patientId = new URLSearchParams(location.search).get('patient');
  if (!patientId) { location.replace('patients.html'); return; }

  let me, record, series = [];
  try {
    me = await TCOSApi.me();
    record = await TCOSApi.getPatient(patientId);
  } catch (error) {
    if (error.status === 401) { location.replace('tcos-login.html'); return; }
    msg('pageMsg', esc(error.message), 'error');
    return;
  }

  const patient = record.patient;
  TCOSRail.paint(me);
  el('patientName').textContent = patient.full_name;
  el('patientInitial').textContent = (patient.full_name || '?').charAt(0).toUpperCase();
  /* Her number first: it is what the chart is filed under. */
  el('patientMeta').textContent = [patient.local_ref, patient.mobile, patient.sex,
    patient.date_of_birth, patient.blood_group].filter(Boolean).join(' · ');

  /* Counts of what is already loaded - no extra call, no new idea. */
  const counts = [
    ['Visits', (record.visits || []).length],
    ['Prescriptions', (record.prescriptions || []).length],
    ['Reports', (record.labReports || []).length]
  ];
  el('patientCounts').innerHTML = counts.map(([label, n]) =>
    '<div><b>' + n + '</b><span>' + label + '</span></div>').join('');
  el('consultLink').href = 'consult.html?patient=' + encodeURIComponent(patientId);

  /* ---------------- ABHA ----------------
     Three states, and the third matters as much as the other two: a patient
     who has said "I don't have one" must be recordable, or the front desk
     is asked the same question at every single visit and stops asking. */

  const abhaGroup = n => String(n || '').length === 14
    ? n.slice(0, 2) + '-' + n.slice(2, 6) + '-' + n.slice(6, 10) + '-' + n.slice(10)
    : (n || '');

  function paintAbha() {
    const none = patient.abha_status === 'not_available';
    const has = patient.abha_number || patient.abha_address;

    el('abhaView').innerHTML = none
      ? '<p class="muted">Recorded as not having an ABHA.</p>'
      : has
        ? '<dl class="pairs">' +
            (patient.abha_number
              ? '<div><dt>Number</dt><dd>' + esc(abhaGroup(patient.abha_number)) + '</dd></div>' : '') +
            (patient.abha_address
              ? '<div><dt>Address</dt><dd>' + esc(patient.abha_address) + '</dd></div>' : '') +
            '<div><dt>Status</dt><dd>Not yet checked against ABDM</dd></div>' +
          '</dl>'
        : '<div class="empty">No ABHA recorded. Ask at the next visit — it takes a minute ' +
          'now and saves re-entering it for every patient later.</div>';

    el('abhaNumber').value = patient.abha_number ? abhaGroup(patient.abha_number) : '';
    el('abhaAddress').value = patient.abha_address || '';
    el('abhaNone').checked = none;
    el('abhaNumber').disabled = none;
    el('abhaAddress').disabled = none;
  }

  function showAbhaForm(open) {
    el('abhaForm').hidden = !open;
    el('abhaView').hidden = open;
    el('abhaEdit').textContent = open ? 'Close' : 'Edit';
    if (!open) msg('abhaMsg', '', '');
  }

  /* Ticking "no ABHA" while leaving a number in the box is a contradiction
     the server refuses. Clearing them here means the doctor never meets
     that error at all. */
  el('abhaNone').addEventListener('change', () => {
    const none = el('abhaNone').checked;
    if (none) { el('abhaNumber').value = ''; el('abhaAddress').value = ''; }
    el('abhaNumber').disabled = none;
    el('abhaAddress').disabled = none;
  });

  el('abhaEdit').addEventListener('click', () => showAbhaForm(el('abhaForm').hidden));
  el('abhaCancel').addEventListener('click', () => { paintAbha(); showAbhaForm(false); });

  el('abhaForm').addEventListener('submit', async event => {
    event.preventDefault();
    const none = el('abhaNone').checked;
    el('abhaSave').disabled = true;
    try {
      const saved = await TCOSApi.setAbha(patientId, {
        status: none ? 'not_available' : 'unverified',
        number: none ? null : el('abhaNumber').value.trim() || null,
        address: none ? null : el('abhaAddress').value.trim() || null
      });
      patient.abha_number = saved.patient.abha_number;
      patient.abha_address = saved.patient.abha_address;
      patient.abha_status = saved.patient.abha_status;
      paintAbha();
      showAbhaForm(false);
    } catch (error) {
      msg('abhaMsg', esc(error.message), 'error');
    } finally {
      el('abhaSave').disabled = false;
    }
  });

  paintAbha();

  /* ---------------- WhatsApp consent ----------------
     Asked once, at the desk, with the patient there. A patient who has
     replied STOP to WhatsApp cannot be re-enabled from here at all - that
     was her decision about every clinic, not this one's to reverse. */

  function paintConsent() {
    const stopped = !!patient.whatsapp_opted_out_at;
    el('waOptIn').checked = !stopped && !!patient.whatsapp_opt_in;
    el('waOptIn').disabled = stopped;
    el('waConsentNote').textContent = stopped
      ? 'This patient replied STOP on WhatsApp. Only they can undo that, from their own phone.'
      : (patient.whatsapp_opt_in
        ? 'Agreed. Reminders go out the evening before an appointment.'
        : 'Ask before ticking this. WhatsApp requires the patient’s agreement.');
  }

  el('waOptIn').addEventListener('change', async () => {
    const agreed = el('waOptIn').checked;
    el('waOptIn').disabled = true;
    try {
      const saved = await TCOSApi.setWhatsappConsent(patientId, agreed);
      patient.whatsapp_opt_in = saved.patient.whatsapp_opt_in;
      patient.whatsapp_opted_out_at = saved.patient.whatsapp_opted_out_at;
    } catch (error) {
      msg('abhaMsg', esc(error.message), 'error');
    } finally {
      el('waOptIn').disabled = false;
      paintConsent();
    }
  });

  paintConsent();

  /* ---------------- investigations: value plus movement ---------------- */

  async function loadSeries() {
    try { series = (await TCOSApi.labSeries(patientId)).series || []; }
    catch (error) { msg('pageMsg', esc(error.message), 'error'); return; }

    if (!series.length) {
      el('trends').innerHTML =
        '<div class="empty">No investigations recorded. Add a lab report to start ' +
        'building this patient’s history.</div>';
      el('attention').innerHTML = '';
      el('seriesNote').textContent = '';
      el('reportCards').innerHTML = '<div class="empty">No reports are attached to this patient yet.</div>';
      return;
    }

    /* Group readings by analyte, keeping them in date order. */
    const byAnalyte = new Map();
    series.forEach(row => {
      if (!byAnalyte.has(row.analyte)) byAnalyte.set(row.analyte, []);
      byAnalyte.get(row.analyte).push(row);
    });

    const dates = [...new Set(series.map(r => r.reported_on))].sort();
    const recent = dates.slice(-3);
    el('seriesNote').textContent = byAnalyte.size + ' measured · ' +
      dates.length + ' report' + (dates.length === 1 ? '' : 's');

    const rows = [...byAnalyte.entries()].map(([analyte, readings]) => {
      const latest = readings[readings.length - 1];
      const previous = readings.length > 1 ? readings[readings.length - 2] : null;
      const move = previous ? LabPanels.movement(previous.value, latest.value) : null;
      const cells = recent.map(date => {
        const hit = readings.find(r => r.reported_on === date);
        if (!hit) return '<td class="reading empty-cell">—</td>';
        const abnormal = hit.flag && hit.flag !== 'normal';
        return '<td class="reading' + (abnormal ? ' ' + esc(hit.flag) : '') + '">' +
          esc(hit.value) + '</td>';
      }).join('');

      return { analyte, latest, move, html:
        '<tr' + (latest.flag && latest.flag !== 'normal' ? ' class="row-flagged"' : '') + '>' +
          '<td class="analyte">' + esc(analyte) +
            (latest.unit ? '<small>' + esc(latest.unit) + '</small>' : '') + '</td>' +
          cells +
          '<td class="ref">' + esc(latest.reference || '—') + '</td>' +
          '<td class="move">' + (move
            ? '<span class="' + move.direction + '">' +
              (move.direction === 'up' ? '▲' : '▼') + ' ' + move.by + '</span>'
            : '<span class="flat">—</span>') + '</td>' +
        '</tr>' };
    });

    /* Abnormal first, then alphabetical - the doctor's eye starts at the top. */
    rows.sort((a, b) => {
      const aBad = a.latest.flag && a.latest.flag !== 'normal' ? 0 : 1;
      const bBad = b.latest.flag && b.latest.flag !== 'normal' ? 0 : 1;
      return aBad - bBad || a.analyte.localeCompare(b.analyte);
    });

    el('trends').innerHTML =
      '<table class="grid trend-table"><thead><tr><th>Investigation</th>' +
      recent.map(d => '<th class="reading">' + esc(prettyDate(d)) + '</th>').join('') +
      '<th class="ref">Reference</th><th class="move">Change</th></tr></thead><tbody>' +
      rows.map(r => r.html).join('') + '</tbody></table>' +
      (dates.length > 3
        ? '<p class="older">Showing the last three of ' + dates.length + ' reports.</p>' : '');

    const reportGroups = new Map();
    series.forEach(value => {
      const key = value.reported_on + '|' + value.report_name;
      if (!reportGroups.has(key)) reportGroups.set(key, { on:value.reported_on, name:value.report_name, status:value.status, values:[] });
      reportGroups.get(key).values.push(value);
    });
    el('reportCards').innerHTML = '<div class="report-card-list">' + [...reportGroups.values()].sort((a,b)=>b.on.localeCompare(a.on)).map(report => {
      const sourceReport = (record.labReports || []).find(r => r.report_name === report.name && r.reported_on === report.on);
      const origin = sourceReport && sourceReport.source === 'patient_upload' ? 'Outside report supplied by patient' : 'Test performed by this clinic';
      return '<article class="report-summary-card"><header><div><b>' + esc(report.name) + '</b><span>' + esc(prettyDate(report.on)) + '</span></div><em>' + esc(origin) + '</em></header>' +
        '<div class="report-value-grid">' + report.values.map(value => '<div class="' + (value.flag && value.flag !== 'normal' ? 'flagged' : '') + '"><span>' + esc(value.analyte) + '</span><b>' + esc(value.value) + ' <small>' + esc(value.unit || '') + '</small></b><small>' + esc(value.reference || '') + '</small></div>').join('') + '</div></article>';
    }).join('') + '</div>';

    /* The attention strip. */
    const abnormal = rows.filter(r => r.latest.flag && r.latest.flag !== 'normal');
    el('attention').innerHTML = abnormal.length
      ? '<div class="attention"><h3>' + abnormal.length + ' value' +
        (abnormal.length === 1 ? '' : 's') + ' outside the reference range</h3>' +
        '<div class="chips">' + abnormal.map(r =>
          '<span class="chip ' + esc(r.latest.flag) + '">' + esc(r.analyte) +
          ' <b>' + esc(r.latest.value) + '</b>' +
          (r.move ? ' <em>' + (r.move.direction === 'up' ? '▲' : '▼') + ' ' + r.move.by + '</em>' : '') +
          '</span>').join('') + '</div></div>'
      : '<div class="attention calm"><h3>Every recorded value is within range</h3></div>';
  }

  document.querySelectorAll('#investigationSwitch button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('#investigationSwitch button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    el('trendView').hidden = button.dataset.investigation !== 'trend';
    el('reportsView').hidden = button.dataset.investigation !== 'reports';
  }));

  /* ---------------- visits and prescriptions ---------------- */

  function loadHistory() {
    const visits = record.visits || [];
    const latestVisit = visits[0];
    const issued = (record.prescriptions || []).filter(r => r.status === 'issued' && !r.superseded_by);
    const latestRx = issued[0];
    const medicineTable = rx => (rx && rx.items && rx.items.length)
      ? '<div class="medicine-list">' + rx.items.map((item, index) =>
          '<div class="medicine-line"><span class="medicine-no">' + (index + 1) + '</span><div><b>' +
          esc(item.medicine_name) + '</b><span>' + esc([item.dose, item.frequency, item.duration].filter(Boolean).join(' · ')) +
          '</span>' + (item.instructions ? '<small>' + esc(item.instructions) + '</small>' : '') + '</div></div>').join('') + '</div>'
      : '<div class="empty">No medicine lines recorded.</div>';
    el('currentTreatment').innerHTML = latestRx
      ? '<div class="rx-summary"><div><b>' + esc(latestRx.rx_number || 'Prescription') + '</b><span>Issued ' +
        esc(prettyDate(latestRx.issued_on)) + ' · ' + (latestRx.items || []).length + ' medicines</span></div></div>' + medicineTable(latestRx)
      : '<div class="empty">No current prescription.</div>';
    el('carePlan').innerHTML = latestVisit
      ? '<div class="care-plan"><div><span>Working diagnosis</span><b>' + esc(latestVisit.diagnosis || '—') + '</b></div>' +
        '<div><span>Advice</span><b>' + esc(latestVisit.advice || '—') + '</b></div>' +
        '<div><span>Next review</span><b>' + esc(latestVisit.follow_up_on ? prettyDate(latestVisit.follow_up_on) : 'As needed') + '</b></div></div>'
      : '<div class="empty">No care plan recorded yet.</div>';
    el('visits').innerHTML = visits.length
      ? '<div class="timeline">' + visits.map(v =>
          '<div class="event">' +
            '<time>' + esc(prettyDate(v.visited_on)) + '</time>' +
            '<div><b>' + esc(v.diagnosis || v.complaints || 'Consultation') + '</b>' +
            (v.advice ? '<span>' + esc(v.advice) + '</span>' : '') +
            (v.follow_up_on ? '<span class="follow">Review ' +
              esc(prettyDate(v.follow_up_on)) + '</span>' : '') + '</div>' +
          '</div>').join('') + '</div>'
      : '<div class="empty">No visits recorded yet.</div>';

    const rx = (record.prescriptions || []).filter(r => r.status === 'issued');
    el('prescriptions').innerHTML = rx.length
      ? '<div class="rx-history">' + rx.map(r => '<details class="rx-history-card"><summary><span><b>' +
          esc(r.rx_number || 'Prescription') + '</b><small>' + esc(prettyDate(r.issued_on)) + ' · ' +
          (r.items || []).length + ' medicines</small></span><span>' + (r.superseded_by ? 'Replaced' : 'View medicines') + '</span></summary>' +
          medicineTable(r) + '</details>').join('') + '</div>'
      : '<div class="empty">No issued prescriptions yet.</div>';
  }

  /* ---------------- recording a report ---------------- */

  function valueRow(analyte) {
    const row = document.createElement('div');
    row.className = 'value-row';
    row.innerHTML =
      '<input class="v-name" placeholder="Analyte" value="' + esc(analyte ? analyte.name : '') + '">' +
      '<input class="v-val" placeholder="Value">' +
      '<input class="v-unit" placeholder="Unit" value="' + esc(analyte ? analyte.unit || '' : '') + '">' +
      '<input class="v-ref" placeholder="Reference" value="' + esc(analyte ? analyte.reference || '' : '') + '">' +
      '<button type="button" class="v-del" title="Remove">×</button>';
    if (analyte) row._analyte = analyte;
    el('rValues').appendChild(row);
    row.querySelector('.v-del').addEventListener('click', () => row.remove());

    /* Flag as the number is typed, so the doctor sees it immediately. */
    row.querySelector('.v-val').addEventListener('input', event => {
      const flag = analyte ? LabPanels.flagFor(analyte, event.target.value) : 'normal';
      row.classList.remove('is-high', 'is-low');
      if (event.target.value.trim() && flag !== 'normal') row.classList.add('is-' + flag);
    });
    return row;
  }

  function fillPanel(key) {
    el('rValues').innerHTML = '';
    const panel = LabPanels.PANELS[key];
    if (!panel) return;
    if (panel.analytes.length) panel.analytes.forEach(a => valueRow(a));
    else { valueRow(); valueRow(); valueRow(); }
    if (key !== 'blank') el('rName').value = panel.label;
  }

  el('rPanel').innerHTML = LabPanels.list()
    .map(([key, panel]) => '<option value="' + esc(key) + '">' + esc(panel.label) + '</option>').join('');
  el('rPanel').addEventListener('change', event => fillPanel(event.target.value));
  el('addValue').addEventListener('click', () => valueRow());

  el('addReportBtn').addEventListener('click', () => {
    msg('reportMsg', '');
    el('reportForm').reset();
    el('rDate').value = new Date().toISOString().slice(0, 10);
    el('rPanel').value = 'glycaemic';
    fillPanel('glycaemic');
    el('reportForm').dataset.attemptKey = crypto.randomUUID();
    el('reportDialog').showModal();
  });
  el('reportCancel').addEventListener('click', () => el('reportDialog').close());
  el('reportClose').addEventListener('click', () => el('reportDialog').close());

  el('reportForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = el('reportSave');
    button.disabled = true;
    try {
      const values = Array.from(document.querySelectorAll('.value-row')).map(row => {
        const analyte = row.querySelector('.v-name').value.trim();
        const value = row.querySelector('.v-val').value.trim();
        if (!analyte || !value) return null;
        return {
          analyte, value,
          unit: row.querySelector('.v-unit').value.trim() || null,
          reference: row.querySelector('.v-ref').value.trim() || null,
          flag: row._analyte ? LabPanels.flagFor(row._analyte, value) : 'normal'
        };
      }).filter(Boolean);

      if (!values.length) throw new TCOSApi.ApiClientError('empty', 'Fill in at least one value.');

      const saved = await TCOSApi.addLabReport({
        patientId,
        reportName: el('rName').value.trim(),
        reportedOn: el('rDate').value,
        source: el('rSource').value,
        idempotencyKey: el('reportForm').dataset.attemptKey,
        values
      });

      /* The scan, attached to the report it belongs to. After the values
         are saved, so a rejected file does not lose the typing - the
         numbers are the part that took effort. */
      const scan = el('rFile').files[0];
      if (scan) {
        el('rFileHelp').textContent = 'Sending the report…';
        try {
          await TCOSApi.uploadFile(scan,
            { kind: 'lab_report', patientId, labReportId: saved.report.id },
            percent => { el('rFileHelp').textContent = 'Sending the report… ' + percent + '%'; });
        } catch (error) {
          /* The values are already saved and correct. Say what happened
             rather than implying the whole report failed. */
          msg('pageMsg', 'Values saved, but the file did not upload: ' +
            esc(error.message) + ' You can attach it from the chart.', 'error');
        }
        el('rFile').value = '';
        el('rFileHelp').textContent = 'Optional. A PDF or a photo of the page, up to 15 MB.';
      }

      el('reportDialog').close();
      record = await TCOSApi.getPatient(patientId);
      await loadSeries();
      msg('pageMsg', 'Report saved with ' + values.length + ' value' +
        (values.length === 1 ? '' : 's') + '.', 'ok');
    } catch (error) {
      msg('reportMsg', esc(error.message), 'error');
    } finally {
      button.disabled = false;
    }
  });

  el('signOutBtn').addEventListener('click', async () => {
    await TCOSApi.signOut(); location.href = 'tcos-login.html';
  });

  /* ---- documents on this patient ------------------------------------- */
  const KB = bytes => bytes >= 1048576
    ? (bytes / 1048576).toFixed(1) + ' MB'
    : Math.max(1, Math.round(bytes / 1024)) + ' KB';

  async function loadDocuments() {
    let list = [];
    try { list = (await TCOSApi.listFiles({ patientId })).files || []; }
    catch (error) { el('documents').innerHTML = '<div class="empty">' + esc(error.message) + '</div>'; return; }

    el('documents').innerHTML = list.length
      ? '<div class="doc-list">' + list.map(f =>
          '<div class="doc-item"><div class="doc-what">' +
            '<b>' + esc(f.original_name || 'Document') + '</b>' +
            '<small>' + esc(String(f.kind).replace('_', ' ')) + ' · ' + esc(KB(f.bytes)) +
              ' · ' + esc(prettyDate(f.created_at) || '') + '</small></div>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-open="' + esc(f.id) + '">Open</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-drop="' + esc(f.id) + '">Remove</button>' +
          '</div>').join('') + '</div>'
      : '<div class="empty">Nothing attached yet. Scans and letters for this patient live here.</div>';

    el('documents').querySelectorAll('[data-open]').forEach(button =>
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const opened = await TCOSApi.openFile(button.dataset.open);
          window.open(opened.url, '_blank', 'noopener');
          /* Released after the new tab has it. A clinic day of opened scans
             held in memory is how a tab ends up using a gigabyte. */
          setTimeout(() => URL.revokeObjectURL(opened.url), 60000);
        } catch (error) { msg('docMsg', esc(error.message), 'error'); }
        finally { button.disabled = false; }
      }));

    el('documents').querySelectorAll('[data-drop]').forEach(button =>
      button.addEventListener('click', async () => {
        /* A reason is required by the server, and it belongs in the record:
           a document that can vanish silently from a chart is the thing
           rule 3 exists to prevent. */
        const reason = prompt('Why is this document being removed?\n\nIt stays on the record.');
        if (reason === null) return;
        try { await TCOSApi.removeFile(button.dataset.drop, reason); await loadDocuments(); }
        catch (error) { msg('docMsg', esc(error.message), 'error'); }
      }));
  }

  el('docFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    msg('docMsg', 'Sending ' + esc(file.name) + '…', 'ok');
    try {
      await TCOSApi.uploadFile(file, { kind: 'attachment', patientId },
        percent => msg('docMsg', 'Sending ' + esc(file.name) + '… ' + percent + '%', 'ok'));
      msg('docMsg', '');
      await loadDocuments();
    } catch (error) { msg('docMsg', esc(error.message), 'error'); }
    finally { event.target.value = ''; }
  });

  loadHistory();
  loadDocuments();
  await loadSeries();
})();
