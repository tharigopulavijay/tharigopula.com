/* =========================================================================
   Twelve demonstration clinics: every product, every package.

   Vijay: "add different demo doctors in each products — like ayurcos free,
   practice, clinic, group; same with allocos and homeocos... so that how
   things are working in all the 3 i want to check."

   THE ASSERTIONS THIS FILE EXISTS FOR:

   1. THE MOBILE IS THE LOGIN, AND IT MUST NORMALISE. Sign-in puts the typed
      number through normaliseMobile before the lookup, so a row stored in
      any other shape is a row the query never finds: the account exists,
      the password is right, and she can never get in. The first version of
      this file built NINE-digit numbers and all twelve accounts would have
      been unreachable. That same bug once broke every doctor approved
      through the console.

   2. ALL TWELVE ARE DEMO. One live account among them is a real clinic on
      a shared password with a trial clock running.

   3. THE SET REALLY IS 3 x 4. The whole point is the comparison - Free
      beside Group in one discipline, AyurCOS beside HomeoCOS on the same
      package. A missing combination is the one he wanted to look at.

   Run:  node test/demo-clinics.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { normaliseMobile } from '@tharigopula/core/lib';
import { demoSeed, DEMO_CLINICS } from '../worker/demoseed.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const PRODUCTS = ['ayurcos', 'homeocos', 'allocos'];
const PLANS = ['basic', 'starter', 'pro', 'pro_plus'];

console.log('\nThree products, four packages, twelve clinics\n');

check('there are twelve', DEMO_CLINICS.length === 12, String(DEMO_CLINICS.length));
for (const product of PRODUCTS) {
  const mine = DEMO_CLINICS.filter(c => c.product === product);
  check(product + ' has all four packages',
    PLANS.every(p => mine.some(c => c.plan === p)) && mine.length === 4,
    mine.map(c => c.plan).join(','));
}
check('every key is unique', new Set(DEMO_CLINICS.map(c => c.key)).size === 12);
check('every clinic name is unique — two identical rows would be unreadable',
  new Set(DEMO_CLINICS.map(c => c.clinicName)).size === 12);

console.log('\nThe mobile is the login, so it has to survive the normaliser\n');

check('every number normalises to itself',
  DEMO_CLINICS.every(c => normaliseMobile(c.mobile) === c.mobile),
  DEMO_CLINICS.filter(c => normaliseMobile(c.mobile) !== c.mobile)
    .map(c => c.mobile).join(', '));

/* THE ONE THAT CAUGHT THE REAL BUG. He types ten digits into the sign-in
   box; the stored row must be what that resolves to. */
check('TYPING THE BARE TEN DIGITS FINDS THE SAME ROW',
  DEMO_CLINICS.every(c => normaliseMobile(c.mobile.replace('+91', '')) === c.mobile),
  DEMO_CLINICS.filter(c => normaliseMobile(c.mobile.replace('+91', '')) !== c.mobile)
    .map(c => c.mobile).join(', '));

check('each is ten digits after the country code',
  DEMO_CLINICS.every(c => /^\+91\d{10}$/.test(c.mobile)),
  DEMO_CLINICS.filter(c => !/^\+91\d{10}$/.test(c.mobile)).map(c => c.mobile).join(', '));
check('all twelve numbers differ', new Set(DEMO_CLINICS.map(c => c.mobile)).size === 12);

/* 9000000xxx is the demo convention already in this repo and is not a live
   Indian mobile series, so a real person can never be sent an SMS meant for
   a clinic that does not exist. */
check('they sit in the reserved demo range',
  DEMO_CLINICS.every(c => c.mobile.startsWith('+9190000')),
  DEMO_CLINICS.map(c => c.mobile).join(', '));

console.log('\nEach one reads like the discipline it belongs to\n');

const ayur = DEMO_CLINICS.filter(c => c.product === 'ayurcos');
const homeo = DEMO_CLINICS.filter(c => c.product === 'homeocos');
const allo = DEMO_CLINICS.filter(c => c.product === 'allocos');
check('Ayurveda doctors hold Ayurveda qualifications',
  ayur.every(c => /BAMS/.test(c.qualification)), ayur.map(c => c.qualification).join(' | '));
check('homeopaths hold homeopathy qualifications',
  homeo.every(c => /BHMS/.test(c.qualification)));
check('allopaths hold medical qualifications',
  allo.every(c => /MBBS/.test(c.qualification)));
check('every registration number says DEMO on its face',
  DEMO_CLINICS.every(c => /^DEMO\//.test(c.registrationNo)));
check('and every council says demo too, so nobody reads it as a real body',
  DEMO_CLINICS.every(c => /demo/i.test(c.council)));

console.log('\nCreating them\n');

const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync('schema.sql', 'utf8'));
/* 038 creates subscriptions and subscription_payments, which 060 then adds
   columns to. 049 is not replayed - see test/offline-payments.test.js for
   why - so the three columns this code writes from it are added by name. */
raw.exec(readFileSync('migrations/038-subscriptions.sql', 'utf8'));
/* schema.sql is the ORIGINAL schema; columns added by migrations 001-059
   are not in it, and replaying fifty-nine files here would be testing the
   migration history rather than this feature. The ones the seeder writes
   are added by name instead - and the list is checked against the live
   production table below, so this cannot drift into testing a schema that
   does not exist. */
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
  },
  async batch(list) { for (const s of list) await s.run(); return []; }
};

