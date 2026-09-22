/* =========================================================================
   Staff permission tests.

   A staff account is the first time somebody other than the doctor holds a
   session at a clinic. The promise made to every doctor who adds one is
   narrow and absolute: her front desk can run her diary and can never open a
   clinical record.

   A permission that only exists in the interface is not a permission - the
   API is one fetch away for anyone who opens the console. So these tests
   read the router's own source and prove the gates are on the routes, the
   same way the isolation tests prove doctor_id is on the queries.

   Run:  node test/staff.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';
import {
  actorFor, actorKey, requireCan, CAN, roleList, temporaryPassword
} from '../worker/staff.js';

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

const router = readFileSync('worker/index.js', 'utf8');
const navSource = readFileSync('js/nav.js', 'utf8');
const teamSource = readFileSync('js/team.js', 'utf8');

/* ---------------------------------------------------------- the roles --- */

console.log('\nRoles\n');

const roles = roleList();
check('there are staff roles to choose from', roles.length >= 3);

/* The single line this whole feature rests on: STAFF cannot open a clinical
   record. Migration 018 added one role that is not staff - another doctor in
   the same practice, who obviously can - so the clinical assertions skip it
   by name and it is checked separately below.

   Skipping by the `clinical` flag rather than by label means a second
   clinical role added later is exempted deliberately, in this file, where
   somebody has to notice. Everything that is not clinical is still held to
   the original rule. */
const clinicalRoles = roles.filter(r => r.clinical);
const staffRoles = roles.filter(r => !r.clinical);

check('there are staff roles to choose from', staffRoles.length >= 3);
check('exactly one role may open the clinical record',
  clinicalRoles.length === 1, clinicalRoles.map(r => r.id).join(','));
check('a treating doctor is offered the diagnostic history in navigation',
  /\['reports\.html',[^\n]+\s'read_notes'\]/.test(navSource));
check('owner-only aggregate reports are not mislabeled as patient diagnostics',
  /reports:\s*'Practice analytics'/.test(teamSource));

for (const role of staffRoles) {
  check('"' + role.label + '" cannot read clinical notes',
    !role.can.includes(CAN.READ_NOTES), role.can.join(','));
  check('"' + role.label + '" cannot write clinical notes',
    !role.can.includes(CAN.WRITE_NOTES), role.can.join(','));
  check('"' + role.label + '" cannot change the practice',
    !role.can.includes(CAN.SETTINGS), role.can.join(','));
  check('"' + role.label + '" cannot manage the team',
    !role.can.includes(CAN.TEAM), role.can.join(','));
  check('"' + role.label + '" cannot see the practice reports',
    !role.can.includes(CAN.REPORTS), role.can.join(','));
}

/* Even the second doctor does not run the business. She sees patients; the
   clinic still belongs to the doctor who owns it. */
for (const role of clinicalRoles) {
  check('"' + role.label + '" still cannot change the practice',
    !role.can.includes(CAN.SETTINGS), role.can.join(','));
  check('"' + role.label + '" still cannot manage the team',
    !role.can.includes(CAN.TEAM), role.can.join(','));
}

/* ------------------------------------------------------------- actors --- */

console.log('\nActors\n');

const doctor = { id: 'doc_A', full_name: 'Dr. Ashwin' };
const asDoctor = actorFor(doctor, null);
const asDesk = actorFor(doctor, { id: 'usr_1', full_name: 'Latha', role: 'front_desk' });
const asPharmacist = actorFor(doctor, { id: 'usr_2', full_name: 'Ravi', role: 'pharmacist' });
const asSecondDoctor = actorFor(doctor, {
  id: 'usr_4', full_name: 'Dr. Leela', role: 'practitioner'
});

check('the doctor may do everything',
  Object.values(CAN).every(c => asDoctor.can(c)));
check('front desk may run the diary', asDesk.can(CAN.APPOINTMENTS));
check('front desk may NOT read notes', !asDesk.can(CAN.READ_NOTES));
check('front desk may NOT touch the pharmacy', !asDesk.can(CAN.PHARMACY));
check('pharmacist may run the pharmacy', asPharmacist.can(CAN.PHARMACY));
check('pharmacist may NOT read notes', !asPharmacist.can(CAN.READ_NOTES));
check('pharmacist may NOT run the diary', !asPharmacist.can(CAN.APPOINTMENTS));
check('the clinic owner has an owner audit identity',
  actorKey({ ...doctor, actor: asDoctor }) === 'doctor:doc_A');
check('staff work is attributed to that person, not the clinic owner',
  actorKey({ ...doctor, actor: asDesk }) === 'staff:usr_1');
check('a second doctor is attributed as a practitioner, not staff',
  actorKey({ ...doctor, actor: asSecondDoctor }) === 'practitioner:usr_4');
