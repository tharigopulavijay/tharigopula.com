/* =========================================================================
   The screen nobody signs in to.

   Until 8 September 2026 js/patient.js pointed at tcos-demo-api. Every
   patient link a real clinic sent was therefore checked against the DEMO
   database. The token was genuine - production minted it - it simply was
   not in the database being asked, so the patient read "this link is not
   valid" and the clinic never knew.

   Nothing threw. Nothing was logged. The identical defect had already been
   found and fixed in js/tcos-api.js during the fork, and this file was
   missed, because it is the one screen you never open while testing: there
   is no sign-in, so it is not on the way to anything else.

   These assertions are cheap and would have caught it on the day.

   Run:  node test/patient-portal.test.js
   ========================================================================= */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* ------------------------------------------- nothing points at the demo --- */
console.log('\nNo shipped code talks to a demo or staging worker by accident\n');

const browserFiles = readdirSync('js').filter(f => f.endsWith('.js'));
const pages = readdirSync('.').filter(f => f.endsWith('.html'));

/* demo.html is allowed to be the demo. Everything else is not. */
const ALLOWED_DEMO = new Set(['demo.html']);

const offenders = [];
for (const file of [...browserFiles.map(f => join('js', f)), ...pages]) {
  if (ALLOWED_DEMO.has(file)) continue;
  const text = readFileSync(file, 'utf8');
  /* Ignore prose: a comment explaining the bug must not itself fail the
     test. Only a real assignment counts. */
  const assigns = text.match(/['"]https:\/\/[a-z0-9-]*demo[a-z0-9-]*\.hello-tharigopula\.workers\.dev['"]/g);
  if (assigns) offenders.push(file + ' -> ' + assigns.join(', '));
}
check('no browser module hard-codes a demo API host', offenders.length === 0,
  offenders.join(' | '));

/* --------------------------------------------------- the portal itself --- */
console.log('\nThe patient portal reaches the API that minted the token\n');

const portal = readFileSync('js/patient.js', 'utf8');

check('the portal points at the production API',
  /https:\/\/tcos-api\.hello-tharigopula\.workers\.dev/.test(portal));
check('the portal does NOT point at the demo API',
  !/const API\s*=\s*['"]https:\/\/tcos-demo-api/.test(portal));

/* A patient link opened from the staging site must be checked by staging,
   or staging testing silently exercises production data. */
check('staging resolves to the staging API',
  /STAGING_APP_HOST = 'staging\.tcos\.tharigopula\.com'/.test(portal) &&
  /location\.hostname === STAGING_APP_HOST/.test(portal));
check('legacy staging Pages links preserve their token while moving hosts',
  /ON_OLD_STAGING/.test(portal) && /location\.replace/.test(portal) &&
  /location\.search \+ location\.hash/.test(portal));
check('local development resolves to the local worker',
  /127\.0\.0\.1:8787/.test(portal));

/* The rule that makes the above stay true: this file resolves the host the
   same way the signed-in client does. */
const client = readFileSync('js/tcos-api.js', 'utf8');
for (const host of ['tcos-api.hello-tharigopula.workers.dev',
                    'staging.tcos.tharigopula.com']) {
  check('portal and signed-in client agree on ' + host.split('.')[0],
    portal.includes(host) === client.includes(host));
}

/* ------------------------------------------------------- read-only --- */
console.log('\nAnd it still cannot change anything\n');

/* The portal is the only screen an unauthenticated stranger can reach with
   a link. If it ever gains a write path, a leaked link becomes a way to
   alter a medical record rather than only to read one. */
const writes = portal.match(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/gi) || [];
check('the patient portal makes no write request', writes.length === 0,
  writes.join(', '));

/* ------------------------------------------------------------ control --- */
console.log('\nThe check can fail - otherwise it proves nothing\n');

const fakeModule = 'const API = "https://tcos-demo-api.hello-tharigopula.workers.dev";';
const wouldCatch = /['"]https:\/\/[a-z0-9-]*demo[a-z0-9-]*\.hello-tharigopula\.workers\.dev['"]/.test(fakeModule);
check('CONTROL: the demo-host pattern matches the line that caused the bug',
  wouldCatch === true);

const innocent = 'const API = "https://tcos-api.hello-tharigopula.workers.dev";';
check('CONTROL: and does not match the correct line',
  /['"]https:\/\/[a-z0-9-]*demo[a-z0-9-]*\.hello-tharigopula\.workers\.dev['"]/.test(innocent) === false);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
