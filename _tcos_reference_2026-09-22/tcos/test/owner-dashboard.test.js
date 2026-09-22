/* =========================================================================
   The business on one screen.

   Vijay: "as an owner i need to have a dashboard right means complete - how
   many customers, which package, attrition rate, new joiners, database used
   by each person, no of messages by each one, no of customers by each."

   What this holds in place:

     1. EVERY FIGURE IS COUNTED, NOT ESTIMATED. A dashboard whose numbers
        cannot be traced to a table is a dashboard nobody trusts the moment
        it disagrees with the bank.
     2. A rate is not printed over a sample too small to carry one. "0%
        churn" over two customers is a lie told with arithmetic.
     3. It counts clinical rows and reads none. The owner console must not
        become a way to browse one person's diagnosis - the isolation suite
        asserts that separately and this asserts the shape of the output.

   Run:  node test/owner-dashboard.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';
import { ownerDashboard } from '../worker/ownerdashboard.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString();

/* A fake D1 that returns the one row shape the dashboard query produces. */
const db = rows => ({
  prepare(sql) {
    return { async all() { return { results: rows }; },
             bind() { return this; } , sql };
  }
});

const clinic = over => ({
  id: 'd' + Math.random().toString(36).slice(2, 8),
  full_name: 'Dr Devi', clinic_name: 'Devi Clinic', plan: 'basic',
  product: 'ayurcos', status: 'active',
  created_at: daysAgo(200), last_sign_in_at: daysAgo(1),
  custom_domain: null, custom_domain_status: null,
  patients: 10, storage_bytes: 1000, messages_all: 5,
  messages_whatsapp: 3, messages_sms: 1, messages_email: 1,
  visits_30d: 4, prescriptions_30d: 3, staff: 1,
  /* When she last DID something. Engagement is read from these now, not
     from last_sign_in_at - see the engagement block below for why. */
  last_visit_at: daysAgo(1), last_rx_at: daysAgo(1), last_invoice_at: null,
  last_appointment_at: null, last_patient_at: null, last_lab_at: null,
  ...over
});

/* No work of any kind, by name, so a test that means "she has recorded
   nothing" cannot accidentally leave one column set. */
const noWork = {
  last_visit_at: null, last_rx_at: null, last_invoice_at: null,
  last_appointment_at: null, last_patient_at: null, last_lab_at: null,
  visits_30d: 0, prescriptions_30d: 0
};

console.log('\nWhat the owner can see\n');

/* ------------------------------------------------ the headline counts --- */

let data = await ownerDashboard.summary(db([
  clinic({ plan: 'basic' }),
  clinic({ plan: 'starter' }),
  clinic({ plan: 'pro' }),
  clinic({ plan: 'pro_plus', status: 'suspended' })
]));

check('it counts every clinic', data.totals.clinics === 4, String(data.totals.clinics));
check('and separates active from suspended',
  data.totals.active === 3 && data.totals.suspended === 1);
check('paying is the paid plans only, not everyone active',
  data.totals.paying === 2, String(data.totals.paying));
check('and Free is the rest', data.totals.free === 1, String(data.totals.free));
check('it breaks the base down by package',
  data.byPlan.basic === 1 && data.byPlan.starter === 1 && data.byPlan.pro === 1,
  JSON.stringify(data.byPlan));

/* ------------------------------------------------ per clinic figures --- */

check('patients are totalled across clinics', data.totals.patients === 40);
check('storage is totalled in real bytes', data.totals.storageBytes === 4000);
check('messages are totalled', data.totals.messages === 20);
check('and each clinic carries its own numbers',
  data.clinics[0].patients === 10 && data.clinics[0].storageBytes === 1000);
check('messages are split by channel, because they cost different amounts',
  data.clinics[0].messages.whatsapp === 3 &&
  data.clinics[0].messages.sms === 1 && data.clinics[0].messages.email === 1,
  JSON.stringify(data.clinics[0].messages));

/* ------------------------------------------------------- new joiners --- */

data = await ownerDashboard.summary(db([
  clinic({ created_at: daysAgo(2) }),
  clinic({ created_at: daysAgo(20) }),
  clinic({ created_at: daysAgo(200) })
]));
check('joiners are counted over 7, 30 and 90 days',
  data.joiners.last7 === 1 && data.joiners.last30 === 2 && data.joiners.last90 === 2,
  JSON.stringify(data.joiners));

/* -------------------------------------------------------- attrition --- */

/* The rule that matters: no rate over a sample too small to carry one. */
data = await ownerDashboard.summary(db([
  clinic({ status: 'suspended' }), clinic(), clinic()
]));
check('with three clinics no attrition RATE is invented',
  data.attrition.rate === null && data.attrition.meaningful === false,
  JSON.stringify(data.attrition));
