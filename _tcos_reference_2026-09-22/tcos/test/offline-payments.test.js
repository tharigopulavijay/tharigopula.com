/* =========================================================================
   Demo accounts, two-tier grace, and a payment that is a payment.

   Vijay, 19 Sep 2026:
     "if i select demo then it should be demo, all features of that package
      should be present without any payment related thing"
     "i should be able to check paid — it doesnot mean i check paid it is
      paid — should be through out: i select the payment date and save"
     "the things which are chargable to us lets give 3 days for that, and
      remaining all lets give 7 days which are not charging us"

   THE ASSERTIONS THIS FILE EXISTS FOR, in the order they would hurt:

   1. A DEMO IS NEVER DOWNGRADED. The worst outcome in this whole file is a
      demonstration clinic quietly dropping to Free on the morning he shows
      it to somebody.

   2. NULL IS NOT "EXPIRED". Every clinic that predates this column has no
      paid-until date. Reading that as a lapse takes the product away from
      everybody at once, silently, on the first nightly sweep.

   3. THE EXPENSIVE THINGS STOP FIRST, AND THREE DAYS EARLIER. A model call
      is money off our card every time; pharmacy is software that already
      exists. They must not expire together.

   4. PAYING EARLY MUST NOT COST HER DAYS. A doctor whose month runs to the
      30th who pays on the 25th keeps her five days.

   Run:  node test/offline-payments.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { featuresFor, planStanding, METERED, GRACE_DAYS } from '../worker/entitlements.js';
import { offlinePayments, addMonths, PRICE_PAISE, METHODS } from '../worker/offlinepayments.js';
import { subscriptions } from '../worker/subscriptions.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const DAY = 86400000;
const NOW = Date.parse('2026-09-19T12:00:00.000Z');
const onDay = n => new Date(NOW + n * DAY).toISOString().slice(0, 10);

/* --------------------------------------------------- the grace windows --- */
console.log('\nA demo account never meets any of this\n');

const demo = { plan: 'pro_plus', account_type: 'demo', plan_paid_until: onDay(-400) };
const demoFeatures = featuresFor(demo, NOW);
check('a demo has every feature of its package', demoFeatures.has('pharmacy') &&
  demoFeatures.has('multi_doctor') && demoFeatures.has('insights'));
check('INCLUDING the ones that cost us money', demoFeatures.has('ai_summary'));
check('a paid-until date 400 days in the past changes nothing',
  demoFeatures.has('pharmacy') && demoFeatures.has('ai_summary'));
check('and its standing says demo, not lapsed',
  planStanding(demo, NOW).state === 'demo', planStanding(demo, NOW).state);

console.log('\nNull is not expired — the clinics that predate this column\n');

const legacy = { plan: 'pro', plan_paid_until: null };
const legacyFeatures = featuresFor(legacy, NOW);
check('a clinic with no paid-until keeps its whole plan',
  legacyFeatures.has('pharmacy') && legacyFeatures.has('ai_summary') &&
  legacyFeatures.has('multi_doctor'));
check('and reports no clock running', planStanding(legacy, NOW).state === 'none');
check('an unreadable date is treated the same, not as a lapse',
  featuresFor({ plan: 'pro', plan_paid_until: 'not-a-date' }, NOW).has('pharmacy'));

console.log('\nInside the paid period, everything works\n');

const paid = { plan: 'pro', plan_paid_until: onDay(5) };
check('a clinic five days from expiry has everything',
  featuresFor(paid, NOW).has('ai_summary') && featuresFor(paid, NOW).has('pharmacy'));
check('and is told how long is left',
  planStanding(paid, NOW).state === 'paid' && planStanding(paid, NOW).daysLeft === 5,
  JSON.stringify(planStanding(paid, NOW)));

console.log('\nThe expensive things stop on day three, the rest on day seven\n');

check('the two windows are 3 and 7',
  GRACE_DAYS.metered === 3 && GRACE_DAYS.rest === 7);

const at = days => featuresFor({ plan: 'pro', plan_paid_until: onDay(-days) }, NOW);

/* Day 1-3: everything still works. A card that fails on a Friday must not
   take her pharmacy away before Monday. */
check('day 1 past due: everything still works',
  at(1).has('ai_summary') && at(1).has('pharmacy') && at(1).has('multi_doctor'));
check('day 3 past due: still everything', at(3).has('ai_summary') && at(3).has('pharmacy'));

