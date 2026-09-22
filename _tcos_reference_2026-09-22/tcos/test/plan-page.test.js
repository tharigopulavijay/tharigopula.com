/* =========================================================================
   The plans page cannot promise what the software refuses.

   This has already gone wrong here once. The page said "Unlimited doctors
   and staff" while migration 030 stopped at twenty-five doctors and fifty
   staff, so the software would have refused a seat at the counter, in front
   of a group that had already paid. js/tcos-plans.js carries the note.

   The plans screen now prints those numbers on the card a doctor is looking
   at when she decides to spend ₹2,199 a month. So the three places that
   describe a plan have to agree, and agreeing by hand is not a plan:

     migration 030  what the software ENFORCES - seats, patients, storage,
                    document reads. The only one that can refuse anybody.
     migration 038  what Razorpay CHARGES.
     tcos-plans.js  what the page SAYS.

   Nothing here needs a network or a browser: all three are files in the
   repo, and a mismatch between them is a lie we would ship.

   Run:  node test/plan-page.test.js
   ========================================================================= */

import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* ------------------------------------------- what the page says it is --- */

/* tcos-plans.js is a browser IIFE that hangs itself off window. Running it
   with a stub window is how the test reads the REAL object rather than a
   copy of it that can drift. */
const win = {};
new Function('window', readFileSync('js/tcos-plans.js', 'utf8'))(win);
const P = win.TCOSPlans;

check('the plan catalogue loads', !!P && !!P.PLANS);

/* --------------------------------------- what the software enforces ----- */

/* Replayed through real SQLite rather than read out of one file with a
   regex. A later migration can change a limit - 055 stopped metering
   patients - and a test that only read 030 would be comparing the page
   against a number the database no longer holds. What matters is the value
   the software ends up enforcing, so this computes exactly that. */
const LIMIT_MIGRATIONS = [
  /* 030 writes prices as well as limits, so the table it writes into has to
     exist even though nothing here reads it. */
  'migrations/019-cost-tracking.sql',
  'migrations/020-plan-limits.sql',
  'migrations/030-plans-from-market-research.sql',
  'migrations/055-patients-are-not-metered.sql'
];

const sqlite = new DatabaseSync(':memory:');
/* The base schema first: these migrations reference tables it already
   creates, and chasing each dependency by hand is how the list goes stale. */
sqlite.exec(readFileSync('schema.sql', 'utf8'));
for (const file of LIMIT_MIGRATIONS) {
  sqlite.exec(readFileSync(file, 'utf8')
    .split('\n').filter(line => !line.trim().startsWith('--')).join('\n'));
}
const enforced = {};
for (const row of sqlite.prepare(
  'SELECT plan, limit_key, included FROM plan_limits').all()) {
  (enforced[row.plan] ||= {})[row.limit_key] = row.included;
}
check('the enforced limits were replayed from the migrations',
  Object.keys(enforced).length >= 4, Object.keys(enforced).join(', '));

/* Every migration that touches plan_limits has to be in the list above, or
   this compares the page against a stale ceiling and passes while lying. */
const touching = readdirSync('migrations')
  .filter(name => name.endsWith('.sql'))
  .filter(name => /plan_limits/.test(readFileSync('migrations/' + name, 'utf8')))
  .map(name => 'migrations/' + name);
const missed = touching.filter(file => !LIMIT_MIGRATIONS.includes(file));
check('every migration that changes a plan limit is replayed here',
  missed.length === 0, 'not replayed: ' + missed.join(', '));

/* ----------------------------------------- what Razorpay will charge ---- */

