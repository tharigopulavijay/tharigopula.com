/* =========================================================================
   Which DNS record a clinic is told to create.

   Getting this wrong does not throw. The doctor is handed a record, creates
   it exactly as instructed, and the domain never resolves - and there is
   nothing in any log to say why, because from the software's side nothing
   failed.

   Two bugs live here, both found that way:

   8 Sep 2026 - apex detection counted labels, so clinic.co.in looked like a
   subdomain of co.in. A .co.in is an ordinary Indian business domain, so
   this was wrong for a large share of exactly the customers this product is
   for.

   12 Sep 2026 - the records pointed at the PLATFORM domain and an apex was
   offered an A record. Both resolve beautifully and neither works:
   Cloudflare for SaaS routes by hostname, so the edge answers 409 for a name
   it has not been told about, and there is no IP to give. Proved by pointing
   a domain we owned at our address by hand - TLS handshake failed over 443, 409
   over 80.

   Run:  node test/domains.test.js
   ========================================================================= */

import { dnsRecords, normaliseDomain, hostnamesFor } from '../worker/domains.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const FALLBACK = 'clinics.tharigopula.com';
const env = { CLINIC_DOMAIN: 'tharigopula.com', CLINIC_FALLBACK_ORIGIN: FALLBACK };
/* Cloudflare for SaaS not set up yet - the state production is in until the
   fallback origin exists. */
const bare = { CLINIC_DOMAIN: 'tharigopula.com', CLINIC_FALLBACK_ORIGIN: '' };

const routing = (domain, e = env) =>
  dnsRecords(e, domain).filter(r => r.purpose === 'routing');
const apexRow = (domain, e = env) => routing(domain, e).find(r => r.name === '@') || null;

console.log('\nIndian domains, which is what this product actually sells into\n');

check('clinic.co.in is an apex, not a subdomain', !!apexRow('clinic.co.in'));
check('drdevi.co.in is an apex', !!apexRow('drdevi.co.in'));
check('a .net.in is an apex', !!apexRow('surgery.net.in'));
check('an .org.in is an apex', !!apexRow('trust.org.in'));
check('an .ac.in is an apex', !!apexRow('college.ac.in'));

console.log('\nSubdomains get one record and no www\n');

for (const d of ['book.clinic.co.in', 'www.clinic.co.in', 'book.drdevi.com']) {
  const rows = routing(d);
  check(d + ' gets a single CNAME',
    rows.length === 1 && rows[0].type === 'CNAME' && rows[0].name !== '@',
    JSON.stringify(rows));
}

console.log('\nOrdinary single-label TLDs are unchanged\n');

for (const d of ['drdevi.com', 'drdevi.in', 'devi.clinic', 'devi.health']) {
  check(d + ' is an apex', !!apexRow(d));
}

console.log('\nNo A record is ever offered - there is no IP to give\n');

/* The 12 Sep bug. An A record here is not "incomplete", it is actively
   wrong: it resolves, so every DNS checker says the setup is correct, and
   the edge answers 409 because Cloudflare for SaaS routes by hostname. */
const everyRecord = ['drdevi.com', 'clinic.co.in', 'book.drdevi.com']
  .flatMap(d => dnsRecords(env, d));
check('not one record is an A record',
  everyRecord.every(r => r.type !== 'A'),
  JSON.stringify(everyRecord.filter(r => r.type === 'A')));

console.log('\nRouting points at the fallback origin, not the platform domain\n');

/* Pointing at tharigopula.com is what produced the 409. The fallback origin
   is the proxied hostname that tells the edge whose account this is. */
check('the apex CNAME targets the fallback origin',
  (apexRow('drdevi.com') || {}).value === FALLBACK,
  JSON.stringify(apexRow('drdevi.com')));
check('so does the subdomain CNAME', routing('book.drdevi.com')[0].value === FALLBACK);
check('and nothing is ever pointed at the platform domain itself',
  everyRecord.every(r => r.value !== 'tharigopula.com'),
  JSON.stringify(everyRecord.filter(r => r.value === 'tharigopula.com')));

console.log('\nAn apex also gets www, because patients type it\n');