/* Day 4-7: the metered things are gone, the rest survive. */
check('DAY 4: the model calls stop', !at(4).has('ai_summary') && !at(4).has('ai_lab_extract'));
check('day 4: but pharmacy, billing and reports keep working',
  at(4).has('pharmacy') && at(4).has('billing') && at(4).has('reports'));
check('day 4: and so do her staff logins and second doctor',
  at(4).has('staff_logins') && at(4).has('multi_doctor'));
check('day 7: still the same', !at(7).has('ai_summary') && at(7).has('pharmacy'));

/* Day 8: Free. */
check('DAY 8: she is on Free', !at(8).has('pharmacy') && !at(8).has('billing') &&
  !at(8).has('multi_doctor'));
check('but she can still see patients, book them and write prescriptions',
  at(8).has('patients') && at(8).has('appointments') && at(8).has('prescriptions') &&
  at(8).has('practice_packs'));

check('the standing names each window',
  planStanding({ plan: 'pro', plan_paid_until: onDay(-1) }, NOW).state === 'grace_full' &&
  planStanding({ plan: 'pro', plan_paid_until: onDay(-5) }, NOW).state === 'grace_reduced' &&
  planStanding({ plan: 'pro', plan_paid_until: onDay(-9) }, NOW).state === 'lapsed');

console.log('\nEvery metered feature is one that actually costs us money\n');

/* If something free crept into this set it would stop four days early for
   no reason; if something expensive were missing we would pay for it. */
for (const key of ['ai_lab_extract', 'ai_summary', 'insights', 'whatsapp']) {
  check(key + ' is metered', METERED.has(key));
}
for (const key of ['pharmacy', 'billing', 'reports', 'staff_logins', 'patients']) {
  check(key + ' is NOT metered — it costs us nothing per use', !METERED.has(key));
}

console.log('\nAn owner override survives a lapse, because that is its job\n');

/* "Her card is failing, keep her pharmacy on while we sort it out" has to
   be expressible, or the clock is the only voice in the room. */
const helped = featuresFor({
  plan: 'pro', plan_paid_until: onDay(-30),
  feature_overrides: JSON.stringify({ pharmacy: true })
}, NOW);
check('an explicit grant outlives the clock', helped.has('pharmacy'));
check('and does not drag the rest back with it', !helped.has('ai_summary'));

/* ------------------------------------------------ recording a payment --- */
console.log('\nA payment is a record, not a tick\n');

const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync('schema.sql', 'utf8'));
/* 038 creates subscriptions and subscription_payments; 060 adds the demo
   flag, the payment clock and the offline-payment columns.

   049 is NOT replayed here. It is the whole owner-console migration and it
   depends on tables from migrations in between, so running it would test
   the migration ORDER rather than this feature. The three columns from it
   that this code writes are added directly, and named, so a reader can see
   exactly what is being assumed to exist. */
raw.exec(readFileSync('migrations/038-subscriptions.sql', 'utf8'));
raw.exec(`ALTER TABLE doctors ADD COLUMN plan_source TEXT NOT NULL DEFAULT 'legacy';
          ALTER TABLE doctors ADD COLUMN plan_override_reason TEXT;
          ALTER TABLE doctors ADD COLUMN plan_updated_at TEXT;`);
raw.exec(readFileSync('migrations/060-demo-accounts-and-real-payments.sql', 'utf8'));
raw.exec(`INSERT INTO doctors (id, mobile, full_name, clinic_name, plan)
          VALUES ('doc_A','+919000000201','Dr A','Clinic A','basic'),
                 ('doc_D','+919000000202','Dr D','Demo Clinic','pro');`);
raw.exec(`UPDATE doctors SET account_type = 'demo' WHERE id = 'doc_D';`);

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

const doctorRow = id => raw.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
const refuses = async (fn, wanted) => {
  try { await fn(); return false; }
  catch (error) { return !wanted || String(error.message || '').includes(wanted); }
};

const good = {
  plan: 'pro', term: 'monthly', paidOn: '2026-09-15',
  method: 'upi', reference: 'UPI-4417-88231'
};

const recorded = await offlinePayments.record(db, doctorRow('doc_A'), good, 'platform:hello@x');
check('the clinic is moved onto the package', doctorRow('doc_A').plan === 'pro');
check('with an END DATE, which is the whole point',
  doctorRow('doc_A').plan_paid_until === '2026-10-15',
  doctorRow('doc_A').plan_paid_until);
