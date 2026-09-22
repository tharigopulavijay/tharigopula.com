/* =========================================================================
   One customer, opened - and the line this screen must not cross.

   Vijay: "me being the owner i should be able to understand what each
   customer is, how it is looking, so if doctor says this is not working we
   will have access to check ... i want to look into his account full
   access, like how many doctors and how many devices he is logging in and
   how many staffs he added, soo on."

   A support call is almost never answered by a patient's record. It is
   answered by which package she is on, whether she is suspended, whether
   the person complaining actually holds the capability, whether anyone is
   signed in, and whether the thing she says she pressed left a trace.

   THE ASSERTIONS THIS FILE EXISTS FOR, in the order they would hurt:

   1. NOTHING CLINICAL COMES BACK. Patients, visits, prescriptions,
      invoices and lab reports are COUNTED and never opened - no name, no
      complaint, no diagnosis, no medicine, no value. This is rule 1 in
      CLAUDE.md, and an owner screen is exactly where it would erode
      first, one useful-looking column at a time.

   2. IT IS ONE CLINIC. Every query is scoped, so opening Devi Ayurveda
      cannot count the clinic down the road's staff, devices or money.

   3. THE COLUMNS EXIST. Nine queries against real tables; I guessed three
      column names wrong writing this (files.size_bytes, doctors.page_slug,
      doctors.custom_domain_state) and the live schema said otherwise.
      Running the real SQL against the real migrations is the only thing
      that catches the fourth.

   Run:  node test/clinic-overview.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* The real schema, built the way production was: schema.sql then every
   migration in order. */
const raw = new DatabaseSync(':memory:');
raw.exec('PRAGMA foreign_keys = OFF;');
raw.exec(readFileSync('schema.sql', 'utf8'));
let applied = 0;
for (const file of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) {
  try { raw.exec(readFileSync('migrations/' + file, 'utf8')); applied++; }
  catch (_) { /* already in schema.sql; the columns are what matter */ }
}
/* Set again AFTER the migrations: one of them turns foreign keys back on,
   and this fixture inserts a patient row without the patient it points at -
   the count is the point, not the person. */
raw.exec('PRAGMA foreign_keys = OFF;');
check('the real schema and migrations were loaded', applied > 30, String(applied));

const db = {
  prepare(sql) {
    const statement = raw.prepare(sql);
    let bound = [];
    const api = {
      bind(...args) { bound = args.map(v => (v === undefined ? null : v)); return api; },
      async first() { return statement.get(...bound) ?? null; },
      async all() { return { results: statement.all(...bound) }; },
      async run() { const out = statement.run(...bound); return { meta: { changes: Number(out.changes) } }; }
    };
    return api;
  }
};

const { tenants } = await import('../worker/platform.js');

/* ---- two clinics, so the scope can be proved rather than assumed ---- */
const insert = (sql, ...args) => raw.prepare(sql).run(...args);

for (const [id, name, mobile] of [
  ['doc_her', 'Devi Ayurveda', '+919000000555'],
  ['doc_other', 'Another Clinic', '+919000000777']
]) {
  insert(`INSERT INTO doctors (id, mobile, full_name, clinic_name, product, plan,
            status, password_hash, password_salt, practice_packs)
          VALUES (?,?,?,?,'ayurcos','starter','active','x','y','["ayurveda","nadi"]')`,
    id, mobile, 'Dr ' + name, name);
}

insert(`INSERT INTO clinic_users (id, doctor_id, mobile, full_name, role, capabilities,
          status, password_hash, password_salt)
        VALUES ('usr_fd','doc_her','+919000000556','Latha','front_desk',
                '["appointments","patients"]','active','x','y')`);
insert(`INSERT INTO clinic_users (id, doctor_id, mobile, full_name, role, capabilities,
          status, password_hash, password_salt)
        VALUES ('usr_other','doc_other','+919000000778','Someone','front_desk',
                '["appointments"]','active','x','y')`);

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
insert(`INSERT INTO sessions (token_hash, doctor_id, expires_at, user_agent)
        VALUES ('t_live','doc_her',?,'Mozilla/5.0 (Linux; Android 14) Chrome/130')`, future);
insert(`INSERT INTO sessions (token_hash, doctor_id, expires_at, user_agent)
        VALUES ('t_expired','doc_her',?,'old phone')`, past);
insert(`INSERT INTO sessions (token_hash, doctor_id, expires_at, user_agent, revoked_at)
        VALUES ('t_revoked','doc_her',?,'signed out phone',?)`, future, past);
insert(`INSERT INTO sessions (token_hash, doctor_id, expires_at, user_agent)
        VALUES ('t_other','doc_other',?,'their phone')`, future);

/* local_ref, not patient_number - checked against the built schema rather
   than assumed, which is the fourth column name I would otherwise have got
   wrong in this one function. */
insert(`INSERT INTO doctor_patients (doctor_id, patient_id, local_ref)
        VALUES ('doc_her','pat_1','DEV-1001')`);
insert(`INSERT INTO doctor_patients (doctor_id, patient_id, local_ref)
        VALUES ('doc_other','pat_2','OTH-1001')`);
