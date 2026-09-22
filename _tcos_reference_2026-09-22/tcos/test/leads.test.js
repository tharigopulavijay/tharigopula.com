/* =========================================================================
   Bookings from other platforms, in one inbox.

   Vijay: "we need to bring the different platforms integration so that
   doctors can track their different lead platforms from one place."

   Four things this holds in place, in order of what they would cost:

     1. A LEAD CREATES NO PATIENT. The obvious build upserts the patient on
        (doctor_id, mobile). That is the bug that once merged a wife's
        records into her husband's chart - in India one number is the whole
        household. A booking carries a name and a number; the doctor decides
        which person that is when she accepts it.
     2. A RETRY IS A NO-OP. Every one of these platforms re-sends when it
        does not get a clean 200. A retried booking that becomes a second row
        is two people in the diary at the same time.
     3. ONE INBOX. Leads land in appointment_requests beside her own page's
        bookings. A separate table would mean two lists to watch, which is
        the problem this feature exists to solve.
     4. A TIME WE CANNOT READ IS NO TIME. A booking in the wrong slot is
        worse than a booking with no slot on it.

   Run:  node test/leads.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { leads, normalise, SOURCES } from '../worker/leads.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};
const caught = async fn => {
  try { await fn(); return null; } catch (error) { return error; }
};

const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync('schema.sql', 'utf8'));
/* appointment_requests has a foreign key to appointments, which arrives in a
   migration this test does not otherwise need. Enough of it to satisfy the
   reference; the accept flow that fills it has its own suite. */
raw.exec(`CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY, doctor_id TEXT NOT NULL, patient_id TEXT,
  scheduled_on TEXT, scheduled_at TEXT, status TEXT)`);
for (const file of ['006-public-page.sql', '058-lead-sources.sql']) {
  const sql = readFileSync('migrations/' + file, 'utf8').replace(/--[^\n]*/g, '');
  for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    try { raw.exec(statement); } catch (_) { /* already present */ }
  }
}
raw.exec(`INSERT INTO doctors (id, mobile, full_name, clinic_name, status)
          VALUES ('doc_A','+919000000001','Dr A','Clinic A','active'),
                 ('doc_B','+919000000002','Dr B','Clinic B','active')`);

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

console.log('\nBookings from everywhere, in one inbox\n');

/* ------------------------------- every platform spells it differently --- */

const practo = normalise({
  patient_name: 'Lakshmi Rao', patient_phone: '9876543210',
  preferred_time: '2026-10-02T16:00:00Z', booking_id: 'PR-8891',
  speciality: 'General physician'
}, 'practo');
check('a Practo-shaped booking is read',
  practo.fullName === 'Lakshmi Rao' && practo.externalRef === 'PR-8891');
check('and its mobile normalised to a number we can ring',
  practo.mobile === '+919876543210', practo.mobile);
check('with the date and time split out',
  practo.preferredOn === '2026-10-02' && practo.preferredTime === '16:00',
  practo.preferredOn + ' ' + practo.preferredTime);

const justdial = normalise({
  LeadName: 'Ramesh K', Phone: '+91 98765 43211', lead_id: 'JD-5521',
  query: 'Knee pain'
}, 'justdial');
check('a Justdial-shaped booking is read from entirely different field names',
  justdial.fullName === 'Ramesh K' && justdial.mobile === '+919876543211' &&
  justdial.externalRef === 'JD-5521', JSON.stringify(justdial));

const own = normalise({ name: 'Anita', mobile: '9000012345' }, 'website');
check('and so is her own site, with the minimum two fields',
  own.fullName === 'Anita' && own.source === 'website');

check('a booking with no name is refused',
  !!(await caught(async () => normalise({ mobile: '9876543210' }, 'practo'))));
check('a booking with no number is refused, because she cannot ring back',
  !!(await caught(async () => normalise({ name: 'X' }, 'practo'))));
check('and a number that is not a number is refused rather than stored',
  !!(await caught(async () => normalise({ name: 'X', mobile: 'call me' }, 'practo'))));

/* A time we cannot read becomes "she asked, ring her" rather than a wrong
   slot. A booking in the wrong place is worse than one with no time. */
const vague = normalise({ name: 'Y', mobile: '9000000000',
  preferred_time: 'sometime tomorrow evening' }, 'justdial');