check('and a note saying how the money arrived',
  /UPI/.test(doctorRow('doc_A').plan_note), doctorRow('doc_A').plan_note);
check('the source is a payment, not an override',
  doctorRow('doc_A').plan_source === 'manual_payment');
check('the expiry is said back to him, so a wrong term is catchable',
  /2026-10-15/.test(recorded.summary), recorded.summary);

const payment = raw.prepare(
  'SELECT * FROM subscription_payments WHERE doctor_id = ?').get('doc_A');
check('a real payment row exists', !!payment);
check('carrying the amount from the price list, not typed',
  payment.amount_paise === PRICE_PAISE.pro.monthly, String(payment.amount_paise));
check('the method', payment.method === 'upi');
check('the reference you can check against a bank statement',
  payment.reference === 'UPI-4417-88231');
check('who recorded it', /hello@x/.test(payment.recorded_by));
check('and what period it bought',
  payment.covers_from === '2026-09-15' && payment.covers_until === '2026-10-15');

const sub = raw.prepare('SELECT * FROM subscriptions WHERE doctor_id = ?').get('doc_A');
check('and a subscription the nightly sweep can see',
  sub && sub.provider === 'manual' && sub.access_until === '2026-10-15');

console.log('\nWhat it refuses, and why each refusal is worth having\n');

check('a payment with no reference is refused',
  await refuses(() => offlinePayments.record(db, doctorRow('doc_A'),
    { ...good, reference: '' }, 'x'), 'checked against the bank'));
check('unless it was cash, which has none',
  !(await refuses(() => offlinePayments.record(db, doctorRow('doc_A'),
    { ...good, method: 'cash', reference: '' }, 'x'))));
check('a future date is refused — nobody has paid yet',
  await refuses(() => offlinePayments.record(db, doctorRow('doc_A'),
    { ...good, paidOn: '2027-01-01' }, 'x'), 'future'));
check('an unknown package is refused',
  await refuses(() => offlinePayments.record(db, doctorRow('doc_A'),
    { ...good, plan: 'platinum' }, 'x')));
check('a missing term is refused', await refuses(() =>
  offlinePayments.record(db, doctorRow('doc_A'), { ...good, term: '' }, 'x')));
check('an unknown method is refused', await refuses(() =>
  offlinePayments.record(db, doctorRow('doc_A'), { ...good, method: 'barter' }, 'x')));

/* Recording revenue against a fictional clinic would put demo money into
   real reporting. */
check('a payment against a DEMO account is refused',
  await refuses(() => offlinePayments.record(db, doctorRow('doc_D'), good, 'x'), 'demo account'));

console.log('\nPaying early must not cost her days\n');

/* A payment can only be dated today or earlier - record() refuses the
   future, correctly - so this is built around the real today rather than a
   fixed date, or the suite would start failing on its own the moment the
   calendar moved past the literal in it. */
const today = new Date().toISOString().slice(0, 10);
const inTwelveDays = addMonths(today, 0);
const runsTo = (() => {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 12);
  return d.toISOString().slice(0, 10);
})();

/* She is paid up for another twelve days, and pays again today. */
raw.prepare('UPDATE doctors SET plan_paid_until = ? WHERE id = ?').run(runsTo, 'doc_A');
const early = await offlinePayments.record(db, doctorRow('doc_A'),
  { ...good, paidOn: today, reference: 'UPI-55512' }, 'x');

check('the new month is added to her EXISTING expiry, not to the payment date',
  doctorRow('doc_A').plan_paid_until === addMonths(runsTo, 1),
  doctorRow('doc_A').plan_paid_until + ' (wanted ' + addMonths(runsTo, 1) + ')');
check('so she keeps the twelve days she had left',
  doctorRow('doc_A').plan_paid_until > addMonths(today, 1),
  doctorRow('doc_A').plan_paid_until + ' vs ' + addMonths(today, 1));
check('and the payment says which period it bought',
  early.coversFrom === runsTo && early.coversUntil === addMonths(runsTo, 1),
  JSON.stringify([early.coversFrom, early.coversUntil]));

/* A doctor who has already LAPSED gets her month from the day she paid,
   not backdated to an expiry she let run out - otherwise paying late buys
   less than a month and she is charged for days she did not have. */
raw.prepare('UPDATE doctors SET plan_paid_until = ? WHERE id = ?').run('2026-01-01', 'doc_A');
await offlinePayments.record(db, doctorRow('doc_A'),
  { ...good, paidOn: today, reference: 'UPI-77790' }, 'x');
