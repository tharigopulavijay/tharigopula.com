/* =========================================================================
   The diet, lifestyle and exercise plan.

   Vijay asked twice how a doctor writes one, and the answer was that she
   could not: the sheet had rendered a plan since 10 September and there was
   nowhere to keep it.

   Two things matter here and neither is the JSON.

     1. ONE PLAN PER VISIT. Saving the desk twice must update the plan, not
        leave the patient holding two contradictory ones.
     2. TENANT ISOLATION. What a homeopath advises a patient to eat is her
        clinical opinion, not a fact about the patient, and the clinic down
        the road must not be able to read it - or worse, publish it under
        its own name.

   Run:  node test/care-plans.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { carePlans } from '../worker/repo.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* node:sqlite is synchronous; the repo is written against D1's async API.
   This adapts one to the other so the SQL under test is the real SQL. */
const sqlite = new DatabaseSync(':memory:');
const applyFile = path => sqlite.exec(
  readFileSync(path, 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n'));

applyFile('schema.sql');
applyFile('migrations/005-appointments.sql');
sqlite.exec(`CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY, doctor_id TEXT NOT NULL, patient_id TEXT NOT NULL,
  visited_on TEXT NOT NULL, diagnosis TEXT, advice TEXT)`);
applyFile('migrations/051-care-plans.sql');

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
  INSERT INTO patients (id, mobile, full_name) VALUES ('pat_1', '+919111111111', 'A Patient');
  INSERT INTO visits (id, doctor_id, patient_id, visited_on)
    VALUES ('vis_A', 'doc_A', 'pat_1', '2026-09-10'),
           ('vis_B', 'doc_B', 'pat_1', '2026-09-10');
`);

const PLAN = {
  meals: [{ when: 'Breakfast', plan: 'Vegetable upma' }],
  prefer: ['Vegetables', 'Pulses'],
  avoid: ['Refined sugar'],
  routine: ['2 L water daily'],
  exercises: [{ name: 'Chin tucks', amount: '10 reps', when: 'Twice daily' }],
  precautions: ['Stop if pain increases.']
};

/* ------------------------------------------------------------ storing --- */
console.log('\nWhat the doctor typed comes back the way she typed it\n');

await carePlans.save(db, 'doc_A', 'pat_1', 'vis_A', PLAN);
let read = await carePlans.forVisit(db, 'doc_A', 'vis_A');

check('the plan is found again', read !== null);
check('meal rows keep both columns',
  read.meals[0].when === 'Breakfast' && read.meals[0].plan === 'Vegetable upma',
  JSON.stringify(read.meals));
check('exercises keep all three', read.exercises[0].amount === '10 reps' &&
  read.exercises[0].when === 'Twice daily');
check('plain lists survive', read.prefer.length === 2 && read.avoid[0] === 'Refined sugar');
check('order is preserved', read.prefer[0] === 'Vegetables');

/* --------------------------------------------------- one plan per visit --- */
console.log('\nSaving twice updates the plan rather than adding a second\n');

/* The desk saves on every Save draft. A patient holding two plans for one
   consultation is worse than holding none: nobody knows which was meant. */
await carePlans.save(db, 'doc_A', 'pat_1', 'vis_A', { ...PLAN, avoid: ['Salt'] });
const rows = sqlite.prepare(
  'SELECT COUNT(*) AS n FROM care_plans WHERE doctor_id = ? AND visit_id = ?')
  .get('doc_A', 'vis_A');
check('there is exactly one plan for the visit', rows.n === 1, String(rows.n));
read = await carePlans.forVisit(db, 'doc_A', 'vis_A');
check('and it is the newer advice', read.avoid[0] === 'Salt', JSON.stringify(read.avoid));

/* ---------------------------------------------------------- isolation --- */
console.log('\nOne clinic cannot read another clinic\'s advice\n');

check('THE BOUNDARY: doctor B cannot read doctor A\'s plan',
  (await carePlans.forVisit(db, 'doc_B', 'vis_A')) === null);
check('nor find it as the patient\'s latest',
  (await carePlans.latestForPatient(db, 'doc_B', 'pat_1')) === null);
check('CONTROL: doctor A can', (await carePlans.latestForPatient(db, 'doc_A', 'pat_1')) !== null);

/* Both clinics writing for the same patient on the same day must not
   collide - the plan belongs to the visit, and they have different ones. */
await carePlans.save(db, 'doc_B', 'pat_1', 'vis_B', { ...PLAN, avoid: ['Curd'] });
check('each clinic keeps its own plan for the same patient',
  (await carePlans.forVisit(db, 'doc_A', 'vis_A')).avoid[0] === 'Salt' &&
  (await carePlans.forVisit(db, 'doc_B', 'vis_B')).avoid[0] === 'Curd');

/* ------------------------------------------------------------- thin data --- */
console.log('\nA half-written plan is normal\n');

await carePlans.save(db, 'doc_A', 'pat_1', 'vis_A', { avoid: ['Sugar'] });
read = await carePlans.forVisit(db, 'doc_A', 'vis_A');
check('missing parts read back as empty lists, never undefined',
  Array.isArray(read.meals) && read.meals.length === 0 &&
  Array.isArray(read.exercises) && read.exercises.length === 0);
check('and what was written is still there', read.avoid[0] === 'Sugar');

/* Stored JSON is read back by code that must not trust it - a corrupted
   row should give an empty list, not throw on a doctor mid-consultation. */
sqlite.prepare('UPDATE care_plans SET prefer = ? WHERE visit_id = ?')
  .run('not json at all', 'vis_A');
read = await carePlans.forVisit(db, 'doc_A', 'vis_A');
check('unreadable stored JSON becomes an empty list rather than an error',
  Array.isArray(read.prefer) && read.prefer.length === 0);

check('a visit with no plan returns null, not an empty plan',
  (await carePlans.forVisit(db, 'doc_A', 'vis_missing')) === null);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