check('but the raw count is still shown, because it is a real fact',
  data.attrition.suspended === 1, JSON.stringify(data.attrition));

const twelve = [];
for (let i = 0; i < 12; i++) twelve.push(clinic({ status: i < 3 ? 'suspended' : 'active' }));
data = await ownerDashboard.summary(db(twelve));
check('once there are enough clinics the rate appears',
  data.attrition.meaningful === true && data.attrition.rate === 25,
  JSON.stringify(data.attrition));

/* A clinic that joined last week cannot have churned this month - counting
   it in the denominator flatters the number forever. */
data = await ownerDashboard.summary(db([
  ...twelve, clinic({ created_at: daysAgo(2) }), clinic({ created_at: daysAgo(3) })
]));
check('brand new clinics are left out of the attrition denominator',
  data.attrition.outOf === 12, String(data.attrition.outOf));

/* ------------------------------------------------------- engagement --- */

data = await ownerDashboard.summary(db([
  clinic({ last_sign_in_at: daysAgo(1), last_visit_at: daysAgo(1) }),
  clinic({ last_sign_in_at: daysAgo(1), ...noWork }),
  clinic({ last_sign_in_at: daysAgo(45), ...noWork }),
  clinic({ last_sign_in_at: null, ...noWork })
]));
check('recording something this week is "using it"',
  data.engagement.active === 1, JSON.stringify(data.engagement));
/* This is the one that predicts churn: she logs in, and records nothing. */
check('signing in and recording NOTHING is not counted as using it',
  data.engagement.slipping === 1, JSON.stringify(data.engagement));
check('a clinic gone quiet for over a month is dormant',
  data.engagement.dormant === 1);
check('and one that never signed in is its own case, not "dormant"',
  data.engagement.never === 1);
check('each clinic says how long since it was last opened',
  data.clinics[0].daysSinceSignIn === 1, String(data.clinics[0].daysSinceSignIn));

/* =====================================================================
   A SIGN-IN IS NOT USAGE.

   Vijay: "anjan has reset the password thats it — that doesn't mean you
   are resetting his usage data."

   Production said the same thing plainly: password_reset at 07:37:48,
   sign_in at 07:38:05, and the business screen then reported the clinic as
   active today. Engagement was read off last_sign_in_at, and the reset
   flow signs her straight back in - so getting locked out and recovering
   looked identical to a full day's clinic.
   ===================================================================== */

const lockedOutToday = clinic({
  created_at: daysAgo(200),
  last_sign_in_at: daysAgo(0),   /* reset her password and came back in */
  ...noWork,
  last_visit_at: daysAgo(60)     /* her last real work was two months ago */
});
data = await ownerDashboard.summary(db([lockedOutToday]));
check('A PASSWORD RESET DOES NOT MAKE A CLINIC LOOK ACTIVE',
  data.engagement.active === 0, JSON.stringify(data.engagement));
check('and what she last DID is reported, not when the door last opened',
  data.clinics[0].daysSinceWork === 60 && data.clinics[0].daysSinceSignIn === 0,
  'worked ' + data.clinics[0].daysSinceWork + 'd ago, opened ' +
  data.clinics[0].daysSinceSignIn + 'd ago');

/* CONTROL: the old rule would have called that clinic active. If this
   assertion ever fails, the two facts have been collapsed back together. */
check('CONTROL: the two dates are genuinely different on that row',
  data.clinics[0].daysSinceWork !== data.clinics[0].daysSinceSignIn);

/* Every kind of work counts, not only visits. A doctor who spent the
   morning registering patients has been working. */
for (const column of ['last_visit_at', 'last_rx_at', 'last_invoice_at',
  'last_appointment_at', 'last_patient_at', 'last_lab_at']) {
  const only = await ownerDashboard.summary(db([
    clinic({ created_at: daysAgo(200), last_sign_in_at: daysAgo(3),
      ...noWork, [column]: daysAgo(2) })
  ]));
  check(column.replace(/^last_|_at$/g, '') + ' on its own counts as using it',
    only.engagement.active === 1, JSON.stringify(only.engagement));
}

/* A clinic that joined on Friday has not "gone quiet" by Monday. Anjan
   signed up two days before this was written, added two patients and two
   staff, and the screen called him Going quiet - a list of people to ring
   about leaving, with a brand new customer on it. */
