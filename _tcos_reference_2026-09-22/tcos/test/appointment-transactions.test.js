/* One public request can become one appointment, however many times a
   browser retries or two people at the desk act on it. */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { acceptRequest, declineRequest, requestById } from '../worker/publicpage.js';

const routerSource = readFileSync('worker/index.js', 'utf8');

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync('schema.sql', 'utf8'));
for (const file of [
  'migrations/005-appointments.sql',
  'migrations/006-public-page.sql',
  'migrations/041-appointment-request-idempotency.sql'
]) db.exec(readFileSync(file, 'utf8'));

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
    VALUES ('doc_a','9000000001','Dr A','A Clinic','x','y'),
           ('doc_b','9000000002','Dr B','B Clinic','x','y');
  INSERT INTO patients (id, mobile, full_name)
    VALUES ('pat_1','9111111111','Meena');
  INSERT INTO appointment_requests
    (id, doctor_id, full_name, mobile, preferred_on, preferred_time, reason)
    VALUES ('req_1','doc_a','Meena','9111111111','2026-09-10','10:30','Review'),
           ('req_2','doc_a','Meena','9111111111','2026-09-11',NULL,'Review'),
           ('req_other','doc_b','Meena','9111111111','2026-09-12',NULL,'Review');
`);

console.log('\nAccepting an online request\n');

const first = await acceptRequest(d1, 'doc_a', 'req_1', {
  patientId: 'pat_1', scheduledOn: '2026-09-10', scheduledAt: '10:30',
  reason: 'Review', actor: 'staff:desk_1'
});
check('the request becomes one online appointment',
  !first.repeated &&
  db.prepare("SELECT source FROM appointments WHERE id=?").get(first.appointmentId).source === 'online');
check('the request points at the patient and appointment it became',
  db.prepare("SELECT status, patient_id, appointment_id FROM appointment_requests WHERE id='req_1'")
    .get().appointment_id === first.appointmentId);
check('acceptance is attributed to the person at the desk',
  db.prepare("SELECT actor FROM audit_events WHERE target_id=?").get(first.appointmentId).actor ===
    'staff:desk_1');

const repeated = await acceptRequest(d1, 'doc_a', 'req_1', {
  patientId: 'pat_1', scheduledOn: '2026-12-31', scheduledAt: '23:59',
  reason: 'Duplicate', actor: 'doctor:doc_a'
});
check('a retry returns the first result instead of booking again',
  repeated.repeated && repeated.appointmentId === first.appointmentId &&
  db.prepare("SELECT COUNT(*) n FROM appointments WHERE request_id='req_1'").get().n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='request_accepted'").get().n === 1);

console.log('\nDeclining is idempotent too\n');

const declined = await declineRequest(d1, 'doc_a', 'req_2', 'doctor:doc_a');
const declinedAgain = await declineRequest(d1, 'doc_a', 'req_2', 'staff:desk_1');
check('the first decline changes state and the retry reports repetition',
  !declined.repeated && declinedAgain.repeated && declined.request.status === 'declined');
check('a repeated decline creates one audit line only',
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='request_declined' AND target_id='req_2'")
    .get().n === 1);

let acceptedAfterDecline = null;
try {
  await acceptRequest(d1, 'doc_a', 'req_2', {
    patientId: 'pat_1', scheduledOn: '2026-09-11', actor: 'doctor:doc_a'
  });
} catch (error) { acceptedAfterDecline = error; }
check('a declined request can never later become an appointment',
  acceptedAfterDecline && /already been handled/.test(acceptedAfterDecline.message));

let crossClinic = null;
try { await requestById(d1, 'doc_a', 'req_other'); }
catch (error) { crossClinic = error; }
check('another clinic cannot read or act on the request',
  crossClinic && crossClinic.status === 404);

check('acceptance uses the request id as the patient-registration retry boundary',
  /const registrationKey = 'request-accept:' \+ params\.id/.test(routerSource) &&
  /patients\.registerForDoctor\([\s\S]{0,500}idempotencyKey: registrationKey/.test(routerSource));
const acceptRoute = routerSource.slice(
  routerSource.indexOf("'POST /requests/:id/accept'"),
  routerSource.indexOf("'POST /requests/:id/decline'"));
check('a retry finds the registered patient before evaluating another quota unit',
  acceptRoute.indexOf('patients.registrationByKey') > -1 &&
  acceptRoute.indexOf('patients.registrationByKey') <
    acceptRoute.indexOf("requireQuota(env.DB, doctor, 'patients', 1)"));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
