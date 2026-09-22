import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  PLATFORM_CAPABILITIES, PLATFORM_ROLE_PRESETS, platformCapabilities
} from '../worker/platform.js';
import { monthlyBusinessAmount } from '../worker/costs.js';

let passed = 0, failed = 0;
const check = (name, ok) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
};

const router = readFileSync('worker/index.js', 'utf8');
const platform = readFileSync('worker/platform.js', 'utf8');
const admin = readFileSync('admin.html', 'utf8');
const ui = readFileSync('js/tcos-admin-console.js', 'utf8');
const api = readFileSync('js/tcos-admin-api.js', 'utf8');
const practice = readFileSync('practice.html', 'utf8');
const migration = readFileSync('migrations/049-owner-console-foundation.sql', 'utf8');
const seed = readFileSync('scripts/seed-owner-console-demo.sql', 'utf8');
const insightSeed = readFileSync('scripts/seed-health-insights-demo.sql', 'utf8');

const migrationDb = new DatabaseSync(':memory:');
migrationDb.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE platform_team (
    email TEXT PRIMARY KEY, full_name TEXT, role TEXT, added_at TEXT, removed_at TEXT
  );
  CREATE TABLE doctors (id TEXT PRIMARY KEY, plan TEXT);
  CREATE TABLE support_requests (
    id TEXT PRIMARY KEY, doctor_id TEXT, created_by TEXT, message TEXT,
    status TEXT, created_at TEXT, updated_at TEXT
  );