data = await ownerDashboard.summary(db([
  clinic({ created_at: daysAgo(2), last_sign_in_at: daysAgo(1), ...noWork }),
  clinic({ created_at: daysAgo(90), last_sign_in_at: daysAgo(1), ...noWork })
]));
check('A CLINIC THAT JOINED DAYS AGO IS SETTLING IN, NOT SLIPPING AWAY',
  data.engagement.settling === 1 && data.engagement.slipping === 1,
  JSON.stringify(data.engagement));
check('and settling in is counted apart from going quiet',
  data.clinics.find(c => c.state === 'new') &&
  data.clinics.find(c => c.state === 'slipping'));

/* Two date shapes live in the real database: ISO with a Z from the Worker,
   and "2026-09-19 08:56:39" from SQLite's CURRENT_TIMESTAMP. Date.parse
   reads the second as LOCAL time - five and a half hours out on this
   laptop, which is enough to move a clinic across a day boundary. */
const sqliteShape = new Date(Date.now() - 2 * 86400000)
  .toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
data = await ownerDashboard.summary(db([
  clinic({ created_at: daysAgo(200), last_sign_in_at: daysAgo(1),
    ...noWork, last_patient_at: sqliteShape })
]));
check('A SQLITE TIMESTAMP IS READ AS UTC, NOT AS LOCAL TIME',
  data.clinics[0].daysSinceWork === 2,
  sqliteShape + ' -> ' + data.clinics[0].daysSinceWork + 'd');

/* first_seen_on is a bare date. Midnight UTC is the conservative reading:
   it can only make activity look older, never newer. */
const bareDate = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
data = await ownerDashboard.summary(db([
  clinic({ created_at: daysAgo(200), last_sign_in_at: daysAgo(1),
    ...noWork, last_patient_at: bareDate })
]));
check('a bare date still reads as a real day, not as NaN',
  data.clinics[0].daysSinceWork === 3,
  bareDate + ' -> ' + data.clinics[0].daysSinceWork + 'd');
check('and an unreadable stamp reads as no work rather than as today',
  (await ownerDashboard.summary(db([
    clinic({ created_at: daysAgo(200), last_sign_in_at: daysAgo(1),
      ...noWork, last_visit_at: 'not a date' })
  ]))).clinics[0].daysSinceWork === null);

/* --------------------------------------------- nothing clinical leaks --- */

/* Comments stripped first. The header of that file explains at length that it
   reads no diagnosis and no medicine - so a grep over the raw text fires on
   the very sentence promising the opposite. Four assertions in this repo have
   now been caught by their own documentation. */
const source = readFileSync('worker/ownerdashboard.js', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check('the module names no clinical field',
  !/\b(diagnosis|complaint|medicine|dose|result_value|report_name)\b/i.test(source),
  (source.match(/\b(diagnosis|complaint|medicine|dose|result_value|report_name)\b/i) || [])[0]);
check('CONTROL: stripping comments did not empty the module',
  /SELECT/.test(source) && source.length > 800);
const shape = JSON.stringify(data);
check('and no clinical word reaches the response',
  !/diagnos|prescrib|medicine|lab_value/i.test(shape));

/* ------------------------------------------------------ it is wired --- */

const router = readFileSync('worker/index.js', 'utf8');
check('the route exists and is capability-gated',
  /'GET \/admin\/dashboard'[\s\S]{0,200}requireAdminCapability\(env, request, 'analytics'\)/
    .test(router));
const consoleJs = readFileSync('js/tcos-admin-console.js', 'utf8');
const html = readFileSync('admin.html', 'utf8');
check('the console has a Business view', /data-view="business"/.test(html) &&
  /data-panel="business"/.test(html));
check('and it loads the dashboard', /loadBusiness/.test(consoleJs) &&
  /AdminApi\.dashboard\(\)/.test(consoleJs));
check('storage is shown in units a person can picture',
  /GB|MB/.test(consoleJs));
check('the screen says "lost" rather than a fake 0% on a small base',
  /attrition\.meaningful/.test(consoleJs));

/* ------------------------------------------------------------ controls --- */

/* Its own fixture rather than whatever `data` happens to hold by now: a
   control that reads a variable reassigned twelve times above is a control
   that stops meaning anything the moment somebody adds a block. */
check('CONTROL: the fake database was actually read',
  await (async () => {
    const four = await ownerDashboard.summary(db([clinic(), clinic(), clinic(), clinic()]));
    return four.clinics.length === 4 && four.totals.clinics === 4;
  })());
check('CONTROL: an empty platform does not throw',
  (await ownerDashboard.summary(db([]))).totals.clinics === 0);
check('CONTROL: and reports no rate rather than NaN',
  (await ownerDashboard.summary(db([]))).attrition.rate === null);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