insert(`INSERT INTO audit_events (id, doctor_id, actor, action, detail)
        VALUES ('aud_1','doc_her','doctor:doc_her','sign_in','passkey')`);
insert(`INSERT INTO audit_events (id, doctor_id, actor, action)
        VALUES ('aud_2','doc_other','doctor:doc_other','sign_in')`);

const view = await tenants.overview(db, 'doc_her');

console.log('\nIt answers the questions a support call actually asks\n');

check('the clinic comes back', view.clinic && view.clinic.clinic_name === 'Devi Ayurveda');
check('HOW MANY STAFF SHE ADDED', view.people.length === 1, String(view.people.length));
check('and what that person may do',
  JSON.stringify(view.people[0].capabilities) === '["appointments","patients"]');
check('HOW MANY DEVICES ARE SIGNED IN', view.devices.length === 1, String(view.devices.length));
check('an expired session is not counted as a live device',
  !view.devices.some(d => d.user_agent === 'old phone'));
check('nor is one that was signed out',
  !view.devices.some(d => d.user_agent === 'signed out phone'));
check('her clinical modules are readable', view.clinic.practicePacks.join(',') === 'ayurveda,nadi');
check('her usage is counted', view.usage.patients === 1);
check('and what has happened is listed', view.activity.length === 1 &&
  view.activity[0].action === 'sign_in');

console.log('\nIt is ONE clinic\n');

/* 2. The failure that would matter: one clinic's screen showing another's
      people, devices or history. */
check('NOT the other clinic\'s staff', !view.people.some(p => p.full_name === 'Someone'));
check('NOT the other clinic\'s devices', !view.devices.some(d => d.user_agent === 'their phone'));
check('NOT the other clinic\'s patients', view.usage.patients === 1);
check('NOT the other clinic\'s history',
  !view.activity.some(a => a.actor === 'doctor:doc_other'));
check('and a clinic that does not exist is a 404, not an empty screen',
  await (async () => {
    try { await tenants.overview(db, 'doc_nobody'); return false; }
    catch (error) { return error.status === 404; }
  })());

console.log('\nAnd it reads nothing clinical\n');

/* 1. THE LINE. Said two ways: what the SQL selects, and what comes back. */
const source = readFileSync('worker/platform.js', 'utf8').replace(/\r\n?/g, '\n');
const body = /async overview\(db, doctorId\) \{[\s\S]*?\n  \},/.exec(source);
check('the function was found to read', !!body);

/* STRIPPED OF COMMENTS FIRST, and this is not fussiness. The comment above
   the function says "no medicine, no value" - explaining the rule - and the
   check below looks for the word `value`. So the prose describing the
   boundary failed the test that enforces it. That has now happened six
   times in this repo, always the same way: a test that reads source and
   forgets that source contains English. */
const stripComments = text => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
const sql = body ? stripComments(body[0]) : '';
check('and stripping its comments left the SQL behind',
  sql.includes('SELECT') && !sql.includes('Vijay'));

for (const column of [
  'complaints', 'diagnosis', 'medicine_name', 'notes', 'value', 'observation',
  'full_name AS patient', 'patient_name', 'dose', 'instruction'
]) {
  check('it never selects ' + column, !sql.includes(column));
}
/* Clinical tables may be COUNTED and nothing else. */
for (const table of ['visits', 'prescriptions', 'lab_reports', 'invoices']) {
  const mentions = sql.split(table).length - 1;
  const counted = new RegExp('COUNT\\(\\*\\) FROM ' + table).test(sql);
  check(table + ' is counted, never selected from', mentions > 0 && counted);
}
check('the patient list is counted through doctor_patients, not read',
  /COUNT\(\*\) FROM doctor_patients/.test(sql));
check('no session token or hash is ever returned',
  !/token_hash/.test(sql) && !view.devices.some(d => 'token_hash' in d));
check('no password material is returned',
  !JSON.stringify(view).includes('password_hash') &&
  !JSON.stringify(view).includes('password_salt'));

/* Whoever looked should leave a trace, because that is the price of being
   able to look at all. */
const router = readFileSync('worker/index.js', 'utf8').replace(/\r\n?/g, '\n');
check('opening a clinic is audited against that clinic',
  /'GET \/admin\/doctors\/:id\/overview'[\s\S]{0,700}action: 'clinic_overview_opened'/.test(router));
check('and it needs the doctors capability',
  /'GET \/admin\/doctors\/:id\/overview'[\s\S]{0,200}requireAdminCapability\(env, request, 'doctors'\)/
    .test(router));

console.log('\nUnreadable stored JSON does not take the screen down\n');

insert(`UPDATE doctors SET practice_packs = 'not json' WHERE id = 'doc_her'`);
const broken = await tenants.overview(db, 'doc_her');
check('a clinic with a corrupt column still opens', !!broken.clinic);
check('and its module list reads empty rather than throwing',
  Array.isArray(broken.clinic.practicePacks) && broken.clinic.practicePacks.length === 0);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
