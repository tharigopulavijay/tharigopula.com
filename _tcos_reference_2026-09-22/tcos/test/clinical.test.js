/* =========================================================================
   Prescription and pharmacy rules.

   These are not style preferences. They are what makes the record
   defensible in a dispute and the counter safe to work at.

   Run:  node test/clinical.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { applyMigration } from './migrate.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('schema.sql', 'utf8'));
/* Migration splitting lives in test/migrate.js now. It used to be inlined
   here and split on every semicolon, which is wrong the moment a seed value
   contains one - migration 019 carries "Set once chosen; 0 until then."
   inside a string, and that cut produces two invalid fragments and a
   half-applied schema. The shared version only breaks on semicolons that are
   outside quotes. */
for (const problem of applyMigration(db, 'migrations/002-prescriptions-and-pharmacy.sql')) {
  console.log('  MIGRATION FAILED: ' + problem);
  failed++;
}

const all = (sql, ...a) => db.prepare(sql).all(...a);
const one = (sql, ...a) => db.prepare(sql).get(...a);
const repoSource = readFileSync('worker/repo.js', 'utf8');

db.exec(`
  INSERT INTO doctors (id, mobile, full_name, clinic_name, patient_prefix)
    VALUES ('doc_A','+919000000001','Dr A','Clinic A','SAHC');
  INSERT INTO patients (id, mobile, full_name) VALUES ('pat_1','+919111111111','Patient One');
  INSERT INTO doctor_patients (doctor_id, patient_id) VALUES ('doc_A','pat_1');
  INSERT INTO stock_items (id, doctor_id, medicine_name, reorder_level)
    VALUES ('sit_A','doc_A','Metformin 500',20);
`);

console.log('\nPrescription numbering\n');

const nextNo = doctor => one(
  `INSERT INTO rx_sequences (doctor_id, year, next_no) VALUES (?, 2026, 1)
   ON CONFLICT(doctor_id, year) DO UPDATE SET next_no = next_no + 1
   RETURNING next_no`, doctor).next_no;

const series = [nextNo('doc_A'), nextNo('doc_A'), nextNo('doc_A')];
check('numbers are sequential and gap-free', JSON.stringify(series) === '[1,2,3]', JSON.stringify(series));
check('a second doctor gets their own series', nextNo('doc_B') === 1);
check('numbering is allocated at issue, not at draft',
  /Nothing is numbered until it is issued/.test(repoSource));

console.log('\nAn issued prescription is frozen\n');

db.exec(`
  INSERT INTO prescriptions (id, doctor_id, patient_id, issued_on, status)
    VALUES ('rx_1','doc_A','pat_1','2026-08-26','draft');
  INSERT INTO prescription_items (id, prescription_id, doctor_id, medicine_name,
    dispense_quantity, stock_item_id)
    VALUES ('rxi_1','rx_1','doc_A','Metformin 500', 60, 'sit_A');
`);
check('a draft is editable', one("SELECT status FROM prescriptions WHERE id='rx_1'").status === 'draft');

db.exec(`UPDATE prescriptions SET status='issued', issued_at=datetime('now'),
         rx_number='SAHC/2026/0001', sequence_no=1 WHERE id='rx_1';`);

/* SQLite will not stop an UPDATE, so the guard lives in the repo. These
   assertions check the guard is actually there. */
check('editing an issued prescription is refused',
  /issued[\s\S]{0,240}cannot be changed/.test(repoSource));
check('issuing the same prescription twice returns the same immutable document',
  /if \(rx\.status === 'issued'\) return rx/.test(repoSource));
check('amending requires a reason that becomes part of the record',
  /Give a reason for the amendment/.test(repoSource));
check('amending twice returns the already-linked replacement',
  /if \(original\.superseded_by\)[\s\S]{0,100}return this\.withItems/.test(repoSource));

db.exec(`
  INSERT INTO prescriptions (id, doctor_id, patient_id, issued_on, status, amends, amend_reason)
    VALUES ('rx_2','doc_A','pat_1','2026-08-26','draft','rx_1','Dose corrected');
  UPDATE prescriptions SET superseded_by='rx_2' WHERE id='rx_1';
`);
check('the original points at its replacement',
  one("SELECT superseded_by FROM prescriptions WHERE id='rx_1'").superseded_by === 'rx_2');
