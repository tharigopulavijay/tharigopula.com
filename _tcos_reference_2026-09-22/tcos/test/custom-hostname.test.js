/* =========================================================================
   A certificate for a domain we do not own.

   What this holds in place is the difference between the screen SAYING a
   doctor's domain is connected and a patient's browser actually opening it.

   The bug, proved by hand on 12 Sep 2026 by pointing a domain we owned at our
   address:

     https  TLS handshake FAILS  - no certificate exists for that name
     http   409                  - the edge refuses a hostname it does not know

   Both answers come from Cloudflare before any of our code runs, and no DNS
   record a doctor can create changes either. So the assertions here are
   about the four things that actually decide whether her domain works:

     1. Refuse honestly when Cloudflare for SaaS is not set up, rather than
        printing DNS instructions that cannot succeed. That was the original
        bug wearing a different hat.
     2. Register the hostname BEFORE showing her records - the records are
        Cloudflare's, generated for her domain, not ones we made up.
     3. An apex registers www too. A certificate error on a doctor's own
        domain looks to a patient like she has been hacked.
     4. Disconnecting DELETES the hostname at Cloudflare. Left behind, it
        bills forever and locks that domain out of every other Cloudflare
        account - including hers.

   Run:  node test/custom-hostname.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const configured = {
  CF_API_TOKEN: 'test-token', CF_ZONE_ID: 'zone123',
  CLINIC_FALLBACK_ORIGIN: 'clinics.tharigopula.com',
  CUSTOM_HOSTNAME_EDGE_ROUTING_READY: 'true',
  CLINIC_DOMAIN: 'tharigopula.com'
};
const unset = { CLINIC_DOMAIN: 'tharigopula.com' };

/* ---------------------------------------------------- a fake Cloudflare --- */

let calls = [];
let created = new Map();
let nextFailure = null;

const cfResult = (hostname, over = {}) => ({
  id: 'ch_' + hostname.replace(/\W/g, '_'),
  hostname,
  status: 'pending',
  ssl: {
    status: 'pending_validation',
    validation_records: [{ txt_name: '_acme-challenge.' + hostname, txt_value: 'dv-' + hostname }],
    validation_errors: [],
    ...(over.ssl || {})
  },
  ownership_verification: { type: 'txt', name: '_cf-custom-hostname.' + hostname,
    value: 'own-' + hostname },
  ...over
});

globalThis.fetch = async (url, init = {}) => {
  const method = init.method || 'GET';
  calls.push({ url: String(url), method, auth: (init.headers || {}).Authorization });

  if (nextFailure) { const f = nextFailure; nextFailure = null; return f(); }

  const path = String(url).replace('https://api.cloudflare.com/client/v4/zones/zone123', '');

  if (method === 'POST' && path === '/custom_hostnames') {
    const sent = JSON.parse(init.body);
    created.set(sent.hostname, { ...cfResult(sent.hostname), _sent: sent });
    return json({ success: true, result: created.get(sent.hostname) });
  }
  if (method === 'GET' && path.startsWith('/custom_hostnames?hostname=')) {
    const name = decodeURIComponent(path.split('=')[1]);
    const hit = created.get(name);
    return json({ success: true, result: hit ? [hit] : [] });
  }
  /* The whole list, which is what the usage readout counts. */
  if (method === 'GET' && path.startsWith('/custom_hostnames?per_page=')) {
    return json({ success: true, result: [...created.values()] });
  }
  if (method === 'GET' && path === '/custom_hostnames/quota') {
    return json({ success: true, result: {
      used: created.size, allocated: 100, hard_cap: 5000,
      exceeded: created.size >= 100
    } });
  }
  if (method === 'GET' && path.startsWith('/custom_hostnames/')) {
    const id = path.split('/').pop();
    const hit = [...created.values()].find(r => r.id === id);
    if (!hit) return json({ success: false, errors: [{ code: 1436, message: 'not found' }] });
    return json({ success: true, result: hit });
  }
  if (method === 'DELETE' && path.startsWith('/custom_hostnames/')) {
    const id = path.split('/').pop();
    const hit = [...created.values()].find(r => r.id === id);
    if (!hit) return json({ success: false, errors: [{ code: 1436, message: 'not found' }] });
    created.delete(hit.hostname);
    return json({ success: true, result: { id } });
  }
  return json({ success: false, errors: [{ code: 0, message: 'unexpected ' + method + ' ' + path }] });
};
const json = body => new Response(JSON.stringify(body),
  { status: 200, headers: { 'Content-Type': 'application/json' } });

