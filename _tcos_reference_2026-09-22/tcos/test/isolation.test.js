/* =========================================================================
   Isolation tests.

   D1 has no row-level security, so the database will happily hand over
   another doctor's rows if a query forgets its doctor_id clause. These tests
   are what catches that, and they must stay green.

   Runs the real schema against real SQLite, in memory, so the SQL under test
   is the SQL that runs in production.

   Run:  node test/isolation.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, statSync } from 'node:fs';

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('schema.sql', 'utf8'));
const all = (sql, ...args) => db.prepare(sql).all(...args);

console.log('\nSeeding two doctors, one patient each\n');

db.exec(`
  INSERT INTO doctors (id, mobile, full_name, clinic_name) VALUES
    ('doc_A', '+919000000001', 'Dr A', 'Clinic A'),
    ('doc_B', '+919000000002', 'Dr B', 'Clinic B');

  INSERT INTO patients (id, mobile, full_name) VALUES
    ('pat_1', '+919111111111', 'Patient One'),
    ('pat_2', '+919222222222', 'Patient Two');

  INSERT INTO doctor_patients (doctor_id, patient_id) VALUES
    ('doc_A', 'pat_1'), ('doc_B', 'pat_2');

  INSERT INTO visits (id, doctor_id, patient_id, visited_on, diagnosis) VALUES
    ('vis_A', 'doc_A', 'pat_1', '2026-08-01', 'A diagnosis'),
    ('vis_B', 'doc_B', 'pat_2', '2026-08-02', 'B diagnosis');

  INSERT INTO prescriptions (id, doctor_id, patient_id, issued_on) VALUES
    ('rx_A', 'doc_A', 'pat_1', '2026-08-01'),
    ('rx_B', 'doc_B', 'pat_2', '2026-08-02');

  INSERT INTO prescription_items (id, prescription_id, doctor_id, medicine_name) VALUES
    ('rxi_A', 'rx_A', 'doc_A', 'Metformin 500'),
    ('rxi_B', 'rx_B', 'doc_B', 'Triphala');

  INSERT INTO stock_items (id, doctor_id, medicine_name) VALUES
    ('sit_A', 'doc_A', 'Metformin 500'),
    ('sit_B', 'doc_B', 'Triphala');

  INSERT INTO lab_reports (id, doctor_id, patient_id, report_name, reported_on) VALUES
    ('lab_A', 'doc_A', 'pat_1', 'Lipid profile', '2026-08-01'),
    ('lab_B', 'doc_B', 'pat_2', 'CBC', '2026-08-02');
`);

console.log('Doctor cannot reach another doctor\'s data\n');

check('A lists only their own patient',
  all("SELECT patient_id FROM doctor_patients WHERE doctor_id = 'doc_A'")
    .every(r => r.patient_id === 'pat_1'));

check("A cannot claim B's patient",
  all("SELECT 1 FROM doctor_patients WHERE doctor_id = 'doc_A' AND patient_id = 'pat_2'").length === 0);

check("A cannot read B's visit by id",
  all("SELECT * FROM visits WHERE doctor_id = 'doc_A' AND id = 'vis_B'").length === 0);

check("A cannot read B's prescription by id",
  all("SELECT * FROM prescriptions WHERE doctor_id = 'doc_A' AND id = 'rx_B'").length === 0);

check("A cannot read B's prescription items",
  all("SELECT * FROM prescription_items WHERE doctor_id = 'doc_A' AND prescription_id = 'rx_B'").length === 0);

check("A cannot read B's lab report",
  all("SELECT * FROM lab_reports WHERE doctor_id = 'doc_A' AND id = 'lab_B'").length === 0);

check("A cannot read B's pharmacy stock",
  all("SELECT * FROM stock_items WHERE doctor_id = 'doc_A' AND id = 'sit_B'").length === 0);

/* The failure this whole file exists to catch: the same query with the
   clause left off. If this does NOT return both rows, the test is lying. */
check('an unscoped query WOULD return both doctors (proves the clause works)',
  all('SELECT id FROM visits').length === 2);

console.log('\nPatient history moves only with consent\n');