const apexRows = routing('drdevi.com');
check('an apex is given both the bare name and www',
  apexRows.length === 2 && apexRows.some(r => r.name === '@') &&
  apexRows.some(r => r.name === 'www'), JSON.stringify(apexRows));
check('and the apex row explains ALIAS/ANAME and the forwarding way out',
  /ALIAS or ANAME/.test(apexRow('drdevi.com').note) &&
  /forwarding/.test(apexRow('drdevi.com').note),
  apexRow('drdevi.com').note);

/* Two names means two certificates. A doctor who puts drclinic.com on her
   signboard still has patients typing www, and a certificate error on a
   doctor's domain looks like she has been hacked. */
check('an apex needs two hostnames registered at the edge',
  hostnamesFor('drdevi.com').join(',') === 'drdevi.com,www.drdevi.com',
  hostnamesFor('drdevi.com').join(','));
check('a subdomain needs one',
  hostnamesFor('book.drdevi.com').join(',') === 'book.drdevi.com');
check('a .co.in apex needs two as well',
  hostnamesFor('clinic.co.in').length === 2, hostnamesFor('clinic.co.in').join(','));

console.log('\nProof records come before routing records\n');

/* Order is not cosmetic. Proving ownership can be done while her existing
   website is still serving; switching the CNAME cannot. Done in this order
   the certificate is waiting when she cuts over, so a clinic's live site is
   never down. */
const proofs = [{
  hostname: 'drdevi.com',
  ownership: { name: '_cf-custom-hostname.drdevi.com', value: 'abc-123' },
  validation: { name: '_acme-challenge.drdevi.com', value: 'xyz-789' }
}];
const withProof = dnsRecords(env, 'drdevi.com', proofs);
check('the ownership TXT is shown', withProof.some(
  r => r.type === 'TXT' && r.purpose === 'ownership' && r.value === 'abc-123'));
check('the certificate TXT is shown', withProof.some(
  r => r.type === 'TXT' && r.purpose === 'certificate' && r.value === 'xyz-789'));
check('and both come before the CNAMEs',
  withProof.findIndex(r => r.purpose === 'routing') >
  withProof.map(r => r.purpose).lastIndexOf('certificate'),
  withProof.map(r => r.purpose).join(' > '));
check('each proof row names the hostname it belongs to',
  withProof.filter(r => r.type === 'TXT').every(r => r.for === 'drdevi.com'));

console.log('\nBefore Cloudflare for SaaS is set up, nothing is invented\n');

/* This is the rule the whole file exists for: showing a doctor instructions
   that cannot succeed is worse than telling her it is not ready. */
check('with no fallback origin, no routing record is printed',
  routing('drdevi.com', bare).length === 0,
  JSON.stringify(routing('drdevi.com', bare)));
check('and no record at all, since there is nothing to show',
  dnsRecords(bare, 'drdevi.com').length === 0);
check('but her proof records still show if she already has them',
  dnsRecords(bare, 'drdevi.com', proofs).length === 2);

console.log('\nWhat a doctor will actually paste\n');

check('a full URL is accepted', normaliseDomain('https://Dr-Devi.co.in/') === 'dr-devi.co.in',
  normaliseDomain('https://Dr-Devi.co.in/'));
check('capitals and spaces are cleaned', normaliseDomain('  DrDevi.COM ') === 'drdevi.com',
  normaliseDomain('  DrDevi.COM '));
check('www is stripped so two clinics cannot own halves of one domain',
  normaliseDomain('www.drdevi.com') === 'drdevi.com');

console.log('\nThe check can fail\n');

/* CONTROL. If apex and subdomain produced the same records, every
   assertion above would pass for the wrong reason. */
check('CONTROL: apex and subdomain really do differ',
  !!apexRow('drdevi.com') !== !!apexRow('book.drdevi.com'),
  routing('drdevi.com').length + ' vs ' + routing('book.drdevi.com').length);

/* CONTROL: the old rule would have failed the .co.in case, so this file
   genuinely covers the bug rather than describing the fix. */
const oldRule = d => String(d || '').split('.').length <= 2;
check('CONTROL: the OLD rule got clinic.co.in wrong',
  oldRule('clinic.co.in') === false);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