`);
migrationDb.exec(migration);

console.log('\nPlatform employees receive jobs, not accidental seniority\n');

check('the owner always has every platform capability',
  platformCapabilities({ role: 'owner', capabilities: '[]' }).length ===
    PLATFORM_CAPABILITIES.length);
check('support does not inherit finance access',
  PLATFORM_ROLE_PRESETS.support.includes('support') &&
  !PLATFORM_ROLE_PRESETS.support.includes('money') &&
  !PLATFORM_ROLE_PRESETS.support.includes('subscriptions'));
check('finance does not inherit patient or support access',
  PLATFORM_ROLE_PRESETS.finance.includes('money') &&
  !PLATFORM_ROLE_PRESETS.finance.includes('patients') &&
  !PLATFORM_ROLE_PRESETS.finance.includes('support'));
check('a custom tick-list is the authority',
  JSON.stringify(platformCapabilities({ role: 'support', capabilities: '["delivery"]' })) ===
    '["delivery"]');
check('unknown or malformed capabilities fail closed',
  platformCapabilities({ role: 'support', capabilities: 'not-json' }).length === 0);
check('the owner can tick exact areas in the console',
  /id="teamCapabilities"/.test(admin) && /data-team-edit/.test(ui));
check('the migration adds delegated capabilities to real rows',
  migrationDb.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('platform_team') WHERE name IN ('capabilities','invited_by','must_change_password')").get().n === 3);
check('team writes require fresh team capability',
  (router.match(/requireFreshAdminCapability\(env, request, 'team'\)/g) || []).length >= 3);

console.log('\nA support request is a conversation with ownership\n');

check('support messages have a durable thread table',
  migrationDb.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='support_messages'").get().n === 1);
check('existing requests become opening messages',
  /SELECT 'opening_' \|\| id/.test(migration));
check('platform support can read, assign and reply',
  /GET \/admin\/support\/:id/.test(router) &&
  /POST \/admin\/support\/:id\/messages/.test(router) &&
  /assignedTo/.test(router));
check('support assignees do not require team-management access',
  /supportAssignees\(db\)/.test(platform) &&
  /data\.assignees/.test(ui) &&
  !/may\('team'\).*listTeam/.test(ui));
check('the server refuses assignment to a teammate without support access',
  /platformCapabilities\(assignee\)\.includes\('support'\)/.test(platform));
check('clinics can read and continue their own conversation',
  /GET \/support\/:id/.test(router) && /POST \/support\/:id\/messages/.test(router) &&
  /id="supportThreadDialog"/.test(practice));
check('internal notes are explicitly hidden from clinic readers',
  /internal = 0/.test(platform));

console.log('\nBusiness cost means both cash and economic cost\n');

check('the ledger distinguishes bank spend from owner time',
  migrationDb.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('business_costs') WHERE name='cash_type'").get().n === 1 &&
  /Leaves the bank/.test(admin) && /opportunity cost/.test(admin));
check('shared tools can allocate only the TCOS percentage',
  /allocation_percent/.test(migration) && /TCOS allocation/.test(admin));
check('a monthly cost remains monthly',
  monthlyBusinessAmount({ cadence: 'monthly', amount_paise: 400000,
    allocation_percent: 100, starts_on: '2026-09-01' }, '2026-09') === 400000);
check('a shared yearly cost is amortised and allocated',
  monthlyBusinessAmount({ cadence: 'yearly', amount_paise: 240000,
    allocation_percent: 50, starts_on: '2026-01-01' }, '2026-09') === 10000);
check('a one-time cost appears only in its month',
  monthlyBusinessAmount({ cadence: 'one_time', amount_paise: 90000,
    allocation_percent: 100, starts_on: '2026-08-12' }, '2026-09') === 0);

console.log('\nUseful patient intelligence keeps the clinical boundary\n');

check('a named patient detail exposes counts, not notes or values', (() => {
  const from = platform.indexOf('async detail(db, id)');
  const to = platform.indexOf('/* Aggregate opportunity', from);
  const section = platform.slice(from, to);
  return from >= 0 && to > from &&
    /visit_count/.test(section) && /report_count/.test(section) &&
    !/complaints|diagnosis|lab_values|medicine_name/.test(section);
})());
check('health patterns suppress cohorts smaller than five',
  /Math\.max\(5/.test(platform) && /HAVING COUNT\(DISTINCT patient_id\) >= \?/.test(platform));
check('analytics has a separately permissioned endpoint and screen',
  /requireAdminCapability\(env, request, 'analytics'\)/.test(router) &&
  /data-panel="insights"/.test(admin));
check('staging seeds demonstrate applications, subscriptions and real cost types',
  (seed.match(/application_demo_/g) || []).length >= 2 &&
  (seed.match(/subscription_demo_/g) || []).length >= 2 &&
  /business_cost_demo_/.test(seed));
check('support examples come from different clinics instead of one noisy customer',
  /'support_demo_1','doc_demo'/.test(seed) &&
  /'support_demo_2','doc_homeo'/.test(seed) &&
  /'support_demo_3','doc_allo'/.test(seed));
check('health insight examples cross the real five-patient privacy floor',
  (insightSeed.match(/visit_health_insight_demo_[1-5]'/g) || []).length === 5 &&
  (insightSeed.match(/lab_health_insight_demo_[1-5]'/g) || []).length >= 5 &&
  /City Diagnostics Hyderabad/.test(insightSeed));
check('the retired demo platform owner cannot return through account seeds',
  !readFileSync('scripts/seed-accounts-demo.sql', 'utf8').includes('admin@tcos.demo'));
check('the browser uses dedicated APIs for the new owner operations',
  /healthAnalytics/.test(api) && /replySupport/.test(api) &&
  /updateTeam/.test(api) && /addCost/.test(api));

/* ---------------- one screen, one link, and it stays fresh ------------- */
console.log('\nThe console on a phone has navigation at all\n');

/* Read here under its own name: the file-wide `consoleJs` is declared
   further down, and reaching it from up here is a temporal dead zone -
   which throws rather than quietly reading empty, but throws all the same. */
/* Normalised, because this checkout is CRLF and CI is LF - a regex written
   with \n silently matches nothing against the other one, which is a test
   that passes by never running. */
const adminJs = readFileSync('js/tcos-admin-console.js', 'utf8').replace(/\r\n?/g, '\n');

/* Vijay, having finally signed in: "the app is worst, i am not even
   understanding what to do, and also i am not able to see the tabs,
   nothing. build like a real mobile app."

   Measured at 375px before any of this: the rail sat at left:-292px -
   css/tcos.css turns it into a slide-out sheet below 760px - and the
   console drew nothing to open it. Twelve screens off the left edge with
   no handle, one panel showing, and no way to reach the other eleven.

   Every piece was already in the stylesheet for the doctor app. The
   console simply never used them, because js/nav.js draws them and the
   console does not load it. */
check('THE CONSOLE DRAWS A BOTTOM TAB BAR', /function paintTabBar/.test(adminJs));
check('and a scrim, so tapping beside the sheet closes it',
  /rail-scrim[\s\S]{0,200}remove\('rail-open'\)/.test(adminJs));
check('four tabs and a More, because five across is the most 375px holds',
  /TAB_VIEWS = \['business', 'applications', 'doctors', 'money'\]/.test(adminJs));

/* THE BAR IS BUILT FROM THE RAIL'S OWN BUTTONS. A hand-written second list
   would be right today and wrong by the next screen added. */
check('IT IS BUILT FROM THE RAIL, NOT A SECOND LIST',
  /paintTabBar[\s\S]{0,900}querySelector\('\.rail button\.nav\[data-view="' \+ view/.test(adminJs));
check('a screen this teammate may not open gets no tab',
  /if \(!source \|\| source\.hidden\) continue;/.test(adminJs));
check('and the bar is painted after the rail has been filtered',
  adminJs.indexOf('button.hidden = !may(viewCapability') < adminJs.indexOf('paintTabBar();'));
check('More opens the rail itself rather than a second menu',
  /more\.addEventListener\('click', \(\) => document\.body\.classList\.toggle\('rail-open'\)\)/.test(adminJs));
check('choosing from the sheet closes it, or the screen is behind it',
  /classList\.remove\('rail-open'\);\n\s*showView\(button\.dataset\.view\)/.test(adminJs));
check('the lit tab follows the screen, and More owns what it opened',
  /function markTabBar[\s\S]{0,420}\(hit \|\| tabs\[tabs\.length - 1\]\)\.classList\.add\('active'\)/.test(adminJs));
check('and it is re-marked on every view change', /markTabBar\(\);\n\n\s*\/\* `silent`/.test(adminJs));

/* Seven numbers at one per row is a scroll, not a dashboard: minmax(212px)
   cannot fit twice inside 375px. */
const css = readFileSync('css/tcos.css', 'utf8');
check('NUMBERS SIT TWO ACROSS ON A PHONE',
  /\.stat-row \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(css));
check('with the icon above the number, since 155px will not hold both',
  /\.stat \{ flex-direction: column;/.test(css));
check('and the poster-sized screen title comes down',
  /\.workspace header h1 \{ font-size: 1\.45rem; \}/.test(css));

console.log('\nEvery screen has its own link, and refreshes itself\n');

/* Vijay: "i want fixed link for everything" and "the time something comes i
   shoudl get directly not like i need to relogin or something". */
const consoleJs = readFileSync('js/tcos-admin-console.js', 'utf8');
const consoleHtml = readFileSync('admin.html', 'utf8');

const navViews = [...new Set([...consoleHtml.matchAll(/data-view="([^"]+)"/g)]
  .map(m => m[1]))];
const panelNames = [...new Set([...consoleHtml.matchAll(/data-panel="([^"]+)"/g)]
  .map(m => m[1]))];

check('there are twelve screens in the rail', navViews.length === 12, String(navViews.length));
check('every one has a panel behind it',
  navViews.every(v => panelNames.includes(v)),
  navViews.filter(v => !panelNames.includes(v)).join(', '));

/* A screen with no loader would be one that silently never refreshes -
   which is exactly the complaint, reintroduced quietly. */
const refreshLoaders = [...new Set([...consoleJs.matchAll(/^\s{4}(\w+): \(\) => load/gm)]
  .map(m => m[1]))];
check('EVERY SCREEN HAS A REFRESH LOADER — one without would never update',
  navViews.every(v => refreshLoaders.includes(v)),
  navViews.filter(v => !refreshLoaders.includes(v)).join(', '));

check('the view is written into the address bar', /#' \+ view/.test(consoleJs));
check('a pasted link or the Back button moves the screen',
  /addEventListener\('hashchange'/.test(consoleJs));
check('and the hash is read on the way in, so a bookmark opens its own screen',
  /location\.hash[\s\S]{0,200}allowed\.find/.test(consoleJs));

/* replaceState, not location.hash = x. Assigning pushes a history entry, so
   Back would walk him through every screen he looked at instead of leaving
   the console. */
check('switching screens does not fill up the Back button',
  /history\.replaceState/.test(consoleJs) &&
  !/location\.hash\s*=\s*'#'/.test(consoleJs));

check('the screen reloads itself on a timer', /setTimeout\([\s\S]{0,80}REFRESH_MS/.test(consoleJs));
check('and immediately when he looks back at the tab',
  /addEventListener\('visibilitychange'/.test(consoleJs));

/* This account is on the Workers free plan and that budget is shared with
   every doctor's clinic. A console left open on a second monitor must not
   spend it redrawing a screen nobody is looking at. */
check('POLLING STOPS WHEN THE TAB IS HIDDEN',
  /if \(document\.hidden\) return;/.test(consoleJs));
check('and only the visible screen is reloaded, not all twelve',
  /VIEW_LOADERS\[currentView\]/.test(consoleJs));
check('a background reload never pops an error over what he is reading',
  /try \{ await loader\(\); \} catch/.test(consoleJs));
check('and it does not poll the sign-in screen',
  /consoleEl\.hidden\) return;/.test(consoleJs));

/* ------------- the sign-in that refuses before it reads a password ------ */
console.log('\nThe console says who Cloudflare Access thinks you are\n');

/* Vijay, three separate times: "i am not able to login, my user id is
   correct password also correct still not working."

   He was right every time. POST /admin/signin refuses OUTRIGHT unless the
   email typed into the form matches the one Cloudflare Access
   authenticated - the password is never reached, the account is never
   looked up. And hello@tharigopula.com, hello.tharigopula@gmail.com and
   vijaytharigopula14@gmail.com are three addresses nobody tells apart at a
   glance.

   The answer sat in a request header the whole time and the page never
   showed it: it asked him to retype an address it already knew, then
   refused him for getting it wrong. */
/* AND ON 20 SEPTEMBER THE RULE ITSELF WENT.
 *
   Showing him the identity was a fix to the symptom. Vijay, on the fourth
   report: "as an owner i can login from anywhere - my tab or pc or laptop
   or phone - and we have multiple email ids. it is impossible that i need
   to have every system logging into a specific email account. i have my
   own user id and pwd, why do i need that consistency."
 *
   He is right. The rule made the console's sign-in depend on which
   Cloudflare ACCOUNT a browser happened to be signed into - the Access
   application's only login method is a Cloudflare dashboard login. Access,
   where it is still in front, remains a gate on the network path; it no
   longer decides WHICH TCOS account he may use once he is through it. The
   password proves who he is, and a passkey proves it is his device. */
check('THE TWO EMAILS NO LONGER HAVE TO MATCH',
  !/request\.headers\.get\(ACCESS_EMAIL_HEADER\) !== submittedEmail/.test(router));
check('and the reason is written down where the rule used to be',
  /THE EMAIL NO LONGER HAS TO MATCH THE CLOUDFLARE IDENTITY/.test(router));
/* The notice stays: it is still the fastest way to see which of three
   similar addresses a browser is holding. */
check('THE CONSOLE CAN NOW ASK WHO ACCESS AUTHENTICATED',
  /'GET \/admin\/access-identity'/.test(router));

/* It may only ever report the CALLER'S identity. The pipeline overwrites
   that header from the validated Access JWT before routing, so a
   caller-supplied one carries no authority - which is what makes echoing
   it safe. */
check('it reads the header the Worker itself sets, not a body field',
  /access-identity'[\s\S]{0,700}headers\.get\(ACCESS_EMAIL_HEADER\)/.test(router));
check('and that header is overwritten after signature validation',
  /headers\.set\(ACCESS_EMAIL_HEADER, access\.email\)/.test(router));
check('it says whether a console account exists for that address',
  /access-identity'[\s\S]{0,900}hasAccount/.test(router));
/* Behind Access the caller is already proven to be that person, so this
   cannot be used to enumerate anybody else's address. */
check('it looks up only the address Access proved, never one from the body',
  /access-identity'[\s\S]{0,900}team\.byEmail\(env\.DB, email\)/.test(router));

check('the sign-in form has somewhere to show it', /id="accessIdentity"/.test(consoleHtml));
check('the console asks before sign-in, not after',
  /AdminApi\.accessIdentity\(\)/.test(consoleJs));
check('it fills the email in for him', /field\.value = identity\.email/.test(consoleJs));

/* readOnly, NOT disabled. A disabled input is not submitted, and the
   server needs this value to compare against - so disabling it would make
   every sign-in fail with an empty email. */
check('the field is readOnly rather than disabled, or nothing would submit',
  /field\.readOnly = true/.test(consoleJs) && !/adminEmail'\)\.disabled = true/.test(consoleJs));

/* The sentence that ends the guessing. */
check('when no account exists for that address, it says so plainly',
  /there is no console account for that address/.test(consoleJs));
check('and a failed lookup leaves the form usable rather than blocking it',
  /catch \(_\) \{ return; \}/.test(consoleJs));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
