/* Issuing and amending prescriptions are clinical transactions. */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { prescriptions } from '../worker/repo.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync('schema.sql', 'utf8'));
db.exec(readFileSync('migrations/009-clinic-users.sql', 'utf8'));
db.exec(readFileSync('migrations/002-prescriptions-and-pharmacy.sql', 'utf8'));
db.exec(readFileSync('migrations/018-practitioners.sql', 'utf8'));
db.exec(readFileSync('migrations/005-appointments.sql', 'utf8'));
/* Which of the three products issued the prescription. Selected by
   withItems so the sheet can wear that product's accent - nothing else on
   the document differs by it. Added by name rather than replaying the
   migration that introduced it, as elsewhere in this suite. */
db.exec("ALTER TABLE doctors ADD COLUMN product TEXT NOT NULL DEFAULT 'ayurcos';");
db.exec(readFileSync('migrations/044-consultation-idempotency.sql', 'utf8'));
db.exec("ALTER TABLE doctors ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified'");

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
  INSERT INTO doctors
    (id, mobile, full_name, clinic_name, patient_prefix, verification_status)
    VALUES ('doc_a','9000000001','Dr A','A Clinic','A','verified');
  INSERT INTO patients (id, mobile, full_name)
    VALUES ('pat_1','9111111111','Meena');
  INSERT INTO doctor_patients (doctor_id, patient_id, local_ref)
    VALUES ('doc_a','pat_1','A-001');
`);

const item = name => ({
  medicineName: name, system: 'allopathy', dose: '1 tablet',
  frequency: 'once daily', duration: '5 days'
});

console.log('\nDraft rows stay together\n');

let draft = await prescriptions.createDraft(d1, 'doc_a', {
  patientId: 'pat_1', items: [item('Paracetamol 500 mg')],
  idempotencyKey: 'rx-draft-attempt-001', actor: 'doctor:doc_a'
});
check('creating a draft writes the header and all lines together',
  draft.status === 'draft' && draft.items.length === 1);
const sameDraft = await prescriptions.createDraft(d1, 'doc_a', {
  patientId: 'pat_1', items: [item('Wrong duplicate')],
  idempotencyKey: 'rx-draft-attempt-001', actor: 'staff:wrong'
});
check('retrying draft creation returns the first draft and audit only',
  sameDraft.id === draft.id && sameDraft.items[0].medicine_name === 'Paracetamol 500 mg' &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='prescription_draft_created'").get().n === 1);

db.exec(`CREATE TRIGGER fail_prescription_line
  BEFORE INSERT ON prescription_items WHEN NEW.medicine_name = 'FAIL'
  BEGIN SELECT RAISE(ABORT, 'forced line failure'); END;`);
let editFailure = null;
try {
  await prescriptions.replaceItems(d1, 'doc_a', draft.id,
    [item('Ibuprofen 200 mg'), item('FAIL')]);
} catch (error) { editFailure = error; }
draft = await prescriptions.withItems(d1, 'doc_a', draft.id);
check('a failed replacement restores every original line',
  editFailure && draft.items.length === 1 && draft.items[0].medicine_name === 'Paracetamol 500 mg');

let createFailure = null;
try {
  await prescriptions.createDraft(d1, 'doc_a', {
    patientId: 'pat_1', items: [item('FAIL')],
    idempotencyKey: 'rx-draft-attempt-fail', actor: 'doctor:doc_a'
  });
} catch (error) { createFailure = error; }
check('a failed first line leaves no orphan prescription header',
  createFailure && db.prepare("SELECT COUNT(*) n FROM prescriptions WHERE doctor_id='doc_a'").get().n === 1);
db.exec('DROP TRIGGER fail_prescription_line');

db.exec(`
  INSERT INTO visits
    (id, doctor_id, patient_id, visited_on, visit_type, follow_up_on, idempotency_key)
    VALUES ('vis_1','doc_a','pat_1','2026-09-08','follow_up','2026-09-15','visit-rx-link-001');
  INSERT INTO patients (id, mobile, full_name)
    VALUES ('pat_2','9333333333','Suma');
  INSERT INTO doctor_patients (doctor_id, patient_id, local_ref)
    VALUES ('doc_a','pat_2','A-002');
  INSERT INTO visits
    (id, doctor_id, patient_id, visited_on, visit_type, idempotency_key)
    VALUES ('vis_other','doc_a','pat_2','2026-09-08','follow_up','visit-rx-link-002');
