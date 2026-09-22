/* =========================================================================
   Doctors' own domains, from the owner's side.

   Vijay: "i asked right web control i cant see that here in owner page where
   i said right they will request as per page we are getting cost so lets
   charge him that."

   What this holds in place:

     1. GRANTING IS A MERGE, NEVER A REPLACE. The clinic's other overrides
        must survive being given a domain. Writing the whole object with one
        key in it would silently take away everything else she was granted -
        a bug nobody notices until a doctor rings up asking where her
        pharmacy went.
     2. Answering the request is part of granting it, or the queue never
        empties and the same clinic is granted three times.
     3. Revenue is exact. Provider pricing is account-specific, so capacity
        comes from Cloudflare's quota API and the actual monthly cost comes
        from the provider bill - not a copied public price.

   Run:  node test/domain-admin.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { domainAdmin, REQUEST_SUBJECT, ADDON_PAISE } from '../worker/domainadmin.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync('schema.sql', 'utf8'));
/* support_requests arrives in migration 011, which cannot be replayed on its
   own here - it also touches clinic_users from an earlier migration, so
   running it against bare schema.sql fails on a table this test does not
   care about.
 *
   So the one table under test is created directly, copied from
   migrations/011-operations-and-support.sql. The columns this module reads -
   doctor_id, subject, status, admin_note - are asserted against the real
   file below, so a change there fails here rather than drifting quietly. */
