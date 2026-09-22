/* =========================================================================
   One prescription document, shown to two different people.

   The doctor composes it and the patient opens a link, and those used to be
   two separate designs of the same object - which is two things to keep in
   step, and they had already fallen out of step.

   Now there is one renderer and a filter. Which makes that FILTER the thing
   worth testing: it is what stands between a clinical reference sheet and a
   patient's phone. Everything else here is presentation and can be argued
   about; this cannot.

   Run:  node test/rx-document.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* The renderer is a browser module that hangs itself off window. Give it a
   window and it runs perfectly well here - which is the point of it being a
   pure function of its input: no fetching, no storage, no URL. */
const globalWindow = {};
new Function('window', readFileSync('js/rx-document.js', 'utf8'))(globalWindow);
const RxDocument = globalWindow.RxDocument;

check('the renderer loads outside a browser', !!RxDocument && typeof RxDocument.render === 'function');

const DOC = {
  clinic: {
    name: 'Vijay Hospital', doctor: 'Dr. Vijay Kumar',
    qualification: 'MD (Ayurveda)', address: 'Hyderabad, Telangana',
    phone: '+919398604302'
  },
  patient: { name: 'Example Patient', sex: 'Male', age: 36, bloodGroup: 'B+ve', ref: 'TCOS-1001' },
  issuedOn: '2026-09-09',
  rxNumber: 'TCOS/2026.0/0001',
  items: [
    { name: 'Pantoprazole 40', system: 'allopathy', dose: '1 tablet',
      frequency: 'Before breakfast', duration: '30 days',
      instructions: 'On an empty stomach.' },
    { name: 'Avipattikar Churna', system: 'ayurveda', dose: '3 g', frequency: 'Twice a day' }
  ],
  diagnosis: 'Acid reflux',
  advice: 'Avoid late dinners.',
  followUp: '2026-10-09',
  investigations: [
    { name: 'HbA1c', reference: '4.0-5.6%', readings: [
      { on: '2026-05-11', value: '8.4', unit: '%', flag: 'high' },
      { on: '2026-08-08', value: '7.6', unit: '%', flag: 'high' }
    ] }
  ]
};

const patientView = RxDocument.render(DOC, { audience: 'patient' });
const doctorView = RxDocument.render(DOC, { audience: 'doctor' });

/* ------------------------------------------------- the boundary that matters --- */
console.log('\nA clinical reference sheet must not reach the patient\n');

check('the doctor sees the investigation history', /Investigation history/i.test(doctorView));
check('and the table of values with it', /HbA1c/.test(doctorView));

check('THE BOUNDARY: the patient does NOT get the investigation history',
  !/Investigation history/i.test(patientView));
check('and none of its values leak through', !/HbA1c/.test(patientView));
check('nor the doctor-reference marker',
  !/not part of the patient handout/i.test(patientView));
check('which the doctor DOES see',
  /not part of the patient handout/i.test(doctorView));

/* An unknown or missing audience must fail CLOSED - to the patient's
   narrower view - or a typo in a caller silently hands over the lot. */
check('an unknown audience is treated as the patient',
  !/Investigation history/i.test(RxDocument.render(DOC, { audience: 'nonsense' })));
check('a missing audience is treated as the patient',
  !/Investigation history/i.test(RxDocument.render(DOC, {})));
check('no options at all is treated as the patient',
  !/Investigation history/i.test(RxDocument.render(DOC)));

/* ------------------------------------------------ it really is one document --- */
console.log('\nBoth people see the same prescription\n');

for (const [what, pattern] of [
  ['the clinic name', /Vijay Hospital/],
  ['the doctor', /Dr\. Vijay Kumar/],
  ['the patient', /Example Patient/],
  ['the prescription number', /TCOS\/2026\.0\/0001/],
  ['both medicines', /Pantoprazole 40/],
  ['the dose line', /Before breakfast/],
  ['the instruction', /On an empty stomach/],
  ['the diagnosis', /Acid reflux/],
  ['the advice', /Avoid late dinners/]
]) {
  check('patient and doctor both see ' + what,
    pattern.test(patientView) && pattern.test(doctorView));
}

