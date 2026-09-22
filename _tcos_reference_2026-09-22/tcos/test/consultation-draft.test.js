/* =========================================================================
   The consultation she has not finished yet.

   Vijay: "already i have opened this abcd patient's prescription, now it
   should be saved as a draft ... if he is not saving within 24 hours this
   draft should disappear."

   Four things matter here, and none of them is the JSON.

     1. IT DISAPPEARS. Not "the nightly job eventually deletes it" - a rule
        that is only true after a cron ran is false for the rest of the day.
        The read path itself must refuse an expired sheet.
     2. IT IS NOT A RECORD. This is the reason it is allowed to be deleted
        on a timer at all. The isolation suite asserts the module never
        touches a clinical table; this asserts the other half - that nothing
        here writes to visits or prescriptions.
     3. TENANT ISOLATION. A half-written consultation is the doctor's
        clinical thinking about a patient, and is if anything more sensitive
        than the finished one, because it is what she wondered before she
        was sure.
     4. ONE SHEET PER PATIENT. Two would mean choosing between them when she
        comes back, and there is no honest way to choose.

   Run:  node test/consultation-draft.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { consultationDrafts, DRAFT_HOURS } from '../worker/consultationdraft.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* node:sqlite is synchronous; the module is written against D1's async API.
   Adapting one to the other means the SQL under test is the real SQL. */
const sqlite = new DatabaseSync(':memory:');
const applyFile = path => sqlite.exec(
  readFileSync(path, 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n'));

applyFile('schema.sql');
applyFile('migrations/054-consultation-scratchpad.sql');

const db = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    return {
      bind(...args) {
        return {
          async run() { return { meta: { changes: statement.run(...args).changes } }; },
          async first() { return statement.get(...args) || null; },
          async all() { return { results: statement.all(...args) }; }
        };
      }
    };
  }
};

sqlite.exec(`
  INSERT INTO doctors (id, mobile, full_name, clinic_name) VALUES
    ('doc_A', '+919000000001', 'Dr A', 'Clinic A'),
    ('doc_B', '+919000000002', 'Dr B', 'Clinic B');
  INSERT INTO patients (id, mobile, full_name) VALUES
    ('pat_1', '+919111111111', 'A Patient'),
    ('pat_2', '+919222222222', 'Another Patient');
`);

const SHEET = {
  v: 1,
  doc: {
    complaints: 'Burning in the chest after meals, three weeks',
    diagnosis: 'Amlapitta', advice: 'Small meals, no late dinner',
    vitals: { bloodPressure: '124/80', weight: '71' },
    items: [{ name: 'Avipattikar churna', dose: '3g', frequency: 'Twice a day' }]
  },
  plan: { meals: [{ when: 'Breakfast', plan: 'Vegetable upma' }], avoid: ['Chillies'] },
  alerts: 'Penicillin'
};

console.log('\nThe half-written consultation\n');

/* ------------------------------------------------------- keeping it --- */

await consultationDrafts.put(db, 'doc_A', 'pat_1', { payload: SHEET, author: null });
const kept = await consultationDrafts.get(db, 'doc_A', 'pat_1');

check('what she typed comes back', !!kept && !!kept.payload);
check('including the narrative',
  kept.payload.doc.complaints === SHEET.doc.complaints);
check('the medicines she had written so far',
  kept.payload.doc.items.length === 1 &&
  kept.payload.doc.items[0].name === 'Avipattikar churna');
check('the vitals', kept.payload.doc.vitals.bloodPressure === '124/80');
check('and the plan tables',
  kept.payload.plan.meals[0].plan === 'Vegetable upma' &&
  kept.payload.plan.avoid[0] === 'Chillies');

/* --------------------------------------------------- one per patient --- */

await consultationDrafts.put(db, 'doc_A', 'pat_1', {
  payload: { ...SHEET, doc: { ...SHEET.doc, diagnosis: 'Amlapitta with anxiety' } }
});
const rows = sqlite.prepare(
  'SELECT COUNT(*) AS n FROM consultation_drafts WHERE doctor_id = ? AND patient_id = ?'
).get('doc_A', 'pat_1');
check('typing again updates the same sheet rather than adding a second',
  rows.n === 1, rows.n + ' rows');
check('and the later version is the one kept',
  (await consultationDrafts.get(db, 'doc_A', 'pat_1'))
    .payload.doc.diagnosis === 'Amlapitta with anxiety');

/* ---------------------------------------------------------- the clock --- */

check('it is set to expire a day out, not on creation day',
  DRAFT_HOURS === 24, String(DRAFT_HOURS));

const expiry = sqlite.prepare(
  'SELECT expires_at, updated_at FROM consultation_drafts WHERE doctor_id = ? AND patient_id = ?'
).get('doc_A', 'pat_1');
const gapHours =
  (new Date(expiry.expires_at) - new Date(expiry.updated_at)) / 3600000;
check('the clock runs from the last keystroke, not the first',
  Math.abs(gapHours - 24) < 0.1, gapHours + ' hours');

