/* Pharmacy movements are money and patient-safety events. The database,
   not a disabled button, must make receipt, FEFO dispensing, quarantine and
   write-off atomic and safe to retry. */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { stock } from '../worker/repo.js';

const pharmacyUi = readFileSync('js/pharmacy.js', 'utf8');
const apiClient = readFileSync('js/tcos-api.js', 'utf8');
const router = readFileSync('worker/index.js', 'utf8');

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync('schema.sql', 'utf8'));
db.exec(readFileSync('migrations/002-prescriptions-and-pharmacy.sql', 'utf8'));
db.exec(readFileSync('migrations/042-stock-operations.sql', 'utf8'));

class D1Statement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new D1Statement(this.sql, args); }
  async first() { return db.prepare(this.sql).get(...this.args) || null; }
  async all() { return { results: db.prepare(this.sql).all(...this.args) }; }
  async run() {
    const result = db.prepare(this.sql).run(...this.args);
    return { meta: { changes: Number(result.changes || 0) } };
  }
}
const d1 = {
  prepare: sql => new D1Statement(sql),
  async batch(statements) {
    db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      db.exec('COMMIT');
      return results;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
};

db.exec(`
  INSERT INTO doctors (id, mobile, full_name, clinic_name)
    VALUES ('doc_a','9000000001','Dr A','A Clinic'),
           ('doc_b','9000000002','Dr B','B Clinic');
  INSERT INTO patients (id, mobile, full_name)
    VALUES ('pat_1','9111111111','Meena');
  INSERT INTO doctor_patients (doctor_id, patient_id, local_ref)
    VALUES ('doc_a','pat_1','A-001');
  INSERT INTO stock_items (id, doctor_id, medicine_name, unit)
    VALUES ('item_a','doc_a','Medicine A','tablet'),
           ('item_b','doc_b','Medicine B','tablet');
`);

console.log('\nReceiving stock is one retry-safe event\n');

const received = await stock.receiveBatch(d1, 'doc_a', {
  stockItemId: 'item_a', batchNo: 'A-100', expiresOn: '2030-01-01', quantity: 10
}, { actor: 'staff:pharmacist_1', idempotencyKey: 'receive-attempt-1' });
const receivedAgain = await stock.receiveBatch(d1, 'doc_a', {
  stockItemId: 'item_a', batchNo: 'WRONG', expiresOn: '2031-01-01', quantity: 99
}, { actor: 'staff:pharmacist_1', idempotencyKey: 'receive-attempt-1' });
check('a receipt creates its batch and inward movement together',
  received.id === receivedAgain.id && received.quantity === 10 &&
  db.prepare("SELECT COUNT(*) n FROM stock_movements WHERE direction='in'").get().n === 1);
check('retrying receipt cannot add stock or audit twice',
  db.prepare("SELECT COUNT(*) n FROM stock_batches WHERE doctor_id='doc_a'").get().n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='stock_received'").get().n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM stock_operations WHERE kind='stock_received'").get().n === 1);

db.exec(`CREATE TRIGGER fail_inward_movement
  BEFORE INSERT ON stock_movements WHEN NEW.direction = 'in' AND NEW.quantity = 13
  BEGIN SELECT RAISE(ABORT, 'forced inward failure'); END;`);
let receiptFailure = null;
try {
  await stock.receiveBatch(d1, 'doc_a', {
    stockItemId: 'item_a', batchNo: 'FAIL', expiresOn: '2030-01-01', quantity: 13
  }, { actor: 'staff:pharmacist_1', idempotencyKey: 'receive-attempt-fail' });
} catch (error) { receiptFailure = error; }
check('a failed movement leaves no believable batch or claimed operation',
  receiptFailure &&
  db.prepare("SELECT COUNT(*) n FROM stock_batches WHERE batch_no='FAIL'").get().n === 0 &&
  db.prepare("SELECT COUNT(*) n FROM stock_operations WHERE operation_key='receive-attempt-fail'").get().n === 0);
db.exec('DROP TRIGGER fail_inward_movement');

console.log('\nDispensing is FEFO, atomic and idempotent\n');

db.exec(`
  INSERT INTO stock_batches
    (id, stock_item_id, doctor_id, batch_no, expires_on, quantity)
    VALUES ('batch_first','item_a','doc_a','FIRST','2029-01-01',3),
           ('batch_second','item_a','doc_a','SECOND','2029-06-01',5);
`);
const drawn = await stock.dispense(d1, 'doc_a', {
  stockItemId: 'item_a', quantity: 6, patientId: 'pat_1',
  idempotencyKey: 'dispense-attempt-1', actor: 'staff:pharmacist_1'
});
check('nearest expiry is exhausted before the later batch',
  drawn.length === 2 && drawn[0].batchNo === 'FIRST' && drawn[0].quantity === 3 &&
  drawn[1].batchNo === 'SECOND' && drawn[1].quantity === 3);
check('the exact shelf quantities and outward movements commit together',
  db.prepare("SELECT quantity FROM stock_batches WHERE id='batch_first'").get().quantity === 0 &&
  db.prepare("SELECT quantity FROM stock_batches WHERE id='batch_second'").get().quantity === 2 &&
  db.prepare("SELECT COUNT(*) n FROM stock_movements WHERE direction='out'").get().n === 2);
