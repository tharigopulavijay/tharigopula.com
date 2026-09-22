/* =========================================================================
   What a plan actually lets a clinic do.

   Until 12 September 2026 the answer was "everything". The plan controlled
   doctor seats, staff seats, AI reads and storage, and not one feature - so
   a clinic on Free had the full pharmacy, the whole billing module, lab
   reports and the patient portal.

   Vijay, looking at his own account: "Vijay Hospital is on Free, why is she
   getting all the options?"

   That made the plans screen a lie in the expensive direction. It told a
   doctor ₹899 would add pharmacy, billing and reports when she already had
   all three.

   Three things this holds in place:

     1. The WRITE routes are gated and the READ routes are not. A clinic
        that drops to Free keeps reading everything it entered.
     2. The server's feature map and the browser's stay identical. They are
        duplicated on purpose - the browser cannot be trusted with a
        permission, the Worker cannot run a browser IIFE - and duplication
        that nothing checks is duplication that rots.
     3. The gate runs BEFORE the handler does any work, like every other
        gate in the router.

   Run:  node test/entitlements.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';
import { PLAN_FEATURES, featuresFor, hasFeature, requireFeature, ADDONS }
  from '../worker/entitlements.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nThe plan decides what a clinic can add\n');

/* ------------------------------------- the two maps must not diverge --- */

const win = {};
new Function('window', readFileSync('js/tcos-plans.js', 'utf8'))(win);
const browser = win.TCOSPlans.PLANS;

for (const id of ['basic', 'starter', 'pro', 'pro_plus']) {
  const onServer = [...PLAN_FEATURES[id]].sort().join(',');
  const onClient = [...browser[id].features].sort().join(',');
  check(id + ': the Worker and the browser agree on what the plan includes',
    onServer === onClient,
    'server: ' + onServer + '  |  browser: ' + onClient);
}

/* ------------------------------------------------- what Free is not --- */

const free = { plan: 'basic' };
for (const key of ['pharmacy', 'billing', 'lab_reports', 'patient_portal']) {
  check('Free does not include ' + key, !hasFeature(free, key));
}
for (const key of ['patients', 'appointments', 'prescriptions', 'practice_packs']) {
  check('but Free does include ' + key + ', or it is not a clinical record',
    hasFeature(free, key));
}
check('Practice includes the pharmacy', hasFeature({ plan: 'starter' }, 'pharmacy'));
check('Practice does not include multiple branches',
  !hasFeature({ plan: 'starter' }, 'multi_location'));
check('Group does', hasFeature({ plan: 'pro_plus' }, 'multi_location'));

/* An unknown plan must fall back to the SMALLEST set. A typo in a plan name
   handing out the whole product is the wrong way to fail. */
check('an unknown plan falls back to Free, not to everything',
  !hasFeature({ plan: 'not_a_plan' }, 'pharmacy') &&
  hasFeature({ plan: 'not_a_plan' }, 'patients'));
check('and so does a doctor with no plan at all',
  !hasFeature({}, 'billing'));

/* ------------------------------- the one capability that costs money --- */

/* Every other feature here is software: switching it on for one more doctor
   costs nothing. A doctor's own domain is billed by Cloudflare per custom
   hostname - two of them for an apex, and billed from creation even while
   pending - so it must never ride on a plan.

   Vijay: "the switch of toggle at my owner login page where it actually
   cost so we cant give to all". */
for (const plan of ['basic', 'starter', 'pro', 'pro_plus', 'clinic']) {
  check(plan + ' does NOT include custom_domain - no plan may',
    !hasFeature({ plan }, 'custom_domain'),
    'putting this on a plan puts every clinic on our Cloudflare bill');
}
check('but the owner can grant it to one clinic',
  hasFeature({ plan: 'basic', feature_overrides: '{"custom_domain":true}' }, 'custom_domain'));

/* The refusal must not say "move up a plan" for something no plan carries.
   A doctor who buys Group to get her domain, and finds it still refused,
   has been taken for money under a false statement. */
