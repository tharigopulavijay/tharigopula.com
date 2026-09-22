/* =========================================================================
   The patient's view of their own record.

   Read on a phone, usually standing up, usually by someone who is not
   interested in software. So:

     - the medicines come first, because "what am I supposed to take" is the
       only question most patients open this to answer
     - no login, no menu, no tabs
     - large type, generous spacing, works at arm's length
     - nothing here can change anything. There is no write path.
   ========================================================================= */
(async () => {
  /* The API this page reads from.
   *
   * This pointed at tcos-demo-api until 8 Sep 2026, which meant every
   * patient link a real clinic sent was checked against the DEMO database.
   * The token was genuine, minted by production - it simply did not exist
   * in the database being asked, so the patient was told their link was
   * invalid. Nothing errored, nothing was logged, and the clinic had no way
   * to tell. It was the one screen nobody signs in to, so it was the one
   * screen never opened while testing.
   *
   * Exactly the same defect was found and fixed in js/tcos-api.js during
   * the fork - see the note there - and this file was missed. So the
   * resolution now matches that file rather than being written out again,
   * and test/patient-portal.test.js fails if any browser module points at
   * the demo worker. */
  const STAGING_APP_HOST = 'staging.tcos.tharigopula.com';
  const ON_OLD_STAGING = location.hostname === 'tcos-staging.pages.dev' ||
    location.hostname.endsWith('.tcos-staging.pages.dev');
  if (ON_OLD_STAGING) {
    location.replace('https://' + STAGING_APP_HOST +
      location.pathname + location.search + location.hash);
    return;
  }
  const API = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://127.0.0.1:8787'
    : location.hostname === STAGING_APP_HOST
      ? 'https://' + STAGING_APP_HOST
      : 'https://tcos-api.hello-tharigopula.workers.dev';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wrap = document.getElementById('wrap');

  const token = new URLSearchParams(location.search).get('t') ||
    location.hash.replace(/^#/, '');

  const fail = (title, detail) => {
    wrap.innerHTML =
      '<div class="card message">' +
        '<h1>' + esc(title) + '</h1>' +
        '<p>' + esc(detail) + '</p>' +
      '</div>';
  };

  if (!token) {
    fail('This link is incomplete', 'Open the full link your doctor sent you.');
    return;
  }

  let data;
  try {
    const response = await fetch(API + '/p/' + encodeURIComponent(token));
    data = await response.json();
    if (!response.ok) {
      fail('This link is no longer valid',
        data.message || 'Ask your doctor to send you a new one.');
      return;
    }
  } catch (_) {
    fail('Could not open your record', 'Check your internet connection and try again.');
    return;
  }

  const prettyDate = value => {
    if (!value) return '';
    const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
    if (!y) return value;
    return new Intl.DateTimeFormat('en-IN',
      { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
  };

  const systemLabel = {
    allopathy: 'English medicine', ayurveda: 'Ayurvedic',
    homeopathy: 'Homeopathic', supplement: 'Supplement'
  };

  const latest = data.prescriptions[0];

  /* ---- what to take: the reason this page exists ---- */
  const medicinesBlock = latest && latest.items.length
    ? '<div class="card">' +
        '<div class="card-head">' +
          '<h2>Your medicines</h2>' +
          '<span class="when">Prescribed ' + esc(prettyDate(latest.issued_on)) + '</span>' +
        '</div>' +
        latest.items.map(item =>
          '<div class="med">' +
            '<div class="med-top">' +
              '<b>' + esc(item.medicine_name) + '</b>' +
              '<span class="sys sys-' + esc(item.system) + '">' +
                esc(systemLabel[item.system] || item.system) + '</span>' +
            '</div>' +
            '<div class="med-detail">' +
              [item.dose, item.frequency, item.duration].filter(Boolean).map(esc).join(' · ') +
            '</div>' +
            (item.instructions ? '<div class="med-note">' + esc(item.instructions) + '</div>' : '') +
          '</div>').join('') +
        (latest.rx_number
          ? '<p class="rx-no">Prescription ' + esc(latest.rx_number) + '</p>' : '') +
      '</div>'
    : '<div class="card message"><h2>No prescription yet</h2>' +
      '<p>Your doctor has not issued one in TCOS yet.</p></div>';

  /* ---- next visit ---- */
  const followUpBlock = data.nextFollowUp
    ? '<div class="card next-visit">' +
        '<span class="label">Next visit</span>' +
        '<b>' + esc(prettyDate(data.nextFollowUp)) + '</b>' +
      '</div>'
    : '';

  /* ---- advice from the most recent visit ---- */
  const lastVisit = data.visits[0];
  const adviceBlock = lastVisit && (lastVisit.advice || lastVisit.diagnosis)
    ? '<div class="card">' +
        '<h2>What your doctor said</h2>' +
        (lastVisit.diagnosis
          ? '<p class="advice-label">Condition</p><p class="advice">' +
            esc(lastVisit.diagnosis) + '</p>' : '') +
        (lastVisit.advice
          ? '<p class="advice-label">Advice</p><p class="advice">' +
            esc(lastVisit.advice) + '</p>' : '') +
      '</div>'
    : '';

  /* ---- lab reports, only verified ones ---- */
  const labBlock = data.labReports.length
    ? '<div class="card">' +
        '<h2>Your test results</h2>' +
        data.labReports.slice(0, 4).map(report =>
          '<div class="report">' +
            '<div class="report-head"><b>' + esc(report.name) + '</b>' +
              '<span>' + esc(prettyDate(report.reportedOn)) + '</span></div>' +
            (report.values.length
              ? '<table><tbody>' + report.values.map(v =>
                  '<tr class="' + (v.flag && v.flag !== 'normal' ? 'flagged' : '') + '">' +
                    '<td>' + esc(v.analyte) + '</td>' +
                    '<td class="value">' + esc(v.value) + ' ' + esc(v.unit || '') + '</td>' +
                    '<td class="ref">' + esc(v.reference || '') + '</td>' +
                  '</tr>').join('') + '</tbody></table>'
              : '') +
          '</div>').join('') +
      '</div>'
    : '';

  /* One row per investigation, one column per date. Patients can immediately
     see whether HbA1c, glucose or cholesterol is improving over time. */
  const trendDates = [...new Set(data.labReports.map(r => r.reportedOn))].sort().slice(-4);
  const trendMap = new Map();
  data.labReports.forEach(report => report.values.forEach(value => {
    if (!trendMap.has(value.analyte)) trendMap.set(value.analyte, []);
    trendMap.get(value.analyte).push({ ...value, on: report.reportedOn });
  }));
  const repeatedTrends = [...trendMap.entries()].filter(([, readings]) => readings.length > 1);
  const labTrendBlock = repeatedTrends.length
    ? '<div class="card trend-card"><div class="card-head"><h2>Your results over time</h2>' +
        '<span class="when">Latest ' + trendDates.length + ' test dates</span></div>' +
        '<p class="trend-help">Read across each row to see how a result has changed.</p>' +
        '<div class="trend-scroll"><table class="patient-trends"><thead><tr><th>Test</th>' +
          trendDates.map(date => '<th>' + esc(prettyDate(date).replace(/\s\d{4}$/, '')) + '</th>').join('') +
          '<th>Change</th></tr></thead><tbody>' + repeatedTrends.map(([name, readings]) => {
            readings.sort((a,b) => a.on.localeCompare(b.on));
            const latestReading = readings[readings.length - 1];
            const previous = readings[readings.length - 2];
            const delta = Number(latestReading.value) - Number(previous.value);
            const movement = Number.isFinite(delta) && delta !== 0
              ? (delta > 0 ? '↑ ' : '↓ ') + Math.abs(delta).toFixed(1).replace(/\.0$/, '')
              : 'Stable';
            return '<tr><th>' + esc(name) + '<small>' + esc(latestReading.reference || '') + '</small></th>' +
              trendDates.map(date => { const hit = readings.find(r => r.on === date); return '<td class="' +
                (hit && hit.flag && hit.flag !== 'normal' ? 'flagged' : '') + '">' +
                (hit ? esc(hit.value) + '<small>' + esc(hit.unit || '') + '</small>' : '—') + '</td>'; }).join('') +
              '<td class="movement">' + esc(movement) + '</td></tr>';
          }).join('') + '</tbody></table></div></div>'
    : '';

  /* ---- everything, newest first ----
     A patient does not think in a table of visits and a table of reports.
     They think: what happened, when, and who did I see. Dental in March,
     sinus in June, cardiology now - one stream, in order. */
  const kindLabel = { visit: 'Consultation', prescription: 'Prescription', report: 'Test report' };

  const entryBody = entry => {
    if (entry.kind === 'prescription' && entry.items && entry.items.length) {
      return '<ul class="mini-meds">' + entry.items.map(item =>
        '<li><b>' + esc(item.medicine_name) + '</b>' +
        (item.dose || item.frequency
          ? '<span>' + esc([item.dose, item.frequency, item.duration].filter(Boolean).join(' · ')) + '</span>'
          : '') + '</li>').join('') + '</ul>';
    }
    if (entry.kind === 'report' && entry.values && entry.values.length) {
      return '<ul class="mini-vals">' + entry.values.slice(0, 6).map(v =>
        '<li class="' + (v.flag && v.flag !== 'normal' ? 'flagged' : '') + '">' +
        esc(v.analyte) + ' <b>' + esc(v.value) + ' ' + esc(v.unit || '') + '</b>' +
        (v.reference ? '<span>(' + esc(v.reference) + ')</span>' : '') + '</li>').join('') +
        (entry.values.length > 6
          ? '<li class="more">and ' + (entry.values.length - 6) + ' more</li>' : '') + '</ul>';
    }
    return entry.detail ? '<p class="detail">' + esc(entry.detail) + '</p>' : '';
  };

  const timelineBlockHtml = (data.timeline || []).length
    ? '<div class="card timeline-card">' +
        '<div class="card-head"><h2>Your health record</h2>' +
        '<span class="when">' + (data.clinics || []).length + ' clinic' +
        ((data.clinics || []).length === 1 ? '' : 's') + '</span></div>' +
        '<div class="stream">' + data.timeline.map(entry =>
          '<div class="moment ' + esc(entry.kind) + '">' +
            '<div class="moment-when">' + esc(prettyDate(entry.on)) + '</div>' +
            '<div class="moment-body">' +
              '<span class="kind">' + esc(kindLabel[entry.kind] || entry.kind) +
              (entry.kind === 'report' && entry.flagged
                ? ' · <em>' + entry.flagged + ' outside range</em>' : '') + '</span>' +
              '<b>' + esc(entry.title) + '</b>' +
              entryBody(entry) +
              '<span class="where">' + esc(entry.clinic) +
              (entry.doctor ? ' · ' + esc(entry.doctor) : '') + '</span>' +
            '</div>' +
          '</div>').join('') + '</div>' +
      '</div>'
    : '';

  const clinicsBlock = (data.clinics || []).length > 1
    ? '<div class="card"><h2>Doctors you have seen</h2>' +
        '<ul class="clinic-list">' + data.clinics.map(c =>
          '<li><b>' + esc(c.clinic_name) + '</b><span>' + esc(c.doctor_name) +
          (c.qualification ? ' · ' + esc(c.qualification) : '') + '</span></li>').join('') +
        '</ul></div>'
    : '';

  const clinic = data.clinic;

  /* THE DOCUMENT, not a second design of it.
   *
   * This page used to render its own card layout of the same facts the
   * doctor had composed - two designs of one object, already drifting
   * apart. Vijay: "what's the use of creating prescription on the doctor
   * side, it should be the same reflection from there."
   *
   * So the prescription is now drawn by js/rx-document.js, the renderer
   * the doctor's screen uses, with audience 'patient' - which draws the
   * pages marked for both and leaves out the ones that are clinical
   * reference only. Everything below the sheet (trends, history, the call
   * button) is the patient's own extra, not part of the prescription. */
  const sheet = window.RxDocument ? window.RxDocument.render({
    clinic: {
      name: clinic.name, doctor: clinic.doctor, qualification: clinic.qualification,
      /* The council registration number belongs on a prescription - it is
         what makes it a clinical document rather than a note. The payload
         has carried it all along; this simply was not passing it on. */
      registrationNo: clinic.registrationNo || '',
      tagline: clinic.tagline || '', address: clinic.address, phone: clinic.phone,
      /* Letterhead is a printing choice for the doctor's own paper. The
         patient is reading a screen, so she always gets the full header. */
      letterhead: false
    },
    patient: {
      name: data.patient.name, sex: data.patient.sex,
      bloodGroup: data.patient.bloodGroup, ref: data.patient.ref || null,
      age: data.patient.age == null ? null : data.patient.age,
      /* Undefined when we do not know, which is what makes the sheet print
         "Not recorded" in amber rather than a blank that reads as "none". */
      allergy: data.patient.allergies || null
    },
    issuedOn: latest ? latest.issued_on : null,
    rxNumber: latest ? latest.rx_number : null,
    items: latest ? latest.items.map(item => ({
      name: item.medicine_name, system: item.system, dose: item.dose,
      frequency: item.frequency, duration: item.duration,
      instructions: item.instructions
    })) : [],
    diagnosis: lastVisit ? lastVisit.diagnosis : null,
    advice: lastVisit ? lastVisit.advice : null,
    followUp: data.nextFollowUp || null
  }, { audience: 'patient' }) : medicinesBlock;

  wrap.innerHTML =
    sheet +
    labTrendBlock +
    labBlock +
    clinicsBlock +
    timelineBlockHtml +

    (clinic.phone
      ? '<a class="call" href="tel:' + esc(clinic.phone) + '">Call the clinic</a>' : '') +

    '<footer>' +
      (clinic.address ? '<p>' + esc(clinic.address) + '</p>' : '') +
      '<p class="safety">This is a copy of what your doctor prescribed. ' +
        'Do not change any medicine without speaking to them.</p>' +
      '<p class="credit">TCOS · A Tharigopula Technologies product</p>' +
    '</footer>';
})();