`);
let wrongVisit = null;
try {
  await prescriptions.replaceItems(d1, 'doc_a', draft.id,
    [item('Paracetamol 500 mg')], { visitId: 'vis_other' });
} catch (error) { wrongVisit = error; }
check('a prescription cannot be linked to another patient visit',
  wrongVisit && /same patient/.test(wrongVisit.message));
draft = await prescriptions.replaceItems(d1, 'doc_a', draft.id,
  [item('Paracetamol 500 mg')], { visitId: 'vis_1' });
check('the reviewed draft links to the consultation visit', draft.visit_id === 'vis_1');

console.log('\nIssue is gap-free and idempotent\n');

const issued = await prescriptions.issue(d1, 'doc_a', draft.id, 'A', 'doctor:doc_a');
const issuedAgain = await prescriptions.issue(d1, 'doc_a', draft.id, 'A', 'doctor:doc_a');
check('the first issue receives the first number', issued.rx_number.endsWith('/0001'));
check('a retry returns the same issued document',
  issuedAgain.id === issued.id && issuedAgain.rx_number === issued.rx_number);
check('a retry cannot advance the sequence or duplicate usage and audit',
  db.prepare("SELECT next_no FROM rx_sequences WHERE doctor_id='doc_a'").get().next_no === 1 &&
  db.prepare("SELECT COUNT(*) n FROM usage_events WHERE idempotency_key=?").get('rx_issue_' + draft.id).n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='prescription_issued'").get().n === 1);
check('issuing books the visit follow-up in the same transaction',
  db.prepare("SELECT COUNT(*) n FROM appointments WHERE from_visit_id='vis_1'").get().n === 1 &&
  db.prepare("SELECT scheduled_on FROM appointments WHERE from_visit_id='vis_1'").get().scheduled_on ===
    '2026-09-15');

console.log('\nAmendment never rewrites history\n');

const amended = await prescriptions.amend(d1, 'doc_a', draft.id, {
  items: [item('Paracetamol 650 mg')], reason: 'Strength corrected', actor: 'doctor:doc_a'
});
check('amending creates a draft linked in both directions',
  amended.status === 'draft' && amended.amends === draft.id &&
  db.prepare('SELECT superseded_by FROM prescriptions WHERE id=?').get(draft.id).superseded_by === amended.id);
check('the replacement carries the corrected line and the original remains issued',
  amended.items[0].medicine_name === 'Paracetamol 650 mg' &&
  db.prepare('SELECT status FROM prescriptions WHERE id=?').get(draft.id).status === 'issued');
const amendedAgain = await prescriptions.amend(d1, 'doc_a', draft.id, {
  items: [item('Wrong duplicate')], reason: 'Retry', actor: 'staff:desk_1'
});
check('retrying amendment returns the first replacement without another draft',
  amendedAgain.id === amended.id &&
  db.prepare('SELECT COUNT(*) n FROM prescriptions WHERE amends=?').get(draft.id).n === 1);
check('the amendment audit names the clinician and is written once',
  db.prepare("SELECT actor FROM audit_events WHERE action='prescription_amended'").get().actor ===
    'doctor:doc_a' &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='prescription_amended'").get().n === 1);

console.log('\nConsultation screen carries retry keys and links the visit\n');

const consultSource = readFileSync('js/consult.js', 'utf8');
const routerSource = readFileSync('worker/index.js', 'utf8');
check('the screen gives visit and draft independent stable attempt keys',
  consultSource.includes('const visitAttemptKey = crypto.randomUUID()') &&
  consultSource.includes('const prescriptionAttemptKey = crypto.randomUUID()') &&
  consultSource.includes('idempotencyKey: visitAttemptKey') &&
  consultSource.includes('idempotencyKey: prescriptionAttemptKey'));
check('Issue saves the visit first and attaches its id before issuing',
  consultSource.indexOf('const visit = await saveVisit();') <
    consultSource.indexOf('await saveDraft(visit.id);') &&
  consultSource.indexOf('await saveDraft(visit.id);') <
    consultSource.indexOf('TCOSApi.issuePrescription(prescriptionId)'));
check('the router no longer books a follow-up after the issue transaction',
  !routerSource.slice(routerSource.indexOf("'POST /prescriptions/:id/issue'"),
    routerSource.indexOf("'POST /prescriptions/:id/amend'")).includes('createFromFollowUp'));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
