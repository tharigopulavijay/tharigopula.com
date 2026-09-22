/* =========================================================================
   Money writes survive retries and failures without changing the books.

   These use the real SQL against SQLite and a D1-compatible transactional
   batch. The UI disabling a button is useful feedback; the database is the
   protection.
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { billing } from '../worker/billing.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync('schema.sql', 'utf8'));
db.exec(readFileSync('migrations/040-payment-idempotency.sql', 'utf8'));

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
  INSERT INTO doctors (id, mobile, full_name, clinic_name, password_hash, password_salt)
    VALUES ('doc_a','9000000001','Dr A','A Clinic','x','y');
  INSERT INTO patients (id, mobile, full_name)
    VALUES ('pat_1','9111111111','Meena');
  INSERT INTO doctor_patients (doctor_id, patient_id, local_ref)
    VALUES ('doc_a','pat_1','A-001');
`);

console.log('\nEditing a draft is all-or-nothing\n');

let invoice = await billing.createDraft(d1, 'doc_a', { patientId: 'pat_1' });
invoice = await billing.replaceItems(d1, 'doc_a', invoice.id, [
  { kind: 'consultation', description: 'Consultation', quantity: 1, unitPrice: 100000 }
]);
check('a valid draft totals in integer paise',
  invoice.total === 100000 && invoice.items.length === 1);

db.exec(`CREATE TRIGGER fail_one_invoice_line
  BEFORE INSERT ON invoice_items WHEN NEW.description = 'FAIL'
  BEGIN SELECT RAISE(ABORT, 'forced line failure'); END;`);
let editFailure = null;
try {
  await billing.replaceItems(d1, 'doc_a', invoice.id, [
    { description: 'Replacement', quantity: 1, unitPrice: 200000 },
    { description: 'FAIL', quantity: 1, unitPrice: 300000 }
  ]);
} catch (error) { editFailure = error; }
invoice = await billing.withItems(d1, 'doc_a', invoice.id);
check('one failed line restores the old lines and old total',
  editFailure && invoice.items.length === 1 &&
  invoice.items[0].description === 'Consultation' && invoice.total === 100000);
db.exec('DROP TRIGGER fail_one_invoice_line');

let invalidLine = null;
try {
  await billing.replaceItems(d1, 'doc_a', invoice.id, [
    { description: 'Impossible', quantity: 0, unitPrice: 100 }
  ]);
} catch (error) { invalidLine = error; }
check('zero quantity is refused instead of silently becoming one',
  invalidLine && /quantity greater than zero/.test(invalidLine.message));

console.log('\nIssuing claims one number exactly once\n');

invoice = await billing.issue(d1, 'doc_a', invoice.id, 'A', 'staff:desk_1');
check('issuing gives the first gap-free number', invoice.invoice_no.endsWith('/0001'));
check('the issue and its actor are audited in the same transaction',
  db.prepare("SELECT actor FROM audit_events WHERE target_id=? AND action='invoice_issued'")
    .get(invoice.id).actor === 'staff:desk_1');

let issueRetry = null;
try { await billing.issue(d1, 'doc_a', invoice.id, 'A', 'staff:desk_1'); }
catch (error) { issueRetry = error; }
check('retrying issue neither renumbers nor advances the sequence',
  issueRetry && (await billing.withItems(d1, 'doc_a', invoice.id)).invoice_no === invoice.invoice_no &&
  db.prepare("SELECT next_no FROM invoice_sequences WHERE doctor_id='doc_a'").get().next_no === 1);

console.log('\nRecording money is idempotent and cannot overpay\n');

invoice = await billing.addPayment(d1, 'doc_a', invoice.id, {
  amount: 60000, method: 'upi', reference: 'UPI-1', receivedOn: '2026-09-08',
  idempotencyKey: 'payment-attempt-1', actor: 'staff:desk_1'
});
check('a part payment leaves the exact balance',
  invoice.paid === 60000 && invoice.balance === 40000);

invoice = await billing.addPayment(d1, 'doc_a', invoice.id, {
  amount: 60000, method: 'upi', reference: 'UPI-1', receivedOn: '2026-09-08',
  idempotencyKey: 'payment-attempt-1', actor: 'staff:desk_1'
});
check('the same payment attempt returns safely without a second receipt',
  invoice.payments.length === 1 &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='payment_received'").get().n === 1);

let overpay = null;
try {
  await billing.addPayment(d1, 'doc_a', invoice.id, {
    amount: 50000, method: 'cash', idempotencyKey: 'payment-attempt-2', actor: 'staff:desk_1'
  });
} catch (error) { overpay = error; }
check('a second request cannot push receipts past the invoice total',
  overpay && /more than/.test(overpay.message) &&
  db.prepare("SELECT SUM(amount) amount FROM payments WHERE invoice_id=?").get(invoice.id).amount === 60000);

let missingKey = null;
try {
  await billing.addPayment(d1, 'doc_a', invoice.id, { amount: 100, method: 'cash' });
} catch (error) { missingKey = error; }
check('a payment without a retry key is refused',
  missingKey && /payment request has expired/.test(missingKey.message));

console.log('\nCancellation cannot race past money already received\n');

let paidCancel = null;
try { await billing.cancel(d1, 'doc_a', invoice.id, 'Entered wrongly', 'doctor:doc_a'); }
catch (error) { paidCancel = error; }
check('a paid invoice cannot be cancelled', paidCancel && /Money has already/.test(paidCancel.message));

let second = await billing.createDraft(d1, 'doc_a', { patientId: 'pat_1' });
second = await billing.replaceItems(d1, 'doc_a', second.id, [
  { description: 'Review', quantity: 1, unitPrice: 50000 }
]);
second = await billing.issue(d1, 'doc_a', second.id, 'A', 'doctor:doc_a');
second = await billing.cancel(d1, 'doc_a', second.id, 'Duplicate bill', 'doctor:doc_a');
check('an unpaid cancellation keeps its number and reason',
  second.status === 'cancelled' && second.invoice_no.endsWith('/0002') &&
  second.cancel_reason === 'Duplicate bill');
check('cancellation is attributed in the same transaction',
  db.prepare("SELECT actor FROM audit_events WHERE target_id=? AND action='invoice_cancelled'")
    .get(second.id).actor === 'doctor:doc_a');

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