check('an unreadable time is left empty, never guessed',
  vague.preferredOn === null && vague.preferredTime === null);

/* Nothing clinical travels in on a lead, and a platform that sends a
   paragraph of symptoms must not turn a booking into a medical record. */
const chatty = normalise({ name: 'Z', mobile: '9000000000',
  message: 'x'.repeat(5000) }, 'other');
check('a long message is capped rather than stored whole',
  chatty.reason.length === 300, String(chatty.reason.length));

/* ------------------------- THE ONE THAT MATTERS: the household rule --- */

const a = await leads.accept(db, 'doc_A',
  normalise({ name: 'Sunita Rao', mobile: '9876500000', booking_id: 'P1' }, 'practo'));
const husband = await leads.accept(db, 'doc_A',
  normalise({ name: 'Mahesh Rao', mobile: '9876500000', booking_id: 'P2' }, 'practo'));

check('two people sharing one mobile both get their own booking',
  a.id !== husband.id && !a.duplicate && !husband.duplicate);
/* This is the assertion that would have failed against the obvious design.
   An upsert on (doctor, phone) would have overwritten Sunita with Mahesh. */
check('and neither name overwrote the other',
  raw.prepare(`SELECT full_name FROM appointment_requests
                WHERE doctor_id='doc_A' AND mobile='+919876500000'
                ORDER BY created_at`).all().map(r => r.full_name).join(',')
    === 'Sunita Rao,Mahesh Rao');
check('NO patient record was created by a lead',
  raw.prepare('SELECT COUNT(*) AS n FROM patients').get().n === 0,
  'the doctor decides which household member this is when she accepts');

const source = readFileSync('worker/leads.js', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
check('the module contains no upsert on a phone number',
  !/ON CONFLICT[^)]*mobile|ON CONFLICT[^)]*phone/i.test(source),
  'one mobile is a household - invariant 6');
check('and does not write to patients at all',
  !/INSERT INTO patients/i.test(source));

/* ---------------------------------------------- a retry is a no-op --- */

const again = await leads.accept(db, 'doc_A',
  normalise({ name: 'Sunita Rao', mobile: '9876500000', booking_id: 'P1' }, 'practo'));
check('the same booking sent twice does not become two',
  again.duplicate === true && again.id === a.id);
check('so the diary cannot hold the same person twice at one time',
  raw.prepare(`SELECT COUNT(*) AS n FROM appointment_requests
                WHERE external_ref='P1'`).get().n === 1);

/* The same reference from a DIFFERENT platform is a different booking. */
const other = await leads.accept(db, 'doc_A',
  normalise({ name: 'Someone', mobile: '9000099999', lead_id: 'P1' }, 'justdial'));
check('but the same reference on another platform is its own booking',
  other.duplicate === false);
/* And another clinic's identical reference must not collide with hers. */
const elsewhere = await leads.accept(db, 'doc_B',
  normalise({ name: 'Other clinic', mobile: '9000088888', booking_id: 'P1' }, 'practo'));
check('and another clinic with the same reference is untouched by hers',
  elsewhere.duplicate === false);

/* ------------------------------------------------------- one inbox --- */

check('leads land in the same table as her own page bookings',
  raw.prepare(`SELECT COUNT(*) AS n FROM appointment_requests
                WHERE doctor_id='doc_A'`).get().n === 3);
check('all waiting, none auto-accepted',
  raw.prepare(`SELECT COUNT(*) AS n FROM appointment_requests
                WHERE doctor_id='doc_A' AND status='new'`).get().n === 3,
  'a lead is a request, not a booking she never agreed to');
check('and no parallel leads table was created',
  raw.prepare(`SELECT COUNT(*) AS n FROM sqlite_master
                WHERE type='table' AND name LIKE '%lead%'`).get().n === 0,
  'two lists is the problem this feature exists to solve');

/* ------------------------------------------------- what came from where --- */

const summary = await leads.summary(db, 'doc_A', 30);
check('she can see how many came from each platform',
  summary.total === 3 && summary.sources.length === 2, JSON.stringify(summary.sources));
check('with a name she recognises, not a slug',
  summary.sources.every(s => s.label && s.label !== s.source) ||
  summary.sources.some(s => s.label === 'Practo'),
  JSON.stringify(summary.sources.map(s => s.label)));
