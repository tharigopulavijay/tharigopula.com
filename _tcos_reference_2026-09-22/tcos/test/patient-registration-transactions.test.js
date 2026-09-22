/* A patient registration spans shared identity, the clinic list, its local
   number, usage and audit. These tests prove that is one retry-safe event. */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { patients } from '../worker/repo.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('schema.sql', 'utf8'));
db.exec(readFileSync('migrations/004-household-identity.sql', 'utf8'));
db.exec(readFileSync('migrations/008-patient-numbers.sql', 'utf8'));
db.exec(readFileSync('migrations/043-patient-registration-operations.sql', 'utf8'));
/* Where the patient travels in from - asked for by a doctor using TCOS,
   and written by both registration paths. */
db.exec(readFileSync('migrations/061-where-the-patient-comes-from.sql', 'utf8'));
db.exec('PRAGMA foreign_keys = ON');

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
  INSERT INTO doctors (id, mobile, full_name, clinic_name, patient_prefix)
    VALUES ('doc_a','9000000001','Dr A','A Clinic','AC'),
           ('doc_b','9000000002','Dr B','B Clinic','BC');
`);

console.log('\nCreating a person and clinic number is one event\n');

const first = await patients.registerForDoctor(d1, 'doc_a', 'AC', {
  mobile: '+919111111111', fullName: 'Meena Rao', sex: 'female',
  idempotencyKey: 'patient-attempt-1', actor: 'staff:frontdesk_1'
});
check('the person and clinic list entry are both present',
  first.full_name === 'Meena Rao' && first.local_ref === 'AC-1001' &&
  db.prepare("SELECT COUNT(*) n FROM patients WHERE id=?").get(first.id).n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM doctor_patients WHERE doctor_id='doc_a' AND patient_id=?").get(first.id).n === 1);
check('usage and audit identify one registration and the real staff actor',
  db.prepare("SELECT COUNT(*) n FROM usage_events WHERE idempotency_key='patient-add:patient-attempt-1'").get().n === 1 &&
  db.prepare("SELECT actor FROM audit_events WHERE action='patient_added'").get().actor === 'staff:frontdesk_1');

const retried = await patients.registerForDoctor(d1, 'doc_a', 'AC', {
  mobile: '+919111111111', fullName: 'Wrong retry name',
  idempotencyKey: 'patient-attempt-1', actor: 'staff:somebody_else'
});
check('a retry returns the first patient and keeps the first number',
  retried.id === first.id && retried.full_name === 'Meena Rao' && retried.local_ref === 'AC-1001');
check('a retry cannot duplicate identity, counter, usage or audit',
  db.prepare('SELECT COUNT(*) n FROM patients').get().n === 1 &&
  db.prepare("SELECT next_no FROM patient_sequences WHERE doctor_id='doc_a'").get().next_no === 1001 &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='patient_added'").get().n === 1);

console.log('\nFailure rolls the whole registration back\n');

db.exec(`CREATE TRIGGER fail_patient_audit
  BEFORE INSERT ON audit_events WHEN NEW.target_id LIKE 'pat_%' AND NEW.target_id != '${first.id}'
  BEGIN SELECT RAISE(ABORT, 'forced patient audit failure'); END;`);
let failedRegistration = null;
try {
  await patients.registerForDoctor(d1, 'doc_a', 'AC', {
    mobile: '+919222222222', fullName: 'Rollback Person',
    idempotencyKey: 'patient-attempt-fail', actor: 'staff:frontdesk_1'
  });
} catch (error) { failedRegistration = error; }
check('a failed audit leaves no orphan person or clinic row',
  failedRegistration &&
  db.prepare("SELECT COUNT(*) n FROM patients WHERE full_name='Rollback Person'").get().n === 0 &&
  db.prepare("SELECT COUNT(*) n FROM doctor_patients WHERE local_ref='AC-1002'").get().n === 0);
check('the failed registration does not consume a number, usage or retry key',
  db.prepare("SELECT next_no FROM patient_sequences WHERE doctor_id='doc_a'").get().next_no === 1001 &&
  db.prepare("SELECT COUNT(*) n FROM usage_events WHERE idempotency_key='patient-add:patient-attempt-fail'").get().n === 0 &&
  db.prepare("SELECT COUNT(*) n FROM patient_registration_operations WHERE operation_key='patient-attempt-fail'").get().n === 0);
db.exec('DROP TRIGGER fail_patient_audit');

console.log('\nHouseholds stay shared while clinic numbers stay local\n');

const linked = await patients.registerForDoctor(d1, 'doc_b', 'BC', {
  mobile: '+919111111111', existingPatientId: first.id,
  idempotencyKey: 'patient-link-attempt-1', actor: 'doctor:doc_b'
});
check('another clinic links the same human under its own patient number',
  linked.id === first.id && linked.local_ref === 'BC-1001' &&
  db.prepare('SELECT COUNT(*) n FROM patients').get().n === 1 &&
  db.prepare('SELECT COUNT(*) n FROM doctor_patients WHERE patient_id=?').get(first.id).n === 2);

const child = await patients.registerForDoctor(d1, 'doc_a', 'AC', {
  mobile: '+919111111111', fullName: 'Asha Rao', relation: 'child',
  idempotencyKey: 'patient-attempt-child', actor: 'staff:frontdesk_1'
});
check('a household number can hold another person without merging charts',
  child.id !== first.id && child.local_ref === 'AC-1002' && child.relation === 'child');

let duplicate = null;
try {
  await patients.registerForDoctor(d1, 'doc_a', 'AC', {
    mobile: '+919111111111', fullName: 'Asha Rao', relation: 'child',
    idempotencyKey: 'patient-attempt-duplicate', actor: 'staff:frontdesk_1'
  });
} catch (error) { duplicate = error; }
check('a second operation cannot create the same household member twice',
  duplicate && /already registered/.test(duplicate.message) &&
  db.prepare("SELECT COUNT(*) n FROM patients WHERE full_name='Asha Rao'").get().n === 1);

console.log('\nThe real form carries the retry key\n');

const patientUi = readFileSync('patients.html', 'utf8');
const router = readFileSync('worker/index.js', 'utf8');
check('opening the form creates one key that the save reuses',
  /patientAttemptKey = crypto\.randomUUID\(\)/.test(patientUi) &&
  /idempotencyKey: patientAttemptKey/.test(patientUi));
check('a completed retry is returned before a new quota unit is evaluated',
  router.indexOf('patients.registrationByKey') > -1 &&
  router.indexOf('patients.registrationByKey') < router.indexOf("requireQuota(env.DB, doctor, 'patients', 1)"));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