check('the router uses the canonical actor helper for clinic audit writes',
  !/actor:\s*'doctor:'\s*\+\s*doctor\.id/.test(router.replace(
    /actor:\s*'doctor:'\s*\+\s*doctor\.id,\s*action:\s*'password_reset'/,
    "actor: 'account-owner', action: 'password_reset'"
  )));

/* An unknown role must fail closed. A typo in a role name should lock
   someone out, never let them in. */
const asNonsense = actorFor(doctor, { id: 'usr_3', full_name: 'X', role: 'wizard' });
check('an unknown role can do nothing at all',
  Object.values(CAN).every(c => !asNonsense.can(c)));

let threw = false;
try { requireCan(asDesk, CAN.READ_NOTES); } catch (_) { threw = true; }
check('requireCan throws for a capability the role lacks', threw);

let allowed = true;
try { requireCan(asDesk, CAN.APPOINTMENTS); } catch (_) { allowed = false; }
check('requireCan passes for a capability the role has', allowed);

/* --------------------------------------------------- the routes proper --- */

console.log('\nEvery clinical route is gated in the router\n');

/* If a route is added to this list it must carry a gate. The list is the
   contract; the assertion is that the code honours it. */
const MUST_BE_GATED = [
  ['GET /patients/:id', 'READ_NOTES'],
  ['GET /patients/:id/shared-history', 'READ_NOTES'],
  ['GET /patients/:id/lab-series', 'READ_NOTES'],
  ['GET /prescriptions/:id', 'READ_NOTES'],
  ['POST /prescriptions', 'WRITE_NOTES'],
  ['PATCH /prescriptions/:id', 'WRITE_NOTES'],
  ['POST /prescriptions/:id/issue', 'WRITE_NOTES'],
  ['POST /prescriptions/:id/amend', 'WRITE_NOTES'],
  ['POST /visits', 'WRITE_NOTES'],
  ['POST /lab-reports', 'WRITE_NOTES'],
  ['GET /lab-reports/:id', 'READ_NOTES'],
  ['POST /patients/:id/share', 'READ_NOTES'],
  ['GET /stock', 'PHARMACY'],
  ['POST /stock/dispense', 'PHARMACY'],
  ['PATCH /me', 'SETTINGS'],
  ['GET /team', 'TEAM'],
  ['POST /team', 'TEAM'],
  ['GET /invoices', 'BILLING'],
  ['POST /invoices', 'BILLING'],
  ['POST /invoices/:id/issue', 'BILLING'],
  ['POST /invoices/:id/payments', 'BILLING'],
  ['GET /prescriptions', 'READ_NOTES'],
  ['GET /reports', 'REPORTS'],
  ['POST /fees', 'SETTINGS'],

  /* Reading a document with AI produces clinical content, so it is gated on
     the clinical capabilities and not on PATIENTS. A front-desk assistant may
     photograph and upload a report - POST /files needs only PATIENTS - but
     turning what the model read into a record is a clinical act, and only
     somebody who could have written that record by hand may confirm it. */
  ['POST /ai/preflight', 'WRITE_NOTES'],
  ['POST /ai/preflights/:id/approve', 'WRITE_NOTES'],
  ['POST /ai/preflights/:id/reject', 'WRITE_NOTES'],
  ['POST /ai/read-report', 'WRITE_NOTES'],
  ['GET /ai/drafts', 'READ_NOTES'],
  ['GET /ai/drafts/:id', 'READ_NOTES'],
  ['POST /ai/drafts/:id/confirm', 'WRITE_NOTES'],
  ['POST /ai/drafts/:id/reject', 'WRITE_NOTES']
];

/* Take each route's body up to the start of the next one, and look for the
   gate inside it. Searching the whole file would pass on any gate anywhere. */
function bodyOf(route) {
  const start = router.indexOf("  '" + route + "': async (env, request");
  if (start < 0) return null;
  const next = router.indexOf("\n  '", start + 5);
  return router.slice(start, next < 0 ? router.length : next);
}

for (const [route, capability] of MUST_BE_GATED) {
  const body = bodyOf(route);
  check(route + ' requires ' + capability,
    !!body && body.includes('gate(doctor, CAN.' + capability + ')'),
    body ? 'gate missing' : 'route not found');
}

/* A gate placed after the work has already happened protects nothing. */
console.log('\nGates run before the handler does anything\n');

for (const [route] of MUST_BE_GATED) {
  const body = bodyOf(route) || '';
  const gateAt = body.indexOf('gate(doctor,');
  const firstAwait = body.indexOf('await ', body.indexOf('requireDoctor') + 20);
  check(route + ' gates before its first other await',
    gateAt > -1 && (firstAwait === -1 || gateAt < firstAwait));
}