check('and how many she actually accepted, which is the real question',
  summary.sources.every(s => 'acceptedPercent' in s),
  'a platform sending fifty bookings she declines is costing her money');
check('every known source has a human label',
  Object.values(SOURCES).every(label => typeof label === 'string' && label.length > 2));

/* ------------------------------------------------------- the secret --- */

check('a clinic with no secret cannot be found by one',
  (await leads.clinicFor(db, 'anything-at-all-long-enough')) === null);
const secret = await leads.issueSecret(db, 'doc_A');
check('issuing a secret is long enough not to be guessed', secret.length >= 20,
  String(secret.length));
const found = await leads.clinicFor(db, secret);
check('and it identifies exactly one clinic', found && found.id === 'doc_A');
check('a short or empty key is refused before any lookup',
  (await leads.clinicFor(db, '')) === null &&
  (await leads.clinicFor(db, 'short')) === null);
await leads.revokeSecret(db, 'doc_A');
check('revoking it stops the URL working immediately',
  (await leads.clinicFor(db, secret)) === null);

/* ------------------------------------------------------- it is wired --- */

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const router = strip(readFileSync('worker/index.js', 'utf8'));
check('the inbound webhook exists', /'POST \/leads\/inbound':/.test(router));
const at = router.indexOf("'POST /leads/inbound':");
const body = router.slice(at, at + 1400);
check('it is rate limited, being a public URL',
  /enforceSourceRateLimit/.test(body));
check('an invalid key gets 401 and nothing else',
  /401, 'unauthorised'/.test(body),
  'a specific message would make this a way to test whether a key is live');
check('the clinic is found BY the secret, not by an id in the URL',
  /leads\.clinicFor\(env\.DB, secret\)/.test(body));
check('a duplicate answers 200, so the platform stops retrying',
  /already_received/.test(body));
check('her inbox shows where bookings came from',
  /sources: await leads\.summary/.test(router));

/* Bookings from outside her own page are a paid capability. Both ends are
   gated, and the inbound one is the load-bearing half: issuing the URL once
   proves nothing about whether she is still entitled a month later. */
check('issuing the webhook URL needs the plan',
  /leads\.issueSecret/.test(router) &&
  /requireFeature\(doctor, 'website_connect'\)[\s\S]{0,200}leads\.issueSecret/.test(router),
  'a free clinic could otherwise mint a working URL');
check('and EVERY inbound booking is checked, not just the day it was issued',
  /hasFeature\(clinic, 'website_connect'\)/.test(body),
  'a clinic that drops to Free would keep a working webhook indefinitely');
check('a clinic that lost the plan is refused with 402, not 401',
  /402, 'plan_feature'/.test(body),
  'this is "not on your plan", not "who are you"');
check('and the refusal says the booking was not silently swallowed',
  /Nothing was lost/.test(body));
/* The plan cannot be checked without reading it. */
const leadSource = readFileSync('worker/leads.js', 'utf8');
check('the clinic lookup returns what the entitlement check needs',
  /plan, feature_overrides/.test(leadSource));

/* --------------------------------------------- she can see it --------- */

/* The API returned `sources` for a day before anything showed it. A number
   nobody can see is a number nobody acts on. */
const todayJs = readFileSync('js/today.js', 'utf8');
check('a booking from another platform is badged on the card',
  /sourceBadge\(request\)/.test(todayJs) && /Practo/.test(todayJs));
/* Her own page and the counter are the ordinary cases. Badging everything
   badges nothing. */
check('but her own page and walk-ins carry no badge',
  !/website:\s*'/.test(todayJs) && !/walk_in:\s*'/.test(todayJs),
  'labelling every row tells her nothing');
check('and the last month is summarised above the list',
  /Last 30 days/.test(todayJs));
check('showing the accepted share, which is the number that matters',
  /acceptedPercent/.test(todayJs),
  'a platform sending fifty she declines is a fee for nothing');
check('the summary is hidden when every booking came from her own page',
  /filter\(s => s\.source !== 'website'/.test(todayJs),
  'a breakdown of one source is not a breakdown');

/* ------------------------------------------------------------ controls --- */

check('CONTROL: the database was really written',
  raw.prepare('SELECT COUNT(*) AS n FROM appointment_requests').get().n === 4);
check('CONTROL: a platform nobody sent is absent',
  !summary.sources.some(s => s.source === 'zznotreal'));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
