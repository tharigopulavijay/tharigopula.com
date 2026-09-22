/* =========================================================================
   Three test hospitals, held at a paid package for good.

   Vijay: "i want 3 accounts in paid, as they are testing accounts, making
   vijay hospital 1,2,3 and enroll into all the 3 paid packages ... i want
   to check like each one what i am getting, so forcefully make this paid."

   THE ASSERTIONS THIS FILE EXISTS FOR, in the order they would hurt:

   1. "FORCEFULLY PAID" IS THE WHOLE POINT, AND IT IS NOT THE `plan`
      COLUMN. A row can say pro_plus and still be handed Free's features,
      because featuresFor() consults the payment clock afterwards. The
      thing that actually holds these three open is account_type='demo'.
      So the test does not check what the column says - it backdates the
      payment clock a year and asserts the features are STILL whole. If
      that exemption is ever removed, these accounts quietly drop to Free
      overnight and he finds out mid-demonstration.

   2. THREE PAID PACKAGES, NOT FOUR. Free is a package but it is not a
      paid one. Four rows here would mean one of the three he asked to
      compare is missing.

   3. HE HAS TO BE ABLE TO SIGN IN. The mobile IS the login and sign-in
      normalises what he types before the lookup, so a row stored in any
      other shape is a row the query never finds: account exists, password
      right, door shut. That bug has already shipped twice in this repo.

   4. THEY NEVER COLLIDE WITH THE TWELVE. A shared mobile would make one
      seeded clinic overwrite another on every build, and idempotency by
      mobile means it would do so silently.

   Run:  node test/owner-test-clinics.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { normaliseMobile } from '@tharigopula/core/lib';
import { demoSeed, DEMO_CLINICS, OWNER_TEST_CLINICS, SEEDED_CLINICS }
  from '../worker/demoseed.js';
import { featuresFor, planStanding, PLAN_FEATURES } from '../worker/entitlements.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const PAID = ['starter', 'pro', 'pro_plus'];

console.log('\nThree accounts, on the three paid packages\n');

check('there are three', OWNER_TEST_CLINICS.length === 3,
  String(OWNER_TEST_CLINICS.length));
check('they are Vijay Hospital 1, 2 and 3',
  OWNER_TEST_CLINICS.map(c => c.clinicName).join(' | ') ===
  'Vijay Hospital 1 | Vijay Hospital 2 | Vijay Hospital 3',
  OWNER_TEST_CLINICS.map(c => c.clinicName).join(' | '));

/* 2. Free is a package. It is not a PAID package. */
check('EVERY PAID PACKAGE IS THERE, AND FREE IS NOT',
  PAID.every(p => OWNER_TEST_CLINICS.some(c => c.plan === p)) &&
  !OWNER_TEST_CLINICS.some(c => c.plan === 'basic'),
  OWNER_TEST_CLINICS.map(c => c.plan).join(','));
check('one account per package, so the comparison is three-way',
  new Set(OWNER_TEST_CLINICS.map(c => c.plan)).size === 3);
check('they climb in order - Practice, Clinic, Group',
  OWNER_TEST_CLINICS.map(c => c.planWord).join(',') === 'Practice,Clinic,Group',
  OWNER_TEST_CLINICS.map(c => c.planWord).join(','));

/* All one product on purpose: the question is what the MONEY buys, and
   that comparison only holds with the discipline held still. */
check('all three are the same product, so only the package differs',
  new Set(OWNER_TEST_CLINICS.map(c => c.product)).size === 1,
  OWNER_TEST_CLINICS.map(c => c.product).join(','));

console.log('\nHe has to be able to sign in to them\n');

/* 3. The mobile is the login. */
check('every number normalises to itself',
  OWNER_TEST_CLINICS.every(c => normaliseMobile(c.mobile) === c.mobile),
  OWNER_TEST_CLINICS.map(c => c.mobile).join(', '));
check('TYPING THE BARE TEN DIGITS FINDS THE SAME ROW',
  OWNER_TEST_CLINICS.every(c => normaliseMobile(c.mobile.replace('+91', '')) === c.mobile),
  OWNER_TEST_CLINICS.map(c => c.mobile).join(', '));
check('each is ten digits after the country code',
  OWNER_TEST_CLINICS.every(c => /^\+91\d{10}$/.test(c.mobile)),
  OWNER_TEST_CLINICS.map(c => c.mobile).join(', '));
check('and they sit in the reserved range, so no real person is ever texted',
  OWNER_TEST_CLINICS.every(c => c.mobile.startsWith('+9190000')),
  OWNER_TEST_CLINICS.map(c => c.mobile).join(', '));

console.log('\nThey never collide with the twelve demonstrations\n');

/* 4. create() is idempotent BY MOBILE. A duplicate number does not error -
      it overwrites, every single build, silently. */