check('the medicine system is labelled in words, not codes',
  /English medicine/.test(patientView) && /Ayurvedic/.test(patientView));

/* -------------------------------------------------------------- the sheet --- */
console.log('\nIt is a sheet, with a signature at the foot of it\n');

check('it renders as a sheet', /class="rx-sheet/.test(patientView));

/* Space on a prescription is expensive, and a heading telling the reader
   what they are already holding buys nothing. Vijay: "it is a prescription
   right, why to waste that much space for it". Same reasoning that removed
   the logo. */
check('no redundant "Prescription" heading across the top',
  !/<h2>Prescription<\/h2>/.test(patientView));
/* But the second sheet DOES say what it is - it is not obvious, and it
   carries a different audience. A small header, not a banner: Vijay,
   "let's make it small, just header - doctor will understand it well". */
check('the investigation sheet still names itself',
  /rx-small-head">Investigation history/.test(doctorView));
check('the signature block is present', /signature \/ stamp/i.test(patientView));
check('the clinic contact is in the footer', /Hyderabad, Telangana/.test(patientView));
check('the footer comes after the body',
  patientView.indexOf('rx-body') < patientView.indexOf('rx-foot'));

/* The pinning itself is CSS, so assert the rule exists rather than pretend
   to measure layout. This is the fix for "when data is less the doctor sign
   goes up", so it must not be quietly removed. */
const sheetCss = readFileSync('css/rx-document.css', 'utf8');
check('the footer is pinned to the bottom of the sheet',
  /\.rx-foot\{[^}]*margin-top:auto/.test(sheetCss));
check('the sheet holds a page height so a short prescription still looks like a page',
  /\.rx-sheet\{[\s\S]*?min-height:/.test(sheetCss));
check('there is a print stylesheet', /@media print/.test(sheetCss));

/* There was a "Doctor review completed" tick on the doctor's copy. Vijay:
   "why to complicate things, just save it, it's done." The document is
   either a draft or issued, and issuing IS the review - a second box saying
   so is a state that can disagree with the real one. */
check('no separate review tick on either copy',
  !/Doctor review completed/.test(doctorView) &&
  !/Doctor review completed/.test(patientView));

/* The movement column computed the change since the last reading. Dropped:
   the dates are in order on the row, and a clinician reads a trend faster
   than she reads someone else's arithmetic about it. */
check('no computed movement column on the investigation table',
  !/rx-move/.test(doctorView) && !/Movement/.test(doctorView));

/* A date heading must sit over its own numbers. It did not: header cells
   were left-aligned while value cells were right-aligned, so every column
   heading floated over empty space. One class now sets both. */
check('date columns and their headings share one alignment class',
  (doctorView.match(/rx-num-col/g) || []).length >= 4,
  String((doctorView.match(/rx-num-col/g) || []).length));
check('and that class pins the alignment in one place',
  /\.rx-num-col\{text-align:right/.test(sheetCss));

/* ------------------------------------------------------- asking for one --- */
console.log('\nA caller can ask for one page of the document\n');

/* The desk shows the investigation sheet beside the prescription it is
   already displaying. Asking for one page beats rendering all of them and
   cutting the string up afterwards, which is what this replaced. */
const labsOnly = RxDocument.render(DOC, { audience: 'doctor', only: ['investigations'] });
check('only investigations comes back', /rx-investigations/.test(labsOnly));
check('and the prescription does not', !/Pantoprazole 40/.test(labsOnly));
check('exactly one sheet is produced',
  (labsOnly.match(/class="rx-sheet/g) || []).length === 1);

/* `only` must not become a way round the audience filter. */
check('asking for investigations as a patient still gets nothing',
  RxDocument.render(DOC, { audience: 'patient', only: ['investigations'] }) === '');

/* The desk asks for an empty one; the prescription never gets one. */
const emptyLabs = RxDocument.render({ ...DOC, investigations: [] },
  { audience: 'doctor', only: ['investigations'], showEmpty: true });
check('showEmpty draws the table with its column names',
  /rx-investigations/.test(emptyLabs) && /Reference range/.test(emptyLabs));
check('and says why it is empty', /No verified readings yet/.test(emptyLabs));
check('it is a full sheet with the clinic on it, not a loose table',
  /rx-sheet/.test(emptyLabs) && /Vijay Hospital/.test(emptyLabs));
check('without showEmpty nothing is drawn - a printed prescription must not carry an empty grid',
  RxDocument.render({ ...DOC, investigations: [] },
    { audience: 'doctor', only: ['investigations'] }) === '');

/* ------------------------------------------------------------- allergy --- */
console.log('\nAllergies are a note on the patient, not a line on the document\n');

/* Vijay moved these off the prescription: "let's not add this in
   prescription but just for notes doctor can write, so the time doctor logs
   in he knows about him - same if he goes to other doctor also." It is a
   fact about the person rather than about one consultation. */
check('an unknown allergy no longer takes a cell on the sheet',
  !/Not recorded/.test(patientView));
check('but a known one is still printed when it is passed',
  /Penicillin/.test(RxDocument.render(
    { ...DOC, patient: { ...DOC.patient, allergy: 'Penicillin' } }, { audience: 'patient' })));

/* ----------------------------------------------------- diet and lifestyle --- */
console.log('\nThe diet and lifestyle plan, which the patient keeps\n');

/* Nothing is drawn when there is no plan. A heading with nothing under it
   is how a product starts advertising what it has not built. */
check('no diet section when the doctor has not written one',
  !/Diet, lifestyle/.test(patientView));

const withDiet = RxDocument.render({ ...DOC, diet: {
  meals: [{ when: 'On waking', plan: 'Warm water' },
          { when: 'Breakfast', plan: 'Vegetable upma or oats' }],
  prefer: ['Vegetables', 'Pulses and whole grains'],
  avoid: ['Refined sugar', 'Late-night heavy meals'],
  routine: ['2 to 2.5 L water daily', '7 to 8 hours of sleep'],
  exercises: [{ name: 'Chin tucks', amount: '10 repetitions', when: 'Twice daily' }],
  precautions: ['Stop if pain or dizziness increases.']
} }, { audience: 'patient' });

check('a plan appears when there is one', /Diet, lifestyle/.test(withDiet));
check('the meal times are a table', /On waking/.test(withDiet) && /rx-meals/.test(withDiet));
check('what to prefer is listed', /Vegetables/.test(withDiet));
check('what to avoid is listed', /Refined sugar/.test(withDiet));
check('the routine advice is listed', /7 to 8 hours of sleep/.test(withDiet));
check('the exercises are listed with how much and when',
  /Chin tucks/.test(withDiet) && /10 repetitions/.test(withDiet) && /Twice daily/.test(withDiet));
check('the precautions are listed', /Stop if pain/.test(withDiet));

/* THE PATIENT KEEPS THIS ONE. It is the half of the plan that covers the
   other 23 hours, so it must not be doctor-only. */
check('the patient gets the plan, not just the doctor',
  /Diet, lifestyle/.test(RxDocument.render({ ...DOC, diet: { prefer: ['Vegetables'] } },
    { audience: 'patient' })));

/* Partial plans are normal - a doctor may write only what to avoid. */
check('a plan with only one list still renders',
  /Refined sugar/.test(RxDocument.render({ ...DOC, diet: { avoid: ['Refined sugar'] } },
    { audience: 'patient' })));
check('an empty plan object draws nothing',
  !/Diet, lifestyle/.test(RxDocument.render({ ...DOC, diet: {} }, { audience: 'patient' })));

/* ---------------------------------------------------------- letterhead --- */
console.log('\nA doctor printing on her own paper gets no header from us\n');

const onLetterhead = RxDocument.render(
  { ...DOC, clinic: { ...DOC.clinic, letterhead: true } }, { audience: 'doctor' });
check('the clinic name is not printed twice', !/<h1>Vijay Hospital/.test(onLetterhead));
check('room is left for the printed letterhead', /rx-letterhead-gap/.test(onLetterhead));
check('but the prescription itself is all still there',
  /Pantoprazole 40/.test(onLetterhead) && /Acid reflux/.test(onLetterhead));

/* --------------------------------------------------------- safe to render --- */
console.log('\nIt survives thin data and hostile data\n');

const empty = RxDocument.render({ clinic: { name: 'A Clinic' }, patient: { name: 'Someone' } },
  { audience: 'patient' });
check('a prescription with nothing on it renders rather than throwing',
  /rx-sheet/.test(empty));
check('and says so plainly', /Nothing has been recorded/.test(empty));

/* A medicine name is typed by a human and travels to a patient's phone. */
const nasty = RxDocument.render({
  clinic: { name: '<script>alert(1)</script>' },
  patient: { name: 'X' },
  items: [{ name: '<img src=x onerror=alert(1)>', system: 'ayurveda' }]
}, { audience: 'patient' });
check('a script tag in the clinic name is escaped', !/<script>alert/.test(nasty));
check('an image handler in a medicine name is escaped', !/<img src=x/.test(nasty));
check('and the escaped text is still readable', /&lt;script&gt;/.test(nasty));

/* ------------------------------------------- nobody draws their own copy --- */
console.log('\nEvery screen showing a prescription uses this renderer\n');

/* The drift this file exists to stop is not hypothetical. There were THREE
   hand-built layouts of one document: the doctor's list modal, the patient's
   link, and this. Vijay opened the doctor's screen after the renderer
   shipped and said "I am seeing the same old thing" - because that screen
   was still drawing its own.
 *
   So: any browser module that renders a prescription must go through
   RxDocument. Building a medicine table by hand is the tell. */
for (const file of ['js/prescriptions.js', 'js/patient.js']) {
  const source = readFileSync(file, 'utf8');
  check(file + ' renders through the shared document', /RxDocument\.render/.test(source));
  check(file + ' does not build its own medicine table',
    !/<(table|thead)[^>]*>[\s\S]{0,120}(Medicine|Dose|Frequency)/i.test(source),
    'hand-built table found');
}

/* The desk is the one screen that legitimately builds its own markup - it
   is the EDITOR, and inputs cannot come out of a read-only renderer. What
   it must not do is invent a second look: it dresses its inputs in the
   document's own classes, so the doctor is writing on the sheet that
   prints rather than filling a form that becomes one. And anything it
   shows read-only - an earlier prescription, or one just issued - goes
   through the renderer like everywhere else. */
const desk = readFileSync('js/desk.js', 'utf8');
check('the desk renders read-only prescriptions through the shared document',
  (desk.match(/RxDocument\.render/g) || []).length >= 2);
check('the desk editor wears the document\'s own classes',
  /class="rx-sheet rx-editing"/.test(desk) && /class="rx-meds"/.test(desk));
check('issuing switches the desk to the read-only document',
  /issued[\s\S]{0,600}RxDocument\.render/.test(desk));
/* Issued prescriptions are immutable - invariant 3. The desk must not
   offer a save once one has been issued. */
check('the desk stops offering Save once a prescription is issued',
  /deskSave'\)\.disabled = true/.test(desk));

/* And the pages must actually load it, or the call above is a crash. */
for (const page of ['p.html', 'prescriptions.html', 'desk.html']) {
  const html = readFileSync(page, 'utf8');
  check(page + ' loads the renderer', /js\/rx-document\.js/.test(html));
  check(page + ' loads the sheet stylesheet', /css\/rx-document\.css/.test(html));
}

/* ------------------------------- three products, one prescription -------- */
console.log('\nThe same sheet for all three products, in three colours\n');

/* Vijay: "we have just worked on the things in ayurcose but it is not only
   for ayur, it is for all - for every change it should be same... just the
   colouring changes, else that also same across all. it is better keep
   consistent, the presentation all consistent."

   THIS IS THE ASSERTION THAT HOLDS THAT PROMISE. Render the identical
   consultation as each of the three products and the output must differ in
   exactly ONE attribute. Anything else that differs means the sheets have
   started to diverge - which is how "the Ayurveda one does X and the
   homeopathy one does not" begins, quietly, one commit at a time. */
const asProduct = id => RxDocument.render(
  { ...DOC, clinic: { ...DOC.clinic, product: id } }, { audience: 'doctor' });

const ayur = asProduct('ayurcos');
const homeo = asProduct('homeocos');
const allo = asProduct('allocos');

check('each sheet declares its product', /data-product="ayurcos"/.test(ayur) &&
  /data-product="homeocos"/.test(homeo) && /data-product="allocos"/.test(allo));

/* Strip the one attribute and the three must be character-for-character
   the same document. */
const withoutProduct = html => html.replace(/ data-product="[a-z]+"/g, '');
check('THE THREE SHEETS ARE OTHERWISE IDENTICAL, character for character',
  withoutProduct(ayur) === withoutProduct(homeo) &&
  withoutProduct(homeo) === withoutProduct(allo),
  'ayur ' + withoutProduct(ayur).length + ', homeo ' + withoutProduct(homeo).length +
  ', allo ' + withoutProduct(allo).length);

/* Her own examination fields are hers whatever she practises - Naabhi on an
   Ayurvedic sheet and a rubric on a homeopathic one go through the same
   code, because clinicfields.js has never heard of a product. */
const withFieldsAs = id => RxDocument.render({
  ...DOC, clinic: { ...DOC.clinic, product: id },
  findings: [{ label: 'Naabhi', value: 'Unset' }, { label: 'Jihva', value: 'Coated' }]
}, { audience: 'doctor' });
check('a doctor\'s own examination fields print on every product',
  ['ayurcos', 'homeocos', 'allocos'].every(id =>
    /Naabhi/.test(withFieldsAs(id)) && /Jihva/.test(withFieldsAs(id))));
check('and identically, apart from the colour',
  withoutProduct(withFieldsAs('homeocos')) === withoutProduct(withFieldsAs('allocos')));

/* An unknown product must fall through to the neutral sheet rather than
   guessing a discipline - a prescription is not the place to assume. */
check('an unknown product gets the neutral sheet, not a guess',
  !/data-product/.test(asProduct('unanicos')));
check('and so does a document with no product at all',
  !/data-product/.test(RxDocument.render(DOC, { audience: 'doctor' })));

/* The CSS side: each product may override the accent and NOTHING else. A
   rule in one of those blocks that is not a colour is the three sheets
   beginning to diverge. */
for (const id of ['ayurcos', 'homeocos', 'allocos']) {
  const block = new RegExp('\\.rx-sheet\\[data-product="' + id + '"\\][^{]*\\{([^}]*)\\}')
    .exec(sheetCss);
  check(id + ' overrides only colour tokens',
    !!block && block[1].split(';').filter(d => d.trim())
      .every(d => /^\s*--rx-deep(-soft)?:\s*#[0-9A-Fa-f]{6}\s*$/.test(d)),
    block ? block[1].trim() : 'no block');
}

/* And the accent each product declares to the app is the accent its
   prescription actually uses - two files, one colour. */
const productsSource = readFileSync('js/products.js', 'utf8');
for (const id of ['ayurcos', 'homeocos', 'allocos']) {
  const declared = new RegExp("id: '" + id + "'[\\s\\S]{0,900}?accent: '(#[0-9A-Fa-f]{6})'")
    .exec(productsSource);
  const used = new RegExp('\\.rx-sheet\\[data-product="' + id + '"\\][^{]*\\{[^}]*--rx-deep:\\s*(#[0-9A-Fa-f]{6})')
    .exec(sheetCss);
  check(id + ': the app and the prescription agree on the colour',
    declared && used && declared[1].toUpperCase() === used[1].toUpperCase(),
    (declared && declared[1]) + ' vs ' + (used && used[1]));
}

/* -------------------------------------------- the masthead prints once --- */
console.log('\nThe letterhead goes on page one and nowhere else\n');

/* Vijay: "why all the pages need the header only the main page the first
   page of prescripton have this header and remainign all will be starting
   from the top just write the heading and start."

   The masthead is the most expensive block on the sheet. Repeating it on a
   diet plan and an investigation sheet costs a third of a page twice over,
   and says nothing page one did not already say. */
const sheets = html => html.split('<article').length - 1;
const mastheads = html => (html.match(/class="rx-head"/g) || []).length;

check('the doctor really is being handed more than one sheet',
  sheets(doctorView) > 1, String(sheets(doctorView)));
check('THE MASTHEAD APPEARS EXACTLY ONCE, however many sheets there are',
  mastheads(doctorView) === 1, String(mastheads(doctorView)));
check('and once on the patient\'s copy too',
  mastheads(patientView) === 1, String(mastheads(patientView)));

/* Not nothing, though. These sheets come apart: page two ends up on a
   pharmacy counter on its own, and clinical instructions on a page with no
   patient name and no date is a page nobody can safely act on. */
check('the later sheets still carry a one-line identity strip',
  /class="rx-continued"/.test(doctorView));
check('naming the clinic', /rx-continued[\s\S]{0,300}Vijay Hospital/.test(doctorView));
check('the patient', /rx-continued[\s\S]{0,300}Example Patient/.test(doctorView));
check('and the prescription number',
  /rx-continued[\s\S]{0,400}TCOS\/2026\.0\/0001/.test(doctorView));

/* Whichever sheet comes first gets the masthead - it is not assumed to be
   the prescription. Asking for the investigation sheet alone must not
   produce a page with no letterhead on it at all. */
const onlyInvestigations = RxDocument.render(DOC,
  { audience: 'doctor', only: ['investigations'] });
check('a single-sheet render still gets its masthead',
  mastheads(onlyInvestigations) === 1, String(mastheads(onlyInvestigations)));
check('and no continuation strip, because nothing is being continued',
  !/rx-continued/.test(onlyInvestigations));

/* A doctor printing on her own paper has asked for our header to go. The
   continuation strip is our header too, so it goes with it. */
const letterhead = RxDocument.render(
  { ...DOC, clinic: { ...DOC.clinic, letterhead: true } }, { audience: 'doctor' });
check('on her own letterhead neither the masthead nor the strip is drawn',
  mastheads(letterhead) === 0 && !/rx-continued/.test(letterhead));

/* ---------------------------------- her own examination, on the sheet --- */
console.log('\nThe examination she recorded reaches the paper\n');

/* Ayurvedic examination fields were recorded on every consultation and
   reached no prescription - see worker/clinicfields.js and the findings
   column added to prescriptions.withItems on 19 Sep 2026. */
const withFindings = RxDocument.render({
  ...DOC,
  findings: [
    { label: 'Jihva', value: 'Central GI leaf stem' },
    { label: 'Naabhi', value: 'Unset' }
  ]
}, { audience: 'doctor' });
check('a pack field prints under its own name', /Jihva/.test(withFindings));
check('and so does one she named herself', /Naabhi/.test(withFindings));
check('with the value beside it', /Central GI leaf stem/.test(withFindings));
check('CONTROL: without findings neither appears',
  !/Jihva/.test(doctorView) && !/Naabhi/.test(doctorView));

/* ------------------------------------------------------------- control --- */
console.log('\nThe boundary test can fail\n');

/* If the investigation page never rendered at all, every exclusion
   assertion above would pass for the wrong reason. */
check('CONTROL: the investigation page really is produced for the doctor',
  doctorView.length > patientView.length &&
  /rx-investigations/.test(doctorView) && !/rx-investigations/.test(patientView),
  'doctor ' + doctorView.length + ' vs patient ' + patientView.length);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