const liveGrant = (patientId, doctorId) => all(
  `SELECT * FROM consent_grants WHERE patient_id = ? AND granted_to_doctor = ?
     AND revoked_at IS NULL AND expires_at > datetime('now')`, patientId, doctorId);

check('B has no grant on A\'s patient by default', liveGrant('pat_1', 'doc_B').length === 0);

db.exec(`INSERT INTO consent_grants (id, patient_id, granted_to_doctor, expires_at)
         VALUES ('con_1', 'pat_1', 'doc_B', datetime('now', '+1 day'));`);

check('grant goes live once the patient approves', liveGrant('pat_1', 'doc_B').length === 1);

check('B can then see A\'s visit for that patient',
  all("SELECT id FROM visits WHERE patient_id = 'pat_1' AND doctor_id != 'doc_B'")
    .some(r => r.id === 'vis_A'));

check('B can then see A\'s prescribed medicines',
  all(`SELECT pi.medicine_name FROM prescription_items pi
         JOIN prescriptions p ON p.id = pi.prescription_id
        WHERE p.patient_id = 'pat_1' AND p.doctor_id != 'doc_B'`).length === 1);

/* Private notes are the doctor's own working thoughts and stay out of every
   shared view, grant or no grant. */
db.exec("UPDATE doctor_patients SET private_notes = 'personal note' WHERE doctor_id = 'doc_A';");
check('private notes are not part of shared history',
  !readFileSync('worker/repo.js', 'utf8')
    .split('sharedHistory')[1].includes('private_notes'));

db.exec("UPDATE consent_grants SET expires_at = datetime('now', '-1 hour') WHERE id = 'con_1';");
check('an expired grant closes the door again', liveGrant('pat_1', 'doc_B').length === 0);

db.exec(`UPDATE consent_grants SET expires_at = datetime('now','+1 day'),
         revoked_at = datetime('now') WHERE id = 'con_1';`);
check('a revoked grant closes the door again', liveGrant('pat_1', 'doc_B').length === 0);

console.log('\nPharmacy safety\n');

db.exec(`INSERT INTO stock_batches (id, stock_item_id, doctor_id, batch_no, expires_on, quantity) VALUES
  ('bat_old', 'sit_A', 'doc_A', 'OLD', date('now','-10 day'), 100),
  ('bat_new', 'sit_A', 'doc_A', 'NEW', date('now','+180 day'), 20);`);

const dispensable = all(
  `SELECT id, batch_no FROM stock_batches
    WHERE doctor_id = 'doc_A' AND stock_item_id = 'sit_A'
      AND quantity > 0 AND expires_on >= date('now') ORDER BY expires_on ASC`);
check('expired stock is never offered for dispensing',
  dispensable.length === 1 && dispensable[0].batch_no === 'NEW',
  JSON.stringify(dispensable));

check('expiry alert catches the expired batch still on the shelf',
  all(`SELECT id FROM stock_batches WHERE doctor_id = 'doc_A' AND quantity > 0
         AND expires_on <= date('now','+60 day')`).length === 1);

console.log('\nSource discipline\n');