check('NO MOBILE IS SHARED WITH A DEMONSTRATION CLINIC',
  new Set(SEEDED_CLINICS.map(c => c.mobile)).size === SEEDED_CLINICS.length,
  String(SEEDED_CLINICS.length - new Set(SEEDED_CLINICS.map(c => c.mobile)).size) +
  ' duplicated');
check('no key is shared either',
  new Set(SEEDED_CLINICS.map(c => c.key)).size === SEEDED_CLINICS.length);
check('no clinic name is shared',
  new Set(SEEDED_CLINICS.map(c => c.clinicName)).size === SEEDED_CLINICS.length);
check('the twelve are untouched by this change',
  DEMO_CLINICS.length === 12 && SEEDED_CLINICS.length === 15,
  DEMO_CLINICS.length + ' + 3 = ' + SEEDED_CLINICS.length);
check('and each set says which it is, so a test account never reads as a demo',
  OWNER_TEST_CLINICS.every(c => c.setWord === 'Owner test') &&
  DEMO_CLINICS.every(c => c.setWord === 'Demonstration'));

console.log('\nCreating them\n');

/* The real schema, built the way test/demo-clinics.test.js builds it:
   schema.sql, then the columns migrations 001-059 added by name, then the
   two migrations this code actually writes into. */
const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync('schema.sql', 'utf8'));
raw.exec(readFileSync('migrations/038-subscriptions.sql', 'utf8'));
raw.exec(`ALTER TABLE doctors ADD COLUMN council TEXT;
          ALTER TABLE doctors ADD COLUMN product TEXT NOT NULL DEFAULT 'ayurcos';
          ALTER TABLE doctors ADD COLUMN plan_source TEXT NOT NULL DEFAULT 'legacy';
          ALTER TABLE doctors ADD COLUMN plan_override_reason TEXT;
          ALTER TABLE doctors ADD COLUMN plan_updated_at TEXT;
          ALTER TABLE doctors ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
          ALTER TABLE doctors ADD COLUMN verified_at TEXT;
          ALTER TABLE doctors ADD COLUMN verification_note TEXT;`);
raw.exec(readFileSync('migrations/060-demo-accounts-and-real-payments.sql', 'utf8'));

const db = {
  prepare(sql) {
    const stmt = raw.prepare(sql);
    return {
      bind(...args) {
        return {
          async first() { return stmt.get(...args) ?? null; },
          async all() { return { results: stmt.all(...args) }; },
          async run() { return stmt.run(...args); }
        };
      },
      async first() { return stmt.get() ?? null; },
      async all() { return { results: stmt.all() }; },
      async run() { return stmt.run(); }
    };
  }
};

const env = { PEPPER: 'test-pepper-value' };

for (const clinic of OWNER_TEST_CLINICS) {
  await demoSeed.create(db, env, clinic.key, 'a-good-test-password', 'platform:x');
}

const rows = raw.prepare(
  'SELECT * FROM doctors ORDER BY mobile').all();
check('three rows exist', rows.length === 3, String(rows.length));
check('each is on the package it was asked for',
  OWNER_TEST_CLINICS.every(c =>
    rows.find(r => r.mobile === c.mobile)?.plan === c.plan),
  rows.map(r => r.clinic_name + '=' + r.plan).join(' '));
check('each carries a password hash and a salt',
  rows.every(r => r.password_hash && r.password_salt));
check('the salts all differ, so one shared password is still three hashes',
  new Set(rows.map(r => r.password_salt)).size === 3);
check('none is forced to change its password at the door',
  rows.every(r => r.must_change_password === 0));
check('each is verified, so the registration number and public page show',
  rows.every(r => r.verification_status === 'verified'));
check('but the note says plainly that nobody checked a register',
  rows.every(r => /no council register/i.test(r.verification_note || '')));
check('and it says owner test, not demonstration',
  rows.every(r => /owner test/i.test(r.verification_note || '')),
  rows.map(r => r.verification_note).join(' | '));
check('the billing note names them as test accounts',
  rows.every(r => /owner test account/i.test(r.plan_note || '')),
  rows.map(r => r.plan_note).join(' | '));
check('each starts with its clinical modules on',
  rows.every(r => JSON.parse(r.practice_packs || '[]').length > 0));
check('no email address, so no welcome mail reaches a real inbox',
  rows.every(r => r.email === null));

console.log('\nForcefully paid, and that is not the plan column\n');

/* 1. THE ONE THIS FILE EXISTS FOR.
 *
   The exemption that holds these open is account_type='demo'. Assert the
   flag, then prove what it does by running the clock a year past them. */
check('all three are exempt from the payment clock', rows.every(r => r.account_type === 'demo'),
  rows.map(r => r.clinic_name + '=' + r.account_type).join(' '));
check('and none of them has a paid-until date to lapse',
  rows.every(r => r.plan_paid_until === null));

