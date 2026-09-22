/* =========================================================================
   Clinical confirmations are transactions, not a sequence of hopeful writes.

   A retry, double-click or failed statement must never create two visits or
   leave an AI note confirmed without the visit it claims to have become.
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { applyMigration } from './migrate.js';
import { consultNotes, visits } from '../worker/repo.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync('schema.sql', 'utf8'));
db.exec(`CREATE TABLE clinic_users (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  registration_no TEXT,
  password_hash TEXT,
  password_salt TEXT
);
ALTER TABLE visits ADD COLUMN practitioner_id TEXT REFERENCES clinic_users(id);`);
for (const file of [
  'migrations/019-cost-tracking.sql',
  'migrations/034-consultation-notes.sql',
  'migrations/035-scribe-speakers.sql',
  'migrations/044-consultation-idempotency.sql'
]) {
  for (const problem of applyMigration(db, file)) {
    console.log('  MIGRATION FAILED: ' + problem);
    failed++;
  }
}

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
  INSERT INTO clinic_users
    (id, doctor_id, full_name, mobile, role, registration_no, password_hash, password_salt)
    VALUES ('usr_prac','doc_a','Dr Leela','9222222222','practitioner','TSMC-22','x','y');
`);

console.log('\nConsultation confirmation\n');

const note = await consultNotes.open(d1, 'doc_a', {
  patientId: 'pat_1', consentBy: 'practitioner:usr_prac'
});
await consultNotes.setDraft(d1, 'doc_a', note.id, {
  transcript: 'Two days of fever.', language: 'en',
  note: {
    complaints: 'Fever for two days.', history: '', examination: '',
    advice: 'Hydration and review.', followUp: '2026-09-10',
    speakers: 'The clinician asked the questions.', confidence: 'clear'
  },
  costPaise: 60
});

const visit = await consultNotes.confirmAsVisit(d1, 'doc_a', note.id, {
  visitedOn: '2026-09-08', visitType: 'follow_up',
  complaints: 'Fever for two days.', diagnosis: null,
  advice: 'Hydration and review.', followUpOn: '2026-09-10'
}, { actor: 'practitioner:usr_prac', practitionerId: 'usr_prac' });

check('confirmation creates one visit signed by the practitioner',
  visit && visit.practitioner_id === 'usr_prac');
const confirmed = await consultNotes.byId(d1, 'doc_a', note.id);
check('the note and visit point to each other after the transaction',
  confirmed.status === 'confirmed' && confirmed.visit_id === visit.id);
check('the patient list last-seen date moves in the same transaction',
  db.prepare("SELECT last_seen_on FROM doctor_patients WHERE doctor_id='doc_a' AND patient_id='pat_1'")
    .get().last_seen_on === '2026-09-08');
check('the audit names the practitioner who actually confirmed it',
  db.prepare("SELECT actor FROM audit_events WHERE target_id=?").get(visit.id).actor ===
    'practitioner:usr_prac');

let retry = null;
try {
  await consultNotes.confirmAsVisit(d1, 'doc_a', note.id, {
    visitedOn: '2026-09-08', visitType: 'follow_up', complaints: 'Duplicate'
  }, { actor: 'doctor:doc_a', practitionerId: null });
} catch (error) { retry = error; }
check('a retry is refused and cannot create a duplicate visit or audit line',
  retry && /already been handled/.test(retry.message) &&
  db.prepare("SELECT COUNT(*) n FROM visits WHERE doctor_id='doc_a'").get().n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='consult_note_confirmed'").get().n === 1);

const notReady = await consultNotes.open(d1, 'doc_a', {
  patientId: 'pat_1', consentBy: 'doctor:doc_a'
});
let premature = null;
try {
  await consultNotes.confirmAsVisit(d1, 'doc_a', notReady.id, {
    visitedOn: '2026-09-08', visitType: 'follow_up'
  }, { actor: 'doctor:doc_a', practitionerId: null });
} catch (error) { premature = error; }
check('a recording that has not produced a reviewable draft cannot become a visit',
  premature && /not ready/.test(premature.message) &&
  db.prepare("SELECT COUNT(*) n FROM visits WHERE doctor_id='doc_a'").get().n === 1);

console.log('\nManual visit save\n');

const manualVisit = await visits.create(d1, 'doc_a', {
  patientId: 'pat_1', visitedOn: '2026-09-09', visitType: 'follow_up',
  complaints: 'Review', practitionerId: 'usr_prac'
}, { actor: 'practitioner:usr_prac', idempotencyKey: 'visit-attempt-001' });
const manualRetry = await visits.create(d1, 'doc_a', {
  patientId: 'pat_1', visitedOn: '2026-09-09', complaints: 'Duplicate'
}, { actor: 'doctor:doc_a', idempotencyKey: 'visit-attempt-001' });
check('retrying a manual save returns the same visit',
  manualRetry.id === manualVisit.id &&
  db.prepare("SELECT COUNT(*) n FROM visits WHERE idempotency_key='visit-attempt-001'").get().n === 1);
check('visit, usage and actor audit commit exactly once',
  db.prepare("SELECT COUNT(*) n FROM usage_events WHERE idempotency_key='visit-save:visit-attempt-001'").get().n === 1 &&
  db.prepare("SELECT actor FROM audit_events WHERE target_id=?",).get(manualVisit.id).actor ===
    'practitioner:usr_prac');
check('an older backdated visit cannot move last seen backwards',
  db.prepare("SELECT last_seen_on FROM doctor_patients WHERE doctor_id='doc_a' AND patient_id='pat_1'")
    .get().last_seen_on === '2026-09-09');

db.exec(`CREATE TRIGGER fail_manual_visit_usage
  BEFORE INSERT ON usage_events WHEN NEW.idempotency_key = 'visit-save:visit-attempt-fail'
  BEGIN SELECT RAISE(ABORT, 'forced visit usage failure'); END;`);
let manualFailure = null;
try {
  await visits.create(d1, 'doc_a', {
    patientId: 'pat_1', visitedOn: '2026-09-10', complaints: 'Must roll back'
  }, { actor: 'doctor:doc_a', idempotencyKey: 'visit-attempt-fail' });
} catch (error) { manualFailure = error; }
check('a downstream failure rolls back the visit and last-seen update',
  manualFailure &&
  db.prepare("SELECT COUNT(*) n FROM visits WHERE idempotency_key='visit-attempt-fail'").get().n === 0 &&
  db.prepare("SELECT last_seen_on FROM doctor_patients WHERE doctor_id='doc_a' AND patient_id='pat_1'")
    .get().last_seen_on === '2026-09-09');

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