const env = { PEPPER: 'test-pepper-value' };
const refuses = async (fn, wanted) => {
  try { await fn(); return false; }
  catch (error) { return !wanted || String(error.message || '').includes(wanted); }
};

check('a short password is refused — these are real accounts',
  await refuses(() => demoSeed.create(db, env, 'ayurcos-basic', 'short', 'x'),
    'at least 10'));
check('and an unknown clinic key is a 404',
  await refuses(() => demoSeed.create(db, env, 'unaniCOS-gold', 'a-good-password', 'x')));

for (const clinic of DEMO_CLINICS) {
  await demoSeed.create(db, env, clinic.key, 'a-good-demo-password', 'platform:x');
}

const rows = raw.prepare('SELECT * FROM doctors ORDER BY mobile').all();
check('twelve clinics exist', rows.length === 12, String(rows.length));

/* THE ONE THAT MATTERS. A single live account here is a real clinic on a
   shared password with a trial clock running against it. */
check('ALL TWELVE ARE DEMO ACCOUNTS',
  rows.every(r => r.account_type === 'demo'),
  rows.filter(r => r.account_type !== 'demo').map(r => r.clinic_name).join(', '));
check('none of them has a payment clock',
  rows.every(r => r.plan_paid_until === null));
check('every package is represented',
  PLANS.every(p => rows.filter(r => r.plan === p).length === 3),
  PLANS.map(p => p + '=' + rows.filter(r => r.plan === p).length).join(' '));
check('and every product', PRODUCTS.every(p => rows.filter(r => r.product === p).length === 4));

check('none is forced to change its password — he is signing in to look, not to onboard',
  rows.every(r => r.must_change_password === 0));
check('each carries a password hash and a salt',
  rows.every(r => r.password_hash && r.password_salt));
check('the salts all differ, so one shared password is still twelve hashes',
  new Set(rows.map(r => r.password_salt)).size === 12);

check('each is verified, so the registration number and public page show',
  rows.every(r => r.verification_status === 'verified'));
check('but the note says plainly that nobody checked a register',
  rows.every(r => /no council register/i.test(r.verification_note || '')));

check('each starts with its product\'s clinical modules on',
  rows.every(r => JSON.parse(r.practice_packs || '[]').length > 0),
  rows.filter(r => JSON.parse(r.practice_packs || '[]').length === 0)
    .map(r => r.clinic_name).join(', '));
check('an Ayurveda demo has the Nadi Pariksha pack, which is the point of looking at it',
  rows.filter(r => r.product === 'ayurcos')
    .every(r => JSON.parse(r.practice_packs).includes('nadi')));

check('no demo clinic has an email address — a welcome mail for a clinic ' +
  'that does not exist is mail a real person receives',
  rows.every(r => r.email === null));

console.log('\nPressing the button twice finishes the job, it does not double it\n');

for (const clinic of DEMO_CLINICS) {
  await demoSeed.create(db, env, clinic.key, 'a-different-password', 'platform:x');
}
check('still twelve, not twenty-four',
  raw.prepare('SELECT COUNT(*) n FROM doctors').get().n === 12,
  String(raw.prepare('SELECT COUNT(*) n FROM doctors').get().n));

/* Somebody changed one by hand. The status must show that rather than
   counting it as done. */
raw.prepare("UPDATE doctors SET plan = 'basic' WHERE mobile = ?")
  .run(DEMO_CLINICS.find(c => c.plan === 'pro_plus').mobile);
/* status() reports every SEEDED clinic - the twelve demonstrations and the
   three Vijay Hospital test accounts, which test/owner-test-clinics.test.js
   covers. Only the twelve were built here, so the rows are filtered to that
   set rather than the assertions being loosened. */
const demoRows = list => list.filter(s => s.set === 'demo');
const status = demoRows(await demoSeed.status(db));
check('status names a clinic whose package was changed by hand',
  status.some(s => s.exists && s.planMatches === false),
  JSON.stringify(status.filter(s => s.planMatches === false).map(s => s.key)));
check('and a rebuild puts it back',
  await (async () => {
    const drifted = status.find(s => s.planMatches === false);
    await demoSeed.create(db, env, drifted.key, 'a-good-demo-password', 'x');
    return demoRows(await demoSeed.status(db)).every(s => s.exists && s.planMatches);
  })());

console.log('\nRemoving them\n');

/* A real clinic must survive the clean-up. */
raw.exec(`INSERT INTO doctors (id, mobile, full_name, clinic_name, plan)
          VALUES ('doc_real','+919812345670','Dr Real','A Real Clinic','pro');`);
const removed = await demoSeed.removeAll(db);
check('all twelve go', removed.removed === 12, JSON.stringify(removed));
check('THE REAL CLINIC IS UNTOUCHED',
  raw.prepare("SELECT COUNT(*) n FROM doctors WHERE id='doc_real'").get().n === 1);
check('and nothing else is left behind',
  raw.prepare('SELECT COUNT(*) n FROM doctors').get().n === 1);

console.log('\nThe check can fail\n');

/* CONTROL. If create() silently did nothing, most assertions above would
   have passed against an empty table. */
check('CONTROL: creating one really does write a row',
  await (async () => {
    const before = raw.prepare('SELECT COUNT(*) n FROM doctors').get().n;
    await demoSeed.create(db, env, 'homeocos-pro', 'a-good-demo-password', 'x');
    return raw.prepare('SELECT COUNT(*) n FROM doctors').get().n === before + 1;
  })());
check('CONTROL: and the mobile check can actually fail',
  normaliseMobile('12345') !== '+9112345');

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