for (const row of rows) {
  const plan = row.plan;
  const whole = PLAN_FEATURES[plan];
  const got = featuresFor(row);
  check(row.clinic_name + ' gets every feature of ' + plan,
    whole.every(f => got.has(f)),
    whole.filter(f => !got.has(f)).join(', ') || 'none missing');
}

/* The package differences he is opening these three to look at. If two of
   them hand out the same set, there is nothing to compare. */
const byPlan = plan => featuresFor(rows.find(r => r.plan === plan));
check('Practice has billing but NOT multiple doctors',
  byPlan('starter').has('billing') && !byPlan('starter').has('multi_doctor'));
check('Clinic adds multiple doctors and the AI summary',
  byPlan('pro').has('multi_doctor') && byPlan('pro').has('ai_summary') &&
  !byPlan('pro').has('insights'));
check('Group adds insights, multiple locations and priority support',
  byPlan('pro_plus').has('insights') && byPlan('pro_plus').has('multi_location') &&
  byPlan('pro_plus').has('priority_support'));

/* AND THE PROOF. Backdate the clock a year. A live clinic this far past
   its date is on Free; these must not move. */
const aYearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
for (const row of rows) {
  const lapsed = { ...row, plan_paid_until: aYearAgo };
  const whole = PLAN_FEATURES[row.plan];
  check('A YEAR PAST ITS DATE, ' + row.clinic_name + ' STILL HAS EVERYTHING',
    whole.every(f => featuresFor(lapsed).has(f)),
    whole.filter(f => !featuresFor(lapsed).has(f)).join(', ') || 'none missing');
  check('and its standing reads demo, not expired',
    planStanding(lapsed).state === 'demo', planStanding(lapsed).state);
}

/* CONTROL. If featuresFor() had simply stopped enforcing the clock, every
   assertion above would pass against a broken gate. */
const realClinic = { plan: 'pro_plus', account_type: 'live', plan_paid_until: aYearAgo };
check('CONTROL: a LIVE clinic a year past its date is cut back to Free',
  !featuresFor(realClinic).has('insights') &&
  !featuresFor(realClinic).has('billing') &&
  featuresFor(realClinic).has('patients'),
  [...featuresFor(realClinic)].join(', '));

console.log('\nThe console can tell the two sets apart\n');

const status = await demoSeed.status(db);
check('status covers all fifteen', status.length === 15, String(status.length));
check('the three exist', status.filter(s => s.set === 'test' && s.exists).length === 3);
check('the twelve do not, because only three were built here',
  status.filter(s => s.set === 'demo').every(s => !s.exists));
check('each row says which set it belongs to',
  status.every(s => s.setWord === 'Demonstration' || s.setWord === 'Owner test'));
check('and each says whether its package drifted',
  status.filter(s => s.exists).every(s => s.planMatches === true));

console.log('\nBuilding twice finishes the job, it does not double it\n');

for (const clinic of OWNER_TEST_CLINICS) {
  await demoSeed.create(db, env, clinic.key, 'a-different-password', 'platform:x');
}
check('still three, not six',
  raw.prepare('SELECT COUNT(*) n FROM doctors').get().n === 3,
  String(raw.prepare('SELECT COUNT(*) n FROM doctors').get().n));
check('and a rebuild does not put them back on the payment clock',
  raw.prepare("SELECT COUNT(*) n FROM doctors WHERE account_type='demo' " +
    'AND plan_paid_until IS NULL').get().n === 3);

console.log('\nRemoving them takes the test hospitals too, by design\n');

/* The remove button says so on its face. What must NOT happen is a real
   clinic going with them. */
raw.exec(`INSERT INTO doctors (id, mobile, full_name, clinic_name, plan)
          VALUES ('doc_real','+919812345670','Dr Real','A Real Clinic','pro');`);
const removed = await demoSeed.removeAll(db);
check('all three go', removed.removed === 3, JSON.stringify(removed));
check('THE REAL CLINIC IS UNTOUCHED',
  raw.prepare("SELECT COUNT(*) n FROM doctors WHERE id='doc_real'").get().n === 1);

console.log('\nThe check can fail\n');

check('CONTROL: creating one really does write a row',
  await (async () => {
    const before = raw.prepare('SELECT COUNT(*) n FROM doctors').get().n;
    await demoSeed.create(db, env, 'test-vijay-2', 'a-good-test-password', 'x');
    return raw.prepare('SELECT COUNT(*) n FROM doctors').get().n === before + 1;
  })());
check('CONTROL: an unknown key is a 404 rather than a silent no-op',
  await (async () => {
    try { await demoSeed.create(db, env, 'test-vijay-9', 'a-good-test-password', 'x'); return false; }
    catch (error) { return error.status === 404; }
  })());
check('CONTROL: a short password is refused — these are real accounts',
  await (async () => {
    try { await demoSeed.create(db, env, 'test-vijay-1', 'short', 'x'); return false; }
    catch (error) { return /at least 10/.test(error.message); }
  })());

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