/* Push it into the past. This is what a laptop closed yesterday looks like
   the following afternoon. */
sqlite.prepare(
  `UPDATE consultation_drafts SET expires_at = ? WHERE doctor_id = ? AND patient_id = ?`
).run(new Date(Date.now() - 60000).toISOString(), 'doc_A', 'pat_1');

check('an expired sheet is not handed back, even before the sweep has run',
  (await consultationDrafts.get(db, 'doc_A', 'pat_1')) === null);
check('and the name is no longer marked as unfinished in the queue',
  (await consultationDrafts.listOpen(db, 'doc_A')).length === 0);

/* CONTROL: it is refusing on the expiry and not simply failing to read.
   Put the clock back and the same row must return. */
sqlite.prepare(
  `UPDATE consultation_drafts SET expires_at = ? WHERE doctor_id = ? AND patient_id = ?`
).run(new Date(Date.now() + 3600000).toISOString(), 'doc_A', 'pat_1');
check('CONTROL: the same row returns once it is in date again',
  !!(await consultationDrafts.get(db, 'doc_A', 'pat_1')));

/* ------------------------------------------------------------ the sweep --- */

await consultationDrafts.put(db, 'doc_A', 'pat_2', { payload: SHEET });
sqlite.prepare(
  `UPDATE consultation_drafts SET expires_at = ? WHERE patient_id = 'pat_2'`
).run(new Date(Date.now() - 60000).toISOString());

const swept = await consultationDrafts.sweep(db);
check('the sweep removes the expired one', swept === 1, String(swept));
check('and leaves the one somebody is still working on',
  !!(await consultationDrafts.get(db, 'doc_A', 'pat_1')));

/* -------------------------------------------------------- isolation --- */

await consultationDrafts.put(db, 'doc_B', 'pat_1', {
  payload: { ...SHEET, doc: { ...SHEET.doc, diagnosis: 'B thinks something else' } }
});

check('the clinic down the road cannot read her half-written consultation',
  (await consultationDrafts.get(db, 'doc_B', 'pat_1'))
    .payload.doc.diagnosis === 'B thinks something else');
check('and hers is untouched by theirs',
  (await consultationDrafts.get(db, 'doc_A', 'pat_1'))
    .payload.doc.diagnosis === 'Amlapitta with anxiety');
check('a clinic sees only its own unfinished sheets',
  (await consultationDrafts.listOpen(db, 'doc_B')).length === 1 &&
  (await consultationDrafts.listOpen(db, 'doc_B'))[0].patientId === 'pat_1');

/* Clearing is what happens the moment she saves properly. It must clear
   HERS and not the other clinic's row for the same patient. */
await consultationDrafts.remove(db, 'doc_A', 'pat_1');
check('saving properly clears her scratchpad',
  (await consultationDrafts.get(db, 'doc_A', 'pat_1')) === null);
check('and does not clear the other clinic\'s sheet for the same patient',
  !!(await consultationDrafts.get(db, 'doc_B', 'pat_1')));

/* --------------------------------------------------- what it refuses --- */

let refused = null;
try {
  await consultationDrafts.put(db, 'doc_A', 'pat_1', {
    payload: { blob: 'x'.repeat(70000) }
  });
} catch (error) { refused = error; }
check('a sheet too large for a consultation is refused, not truncated',
  refused !== null && refused.status === 400, refused && refused.message);

refused = null;
try {
  await consultationDrafts.put(db, 'doc_A', 'pat_1', { payload: '{ not json' });
} catch (error) { refused = error; }
check('something that cannot be read back is refused rather than stored',
  refused !== null && refused.status === 400, refused && refused.message);

refused = null;
try { await consultationDrafts.put(db, 'doc_A', 'pat_1', { payload: null }); }
catch (error) { refused = error; }
check('and so is nothing at all', refused !== null && refused.status === 400);

/* -------------------------------------------- it is not the record --- */

/* THE point of the whole design. If any of this had gone into visits or
   prescriptions, then deleting it on a timer would be deleting clinical
   records, and the 24-hour rule would be indefensible rather than safe. */
const visits = sqlite.prepare('SELECT COUNT(*) AS n FROM visits').get();
const scripts = sqlite.prepare('SELECT COUNT(*) AS n FROM prescriptions').get();
check('nothing typed into the scratchpad became a visit', visits.n === 0, String(visits.n));
check('nor a prescription', scripts.n === 0, String(scripts.n));

/* And the module says so itself: no statement in it names a clinical table.
   Asserted in test/isolation.test.js too, deliberately - that is the file
   somebody reads before changing tenancy rules, this is the one they read
   before changing the scratchpad. */
const source = readFileSync('worker/consultationdraft.js', 'utf8');
check('the module writes to consultation_drafts and nowhere else',
  !/\b(INSERT INTO|UPDATE|DELETE FROM)\s+(?!consultation_drafts)/i.test(
    source.replace(/DO UPDATE SET/g, '')),
  'a write to another table appears in the module');

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