const routerSource = readFileSync('worker/index.js', 'utf8');
check('no raw SQL in the router', !/\.prepare\s*\(/.test(routerSource),
  'worker/index.js builds SQL directly');

/* The real invariant: every statement that touches a clinical table must
   mention doctor_id in that same statement.

   This used to read repo.js alone, back when repo.js was the only file with
   SQL in it. It is not any more - billing, reports, staff, the platform
   console, the public page and the patient's own view all query directly -
   and a check that reads one file while five others hold 85 statements is
   not a proof, it is a habit.

   Worse, the clinical table list had grown to include invoices and payments
   while the queries against them live in billing.js, so those names were
   being matched against a file that never mentions them. The test was
   passing on an empty set.

   Every module with SQL is now scanned. The discipline had in fact held -
   nothing was unscoped when this was widened - but "we checked" and "we know"
   are different claims, and only one of them belongs in a clinical system. */
/* Every module that holds SQL. A new file added here is the only thing
   standing between a new query and never being checked at all - which is
   why schedule.js, domains.js and costs.js were added the moment they were
   written rather than the next time somebody remembered. */
const SQL_MODULES = ['repo.js', 'billing.js', 'reports.js', 'staff.js',
  'platform.js', 'publicpage.js', 'patientview.js',
  'schedule.js', 'domains.js', 'costs.js', 'quota.js', 'files.js',
  'drafts.js', 'preflights.js', 'aiops.js', 'subscriptions.js',
  'consultationdraft.js', 'ownerdashboard.js', 'coupons.js', 'domainadmin.js', 'leads.js',
  'clinicfields.js', 'offlinepayments.js', 'demoseed.js', 'passkeys.js'];
/* security.js used to be pushed on here. It moved to @tharigopula/core on
   17 Sep 2026 and took five SQL statements with it - so for a moment a
   module holding SQL had silently left the scan, which is precisely the hole
   closed two days earlier by a different route.
 *
   It is scanned in its new home instead, below. A module does not stop
   needing this check by changing address. */

/* This list was hand-written, which means a new module with SQL in it was
   simply not scanned until somebody remembered to add it here - and the one
   thing this file exists to catch is exactly what a new module gets wrong.
   So the list is now checked against the directory rather than trusted.
   A module that writes SQL and is not listed fails, by name. */
const withSql = readdirSync('worker')
  .filter(name => name.endsWith('.js'))
  .filter(name => /db\.prepare\(/.test(readFileSync('worker/' + name, 'utf8')));
const unscanned = withSql.filter(name =>
  !SQL_MODULES.includes(name) && name !== 'index.js');
check('every worker module that writes SQL is on the scan list',
  unscanned.length === 0, 'missing: ' + unscanned.join(', '));

const repoSource = readFileSync('worker/repo.js', 'utf8');
const CLINICAL = /\b(doctor_patients|visits|prescriptions|prescription_items|lab_reports|lab_values|stock_items|stock_batches|stock_movements|invoices|invoice_items|payments|fee_items)\b/;
const sharedFrom = repoSource.indexOf('async sharedHistory');
const sharedTo = repoSource.indexOf('/* ------', sharedFrom);

/* The platform console's patient roster spans every clinic on purpose, so it
   gets a named exception here - by name and by position, never by file.

   An earlier version of this query carried "AND dp.doctor_id IS NOT NULL",
   which is not a scope: every row has a doctor_id, so the clause matched
   everything and existed only because the scan below asks whether the string
   "doctor_id" appears. That is a way past the check rather than a reason to
   be past it, and it left the scanner reporting a pass over a file it was no
   longer reading. If a query genuinely needs to cross tenants, it belongs in
   this list where somebody has to read it. */
const rosterSource = readFileSync('worker/platform.js', 'utf8');
const rosterFrom = rosterSource.indexOf('export const platformPatients');
const rosterTo = rosterSource.indexOf('export const supportRequests', rosterFrom);

let scanned = 0;
const offenders = [];

for (const file of SQL_MODULES) {
  const source = readFileSync('worker/' + file, 'utf8');
  const found = [...source.matchAll(/db\.prepare\(\s*([`'"])([\s\S]*?)\1/g)];
  scanned += found.length;

  for (const match of found) {
    const sql = match[2];
    if (!CLINICAL.test(sql)) continue;
    if (/doctor_id/.test(sql)) continue;

    /* Two places read clinical rows without a doctor_id, both deliberately:

       repo.sharedHistory - another clinic's records, and only after the
         patient has approved. The grant check is asserted separately below.

       patientview.js - the patient's OWN record, opened by an unguessable
         token rather than a session. It spans every clinic they have been to
         because that is the whole point of it, and the token identifies the
         patient, not the doctor. */
    if (file === 'repo.js' && match.index > sharedFrom && match.index < sharedTo) continue;
    if (file === 'patientview.js') continue;

    /* platform.platformPatients - the admin roster. It lists who is on the
       platform and which clinics they attend, and nothing clinical beyond
       that; the assertion below proves it reads no diagnosis, medicine or
       result. Scoped to the export, so a later unscoped query added further
       down platform.js is still caught. */
    if (file === 'platform.js' && match.index > rosterFrom && match.index < rosterTo) continue;

    offenders.push(file + ': ' + sql.replace(/\s+/g, ' ').trim().slice(0, 70));
  }
}

check('every clinical statement in every module names doctor_id',
  offenders.length === 0, offenders.join(' | '));

/* A HOLE THIS TEST HAD UNTIL 14 Sep 2026.

   The scan above finds SQL by matching db.prepare( followed by a quote. A
   query lifted into a module-level const - `const Q = \`SELECT ...\`` and
   then db.prepare(Q) - is therefore never read by it, and ownerdashboard.js
   was written that way and sailed through reporting "0 statements".

   Nothing malicious is needed for this to bite: pulling a long query out for
   readability is the most natural refactor there is, and it silently removes
   the query from the one check standing between it and a cross-tenant leak.

   So: any clinical SELECT anywhere in a scanned module must be inside a
   db.prepare call. Keeping them there is the whole price of being scanned. */
const hidden = [];
for (const file of SQL_MODULES) {
  const source = readFileSync('worker/' + file, 'utf8');
  /* Specifically a query ASSIGNED TO A NAME, which is the refactor that hides
     it. Matching every backtick span instead walks from the end of one
     literal to the start of the next and flags ordinary code in between -
     the first version of this check did exactly that and reported nine
     offenders that were all comments. */
  for (const [, name, literal] of
       source.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*`([\s\S]*?)`/g)) {
    if (!/\bSELECT\b[\s\S]*\bFROM\b/i.test(literal)) continue;
    if (!CLINICAL.test(literal)) continue;
    hidden.push(file + ': ' + name);
  }
}
check('no clinical SQL is parked in a const where the scan cannot see it',
  hidden.length === 0, hidden.join(' | '));

/* THE SHARED CORE IS SCANNED TOO.
 *
   security.js moved to @tharigopula/core carrying five SQL statements. Code
   does not stop needing tenant isolation by changing repository, and a
   module that leaves this scan is worth more to an attacker than one that
   was never in it - everyone assumes it is still covered.
 *
   The core's own boundary test proves it names no domain concept; this
   proves the same thing from TCOS's side, so neither repo can quietly drop
   the guarantee the other is relying on. */
const CORE = 'node_modules/@tharigopula/core/src';
const coreFiles = (function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = dir + '/' + entry;
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (entry.endsWith('.js')) out.push(path);
  }
  return out;
})(CORE);

check('the shared core is present to be scanned', coreFiles.length >= 5,
  coreFiles.length + ' files at ' + CORE);

const coreSql = coreFiles.flatMap(file =>
  [...readFileSync(file, 'utf8').matchAll(/db\.prepare\(\s*([`'"])([\s\S]*?)\1/g)]
    .map(m => ({ file, sql: m[2] })));
check('the core does hold SQL, so this check has something to do',
  coreSql.length >= 3, coreSql.length + ' statements');
check('and none of it touches a clinical table',
  coreSql.every(({ sql }) => !CLINICAL.test(sql)),
  coreSql.filter(({ sql }) => CLINICAL.test(sql))
    .map(({ file, sql }) => file + ': ' + sql.slice(0, 50)).join(' | '));

/* CONTROL. A check that has never been shown to fail is a check nobody
   should trust - this is the one that was green over an unscanned module
   twenty minutes ago. Run the same detector over the exact shape it exists
   to catch. */
const decoy = 'const HIDDEN = `SELECT * FROM visits WHERE 1=1`;';
const decoyHits = [...decoy.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*`([\s\S]*?)`/g)]
  .filter(([, , sql]) => /\bSELECT\b[\s\S]*\bFROM\b/i.test(sql) && CLINICAL.test(sql));
check('CONTROL: the detector catches a query hidden in a const',
  decoyHits.length === 1, 'the check above cannot fail, so it proves nothing');

/* aiops.js is the one module that deliberately reads ACROSS clinics: the
   platform-wide spend cap exists to catch a fault in our own code, and a
   fault affecting every clinic is invisible from inside any single one.

   That is only acceptable because what it reads is money and machine state -
   never a patient, a diagnosis, a medicine or a result. The scanner lets it
   through by treating ai_spend as non-clinical, which is a judgement about
   those table names; this asserts the judgement instead of assuming it, so
   the day somebody joins ai_spend to a clinical table to make a nicer report,
   this fails. */
const aiopsSource = readFileSync('worker/aiops.js', 'utf8');
const aiopsSql = [...aiopsSource.matchAll(/db\.prepare\(\s*([`'"])([\s\S]*?)\1/g)]
  .map(m => m[2]);
check('the cross-clinic spend guard reads no clinical table at all',
  aiopsSql.every(sql => !CLINICAL.test(sql)),
  aiopsSql.filter(sql => CLINICAL.test(sql)).join(' | '));
check('and it was actually looking at some SQL', aiopsSql.length >= 6,
  aiopsSql.length + ' statements');

/* ownerdashboard.js is the other module that deliberately spans every clinic:
   the owner's business screen - how many clinics, on what plan, how much
   storage, how many messages, who has stopped using it.

   Its clinical subqueries ARE scoped (dp.doctor_id = d.id), so the scanner
   above lets it through on the doctor_id rule. That is the same shape as the
   "AND doctor_id IS NOT NULL" clause that once got four unscoped queries past
   this test, so passing that way is not evidence of anything and is asserted
   properly here instead.

   The limit that matters is not scoping, it is CONTENT. A business needs to
   know a clinic recorded 40 visits last month. It does not need to know what
   was wrong with anybody. So every clinical table may be COUNTED and nothing
   in it may be SELECTED: no diagnosis, no medicine, no lab value, no patient
   name. The day somebody adds "top diagnosis" to make a nicer chart, this
   fails. */
const dashSource = readFileSync('worker/ownerdashboard.js', 'utf8');
const dashSql = [...dashSource.matchAll(/db\.prepare\(\s*([`'"])([\s\S]*?)\1/g)]
  .map(m => m[2]);
check('the owner dashboard was actually scanned', dashSql.length >= 1,
  dashSql.length + ' statements');
/* COUNT, SUM, and MAX OF A TIMESTAMP - nothing else.
 *
   The third was added for the business screen's "when did she last do any
   work", after a password reset was found making a dormant clinic look
   active. WHEN a visit was written is metadata of exactly the same kind as
   HOW MANY there are; WHAT it said is the line, and it does not move.
 *
   So MAX is allowed only over a column named like a time - _at or _on.
   MAX(v.diagnosis) is alphabetically the last diagnosis in the clinic and
   is still refused, which the control below proves rather than assumes. */
const countedNotRead = sql =>
  [...sql.matchAll(/(?:FROM|JOIN)\s+(\w+)/g)]
    .map(m => m[1])
    .filter(name => CLINICAL.test(name))
    .every(name => new RegExp(
      '(?:(?:COUNT|SUM)\\s*\\([^)]*\\)|MAX\\s*\\(\\s*(?:\\w+\\.)?\\w*(?:_at|_on)\\s*\\))' +
      '\\s*FROM\\s+' + name + '\\b', 'i').test(sql));

check('every clinical table it touches is counted, never read',
  dashSql.every(countedNotRead),
  'a clinical table is being read rather than counted');
check('CONTROL: MAX over a clinical FIELD is still refused',
  !countedNotRead('SELECT MAX(v.diagnosis) FROM visits v WHERE v.doctor_id = d.id'));
check('CONTROL: and a plain SELECT from a clinical table still is too',
  !countedNotRead('SELECT v.id FROM visits v WHERE v.doctor_id = d.id'));
check('CONTROL: while MAX of a timestamp passes, which is what was added',
  countedNotRead('SELECT MAX(v.created_at) FROM visits v WHERE v.doctor_id = d.id'));
check('and it names no clinical field at all',
  !/\b(diagnosis|complaint|medicine|drug_name|dose|result_value|lab_name|report_name|notes?)\b/i
    .test(dashSql.join(' ')),
  'the owner console must not become a way to read one person\'s record');
check('the scan actually reached the SQL (not passing on an empty set)',
  scanned >= 150, 'only ' + scanned + ' statements found');

/* consultationdraft.js has one statement that is not scoped to a doctor:
   the nightly DELETE of expired sheets, which matches on a timestamp rather
   than on a tenant. That is only defensible because the table is a
   scratchpad - it holds keystrokes, not records, and deleting one costs
   typing rather than history.

   The exemption therefore depends entirely on that file never touching a
   clinical table, which is asserted here rather than assumed. The day
   somebody joins consultation_drafts to visits to make a nicer screen, this
   fails and the DELETE has to be re-argued. */
const scratchSource = readFileSync('worker/consultationdraft.js', 'utf8');
const scratchSql = [...scratchSource.matchAll(/db\.prepare\(\s*([`'"])([\s\S]*?)\1/g)]
  .map(m => m[2]);
check('the consultation scratchpad reads no clinical table at all',
  scratchSql.every(sql => !CLINICAL.test(sql)),
  scratchSql.filter(sql => CLINICAL.test(sql)).join(' | '));
check('and it was actually looking at some SQL', scratchSql.length >= 5,
  scratchSql.length + ' statements');
/* Exactly one statement may skip the doctor_id scope, and it must be the
   sweep. Anything else unscoped in this file is a leak between clinics. */
const scratchUnscoped = scratchSql.filter(sql => !/doctor_id/.test(sql));
check('only the expiry sweep is unscoped, and it only deletes',
  scratchUnscoped.length === 1 && /^\s*DELETE\s+FROM\s+consultation_drafts\s+WHERE\s+expires_at/i
    .test(scratchUnscoped[0]),
  scratchUnscoped.join(' | '));

/* "doctor_id IS NOT NULL" reads like a scope and is the opposite of one: the
   column is NOT NULL on every clinical table, so it matches every row while
   putting the word the scan looks for into the statement. It got four
   statements past the check once. Nothing legitimate needs it - a query is
   either scoped to one doctor or it is a declared exception above. */
const smuggled = [];
for (const file of SQL_MODULES) {
  const source = readFileSync('worker/' + file, 'utf8');
  if (/doctor_id\s+IS\s+NOT\s+NULL/i.test(source)) smuggled.push(file);
}
check('no query fakes a scope with "doctor_id IS NOT NULL"',
  smuggled.length === 0, smuggled.join(', '));

/* The platform console lists every doctor on the platform, so it may COUNT
   their rows - how many patients, how many prescriptions - to bill and
   support them. What it must never do is read what is IN those rows.

   Counting is not reading. "COUNT(*) FROM prescriptions" says a clinic is
   active; "SELECT diagnosis" says what a patient has. The first is our
   business, the second never is. So the ban is on the content columns
   rather than on the tables, which is where the line actually falls. */
const CONTENT = /\b(diagnosis|complaints|advice|private_notes|medicine_name|instructions|rx_number|report_name|findings|observation)\b/;
const platformSource = readFileSync('worker/platform.js', 'utf8');
const platformLeaks = [...platformSource.matchAll(/db\.prepare\(\s*([`'"])([\s\S]*?)\1/g)]
  .map(m => m[2])
  .filter(sql => CONTENT.test(sql));
check('the platform console counts clinical rows but never reads them',
  platformLeaks.length === 0,
  platformLeaks.map(q => q.replace(/\s+/g, ' ').trim().slice(0, 60)).join(' | '));

check('sharedHistory is the only cross-doctor reader, and it checks a grant',
  /async sharedHistory[\s\S]*?activeGrant\([\s\S]*?if \(!grant\)/.test(repoSource));

check('usage events are idempotent', /idempotency_key/.test(repoSource));

/* A prepare() with no SQL throws only when that code path runs, so it can
   deploy green and fail at a doctor's desk. Caught once already. */
const codeOnly = repoSource.replace(/\/\*[\s\S]*?\*\//g, '');
check('no db.prepare() call is left without SQL',
  !/db\.prepare\(\s*\)/.test(codeOnly));
/* SQL should be a literal at the call site. One function legitimately builds
   its SET clause from an allow-list of column names; this pins that to
   exactly one place so a second dynamic query cannot appear unnoticed. */
const dynamicPrepares = [...codeOnly.matchAll(/db\.prepare\(\s*([A-Za-z_$][\w$]*)\s*\)/g)]
  .map(m => m[1]);
check('SQL is a literal everywhere except one allow-listed builder',
  dynamicPrepares.length === 1 && dynamicPrepares[0] === 'sql',
  dynamicPrepares.join(', '));
check('that builder filters column names against an allow-list',
  /const allowed = \[[\s\S]*?\];[\s\S]*?filter\(k => allowed\.includes\(k\)\)/.test(repoSource));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