check('a lapsed clinic pays from today, not from the date it ran out',
  doctorRow('doc_A').plan_paid_until === addMonths(today, 1),
  doctorRow('doc_A').plan_paid_until);

check('every payment is in her history, none overwritten',
  (await offlinePayments.history(db, 'doc_A')).length === 4,
  String((await offlinePayments.history(db, 'doc_A')).length));
check('and there is still exactly ONE manual subscription for the clinic',
  raw.prepare("SELECT COUNT(*) n FROM subscriptions WHERE doctor_id='doc_A'").get().n === 1);

console.log('\nMonth arithmetic, the way a person reads a date\n');

check('31 Jan + 1 month is 28 Feb, not 3 March',
  addMonths('2026-01-31', 1) === '2026-02-28', addMonths('2026-01-31', 1));
check('31 Mar + 1 month is 30 Apr', addMonths('2026-03-31', 1) === '2026-04-30');
check('a year is a year', addMonths('2026-09-15', 12) === '2027-09-15');
check('29 Feb in a leap year + 1 year lands on 28 Feb',
  addMonths('2028-02-29', 12) === '2029-02-28', addMonths('2028-02-29', 12));

console.log('\nThe price shown is the price charged\n');

/* Two copies of the price list exist - the Worker records payments, the
   browser sells the plans. A doctor quoted one figure and charged another
   is the kind of mistake that ends a relationship. */
const plansSource = readFileSync('js/tcos-plans.js', 'utf8');
for (const [plan, prices] of Object.entries(PRICE_PAISE)) {
  const block = plansSource.slice(plansSource.indexOf("id: '" + plan + "'"));
  const monthly = /priceMonthly:\s*(\d+)/.exec(block);
  const yearly = /priceYearly:\s*(\d+)/.exec(block);
  check(plan + ': the Worker and the plan page agree',
    monthly && yearly &&
    Number(monthly[1]) * 100 === prices.monthly &&
    Number(yearly[1]) * 100 === prices.yearly,
    (monthly && monthly[1]) + '/' + (yearly && yearly[1]) + ' vs ' + JSON.stringify(prices));
}

console.log('\nThe nightly sweep moves a lapsed clinic to Free, and skips demos\n');

raw.exec(`UPDATE doctors SET plan = 'pro', plan_paid_until = '2026-01-01',
                             account_type = 'live', status = 'active' WHERE id = 'doc_A';`);
raw.exec(`UPDATE doctors SET plan = 'pro_plus', plan_paid_until = '2026-01-01',
                             account_type = 'demo', status = 'active' WHERE id = 'doc_D';`);

const swept = await subscriptions.sweepLapsedClocks(db, GRACE_DAYS.rest);
check('the live clinic is moved to Free', doctorRow('doc_A').plan === 'basic');
check('and told why, in words, with the date', /was pro until 2026-01-01/i
  .test(doctorRow('doc_A').plan_note || ''), doctorRow('doc_A').plan_note);
check('and that nothing was deleted', /nothing was deleted/i
  .test(doctorRow('doc_A').plan_note || ''));
check('its clock is cleared so it is not swept again',
  doctorRow('doc_A').plan_paid_until === null);

/* THE ONE THAT MATTERS MOST IN THIS FILE. */
check('THE DEMO IS UNTOUCHED, though its date is far older',
  doctorRow('doc_D').plan === 'pro_plus' && doctorRow('doc_D').account_type === 'demo');
check('exactly one clinic moved', swept.moved === 1, JSON.stringify(swept));

console.log('\nThe check can fail\n');

/* CONTROL. If featuresFor ignored the clock entirely, most of the grace
   assertions above would pass for the wrong reason. */
check('CONTROL: the clock really does remove things',
  featuresFor({ plan: 'pro', plan_paid_until: onDay(0) }, NOW).size >
  featuresFor({ plan: 'pro', plan_paid_until: onDay(-9) }, NOW).size);
check('CONTROL: and a demo really is exempt from that same clock',
  featuresFor({ plan: 'pro', plan_paid_until: onDay(-9), account_type: 'demo' }, NOW).size >
  featuresFor({ plan: 'pro', plan_paid_until: onDay(-9) }, NOW).size);
check('CONTROL: every method offered is one record() accepts',
  METHODS.every(m => typeof m === 'string' && m.length > 1));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