const ch = await import('../worker/customhostname.js');
const { domains, dnsRecords, hostnamesFor } = await import('../worker/domains.js');

/* ----------------------------------------------------------- a fake D1 --- */

function fakeDb(row) {
  const doctor = { id: 'doc1', ...row };
  const statements = [];
  return {
    doctor, statements,
    prepare(sql) {
      return {
        bind(...args) { return { sql, args,
          async run() { statements.push({ sql, args }); apply(doctor, sql, args); return {}; },
          async first() { return null; } }; }
      };
    }
  };
}
/* Just enough of D1 to see what a route actually wrote. Deliberately naive:
   the point is to read back the values, not to reimplement SQLite. */
function apply(doctor, sql, args) {
  const columns = [...sql.matchAll(/(\w+)\s*=\s*(\?|NULL|'[^']*')/g)].map(m => [m[1], m[2]]);
  let i = 0;
  for (const [column, token] of columns) {
    if (token === '?') doctor[column] = args[i++];
    else if (token === 'NULL') doctor[column] = null;
    else doctor[column] = token.slice(1, -1);
  }
}

console.log('\nA certificate for a domain we do not own\n');

/* ------------------------------------ 1. honest refusal when unconfigured --- */

check('unconfigured is reported as unconfigured', ch.configured(unset) === false);
check('and configured as configured', ch.configured(configured) === true);
check('health names exactly what is missing',
  ch.health(unset).missing.join(',') ===
    'CF_API_TOKEN,CF_ZONE_ID,CLINIC_FALLBACK_ORIGIN,CUSTOM_HOSTNAME_EDGE_ROUTING_READY',
  ch.health(unset).missing.join(','));

let refused = null;
try { await domains.claim(fakeDb({}), unset, 'doc1', 'drdevi.com'); }
catch (error) { refused = error; }
check('claiming a domain with no certificate service REFUSES',
  refused && refused.status === 503, String(refused));
check('and says her free address still works',
  refused && /free TCOS web address keeps working/i.test(refused.message),
  refused && refused.message);
/* The whole original bug: she was told to create records, created them
   perfectly, and reached nothing. */
check('nothing was written, so she is not left with a dead domain stored',
  refused && !refused.wrote);

/* -------------------------------------------- 2. registered before shown --- */

calls = []; created = new Map();
const db = fakeDb({});
const claimed = await domains.claim(db, configured, 'doc1', 'https://DrDevi.com/');

check('the domain is normalised before anything else',
  claimed.domain === 'drdevi.com', claimed.domain);
check('a custom hostname was created at Cloudflare',
  calls.some(c => c.method === 'POST' && c.url.endsWith('/custom_hostnames')));
check('with the zone in the path, not guessed from the hostname',
  calls.every(c => c.url.includes('/zones/zone123/')));
check('and the token in an Authorization header, never in the URL',
  calls.every(c => c.auth === 'Bearer test-token' && !c.url.includes('test-token')));

const sent = created.get('drdevi.com')._sent;
check('DNS validation is requested, not HTTP',
  sent.ssl.method === 'txt' && sent.ssl.type === 'dv', JSON.stringify(sent.ssl));
/* HTTP validation needs her traffic already reaching us, which cannot be
   true while her old website is still live. TXT lets the certificate be
   issued first and the cutover happen with no gap. */
check('no wildcard - she is connecting her site, not delegating her domain',
  sent.ssl.wildcard === false);
check('and TLS 1.2 is the floor', sent.ssl.settings.min_tls_version === '1.2');

check('the records shown are Cloudflare\'s, for HER domain',
  claimed.records.some(r => r.value === 'own-drdevi.com') &&
  claimed.records.some(r => r.value === 'dv-drdevi.com'),
  JSON.stringify(claimed.records));

/* ------------------------------------------------ 3. an apex covers www --- */

check('an apex registered both names',
  created.has('drdevi.com') && created.has('www.drdevi.com'),
  [...created.keys()].join(','));
check('both ids were stored, or the www one could never be deleted',
  db.doctor.custom_hostname_id === 'ch_drdevi_com' &&
  db.doctor.custom_hostname_www_id === 'ch_www_drdevi_com',
  db.doctor.custom_hostname_id + ' / ' + db.doctor.custom_hostname_www_id);
check('and she is shown proof records for both',
  claimed.records.filter(r => r.type === 'TXT' && r.for === 'www.drdevi.com').length === 2,
  JSON.stringify(claimed.records.map(r => r.for)));

calls = []; created = new Map();
const subDb = fakeDb({});
await domains.claim(subDb, configured, 'doc1', 'book.drdevi.com');
check('a subdomain registers one hostname and no www',
  created.size === 1 && created.has('book.drdevi.com'), [...created.keys()].join(','));
check('and leaves the www id null',
  subDb.doctor.custom_hostname_www_id === null, String(subDb.doctor.custom_hostname_www_id));

/* --------------------------------------- the status is never invented --- */

calls = []; created = new Map();
const liveDb = fakeDb({});
await domains.claim(liveDb, configured, 'doc1', 'drdevi.com');

check('a freshly claimed domain is pending, not active',
  liveDb.doctor.custom_domain_status === 'pending', liveDb.doctor.custom_domain_status);
check('and has no active_at, because it is not serving anyone',
  !liveDb.doctor.custom_domain_active_at);

let result = await domains.check(liveDb.prepare ? liveDb : liveDb, configured,
  'doc1', 'drdevi.com', liveDb.doctor);
check('checking asks Cloudflare rather than resolving DNS ourselves',
  calls.some(c => c.url.includes('/custom_hostnames/ch_drdevi_com')) &&
  !calls.some(c => c.url.includes('cloudflare-dns.com')),
  'a CNAME that resolves proves she typed a record, not that a browser will open it');
check('and still says pending while validation is outstanding',
  result.status === 'pending', result.status);
check('with a next step in words, not Cloudflare\'s status strings',
  /Add the records below/i.test(result.message) &&
  !/pending_validation/.test(result.message), result.message);

/* Certificate issued and the edge accepting the hostname - both, for both
   names. Anything less is not "live". */
for (const record of created.values()) {
  record.ssl.status = 'active';
  record.status = 'active';
}
result = await domains.check(liveDb, configured, 'doc1', 'drdevi.com', liveDb.doctor);
check('once BOTH hostnames are active, so is the domain',
  result.status === 'active', result.status);
check('and active_at is stamped', !!liveDb.doctor.custom_domain_active_at);
check('her page is described as live and secure',
  /live and secure/i.test(result.message), result.message);

/* One name lagging must not be reported as done. */
[...created.values()][1].ssl.status = 'pending_issuance';
result = await domains.check(liveDb, configured, 'doc1', 'drdevi.com', liveDb.doctor);
check('a www that is still issuing is NOT reported as active',
  result.status === 'issuing', result.status);
check('and she is told it needs nothing from her',
  /needs nothing from you/i.test(result.message), result.message);

/* A validation failure must carry Cloudflare's own wording - paraphrasing
   "CAA record prevents issuance" loses the one word she can search for. */
[...created.values()][1].ssl.status = 'pending_validation';
[...created.values()][1].ssl.validation_errors =
  [{ message: 'caa_error: CAA record prevents issuance' }];
result = await domains.check(liveDb, configured, 'doc1', 'drdevi.com', liveDb.doctor);
check('a validation failure is reported as failed', result.status === 'failed', result.status);
check('and Cloudflare\'s own wording is kept',
  /CAA record prevents issuance/.test(result.error || ''), result.error);

/* ---------------------------------------- recovering a lost hostname id --- */

calls = [];
const orphan = fakeDb({ custom_domain: 'drdevi.com' });
orphan.doctor.custom_hostname_id = null;
orphan.doctor.custom_hostname_www_id = null;
await domains.check(orphan, configured, 'doc1', 'drdevi.com', orphan.doctor);
check('a domain whose id we lost is found by name rather than duplicated',
  calls.some(c => c.url.includes('custom_hostnames?hostname=')) &&
  !calls.some(c => c.method === 'POST'),
  'creating a second hostname for the same name is refused by Cloudflare');
check('and the id is written back',
  orphan.doctor.custom_hostname_id === 'ch_drdevi_com', orphan.doctor.custom_hostname_id);

calls = []; created = new Map();
const fresh = fakeDb({ custom_domain: 'newclinic.com' });
await domains.check(fresh, configured, 'doc1', 'newclinic.com', fresh.doctor);
check('a domain claimed before this shipped is registered on first check',
  created.has('newclinic.com'), [...created.keys()].join(','));

/* ------------------------------------------------ 4. disconnect deletes --- */

calls = [];
const before = created.size;
await domains.release(fresh, configured, 'doc1', fresh.doctor);
check('disconnecting DELETES the hostname at Cloudflare',
  calls.some(c => c.method === 'DELETE'), JSON.stringify(calls.map(c => c.method)));
check('so it stops billing and stops locking the domain out',
  created.size < before || !created.has('newclinic.com'));
check('and the local row is cleared', fresh.doctor.custom_domain === null &&
  fresh.doctor.custom_hostname_id === null &&
  fresh.doctor.custom_domain_records === null);

/* Deleting something already gone is the outcome we wanted, not an error -
   otherwise a doctor can never disconnect a domain that was tidied up by
   hand at Cloudflare. */
const gone = await ch.remove(configured, 'ch_does_not_exist');
check('deleting an already-deleted hostname succeeds quietly', gone.removed === true);
check('and asking for a deleted hostname returns nothing rather than raising',
  (await ch.status(configured, 'ch_does_not_exist')) === null);

/* ------------------------------------------------- when Cloudflare is down --- */

nextFailure = () => { throw new TypeError('network'); };
let netError = null;
try { await ch.status(configured, 'ch_drdevi_com'); } catch (error) { netError = error; }
check('an unreachable API says so rather than blaming her DNS',
  netError && netError.status === 502 &&
  /could not reach the certificate service/i.test(netError.message), String(netError));
check('and tells her the settings are saved, so she does not undo correct records',
  netError && /settings are saved/i.test(netError.message));

/* Cloudflare answers 200 with success:false as readily as it answers 4xx. */
nextFailure = () => json({ success: false, errors: [{ code: 1234, message: 'token lacks permission' }] });
let apiError = null;
try { await ch.status(configured, 'ch_drdevi_com'); } catch (error) { apiError = error; }
check('success:false on a 200 is still a failure', apiError && apiError.status === 502);
check('and our token problem is NOT shown to the doctor',
  apiError && !/token/i.test(apiError.message), apiError && apiError.message);
check('but it is kept where an operator can read it',
  apiError && /token lacks permission/.test(apiError.detail || ''), apiError && apiError.detail);

/* --------------------------------------- it finishes without her watching --- */

/* A certificate arrives minutes after her DNS spreads, and she has no way to
   know when. Without a sweep she either sits pressing a button or - far more
   likely - closes the tab convinced it did not work. */
calls = []; created = new Map();
const waiting = [
  { id: 'd1', custom_domain: 'one.com', custom_hostname_id: null },
  { id: 'd2', custom_domain: 'two.com', custom_hostname_id: null }
];
const sweepDb = {
  rows: [],
  prepare(sql) {
    return {
      bind(...args) {
        return {
          sql, args,
          async all() { return { results: /SELECT/.test(sql) ? waiting : [] }; },
          async run() { sweepDb.rows.push({ sql, args }); return {}; },
          async first() { return null; }
        };
      }
    };
  }
};
const swept = await domains.sweep(sweepDb, configured);
check('the sweep checks every domain still waiting', swept.checked === 2,
  JSON.stringify(swept));
check('and registers the ones that were never registered',
  created.has('one.com') && created.has('two.com'), [...created.keys()].join(','));
check('and writes each result back, or tomorrow it checks the same two again',
  sweepDb.rows.filter(r => /UPDATE doctors/.test(r.sql)).length === 2,
  String(sweepDb.rows.length));

const domainsSource = readFileSync('worker/domains.js', 'utf8');
check('the sweep query is limited to domains still waiting',
  /custom_domain_status IN \('pending','issuing','verifying'\)/.test(domainsSource));
check('and is capped, so it cannot run the cron out of time',
  /LIMIT \?/.test(domainsSource));
check('one broken domain does not stop the rest being checked',
  /catch \(error\) \{\s*console\.error\('domain sweep'/.test(domainsSource));

/* With nothing configured it must not run at all, rather than raising on
   every doctor every night. */
check('the sweep is silent when custom domains are not set up',
  (await domains.sweep(sweepDb, unset)).skipped === 'not_configured');

/* ----------------------- routing is an explicit edge prerequisite ------- */

/* Custom Hostnames arrive through one provider-zone Worker route. That is
   infrastructure with a marketing-site blast radius, so it is installed and
   hand-proved once, not created by a request that happens to contain a
   doctor's domain. Runtime certificate code must not need Workers-route
   permissions at all. */
const chSource = readFileSync('worker/customhostname.js', 'utf8');
const domainSource = readFileSync('worker/domains.js', 'utf8');
check('runtime code cannot create or remove Worker routes',
  !/workers\/routes|attachRoute|detachRoute/.test(chSource + domainSource));
check('a missing edge-routing proof keeps custom domains unavailable',
  ch.configured({ ...configured, CUSTOM_HOSTNAME_EDGE_ROUTING_READY: 'false' }) === false);
check('but pausing new claims keeps certificate cleanup available',
  ch.serviceConfigured({ ...configured, CUSTOM_HOSTNAME_EDGE_ROUTING_READY: 'false' }) === true);

/* ----------------------------------------- provider-confirmed capacity --- */

/* A copied public price is not an invoice. The quota endpoint is the source
   of truth for the account's usable hostname capacity. */
created = new Map();
for (let i = 0; i < 40; i++) {
  created.set('c' + i + '.com', cfResult('c' + i + '.com', { status: 'active',
    ssl: { status: 'active', validation_records: [], validation_errors: [] } }));
}
let use = await ch.usage(configured);
check('usage comes from the provider quota',
  use.total === 40 && use.allocated === 100 && use.hardCap === 5000,
  JSON.stringify(use));

for (let i = 40; i < 130; i++) {
  created.set('c' + i + '.com', cfResult('c' + i + '.com', { status: 'active',
    ssl: { status: 'active', validation_records: [], validation_errors: [] } }));
}
use = await ch.usage(configured);
check('quota warns when the provider allocation is reached',
  use.total === 130 && use.exceeded === true, JSON.stringify(use));

/* The ones worth chasing: billed from creation, serving nobody. Usually a
   doctor who started and gave up halfway through her DNS. */
created.set('abandoned.com', cfResult('abandoned.com'));
use = await ch.usage(configured);
check('hostnames not serving are counted separately',
  use.pending === 1, String(use.pending));

check('and with nothing configured it reports that rather than a number',
  (await ch.usage(unset)).configured === false);

/* ---------------------------------------------------- wired into the app --- */

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const router = strip(readFileSync('worker/index.js', 'utf8'));
check('the claim route drives the certificate flow',
  /domains\.claim\(env\.DB, env, doctor\.id/.test(router));
check('the check route passes the doctor, so stored ids are used',
  /domains\.check\(\s*env\.DB, env, doctor\.id, doctor\.custom_domain, doctor\)/.test(router));
check('disconnecting passes the doctor, or the hostname is orphaned at Cloudflare',
  /domains\.release\(env\.DB, env, doctor\.id, doctor\)/.test(router));
check('the screen is told whether this is available at all',
  /available: customHostname\.configured\(env\)/.test(router));
check('the nightly cron runs the sweep',
  /domains\.sweep\(env\.DB, env\)/.test(router));

/* Comments stripped first. Three assertions in this repo have fired on their
   own explanatory comment - a note saying "X is gone and here is why" reads
   to a grep exactly like X still being there. */
const rawConfig = readFileSync('wrangler.jsonc', 'utf8');
const config = strip(rawConfig);
check('CF_API_TOKEN is a secret, never a var',
  /CF_API_TOKEN/.test(rawConfig) && !/"CF_API_TOKEN"\s*:/.test(config));
check('CLINIC_APEX_IP is gone - there is no IP that works',
  !/CLINIC_APEX_IP/.test(config));
check('CONTROL: stripping comments did not empty the config',
  /"CLINIC_DOMAIN"/.test(config) && config.length > 400);
check('the zone and fallback origin are declared',
  /"CF_ZONE_ID"\s*:/.test(config) && /"CLINIC_FALLBACK_ORIGIN"\s*:/.test(config));

const migration = readFileSync('migrations/056-custom-hostnames.sql', 'utf8');
for (const column of ['custom_hostname_id', 'custom_hostname_www_id',
                      'custom_domain_records', 'custom_domain_ssl_status']) {
  check('the migration adds ' + column, migration.includes(column));
}

/* ------------------------------------------------------------- controls --- */

check('CONTROL: the fake Cloudflare was actually called', calls.length > 0);
check('CONTROL: the router was really read', router.length > 50000);
check('CONTROL: a hostname nobody registered is absent',
  !created.has('zzz-not-a-domain.com'));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