/* ------------------------------------------------ temporary passwords --- */

console.log('\nTemporary passwords\n');

const samples = Array.from({ length: 200 }, () => temporaryPassword());
check('long enough to be worth having', samples.every(p => p.length >= 12));
/* Whole words, so nothing has to be spelled out and no character is
   ambiguous on its own: "lotus" can never be heard as "1otus", but a bare
   "l" in a random string can. */
check('nothing that has to be spelled out over a phone',
  samples.every(p => /^[a-z]+-[a-z]+-\d{4}$/.test(p)));
check('not the same one twice', new Set(samples).size > 190);

/* ------------------------------------------------ several doctors ------ */

/* Migration 018 puts a second doctor inside an existing clinic rather than
   moving the tenant boundary. That is only safe while the clinical
   capabilities stay unreachable from the tick-list a doctor uses to set up
   her receptionist - so these assertions guard the seam. */

console.log('\nMore than one doctor in a clinic\n');

const staffSource = readFileSync('worker/staff.js', 'utf8');

const practitioner = roleList().find(r => r.id === 'practitioner');
check('there is a role for another doctor in the practice', !!practitioner);
check('and it can open and write the clinical record',
  practitioner && practitioner.can.includes('read_notes') &&
  practitioner.can.includes('write_notes'));

/* The whole point of the seam. */
const assignable = practitioner ? practitioner.assignable : [];
check('read_notes is NOT something a doctor can tick for a staff member',
  !assignable.includes('read_notes'), assignable.join(', '));
check('write_notes is NOT tickable either',
  !assignable.includes('write_notes'), assignable.join(', '));
check('nor is running the practice or the team',
  !assignable.includes('settings') && !assignable.includes('team'));

/* A saved capability list must not be able to grant what the tick-list
   cannot. Before this, a row holding ["read_notes"] would have been
   filtered - but only because read_notes is absent from ASSIGNABLE, which
   is one edit away from being untrue. The clinical roles now ignore the
   stored list entirely. */
const fakeCapabilities = { id: 'u1', full_name: 'X', role: 'front_desk',
  capabilities: '["read_notes","write_notes","patients"]' };
const smuggled = actorFor({ id: 'doc', full_name: 'D' }, fakeCapabilities);
check('a front-desk row holding read_notes still cannot open a record',
  !smuggled.can('read_notes') && !smuggled.can('write_notes'));
check('and keeps the ordinary duties it legitimately has',
  smuggled.can('patients'));

const asPractitioner = actorFor({ id: 'doc', full_name: 'D' },
  { id: 'u2', full_name: 'Dr Two', role: 'practitioner',
    registration_no: 'CCH-99', verification_status: 'unverified',
    capabilities: '["pharmacy"]' });
check('a practitioner reads the role, not the stored tick-list',
  asPractitioner.can('write_notes') && !asPractitioner.can('pharmacy'));
check('and is marked as one, so their own name signs their work',
  asPractitioner.isPractitioner === true);
check('an unverified practitioner is not reported as verified',
  asPractitioner.verified === false);

check('a doctor added to a practice must state their own registration number',
  /A doctor needs their own council registration number/.test(staffSource));

/* Attribution. A shared clinic that cannot say which doctor wrote a note
   has a record that is not defensible. */
const repoText = readFileSync('worker/repo.js', 'utf8');
const routerText = readFileSync('worker/index.js', 'utf8');
check('visits record which doctor saw the patient',
  /INSERT INTO visits[\s\S]{0,400}practitioner_id/.test(repoText));
check('prescriptions record who wrote them',
  /INSERT INTO prescriptions[\s\S]{0,300}practitioner_id/.test(repoText));
check('and that comes from the session, never from the request body',
  /practitionerId: doctor\.actor\.userId/.test(routerText) &&
  !/practitionerId: *(visit|body|details)\./.test(routerText));

check('prescription detail names the practitioner who actually issued it',
  /COALESCE\(pr\.full_name, d\.full_name\) AS doctor_name/.test(repoText) &&
  /COALESCE\(pr\.registration_no, d\.registration_no\) AS registration_no/.test(repoText));

const patientViewText = readFileSync('worker/patientview.js', 'utf8');
check('the patient timeline names each treating practitioner, not only the owner',
  (patientViewText.match(/COALESCE\(pr\.full_name, d\.full_name\) AS doctor_name/g) || []).length >= 2);

check('/me exposes the signed-in practitioner identity needed to sign documents',
  routerText.includes('isPractitioner: !!doctor.actor.isPractitioner') &&
  routerText.includes('registrationNo: doctor.actor.registrationNo') &&
  routerText.includes('qualification: doctor.actor.qualification'));

/* --------------------------------------------------------------------- */

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
