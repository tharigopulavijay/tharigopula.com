/* =========================================================================
   The plans screen must not sell what does not exist.

   It was advertising WhatsApp reminders, voice prescriptions, an AI copilot,
   multi-step automation, white labelling and API access. None of those are
   built. A doctor who pays for Pro because of the WhatsApp line finds out at
   the point she needs it, which is the worst possible moment and the one
   conversation that ends a renewal.

   These assertions read the plan file and the router together, so a feature
   can only be listed once something in the product actually backs it.

   Run:  node test/plans.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const plans = readFileSync('js/tcos-plans.js', 'utf8');
const router = readFileSync('worker/index.js', 'utf8');
const migration = readFileSync('migrations/030-plans-from-market-research.sql', 'utf8');
const admin = readFileSync('admin.html', 'utf8');

/* Only what a PLAN offers counts. FEATURE_GROUPS above it is the catalogue
   of everything TCOS might one day have - it is allowed to be longer, and
   listing something there is not selling it. So the search is confined to
   the PLANS object, which is the part a doctor is shown and charged for. */
const plansBlock = plans.slice(
  plans.indexOf('const PLANS = {'),
  plans.indexOf('const PLAN_ORDER'));

if (plansBlock.length < 200) {
  console.log('  FAIL  could not find the PLANS object - the rest is meaningless');
  process.exit(1);
}

const sold = new Set();
for (const block of plansBlock.matchAll(/features:\s*\[([\s\S]*?)\]/g)) {
  for (const key of block[1].matchAll(/'([a-z_]+)'/g)) sold.add(key[1]);
}

/* ------------------------------------------------------- not yet built --- */
console.log('\nNothing is sold before it is built\n');

/* Each of these was on the plans screen and has no implementation. The right
   half is what would have to exist for the claim to be honest. */
const NOT_BUILT = {
  whatsapp: 'no provider, no templates, no send path - nothing counts a whatsapp_message',
  ai_voice_rx: 'no speech-to-text anywhere in the worker',
  ai_copilot: 'does not exist',
  automation_advanced: 'no rules engine',
  white_label: 'no per-clinic branding beyond the three products',
  api_access: 'no public API, no keys, no docs'
};
for (const [feature, why] of Object.entries(NOT_BUILT)) {
  check('"' + feature + '" is not offered on any plan', !sold.has(feature), why);
}

/* ----------------------------------------------------------- is built --- */
console.log('\nWhat is sold is actually there\n');

check('lab report reading is backed by a route',
  sold.has('ai_lab_extract') && /'POST \/ai\/read-report'/.test(router));
check('pharmacy is backed by a route',
  sold.has('pharmacy') && /'POST \/stock\/dispense'/.test(router));
check('billing is backed by a route',
  sold.has('billing') && /'POST \/invoices'/.test(router));
check('the patient portal is backed by a route',
  sold.has('patient_portal') && /'GET \/p\/:token'/.test(router));
check('the clinic web address is backed by a route',
  sold.has('website_connect') && /'POST \/me\/domain'/.test(router));
check('staff logins are backed by a route',
  sold.has('staff_logins') && /'POST \/team'/.test(router));

/* --------------------------------------------------------- the prices --- */
console.log('\nThe screen and the database agree on price\n');

/* A plans screen quoting one number while the meter enforces another is how
   a clinic is billed for something it was not offered. */
const uiPrice = id => {
  const block = plans.slice(plans.indexOf(id + ': {'));
  const m = block.match(/priceMonthly:\s*(\d+)/);
  return m ? Number(m[1]) : null;
};
const dbPaise = id => {
  const m = migration.match(new RegExp("\\('" + id + "',\\s*(\\d+)\\)"));
  return m ? Number(m[1]) : null;
};
for (const id of ['basic', 'starter', 'pro', 'pro_plus']) {
  check(id + ': screen and database quote the same price',
    uiPrice(id) * 100 === dbPaise(id),
    '₹' + uiPrice(id) + ' on screen vs ' + dbPaise(id) + ' paise in the plan table');
}

check('manual onboarding offers every current plan at the current price',
  admin.includes('value="starter">Practice — ₹899/mo') &&
  admin.includes('value="pro">Clinic — ₹2,199/mo') &&
  admin.includes('value="pro_plus">Group — ₹4,499/mo'));

/* ------------------------------------------------------------- the AI --- */
console.log('\nAI reading is included, not sold separately\n');

/* Adrine bundles an AI scribe at ₹999. Charging on top of a subscription for
   the same idea is above the market, and at ₹3 a report there is nothing
   worth metering - a doctor who weighs the price before uploading never
   forms the habit. */
const aiRuns = id => {
  const block = plans.slice(plans.indexOf(id + ': {'));
  const m = block.match(/aiRuns:\s*(\d+)/);
  return m ? Number(m[1]) : null;
};
check('the free plan includes none, which is what keeps it free',
  aiRuns('basic') === 0);
check('every PAID plan includes some',
  aiRuns('starter') > 0 && aiRuns('pro') > 0 && aiRuns('pro_plus') > 0,
  [aiRuns('starter'), aiRuns('pro'), aiRuns('pro_plus')].join(', '));
check('and the allowance grows with the plan',
  aiRuns('starter') < aiRuns('pro') && aiRuns('pro') < aiRuns('pro_plus'));

/* Included in the plan AND metered in the database must be the same number,
   or a doctor is cut off before the allowance she was sold. */
const dbIncluded = id => {
  const m = migration.match(new RegExp("\\('" + id + "','ai_documents',(\\d+)"));
  return m ? Number(m[1]) : null;
};
for (const id of ['starter', 'pro', 'pro_plus']) {
  check(id + ': the meter allows exactly what the screen promised',
    aiRuns(id) === dbIncluded(id),
    aiRuns(id) + ' promised vs ' + dbIncluded(id) + ' allowed');
}

/* ---------------------------------------------------------- the margin --- */
console.log('\nEvery paid plan makes money even if every reading is used\n');

/* About ₹3 a report on the batch route, measured on a real 24-page document
   rather than estimated. */
const COST_PER_READ = 3;
for (const id of ['starter', 'pro', 'pro_plus']) {
  const revenue = uiPrice(id);
  const aiCost = aiRuns(id) * COST_PER_READ;
  check(id + ': AI at FULL use stays under half the price',
    aiCost < revenue / 2,
    '₹' + aiCost + ' of AI against ₹' + revenue + ' -> ' +
    Math.round(100 - (aiCost / revenue * 100)) + '% margin');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