raw.exec(`
  CREATE TABLE support_requests (
    id TEXT PRIMARY KEY, doctor_id TEXT NOT NULL, created_by TEXT NOT NULL,
    category TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'open',
    admin_note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);

/* The custom-domain columns arrive in migrations 016 and 056, neither of
   which is folded into schema.sql. Replayed here because this module reads
   every one of them. */
for (const file of ['006-public-page.sql', '016-custom-domains.sql',
                    '056-custom-hostnames.sql']) {
  /* Comments stripped BEFORE splitting: these files carry `-- note` after
     the semicolon, so a naive split leaves the next statement beginning with
     a comment line and the ALTER is never matched. */
  const sql = readFileSync('migrations/' + file, 'utf8')
    .replace(/--[^\n]*/g, '');
  for (const statement of sql.split(';').map(s => s.trim())
       .filter(s => /^ALTER TABLE doctors/i.test(s))) {
    try { raw.exec(statement); } catch (_) { /* already present */ }
  }
}

const realSupportDdl = readFileSync('migrations/011-operations-and-support.sql', 'utf8');
for (const column of ['doctor_id', 'subject', 'status', 'admin_note', 'updated_at']) {
  check('the real support_requests table still has ' + column,
    new RegExp('^\\s*' + column + '\\s', 'm').test(realSupportDdl),
    'this test\'s copy of the table has drifted from the migration');
}

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

raw.exec(`
  INSERT INTO doctors (id, mobile, full_name, clinic_name, plan, feature_overrides)
  VALUES ('doc_A','+919000000001','Dr A','Clinic A','starter','{"pharmacy":true}'),
         ('doc_B','+919000000002','Dr B','Clinic B','pro','{}'),
         ('doc_C','+919000000003','Dr C','Clinic C','basic','{}');
  INSERT INTO support_requests (id, doctor_id, created_by, category, subject, message)
  VALUES ('sr_1','doc_A','doctor:doc_A','account','${REQUEST_SUBJECT}','Please switch it on'),
         ('sr_2','doc_B','doctor:doc_B','account','${REQUEST_SUBJECT}','Me too'),
         ('sr_3','doc_C','doctor:doc_C','account','Something else','Unrelated');
`);

/* Cloudflare for SaaS unconfigured, so usage reports that rather than a
   number - the screen must still work. */
const env = { AI_USD_INR: '95' };

console.log('\nWho asked, who has it, what it costs\n');

let view = await domainAdmin.overview(db, env, 95);

check('doctors who asked are gathered into a queue',
  view.requests.length === 2, JSON.stringify(view.requests.map(r => r.doctorId)));
check('and an unrelated support request is not mistaken for one',
  !view.requests.some(r => r.doctorId === 'doc_C'));
check('nobody has it yet', view.connected.length === 0);
check('so there is no revenue to claim', view.money.revenuePaise === 0);

/* ------------------------------------------- the merge, not a replace --- */

await domainAdmin.setAllowed(db, 'doc_A', true);
const after = raw.prepare('SELECT feature_overrides FROM doctors WHERE id = ?').get('doc_A');
const overrides = JSON.parse(after.feature_overrides);
check('granting switches the add-on on', overrides.custom_domain === true);
check('AND leaves her other overrides alone',
  overrides.pharmacy === true,
  'writing the whole object with one key in it takes away everything else');

/* ---------------------------------------------- the queue empties --- */

await domainAdmin.closeRequests(db, 'doc_A', 'granted');
view = await domainAdmin.overview(db, env, 95);
check('a granted clinic leaves the waiting list',
  !view.requests.some(r => r.doctorId === 'doc_A'),
  'otherwise the same clinic is granted three times');
check('and appears in the switched-on list',
  view.connected.length === 1 && view.connected[0].doctorId === 'doc_A');
check('the other request is still waiting',
  view.requests.length === 1 && view.requests[0].doctorId === 'doc_B');

/* Granted but no domain entered. She is paying ₹50 for something she has
   not set up, which is a refund conversation before it is a complaint. */
check('a clinic paying but not yet connected is flagged',
  view.connected[0].unused === true);

/* ------------------------------------------------------------ money --- */

check('revenue is counted per switched-on clinic',
  view.money.revenuePaise === ADDON_PAISE, String(view.money.revenuePaise));
check('the price is integer paise, like all money here',
  Number.isInteger(ADDON_PAISE) && ADDON_PAISE === 5000);
check('cost and margin are deliberately not invented',
  'costPaise' in view.money && 'marginPaise' in view.money,
  'the response explicitly distinguishes revenue from provider cost');
check('both are unknown until the provider bill is reconciled',
  view.money.costPaise === null && view.money.marginPaise === null);

/* ---------------------------------------------- switching back off --- */

await domainAdmin.setAllowed(db, 'doc_A', false);
const off = JSON.parse(
  raw.prepare('SELECT feature_overrides FROM doctors WHERE id = ?').get('doc_A').feature_overrides);
check('revoking removes the key rather than setting it false',
  !('custom_domain' in off),
  'a false override would also block a plan that later includes it');
check('and still leaves her other overrides alone', off.pharmacy === true);

let missing = null;
try { await domainAdmin.setAllowed(db, 'doc_ZZZ', true); } catch (e) { missing = e; }
check('an unknown clinic is a 404, not a silent no-op',
  missing && missing.status === 404, String(missing));

/* ------------------------------------- unconfigured Cloudflare is fine --- */

check('with Cloudflare for SaaS not set up the screen still renders',
  view.usage.configured === false, JSON.stringify(view.usage));
check('and no made-up zero cost is reported',
  view.money.costPaise === null);

/* ------------------------------------------------------- it is wired --- */

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const router = strip(readFileSync('worker/index.js', 'utf8'));
check('the console can read the overview',
  /'GET \/admin\/domains':/.test(router));
check('and grant or revoke it', /'POST \/admin\/domains\/:id':/.test(router));
const at = router.indexOf("'POST /admin/domains/:id':");
check('granting demands a fresh sign-in, because it starts charging her',
  /requireFreshAdminCapability\(env, request, 'money'\)/.test(router.slice(at, at + 300)));
check('and granting also answers her request',
  /domainAdmin\.closeRequests/.test(router.slice(at, at + 800)));

const html = readFileSync('admin.html', 'utf8');
const js = readFileSync('js/tcos-admin-console.js', 'utf8');
check('the console has a Web & domains screen',
  /data-view="webdomains"/.test(html) && /data-panel="webdomains"/.test(html));
check('with a count of who is waiting on the nav',
  /id="domainRequestCount"/.test(html) && /domainRequestCount/.test(js));
check('the screen shows revenue and says where the actual cost comes from',
  /We charge/.test(js) && /See provider bill/.test(js) && /Revenue less bill/.test(js));
check('and the price comes from the server, not typed into the screen',
  /m\.addonPaise/.test(js), 'two prices in two places is how a doctor is quoted the wrong one');

/* The doctor-facing refusal and this screen must name the same price. */
const entitlements = readFileSync('worker/entitlements.js', 'utf8');
check('the doctor-facing price and the owner-facing price agree',
  /pricePaise:\s*5000/.test(entitlements) && ADDON_PAISE === 5000,
  'she is told one number and billed another');

/* ------------------------------------------------------------ controls --- */

check('CONTROL: the fake database was really written',
  raw.prepare('SELECT COUNT(*) AS n FROM doctors').get().n === 3);
check('CONTROL: a clinic nobody granted is absent from the connected list',
  !view.connected.some(c => c.doctorId === 'doc_C'));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