let addonRefusal = null;
try { requireFeature({ plan: 'pro_plus' }, 'custom_domain'); }
catch (error) { addonRefusal = error; }
check('the refusal does NOT tell her to upgrade',
  addonRefusal && !/move up a plan/i.test(addonRefusal.message),
  addonRefusal && addonRefusal.message);
check('it names the price', addonRefusal && /₹50 a month/.test(addonRefusal.message));
check('it says to ask us', addonRefusal && /ask us to switch it on/i.test(addonRefusal.message));
check('it reassures her the free address keeps working',
  addonRefusal && /free TCOS web address keeps working/i.test(addonRefusal.message));
check('and it is a distinct code, so the client can offer the right button',
  addonRefusal && addonRefusal.code === 'plan_addon', addonRefusal && addonRefusal.code);

/* The price is stated in three places - server refusal, feature catalogue,
   and the doctor's screen. They must agree or she is quoted two numbers. */
const addonCatalogue = win.TCOSPlans.addon('custom_domain');
check('the catalogue and the server agree on the price',
  addonCatalogue && addonCatalogue.pricePaise === ADDONS.custom_domain.pricePaise,
  String(addonCatalogue && addonCatalogue.pricePaise) + ' vs ' +
  ADDONS.custom_domain.pricePaise);
check('and it is integer paise, like all money here',
  Number.isInteger(ADDONS.custom_domain.pricePaise));
check('the catalogue price renders as ₹50/month',
  win.TCOSPlans.formatAddon('custom_domain') === '₹50/month',
  win.TCOSPlans.formatAddon('custom_domain'));

/* ------------------------------------------- a preset, not a lock ------ */

check('the platform can switch one capability on for one clinic',
  hasFeature({ plan: 'basic', feature_overrides: '{"pharmacy":true}' }, 'pharmacy'));
check('and off again',
  !hasFeature({ plan: 'pro_plus', feature_overrides: '{"pharmacy":false}' }, 'pharmacy'));
check('unreadable overrides fall back to the plan rather than throwing',
  hasFeature({ plan: 'starter', feature_overrides: 'not json' }, 'pharmacy'));

/* ------------------------------------------------- what it refuses ----- */

let refused = null;
try { requireFeature(free, 'pharmacy'); } catch (error) { refused = error; }
check('a write to a feature the plan lacks is refused', !!refused);
check('with 402, not 403 - this is "not on your plan", not "not allowed"',
  refused && refused.status === 402, refused && String(refused.status));
check('and the message says the records are still readable',
  refused && /stays available to read/i.test(refused.message), refused && refused.message);
check('a write she IS entitled to passes straight through',
  (() => { try { requireFeature({ plan: 'starter' }, 'pharmacy'); return true; }
           catch (_) { return false; } })());

/* ------------------------------ writes gated, reads deliberately not --- */

console.log('');

const router = readFileSync('worker/index.js', 'utf8');

/* Every one of these takes money or adds a record. */
const MUST_GATE = [
  ['POST /stock/items', 'pharmacy'],
  ['POST /stock/batches', 'pharmacy'],
  ['POST /stock/dispense', 'pharmacy'],
  ['POST /invoices', 'billing'],
  ['POST /invoices/:id/issue', 'billing'],
  ['POST /invoices/:id/payments', 'billing'],
  ['POST /lab-reports', 'lab_reports'],
  ['POST /patients/:id/share', 'patient_portal'],
  /* The route that spends real money. Ungated until 12 Sep 2026, so any
     doctor on Free could have put two billed hostnames on our account. */
  ['POST /me/domain', 'custom_domain']
];

for (const [route, feature] of MUST_GATE) {
  const at = router.indexOf("  '" + route + "':");
  const body = at < 0 ? '' : router.slice(at, at + 700);
  const gateAt = body.indexOf("requireFeature(doctor, '" + feature + "')");
  check(route + ' is gated on ' + feature, gateAt > 0, at < 0 ? 'route missing' : 'no gate');
  /* Before the handler does any work, like every other gate in this router.
     A check after the write has already happened is decoration. */
  const firstAwaitBody = body.indexOf('await body(request)');
  check('  and the gate runs before it reads the request',
    gateAt > 0 && (firstAwaitBody < 0 || gateAt < firstAwaitBody));
}

