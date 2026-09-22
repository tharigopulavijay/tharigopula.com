/* =========================================================================
   The prescription document. ONE of them.

   This is the renderer both sides use. The doctor composes a prescription
   and the patient opens a link, and those used to be two separate designs
   of the same object - which is two things to keep in step, and they had
   already fallen out of step.

   Vijay put it plainly: "what's the use of creating prescription on the
   doctor side, it should be the same reflection from there - the real
   customer needs to see it that way."

   So: one document, made of PAGES, and every page declares who may see it.

     audience 'both'   - the doctor composes it, the patient receives it
     audience 'doctor' - clinical reference, never in the patient's copy

   LAYOUT
   ------
   Follows the compact sheet Vijay approved on 10 Sep. The things that make
   it fit on one page, in the order they save the most room:

     - medicines are a TABLE with columns, not stacked blocks. Six columns
       of dense rows where the old version used three lines per medicine.
     - sections PAIR UP across the sheet: complaint beside assessment,
       investigations beside the next visit. Roughly half the height.
     - the patient strip is ONE LINE of pipe-separated facts.
     - blank numbered rows pad the medicine table out, the way a printed
       pad has ruled lines left on it.

   WHAT THIS DELIBERATELY DOES NOT DO
   ----------------------------------
   It renders only sections TCOS holds data for. No empty "Diet plan" page
   is drawn because the reference has one - inventing a heading with nothing
   under it is how a product starts advertising what it has not built.

   It is a pure function of the model. No fetching, no storage, no reading
   the URL: hand it a document and it returns HTML. That is what lets the
   same code run on the doctor's screen and on a patient's phone, and what
   lets it be tested without a browser.
   ========================================================================= */
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const prettyDate = value => {
    if (!value) return '';
    const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
    if (!y) return String(value);
    return new Intl.DateTimeFormat('en-IN',
      { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
  };

  /* Written out in full even though it costs column width. The tag is there
     for the PATIENT, and "English medicine" is what people actually say -
     "English" on its own beside a medicine name reads as a language. */
  const SYSTEM_LABEL = {
    allopathy: 'English medicine', ayurveda: 'Ayurvedic',
    homeopathy: 'Homeopathic', supplement: 'Supplement'
  };

  /* A titled panel. Dark bar, content beneath - the unit the sheet is built
     from, and what lets two of them sit side by side. */
  const panel = (title, body, extraClass) =>
    '<section class="rx-panel' + (extraClass ? ' ' + extraClass : '') + '">' +
      '<h2>' + esc(title) + '</h2>' +
      '<div class="rx-panel-body">' + body + '</div>' +
    '</section>';

  const labelled = (label, value) => value
    ? '<p class="rx-p"><b>' + esc(label) + ':</b> ' + esc(value) + '</p>' : '';

  /* ------------------------------------------------------ the masthead --- */

  /* Letterhead mode: a doctor who prints on her own paper does not want ours
     at the top of it. She ticks the box once in her practice settings and
     the whole block goes, leaving room for the paper's own header. */
  function masthead(clinic, doc) {
    if (clinic.letterhead) return '<div class="rx-letterhead-gap"></div>';

    /* No logo, no letter mark. The top of a prescription is the most
       valuable space on it and a coloured circle with an initial in it buys
       nothing. The clinic's NAME is the identity. */
    const credentials = [clinic.doctor, clinic.qualification,
      clinic.registrationNo ? 'Reg. No. ' + clinic.registrationNo : '']
      .filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ');

    const meta = [];
    if (doc.patient && doc.patient.ref) meta.push(['UHID', doc.patient.ref]);
    if (doc.issuedOn) meta.push(['Visit', prettyDate(doc.issuedOn)]);
    if (doc.rxNumber) meta.push(['Rx No', doc.rxNumber]);

    return '<header class="rx-head">' +
      '<div class="rx-head-clinic">' +
        '<h1>' + esc(clinic.name || '') + '</h1>' +
        (clinic.tagline ? '<p class="rx-tagline">' + esc(clinic.tagline) + '</p>' : '') +
        (credentials ? '<p class="rx-credentials">' + credentials + '</p>' : '') +
      '</div>' +
      '<div class="rx-head-meta">' + meta.map(([k, v]) =>
        '<div><b>' + esc(k) + ':</b> ' + esc(v) + '</div>').join('') + '</div>' +
    '</header>';
  }

  /* Page two onwards.

     Vijay: "why all the pages need the header only the main page the first
     page of prescripton have this header and remainign all will be starting
     from the top just write the heading and start right simple thing."

     He is right, and it is not only about looks: the masthead is the most
     expensive block on the sheet, and repeating the clinic name, the
     doctor's credentials and the registration number on a diet plan pushes
     content onto a fourth page to say what page one already said.

     WHAT IS LEFT IS ONE LINE, AND IT IS DELIBERATELY NOT NOTHING. These
     sheets come apart. Page two ends up on a pharmacy counter or in a file
     on its own, and a loose page carrying clinical instructions with no
     patient name and no date on it is a page nobody can safely act on. So
     the clinic, the patient and the Rx number survive at one line of small
     type - about a twelfth of the height of the block it replaces. */
  function continuationHead(clinic, doc) {
    if (clinic.letterhead) return '';
    const patient = (doc.patient && doc.patient.name) || '';
    const bits = [clinic.name, patient, doc.rxNumber ? 'Rx ' + doc.rxNumber : '',
      prettyDate(doc.issuedOn)].filter(Boolean);
    if (!bits.length) return '';
    return '<div class="rx-continued">' +
      bits.map(b => '<span>' + esc(b) + '</span>').join('<i>|</i>') + '</div>';
  }

  const documentTitle = title =>
    '<div class="rx-title"><h2>' + esc(title) + '</h2><span class="rx-title-rule"></span></div>';

  /* The patient strip: one line, pipe separated, the facts a clinician reads
     before anything else. */
  function patientStrip(doc) {
    const p = doc.patient || {};
    const vitals = doc.vitals || {};
    const cells = [];
    if (p.name) cells.push('<b>Patient:</b> ' + esc(p.name));
    const ageSex = [p.age ? p.age : '', p.sex].filter(Boolean).join(' / ');
    if (ageSex) cells.push(esc(ageSex));

    /* ALLERGIES ARE NO LONGER PRINTED HERE.
     *
     * They were, and the argument for it was real: a missing allergy line
     * reads as "no allergies" to whoever dispenses. Vijay's call was to
     * take it off the prescription and keep it as a note the doctor writes
     * and every doctor sees on opening the patient - "so the time doctor
     * logs in he knows about him, same if he goes to other doctor also."
     *
     * It is a fact about the person rather than about this consultation, so
     * it belongs to the patient and not to a document issued on one day -
     * and a note that follows her between clinics is seen more often than
     * a line on a sheet somebody has to still be holding.
     *
     * A known allergy is still printed when one is passed, because a doctor
     * who deliberately puts it on a prescription means it to be there. What
     * changed is that an unknown one no longer occupies a cell. */
    if (p.allergy) cells.push('<b>Allergy:</b> ' + esc(p.allergy));

    if (p.bloodGroup) cells.push('<b>Blood:</b> ' + esc(p.bloodGroup));
    if (vitals.bloodPressure) cells.push('BP ' + esc(vitals.bloodPressure));
    if (vitals.weight) cells.push('Wt ' + esc(vitals.weight));
    if (vitals.height) cells.push('Ht ' + esc(vitals.height));
    if (vitals.bloodSugar) cells.push('Sugar ' + esc(vitals.bloodSugar));

    return '<div class="rx-strip">' +
      cells.map(c => '<span>' + c + '</span>').join('<i>|</i>') + '</div>';
  }

  /* -------------------------------------------------------- the pages --- */

  /* Medicines, as a table. This is where the space is won: six narrow
     columns instead of three stacked lines each. */
  function medicineTable(items, padTo) {
    const rows = items.map((item, index) =>
      '<tr>' +
        '<td class="rx-n">' + (index + 1) + '</td>' +
        '<td class="rx-name"><b>' + esc(item.name) + '</b>' +
          (item.system
            ? ' <span class="rx-sys rx-sys-' + esc(item.system) + '">' +
              esc(SYSTEM_LABEL[item.system] || item.system) + '</span>' : '') + '</td>' +
        '<td>' + esc(item.dose || '') + '</td>' +
        '<td>' + esc(item.frequency || '') + '</td>' +
        '<td class="rx-days">' + esc(item.duration || '') + '</td>' +
        '<td>' + esc(item.instructions || '') + '</td>' +
      '</tr>').join('');

    /* Blank ruled rows, the way a printed pad has lines left on it. Only on
       paper-length documents - padding a two-line prescription on a phone
       would be six rows of nothing to scroll past. */
    let blanks = '';
    for (let i = items.length; i < padTo; i++) {
      blanks += '<tr class="rx-blank"><td class="rx-n">' + (i + 1) +
        '</td><td></td><td></td><td></td><td></td><td></td></tr>';
    }

    return '<table class="rx-meds"><thead><tr>' +
      '<th class="rx-n">#</th><th>Medicine / strength</th><th>Dose</th>' +
      '<th>Timing</th><th class="rx-days">Days</th><th>Instructions</th>' +
      '</tr></thead><tbody>' + rows + blanks + '</tbody></table>';
  }

  function prescriptionPage(doc) {
    /* No "Prescription" heading. Vijay: "it is a prescription right, why to
       waste that much space for it" - and he is right. A title telling the
       reader what they are already holding costs a whole band across the
       top of the sheet and says nothing. The masthead rule closes off the
       header instead.

       The investigation sheet DOES keep its title, because that one is not
       obvious: it is a second page, and it needs to say what it is and who
       it is for. */
    const parts = [patientStrip(doc)];

    /* Complaint and examination on the left, assessment on the right. The
       pairing is what halves the height of this part of the sheet. */
    const findings = (doc.findings || []).filter(f => f && f.label && f.value);
    const examination = (doc.complaints ? labelled('Complaint', doc.complaints) : '') +
      (doc.examination ? labelled('Examination', doc.examination) : '') +
      (findings.length
        ? '<ul class="rx-findings">' + findings.map(f =>
            '<li><b>' + esc(f.label) + '</b> ' + esc(f.value) + '</li>').join('') + '</ul>'
        : '');

    const diagnoses = doc.diagnosis
      ? String(doc.diagnosis).split(/\s*[;\n]\s*/).filter(Boolean) : [];
    const assessment = diagnoses.length
      ? '<ol class="rx-assessment">' + diagnoses.map(d =>
          '<li>' + esc(d) + '</li>').join('') + '</ol>' : '';

    if (examination || assessment) {
      parts.push('<div class="rx-pair">' +
        (examination ? panel('Complaint & examination', examination) : '') +
        (assessment ? panel('Assessment', assessment) : '') +
      '</div>');
    }

    const items = doc.items || [];
    if (items.length) {
      parts.push(panel('Prescription / medicines',
        medicineTable(items, Math.max(items.length, 8)), 'rx-panel-flush'));
    }

    /* Investigations ordered beside the next visit - the same pairing trick
       at the foot of the sheet. */
    const ordered = (doc.investigationsOrdered || []).filter(Boolean);
    const orderedPanel = ordered.length
      ? panel('Investigations ordered',
          '<p class="rx-p">' + ordered.map(esc).join(' &nbsp;&middot;&nbsp; ') + '</p>')
      : '';
    const nextPanel = doc.followUp
      ? panel('Next visit', '<p class="rx-p rx-next">' + esc(prettyDate(doc.followUp)) + '</p>')
      : '';
    if (orderedPanel || nextPanel) {
      parts.push('<div class="rx-pair">' + orderedPanel + nextPanel + '</div>');
    }

    if (doc.advice) parts.push(panel('Advice', '<p class="rx-p">' + esc(doc.advice) + '</p>'));

    /* One part means the patient strip and nothing else - no examination,
       no medicines, no advice. Say so rather than printing a header over
       empty space. (This counted 2 while there was a title above the
       strip; dropping the title moved the number.) */
    if (parts.length === 1) {
      parts.push('<div class="rx-nothing">Nothing has been recorded on this ' +
        'prescription yet.</div>');
    }
    return parts.join('');
  }

  /* Doctor reference only. The reference implementation prints exactly this
     warning at the top of its own version, and it is the right instinct: a
     table of every value a patient has produced is a thing to read WITH a
     clinician, not to hand over at the counter. */
  function investigationPage(doc, options) {
    const series = doc.investigations || [];
    const head = '<h3 class="rx-small-head">Investigation history' +
      '<span>Doctor reference &middot; not part of the patient handout</span></h3>';

    /* Nothing recorded. On a printed prescription this page simply does not
       exist - an empty grid on paper is noise. On the desk it does, because
       Vijay asked for it: "just give like the table empty table which makes
       like this is there right." A blank area reads as a screen that is
       broken; the ruled table says the feature is here and waiting. */
    if (!series.length) {
      if (!options || !options.showEmpty) return '';
      return head +
        '<table class="rx-investigations"><thead><tr>' +
          '<th>Investigation</th><th>Reference range</th>' +
          '<th class="rx-num-col">Earlier</th><th class="rx-num-col">Previous</th>' +
          '<th class="rx-num-col">Latest</th></tr></thead><tbody><tr>' +
          '<td class="rx-empty-row" colspan="5">No verified readings yet. ' +
          'Upload a report, or ask the patient to send one.</td>' +
        '</tr></tbody></table>';
    }

    const dates = [...new Set(series.flatMap(t => t.readings.map(r => r.on)))]
      .sort().slice(-3);

    /* A small header, not a banner. Vijay: "why do we need that big
       Investigation history, let's make it small - just header - doctor
       will understand it well right." A doctor looking at a table of
       analytes and dates knows what she is looking at.

       There was also a Movement column computing the change since the last
       reading. Dropped on his instruction: the dates are right there in
       order, and a clinician reads a trend across a row faster than she
       reads someone else's arithmetic about it. */
    return head +
      '<table class="rx-investigations"><thead><tr>' +
        '<th>Investigation</th><th>Reference range</th>' +
        dates.map(d => '<th class="rx-num-col">' + esc(prettyDate(d)) + '</th>').join('') +
        '</tr></thead><tbody>' +
      series.map(test => {
        const readings = [...test.readings].sort((a, b) => String(a.on).localeCompare(b.on));
        return '<tr><th>' + esc(test.name) + '</th>' +
          '<td class="rx-ref">' + esc(test.reference || '—') + '</td>' +
          dates.map(date => {
            const hit = readings.find(r => r.on === date);
            return '<td class="rx-num-col' +
              (hit && hit.flag && hit.flag !== 'normal' ? ' rx-flag' : '') +
              '">' + (hit ? esc(hit.value) + (hit.unit ? ' ' + esc(hit.unit) : '') : '—') + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }

  /* ------------------------------------------------- diet and lifestyle --- */

  /* The patient's half of the plan: what to eat, what to avoid, how to
     move. Vijay asked for this below the prescription, and it is the page a
     patient actually keeps - the prescription tells her what to swallow,
     this tells her what to do for the other 23 hours.

     Rendered only when a diet plan exists on the document. TCOS has no
     table for one yet, so today no clinic produces it; the moment the desk
     can save one, it appears here with no change to this file. */
  function dietPage(doc) {
    const diet = doc.diet;
    if (!diet) return '';
    const list = (title, entries, kind) => (entries || []).length
      ? '<div class="rx-list rx-list-' + kind + '"><h4>' + esc(title) + '</h4><ul>' +
        entries.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></div>'
      : '';

    const meals = (diet.meals || []).length
      ? '<table class="rx-meals"><thead><tr><th>Time</th><th>Plan</th></tr></thead><tbody>' +
        diet.meals.map(m => '<tr><th>' + esc(m.when) + '</th><td>' +
          esc(m.plan) + '</td></tr>').join('') + '</tbody></table>'
      : '';

    const exercises = (diet.exercises || []).length
      ? '<table class="rx-meals"><thead><tr><th>Practice</th><th>How much</th><th>When</th>' +
        '</tr></thead><tbody>' + diet.exercises.map(x =>
          '<tr><th>' + esc(x.name) + '</th><td>' + esc(x.amount || '') + '</td>' +
          '<td>' + esc(x.when || '') + '</td></tr>').join('') + '</tbody></table>'
      : '';

    const left = (meals ? panel('Daily meal plan', meals, 'rx-panel-flush') : '') +
      list('Prefer', diet.prefer, 'good') +
      list('Limit or avoid', diet.avoid, 'avoid') +
      list('Hydration and routine', diet.routine, 'plain');

    const right = (exercises ? panel('Movement and exercise', exercises, 'rx-panel-flush') : '') +
      list('Precautions', diet.precautions, 'warn');

    if (!left && !right) return '';

    return '<h3 class="rx-small-head">Diet, lifestyle and exercise' +
      '<span>Prepared for this consultation</span></h3>' +
      '<div class="rx-pair rx-pair-top">' +
        '<div>' + left + '</div>' +
        '<div>' + right + '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------- the footer --- */

  /* Pinned to the bottom of the SHEET, not placed after the content.
     Vijay: "when data is less the doctor sign goes up - that is not a good
     habit." A signature floating up under two lines of medicine reads as an
     unfinished form. The CSS holds it down; this only supplies it. */
  function sheetFooter(clinic, options) {
    const contact = [clinic.address, clinic.phone, clinic.website]
      .filter(Boolean).map(v => '<span>' + esc(v) + '</span>').join('');
    return '<footer class="rx-foot">' +
      '<div class="rx-sign-row">' +
        '<div class="rx-credit">' +
          (contact ? '<div class="rx-contact">' + contact + '</div>' : '') +
          '<div class="rx-powered">Powered by Tharigopula Technologies &middot; TCOS</div>' +
        '</div>' +
        '<div class="rx-sign">' +
          '<div class="rx-sign-line"></div>' +
          '<b>' + esc(clinic.doctor || '') + '</b>' +
          '<span>Doctor&rsquo;s signature / stamp</span>' +
        '</div>' +
      '</div>' +
    /* There was a "Doctor review completed" tick here. Vijay: "why to
       complicate things, just save it, it's done." He is right - the
       document is either a draft or issued, and issuing IS the review.
       A second box saying the same thing is a state that can disagree
       with the real one. */
    '</footer>';
  }

  /* ---------------------------------------------------------- render --- */

  /* `audience` is 'doctor' or 'patient'. Everything else is the document. */
  function render(doc, options) {
    const settings = options || {};
    /* Fails CLOSED to the patient's narrower view: an unknown or missing
       audience must never be the one that shows more. */
    const audience = settings.audience === 'doctor' ? 'doctor' : 'patient';
    const clinic = doc.clinic || {};

    /* `only` picks named pages. The desk shows the investigation sheet
       beside the prescription it is already displaying, and asking for one
       page is better than rendering all of them and cutting the string up
       afterwards - which is what this replaced. */
    const only = Array.isArray(settings.only) ? settings.only : null;
    const wanted = name => !only || only.includes(name);

    const pages = [
      { name: 'prescription', audience: 'both',
        body: wanted('prescription') ? prescriptionPage(doc) : '' },
      /* The patient keeps this one. It goes below the prescription because
         the medicines are what she opens it for; the plan is what she comes
         back to. */
      { name: 'diet', audience: 'both', body: wanted('diet') ? dietPage(doc) : '' },
      { name: 'investigations', audience: 'doctor',
        body: wanted('investigations') ? investigationPage(doc, settings) : '' }
    ];

    /* THE MASTHEAD GOES ON THE FIRST SHEET AND NOWHERE ELSE.
       Which sheet is first depends on what there is to print - a patient
       with no diet plan has the prescription first, `only: ['investigations']`
       makes that sheet the first one - so it is decided after filtering,
       never assumed to be the prescription. */
    /* THE ONLY THING ABOUT THIS DOCUMENT THAT DIFFERS BY PRODUCT.
     *
       Vijay: "just the colouring changes, else that also same across all -
       it is better keep consistent, the presentation all consistent."
     *
       One attribute, and css/rx-document.css swaps two colour tokens off
       it. Every other byte this function emits is identical whether the
       doctor is on AyurCOS, HomeoCOS or AlloCOS - same layout, same
       sections, same six examination fields, same letterhead rule. A
       homeopath and an Ayurvedic doctor get the same sheet in a different
       colour, which is the whole of the difference and is meant to be.
     *
       It arrives on `doc.clinic`, not read from a global: this renderer is
       a pure function of its input, which is what lets the same code run on
       the doctor's screen, on a patient's phone and in a test without a
       browser. An unknown or missing product falls through to the neutral
       sheet rather than guessing a discipline. */
    const KNOWN_PRODUCTS = ['ayurcos', 'homeocos', 'allocos'];
    const product = KNOWN_PRODUCTS.includes(clinic.product) ? clinic.product : '';

    return pages
      .filter(page => page.body && (page.audience === 'both' || audience === 'doctor'))
      .map((page, index) =>
        '<article class="rx-sheet' + (clinic.letterhead ? ' rx-on-letterhead' : '') +
          (index ? ' rx-sheet-continued' : '') + '"' +
          (product ? ' data-product="' + product + '"' : '') + '>' +
          (index ? continuationHead(clinic, doc) : masthead(clinic, doc)) +
          '<div class="rx-body">' + page.body + '</div>' +
          sheetFooter(clinic, { audience }) +
        '</article>').join('');
  }

  window.RxDocument = { render, prettyDate, esc };
})();