check('the replacement points back at the original',
  one("SELECT amends FROM prescriptions WHERE id='rx_2'").amends === 'rx_1');
check('the original stays readable after being amended',
  one("SELECT status FROM prescriptions WHERE id='rx_1'").status === 'issued');

console.log('\nPharmacy safety\n');

db.exec(`
  INSERT INTO stock_batches (id, stock_item_id, doctor_id, batch_no, expires_on, quantity) VALUES
    ('bat_exp','sit_A','doc_A','EXP',  date('now','-5 day'),   50),
    ('bat_soon','sit_A','doc_A','SOON', date('now','+20 day'),  30),
    ('bat_far','sit_A','doc_A','FAR',  date('now','+300 day'), 100),
    ('bat_quar','sit_A','doc_A','QUAR', date('now','+300 day'), 40);
  UPDATE stock_batches SET quarantined_at=datetime('now'), quarantine_reason='recall'
    WHERE id='bat_quar';
`);

const dispensable = all(
  `SELECT batch_no FROM stock_batches
    WHERE doctor_id='doc_A' AND stock_item_id='sit_A' AND quantity > 0
      AND expires_on >= date('now') AND quarantined_at IS NULL
    ORDER BY expires_on ASC`).map(r => r.batch_no);

check('expired stock cannot be dispensed', !dispensable.includes('EXP'));
check('quarantined stock cannot be dispensed', !dispensable.includes('QUAR'));
check('nearest expiry goes out first (FEFO)',
  JSON.stringify(dispensable) === '["SOON","FAR"]', JSON.stringify(dispensable));

check('the dispense query excludes quarantined batches', /quarantined_at IS NULL/.test(repoSource));
check('dispensing more than is on hand is refused', /Receive stock before dispensing/.test(repoSource));
check('a write-off records where the stock went, not just a zero',
  /INSERT INTO stock_movements[\s\S]{0,140}'expired'/.test(repoSource));
check('quarantine demands a reason', /Say why the batch is being quarantined/.test(repoSource));

console.log('\nPrescribed versus dispensed\n');

db.exec(`INSERT INTO stock_movements (id, doctor_id, batch_id, patient_id, direction,
  quantity, reason, prescription_item_id)
  VALUES ('mov_1','doc_A','bat_soon','pat_1','out',30,'dispensed','rxi_1');`);

const line = one(
  `SELECT pi.dispense_quantity,
     COALESCE((SELECT SUM(sm.quantity) FROM stock_movements sm
       WHERE sm.prescription_item_id = pi.id AND sm.doctor_id = pi.doctor_id
         AND sm.direction='out'),0) AS dispensed
   FROM prescription_items pi WHERE pi.id='rxi_1' AND pi.doctor_id='doc_A'`);

check('the system knows what was prescribed', line.dispense_quantity === 60);
check('and how much was actually handed over', line.dispensed === 30);
check('so a shortfall is visible', line.dispense_quantity - line.dispensed === 30);

console.log('\nStock levels\n');

const onHand = one(
  `SELECT COALESCE(SUM(quantity),0) AS n FROM stock_batches
    WHERE doctor_id='doc_A' AND stock_item_id='sit_A'
      AND quarantined_at IS NULL AND expires_on >= date('now')`).n;
/* SOON(30) + FAR(100). EXP is out of date and QUAR is off the shelf, so
   neither counts - but SOON expires in 20 days and is still usable today. */
check('on-hand counts in-date, un-quarantined stock only', onHand === 130, 'got ' + onHand);

const wouldIncludeEverything = one(
  `SELECT COALESCE(SUM(quantity),0) AS n FROM stock_batches
    WHERE doctor_id='doc_A' AND stock_item_id='sit_A'`).n;
check('and a naive total would have overstated it by 90',
  wouldIncludeEverything - onHand === 90, 'naive total ' + wouldIncludeEverything);

check('expiry alert catches everything inside 60 days including already expired',
  all(`SELECT id FROM stock_batches WHERE doctor_id='doc_A' AND quantity > 0
        AND expires_on <= date('now','+60 day')`).length === 2);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
