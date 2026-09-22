/* =========================================================================
   A patient added to a clinic must actually be on that clinic's list.

   This exists because of a real defect found by clicking "Add patient" in
   the browser and watching nothing happen:

     patient_sequences.next_no had fallen behind doctor_patients - a seed
     wrote local_ref values without advancing the counter. addToList asked
     for the next number, got one already in use, and INSERT OR IGNORE
     silently discarded the row. It then RETURNED THAT NUMBER anyway, so the
     API answered 201 with a patient reference for a patient who was never
     joined to the doctor.

     From the front desk: the patient vanished. And she could not be added
     again, because her mobile was now registered to the orphaned person.

   The fix is to treat the number as claimed only once the row is read back,
   and to try the next one if it was not. These assertions hold that.

   Run:  node test/patient-numbers.test.js
   ========================================================================= */

import { patients } from '../worker/repo.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* A database with a real UNIQUE index on (doctor_id, local_ref), a counter
   that can be set behind the data, and INSERT OR IGNORE semantics. */
function fakeDb({ taken = [], counter = 1001 }) {
  const rows = taken.map(ref => ({ doctor_id: 'doc_1', patient_id: 'other', local_ref: ref }));
  let next = counter;
  const state = { attempts: 0 };

  const db = {
    state,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM doctor_patients WHERE doctor_id = \? AND patient_id = \?/.test(sql)) {
                const [doctorId, patientId] = args;
                return rows.find(r => r.doctor_id === doctorId && r.patient_id === patientId) || null;
              }
              if (/INSERT INTO patient_sequences/.test(sql)) {
                state.attempts++;
                return { next_no: next++ };
              }
              return null;
            },
            async run() {
              if (/INSERT OR IGNORE INTO doctor_patients/.test(sql)) {
                const [doctorId, patientId, localRef] = args;
                /* The UNIQUE index. A taken ref is silently ignored, which
                   is exactly what made the original bug invisible. */
                const clash = rows.some(r => r.doctor_id === doctorId && r.local_ref === localRef);
                if (!clash) rows.push({ doctor_id: doctorId, patient_id: patientId, local_ref: localRef });
              }
              return {};
            }
          };
        }
      };
    }
  };
  return db;
}

/* ------------------------------------------------------- the happy path --- */
console.log('\nA clean counter\n');

let db = fakeDb({ taken: [], counter: 1001 });
let ref = await patients.addToList(db, 'doc_1', 'pat_new', 'DEMO');
check('the first patient gets the first number', ref === 'DEMO-1001', ref);
check('and it took one attempt', db.state.attempts === 1, String(db.state.attempts));

/* --------------------------------------------------- the counter lagging --- */
console.log('\nA counter that has fallen behind the data\n');

/* Exactly the production state: refs up to 1016 in use, counter at 1008. */
const inUse = [];
for (let n = 1001; n <= 1016; n++) inUse.push('DEMO-' + n);

db = fakeDb({ taken: inUse, counter: 1008 });
ref = await patients.addToList(db, 'doc_1', 'pat_new', 'DEMO');

check('the patient still gets a number', typeof ref === 'string' && ref.startsWith('DEMO-'), String(ref));
check('and it is NOT one already in use', !inUse.includes(ref), ref);
check('it walked past the taken numbers', db.state.attempts > 1, String(db.state.attempts));

/* The whole point: the row must exist, not merely be reported. */
const landed = await db.prepare(
  'SELECT local_ref FROM doctor_patients WHERE doctor_id = ? AND patient_id = ?')
  .bind('doc_1', 'pat_new').first();
check('THE ROW EXISTS - the patient is genuinely on the list',
  landed !== null && landed.local_ref === ref, JSON.stringify(landed));

/* ------------------------------------------------------ already on list --- */
console.log('\nSomeone already on the list keeps their number\n');

db = fakeDb({ taken: [], counter: 1001 });
const first = await patients.addToList(db, 'doc_1', 'pat_same', 'DEMO');
const again = await patients.addToList(db, 'doc_1', 'pat_same', 'DEMO');
check('adding the same patient twice does not renumber her', first === again, first + ' vs ' + again);
check('and does not burn a second number', db.state.attempts === 1, String(db.state.attempts));

/* ------------------------------------------------------------ giving up --- */
console.log('\nWhen it genuinely cannot, it says so instead of lying\n');

/* Every number the counter will produce is taken. The old code would have
   returned one of them and left the patient orphaned; this must throw. */
const allTaken = [];
for (let n = 1001; n <= 1200; n++) allTaken.push('DEMO-' + n);
db = fakeDb({ taken: allTaken, counter: 1001 });

let threw = null;
try { await patients.addToList(db, 'doc_1', 'pat_doomed', 'DEMO'); }
catch (error) { threw = error; }

check('it throws rather than reporting a number it did not claim', threw !== null);
check('and the message points at the real cause',
  threw && /patient_sequences is far behind/.test(threw.message), threw && threw.message);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