/* migration 038: ('rzp_starter_monthly_v1','razorpay','starter','monthly',89900,'INR',1) */
const charged = {};
for (const [, plan, cadence, paise] of
     readFileSync('migrations/038-subscriptions.sql', 'utf8')
       .matchAll(/\('rzp_[a-z_0-9]+'\s*,\s*'razorpay'\s*,\s*'([a-z_]+)'\s*,\s*'([a-z]+)'\s*,\s*(\d+)/g)) {
  (charged[plan] ||= {})[cadence] = Number(paise);
}
check('the charged prices were read from migration 038',
  Object.keys(charged).length === 3, Object.keys(charged).join(', '));

/* ---------------------------------------------------- do they agree? --- */

console.log('\nWhat the card says vs what the software does\n');

const LIMIT_MAP = [
  ['activePatients', 'patients'],
  ['storageMb', 'storage_mb'],
  ['aiRuns', 'ai_documents'],
  ['doctors', 'doctors'],
  ['staff', 'staff']
];

/* "Not metered" is written two ways and both are deliberate: the database
   holds -1, because the column is an integer and a sentinel there keeps the
   arithmetic honest; the page holds null, because every screen that prints
   a limit would otherwise have to know the sentinel, and the first one to
   forget prints "-1" at a doctor. So this compares MEANING, not spelling. */
const notMetered = value => value == null || value < 0;

for (const id of P.PLAN_ORDER) {
  const plan = P.PLANS[id];
  if (!plan) continue;
  for (const [onCard, inDatabase] of LIMIT_MAP) {
    const said = plan.limits[onCard];
    const does = enforced[id] && enforced[id][inDatabase];
    const agree = notMetered(said) && notMetered(does)
      ? true
      : said === does;
    check(id + ': the card\'s ' + onCard + ' matches what the software allows',
      agree, 'card says ' + said + ', the database enforces ' + does);
  }
}

/* And the two must not disagree about WHICH lines are metered. A card
   saying unlimited over a database that still counts is the failure this
   whole file exists for, and `notMetered` on both sides would hide it if
   only one of them had been changed. */
for (const id of P.PLAN_ORDER) {
  for (const [onCard, inDatabase] of LIMIT_MAP) {
    const said = P.PLANS[id].limits[onCard];
    const does = enforced[id] && enforced[id][inDatabase];
    check(id + ': ' + onCard + ' is metered in both places, or neither',
      notMetered(said) === notMetered(does),
      'card ' + (notMetered(said) ? 'says unlimited' : 'says ' + said) +
      ', database ' + (notMetered(does) ? 'does not meter it' : 'enforces ' + does));
  }
}

console.log('');

for (const id of ['starter', 'pro', 'pro_plus']) {
  const plan = P.PLANS[id];
  check(id + ': the monthly price on the card is the price Razorpay charges',
    plan.priceMonthly * 100 === charged[id].monthly,
    'card ₹' + plan.priceMonthly + ', catalogue ' + charged[id].monthly + ' paise');
  check(id + ': and the yearly one',
    plan.priceYearly * 100 === charged[id].yearly,
    'card ₹' + plan.priceYearly + ', catalogue ' + charged[id].yearly + ' paise');
}

/* The free plan is not in the payment catalogue, because it is not
   something anybody buys. The card must not invent a price for it. */
check('Free is not in the payment catalogue and costs nothing on the card',
  !charged.basic && P.PLANS.basic.priceMonthly === 0 && P.PLANS.basic.priceYearly === 0);

/* ------------------------------------------ only real features listed --- */

console.log('');

/* Every key a plan claims must exist in the feature catalogue, or the card
   renders the raw key - "ai_voice_rx" - at a doctor. */
const known = new Set(P.ALL_FEATURES.map(f => f.key));
const unknown = [];
for (const id of P.PLAN_ORDER) {
  for (const key of P.PLANS[id].features || []) {
    if (!known.has(key)) unknown.push(id + ':' + key);
  }
}
check('every feature a plan claims exists in the catalogue',
  unknown.length === 0, unknown.join(', '));

/* These six were being sold on this screen and none of them were built.
   They come back when they are real, and not before - which is a rule that
   only means anything if something checks. */
const NOT_BUILT = ['whatsapp', 'ai_voice_rx', 'ai_copilot',
  'automation_advanced', 'white_label', 'api_access'];
const sold = [];
for (const id of P.PLAN_ORDER) {
  for (const key of P.PLANS[id].features || []) {
    if (NOT_BUILT.includes(key)) sold.push(id + ':' + key);
  }
}
check('no plan sells a feature that has not been built',
  sold.length === 0, sold.join(', '));

/* ------------------------------------------------ the page uses them --- */

const page = readFileSync('js/subscription.js', 'utf8');
check('the plans screen reads the catalogue rather than its own copy',
  /window\.TCOSPlans/.test(page) && /FEATURE_LABEL/.test(page));
check('and takes the price from the API, not from the catalogue',
  /priceRow\s*\?\s*priceRow\.price_paise/.test(page),
  'the price shown must be the one Razorpay will charge');
/* Zero customers means a popularity badge would be an invented claim, on
   the one screen where somebody is deciding whether to trust us with money. */
check('no invented popularity claim on the cards',
  !/popular/i.test(page) && !/most (practices|doctors|clinics)/i.test(page));

/* -------------------------------------------- bigger than Group -------- */

console.log('');

const contact = P.CONTACT_PLAN;
check('there is a card for practices bigger than Group', !!contact && !!contact.name);

/* It must stay OUT of the plan machinery. Entitlements, trials and the
   admin console all walk PLANS and PLAN_ORDER, and a plan nobody can be on
   would be a special case in every one of them. */
check('the enterprise card is not a plan anybody can be put on',
  !P.PLANS[contact.id] && !P.PLAN_ORDER.includes(contact.id),
  'it leaked into PLANS or PLAN_ORDER');
check('and it carries no price, because there is nothing to charge',
  contact.priceMonthly === undefined && contact.priceYearly === undefined);
check('and it is marked as contact-only', contact.contactOnly === true);

/* It may not claim a capability the software does not have. What it
   actually offers is a negotiable ceiling, which is true - the console can
   raise any single limit for one clinic. */
const claimed = (contact.points || []).join(' ').toLowerCase();
check('the enterprise card claims no unbuilt feature',
  !NOT_BUILT.some(key => claimed.includes(key.replace(/_/g, ' '))) &&
  !/whatsapp|api access|white label|voice/i.test(claimed), claimed);
check('and does not promise anything unlimited',
  !/unlimited/i.test(claimed + ' ' + (contact.pitch || '') + ' ' + (contact.scope || '')),
  'the software has a ceiling on every limit; "unlimited" has burned this page before');

/* "Talk to us" has to go somewhere a person reads. There has been a
   mailto: on this product before, sitting beside a button that created
   accounts, and it went nowhere anybody tracked. */
const html = readFileSync('subscription.html', 'utf8');
/* An actual link or navigation, not the word - which appears in both files
   in a comment explaining why there is no mailto here. A check that fires
   on its own explanation is a check nobody will keep. */
const realMailto = /href\s*=\s*["']mailto:|location\.(href|assign)\s*=\s*["']mailto:/;
check('the enquiry raises a real support request rather than a mailto',
  /createSupportRequest/.test(page) && !realMailto.test(page + html));
check('and the enquiry form exists on the page',
  /id="enquiryDialog"/.test(html) && /id="enquiryForm"/.test(html));

/* ------------------------- the screen must not contradict itself -------- */

console.log('');

/* Vijay, looking at his own account: "current subscription on top is
   Practice but choose a plan shows Free ... this customer is already on a
   plan, we need to be consistent."

   Both halves were reading different things. The panel read the SUBSCRIPTION
   row - which named a yearly Practice he had started and never paid for -
   and the cards read planStatus, which is what the Worker actually enforces.
   The cards were right. The panel was the reassuring one, and it was wrong:
   it also said "Renews automatically" about a payment that had never
   happened. */
/* Comments stripped. Several of these ask "does the code still do X", and
   the comments in that file explain at length the bugs where it did not -
   so the prose would answer for the code. A check that fires on its own
   explanation is a check nobody keeps. */
const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const worker = readFileSync('worker/subscriptions.js', 'utf8');

check('the current plan comes from what the Worker enforces, not the subscription row',
  /planStatus && me\.planStatus\.plan/.test(code) && !/me\.plan\b(?!Status)/.test(code),
  'reading the subscription row for entitlement is how the screen lied');
check('a started-but-unpaid subscription is described as unpaid',
  /unpaid\s*=\s*\(\)\s*=>/.test(page) &&
  /\['created', 'authenticated'\]/.test(page));
check('and never claims it renews automatically',
  /unpaid\(\)[\s\S]{0,400}?Renews automatically/.test(page) === false ||
  /unpaid\(\)\s*\?[\s\S]{0,300}until this payment succeeds/.test(page));
check('it says plainly that nothing has been charged',
  /nothing has been charged/i.test(page));

/* AN UNPAID CHECKOUT MUST NOT BLOCK AN UPGRADE.

   He clicked Choose Clinic, then Choose Group, and got the same refusal
   each time. The first fix disabled those buttons, which was worse - it
   made a server limitation into a product rule. Vijay: "people not paying
   does not mean they are not paying, they may upgrade - why are you not
   giving that choice?"

   Somebody who opened a ₹899 checkout and came back wanting Clinic is the
   best thing that happens on this screen. The server now drops the unpaid
   one and opens the new one. */
check('an unfinished payment never disables another plan',
  !/const blocked/.test(code) && !/Finish or cancel the payment/.test(code),
  'a Choose button was made unclickable because of a pending checkout');
check('and the one she started still offers to finish it',
  /pending[\s\S]{0,300}Finish payment/.test(code));
check('the server drops an unpaid subscription rather than refusing the new one',
  /UNPAID\.has\(existing\.status\)[\s\S]{0,80}abandon\(/.test(worker),
  'start() must abandon an unpaid subscription, not throw');
check('but a PAID one is not silently replaced',
  /Stop the renewal first/.test(worker),
  'changing plan mid-paid-period is a proration question, not a second checkout');
check('abandoning cancels at the provider immediately, since nothing was paid',
  /async function abandon[\s\S]{0,400}cancel_at_cycle_end: false/.test(worker));
check('and still proceeds if the provider will not cancel it',
  /subscription_abandon_provider_failed/.test(worker),
  'a provider hiccup must not leave her unable to buy anything');
/* Cancelling used to be offered only on an ACTIVE subscription, so a doctor
   who picked the wrong plan could neither finish nor drop it. */
check('an unpaid subscription can be cancelled so she can choose again',
  /unpaid\(\)[\s\S]{0,200}Cancel and choose a different plan/.test(page));

/* And the server has to agree: ending an unstarted cycle is a request
   Razorpay refuses, which is what left him stuck. */
check('the server cancels immediately when nothing was ever paid',
  /cancel_at_cycle_end:\s*started/.test(worker) &&
  /const started = ACTIVE\.has\(local\.status\)/.test(worker));

/* One name per plan. There were three hardcoded maps; practice.html's copy
   called the ₹4,499 plan "Practice", which is the ₹899 plan's name. */
check('plan names come from the catalogue, not a second hardcoded map',
  !/starter:\s*'Practice'/.test(page) &&
  !/starter:\s*'Practice'/.test(readFileSync('practice.html', 'utf8')));

/* CONTROL: the comparisons above must be capable of failing. If either
   migration had been read as an empty set, every assertion would have
   compared undefined with undefined and passed. */
check('CONTROL: the enforced limits are real numbers, not an empty read',
  enforced.pro_plus && enforced.pro_plus.doctors === 25,
  JSON.stringify(enforced.pro_plus));
check('CONTROL: the charged prices are real numbers, not an empty read',
  charged.pro && charged.pro.monthly === 219900, JSON.stringify(charged.pro));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