const drawnAgain = await stock.dispense(d1, 'doc_a', {
  stockItemId: 'item_a', quantity: 100, patientId: 'pat_1',
  idempotencyKey: 'dispense-attempt-1', actor: 'staff:pharmacist_1'
});
check('a retry returns the first draw without touching stock again',
  drawnAgain.length === 2 &&
  db.prepare("SELECT quantity FROM stock_batches WHERE id='batch_second'").get().quantity === 2);
check('usage, audit and operation are written once',
  db.prepare("SELECT COUNT(*) n FROM usage_events WHERE idempotency_key='stock-dispense:dispense-attempt-1'").get().n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='stock_dispensed'").get().n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM stock_operations WHERE kind='stock_dispensed'").get().n === 1);

db.exec(`
  INSERT INTO stock_batches
    (id, stock_item_id, doctor_id, batch_no, expires_on, quantity)
    VALUES ('batch_rollback_1','item_a','doc_a','ROLL-1','2031-01-01',2),
           ('batch_rollback_2','item_a','doc_a','ROLL-2','2031-02-01',2);
  CREATE TRIGGER fail_second_draw
    BEFORE INSERT ON stock_movements WHEN NEW.batch_id = 'batch_rollback_2'
    BEGIN SELECT RAISE(ABORT, 'forced second draw failure'); END;
`);
let dispenseFailure = null;
try {
  await stock.dispense(d1, 'doc_a', {
    stockItemId: 'item_a', quantity: 15,
    idempotencyKey: 'dispense-attempt-fail', actor: 'staff:pharmacist_1'
  });
} catch (error) { dispenseFailure = error; }
check('a later failed draw restores every earlier batch in the same dispense',
  dispenseFailure &&
  db.prepare("SELECT quantity FROM stock_batches WHERE id='batch_rollback_1'").get().quantity === 2 &&
  db.prepare("SELECT quantity FROM stock_batches WHERE id='batch_rollback_2'").get().quantity === 2 &&
  db.prepare("SELECT COUNT(*) n FROM stock_operations WHERE operation_key='dispense-attempt-fail'").get().n === 0);
db.exec('DROP TRIGGER fail_second_draw');

let crossClinic = null;
try {
  await stock.dispense(d1, 'doc_a', {
    stockItemId: 'item_b', quantity: 1,
    idempotencyKey: 'dispense-cross-clinic', actor: 'staff:pharmacist_1'
  });
} catch (error) { crossClinic = error; }
check('another clinic stock id remains a not-found boundary',
  crossClinic && /not found/i.test(crossClinic.message));

console.log('\nQuarantine and write-off preserve the evidence\n');

const held = await stock.quarantine(d1, 'doc_a', 'batch_rollback_1',
  'manufacturer recall', 'staff:pharmacist_1', 'quarantine-attempt-1');
const heldAgain = await stock.quarantine(d1, 'doc_a', 'batch_rollback_1',
  'wrong retry text', 'staff:pharmacist_1', 'quarantine-attempt-2');
check('quarantine records the reason once and a repeat reports the held quantity',
  held.quantityHeld === 2 && heldAgain.repeated === true &&
  db.prepare("SELECT quarantine_reason FROM stock_batches WHERE id='batch_rollback_1'").get().quarantine_reason === 'manufacturer recall' &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='batch_quarantined'").get().n === 1);

const written = await stock.writeOff(d1, 'doc_a', 'batch_rollback_1',
  'recall disposal', 'staff:pharmacist_1', 'writeoff-attempt-1');
const writtenAgain = await stock.writeOff(d1, 'doc_a', 'batch_rollback_1',
  'different retry', 'staff:pharmacist_1', 'writeoff-attempt-1');
check('write-off records the whole remaining quantity and then zeros the shelf',
  written.written === 2 && writtenAgain.written === 2 &&
  db.prepare("SELECT quantity FROM stock_batches WHERE id='batch_rollback_1'").get().quantity === 0);
check('retrying write-off cannot duplicate movement, operation or audit',
  db.prepare("SELECT COUNT(*) n FROM stock_movements WHERE batch_id='batch_rollback_1' AND direction='expired'").get().n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM stock_operations WHERE kind='batch_written_off'").get().n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='batch_written_off'").get().n === 1);

let noKey = null;
try {
  await stock.writeOff(d1, 'doc_a', 'batch_rollback_2',
    'expired', 'staff:pharmacist_1', '');
} catch (error) { noKey = error; }
check('a stock mutation without a retry key is refused',
  noKey && /stock action has expired/i.test(noKey.message));

console.log('\nThe browser and API preserve the retry boundary\n');

check('each pharmacy dialog creates one key and reuses it on submit',
  /itemAttemptKey = crypto\.randomUUID\(\)/.test(pharmacyUi) &&
  /receiveAttemptKey = crypto\.randomUUID\(\)/.test(pharmacyUi) &&
  /dispenseAttemptKey = crypto\.randomUUID\(\)/.test(pharmacyUi) &&
  /idempotencyKey: itemAttemptKey/.test(pharmacyUi) &&
  /idempotencyKey: receiveAttemptKey/.test(pharmacyUi) &&
  /idempotencyKey: dispenseAttemptKey/.test(pharmacyUi));
check('stock keys and the real signed-in actor reach the transactional methods',
  /quarantineBatch: \(id, reason, idempotencyKey\)/.test(apiClient) &&
  /writeOffBatch: \(id, reason, idempotencyKey\)/.test(apiClient) &&
  /idempotencyKey, actor: actorKey\(doctor\)/.test(router) &&
  /reason, actorKey\(doctor\), idempotencyKey/.test(router));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