/* READS MUST STAY OPEN. This is the whole downgrade promise: a clinic that
   drops to Free can still see the stock it bought and the invoices it
   raised. Gating one of these would be taking a doctor's own records away
   from her. */
console.log('');
const MUST_NOT_GATE = ['GET /stock', 'GET /invoices',
  'GET /lab-reports/:id', 'GET /patients/:id/lab-series'];
for (const route of MUST_NOT_GATE) {
  const at = router.indexOf("  '" + route + "':");
  const body = at < 0 ? '' : router.slice(at, at + 500);
  check(route + ' is NOT gated - a downgrade never hides her own records',
    at >= 0 && !/requireFeature\(/.test(body), at < 0 ? 'route missing' : 'it is gated');
}

/* ------------------------------ and the screen says so, on the screen --- */

/* Vijay: "show all the tabs, but it should be functional if they are on the
   package. If they are not, grey out so they will know what they are
   missing - or clicking, 'you don't have access, you need to upgrade'."

   Marking the nav tells her something is off. It does not tell her WHAT she
   is missing or what to do, and a click that quietly fails tells her the
   product is broken rather than that it is for sale. */

console.log('');

const gate = readFileSync('js/plan-gate.js', 'utf8');

/* Presentation, never permission. The comment saying so is not the point -
   the point is that every action it greys out is refused again server-side,
   which the route assertions above already prove. */
check('the gate is explicit that it is not a permission',
  /PRESENTATION, NEVER PERMISSION/i.test(gate));

/* An older session predates /me carrying features. "I do not know" must not
   grey out a doctor's whole pharmacy - the server still decides. */
const win2 = { document: undefined };
new Function('window', 'document', gate)(win2, {
  getElementById: () => null, querySelectorAll: () => [], createElement: () => ({})
});
const G = win2.TCOSGate;
check('the client gate loads', !!G && typeof G.apply === 'function');
check('a session that reports no features is left alone, not locked out',
  G.has({}, 'pharmacy') === true && G.has({ features: undefined }, 'billing') === true);
check('and one that does report them is respected',
  G.has({ features: ['patients'] }, 'pharmacy') === false &&
  G.has({ features: ['patients', 'pharmacy'] }, 'pharmacy') === true);
check('no feature named means nothing to gate',
  G.has({ features: [] }, null) === true);

/* Each screen has to actually call it, with the right capability and the
   buttons that write. A gate nobody invokes is a file. */
const SCREENS = [
  ['js/pharmacy.js', 'pharmacy', ['#addItemBtn', '#receiveBtn']],
  ['js/billing.js', 'billing', ['#newBillBtn']],
  ['js/readings.js', 'lab_reports', ['#uploadBtn']]
];
for (const [file, feature, actions] of SCREENS) {
  const source = readFileSync(file, 'utf8');
  check(file + ' applies the gate for ' + feature,
    new RegExp("TCOSGate\\.apply\\([\\s\\S]{0,200}feature: '" + feature + "'").test(source));
  for (const selector of actions) {
    check('  and locks ' + selector, source.includes("'" + selector + "'"));
  }
  const page = file.replace('js/', '').replace('.js', '.html');
  check('  and ' + page + ' loads the gate script',
    readFileSync(page, 'utf8').includes('js/plan-gate.js'));
}

/* CONTROL: the scan must be capable of failing. If indexOf were missing
   every route, both sets above would pass on empty strings. */
check('CONTROL: the router was actually read',
  router.length > 50000 && router.includes("'POST /invoices':"),
  router.length + ' bytes');
check('CONTROL: a feature nothing gates on is not found',
  !/requireFeature\(doctor, 'zzz_not_a_feature'\)/.test(router));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
