/* =========================================================================
   The shadow connection to the Tharigopula control plane.

   Shadow mode exists so that a shared service nobody trusts yet cannot take
   a clinic down. That promise is only worth something if it is tested, so
   these assertions are about what happens when the platform is ABSENT,
   BROKEN or SLOW - the states it will actually be in for the next few weeks.

   Run:  node test/platform.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';
import { resolvePlatformWorkspaceShadow } from '../worker/thari-platform.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* Node has crypto.randomUUID on globalThis from 19 onwards; the Worker has
   it always. Guard so the test does not fail for a reason nobody cares
   about. */
if (!globalThis.crypto) globalThis.crypto = { randomUUID: () => 'test-id' };

console.log('\nIt never blocks TCOS\n');

const noBinding = await resolvePlatformWorkspaceShadow({}, 'doc_demo');
check('with no binding at all, it returns rather than throwing',
  noBinding.mode === 'unconfigured' && noBinding.context === null);

const thrown = await resolvePlatformWorkspaceShadow({
  THARI_PLATFORM: { resolveWorkspace() { throw new Error('control plane down'); } }
}, 'doc_demo');
check('when the control plane throws, TCOS still gets an answer',
  thrown.mode === 'unavailable' && thrown.context === null);

const rejected = await resolvePlatformWorkspaceShadow({
  THARI_PLATFORM: { resolveWorkspace: () => Promise.reject(new Error('rpc failed')) }
}, 'doc_demo');
check('a rejected promise is caught too, not left unhandled',
  rejected.mode === 'unavailable');

const notMapped = await resolvePlatformWorkspaceShadow({
  THARI_PLATFORM: { resolveWorkspace: async () => null }
}, 'doc_nobody');
check('a doctor not yet provisioned reads as unmapped, not as an error',
  notMapped.mode === 'unmapped' && notMapped.context === null);

let received;
const mapped = await resolvePlatformWorkspaceShadow({
  THARI_PLATFORM: {
    resolveWorkspace: async input => {
      received = input;
      return { workspace: { id: 'workspace_1' } };
    }
  }
}, 'doc_demo');
check('a provisioned doctor resolves to a workspace',
  mapped.mode === 'shadow' && mapped.context.workspace.id === 'workspace_1');

/* The payload checked by value, not by reading the source. A field added
   later - a product key, a clinic name, a patient count - fails here even
   if it is spelled in a way no regex below would catch. */
check('the payload is exactly one opaque reference and nothing else',
  JSON.stringify(received) === JSON.stringify({ externalWorkspaceRef: 'doc_demo' }),
  JSON.stringify(received));

/* ------------------------------------------------------------------------ */
console.log('\nIt never authorises, and never names a product\n');

const source = readFileSync('worker/thari-platform.js', 'utf8');
const router = readFileSync('worker/index.js', 'utf8');
const apiClient = readFileSync('js/tcos-api.js', 'utf8');
const wrangler = readFileSync('wrangler.jsonc', 'utf8');
const nav = readFileSync('js/nav.js', 'utf8');
const today = readFileSync('js/today.js', 'utf8');
const consult = readFileSync('js/consult.js', 'utf8');
const prescription = readFileSync('rx.html', 'utf8');
const clinicPage = readFileSync('tcos-clinic.html', 'utf8');
const domainsMigration = readFileSync('migrations/016-custom-domains.sql', 'utf8');

/* The entrypoint fixes the product on the control-plane side. Sending one
   from here would defeat the isolation the named binding exists to give. */
check('no product key is ever sent',
  !/productKey|product_key/.test(source));

check('it calls exactly one control-plane method',
  (source.match(/THARI_PLATFORM\.\w+/g) || []).join(',') === 'THARI_PLATFORM.resolveWorkspace');

/* The moment this appears in a gate, shadow mode has silently ended. */
const gatingUse = /resolvePlatformWorkspaceShadow[\s\S]{0,300}?(throw|forbidden|unauthorised|requireVerified)/
  .test(router);
check('nothing in the router gates on the platform result', !gatingUse);

check('the binding is not wired up yet, so nothing depends on it',
  !/"services"\s*:\s*\[\s*\{/.test(wrangler));

check('a legacy staging Pages address is redirected to the secure host',
  /ON_OLD_STAGING/.test(apiClient) && /location\.replace/.test(apiClient));
check('staging UI and API use one origin',
  apiClient.includes('staging.tcos.tharigopula.com') &&
  wrangler.includes('"APP_ORIGIN": "https://staging.tcos.tharigopula.com"'));

check('the signed-in product replaces the static browser title',
  /document\.title = page\[2\] \+ ' \| ' \+ product\.name/.test(nav));
check('the shared Today screen does not call every pharmacy Ayurveda',
  !today.includes('Ayurveda pharmacy shelf'));
check('the consultation reads the practice packs chosen by this clinic',
  /new Set\(me\.practicePacks \|\| \[\]\)/.test(consult) &&
  !consult.includes("['ayurveda', 'nadi'"));
check('medicine entry follows the signed-in product without hiding shared systems',
  /medicineSystemsFor\(product\)/.test(consult) &&
  /medicineSystemsFor\(product\)/.test(prescription));
check('prescription and consultation footers name the signed-in product',
  /product\.name/.test(consult) && /product\.name/.test(prescription));
check('waiting online requests are visible on Today, not silently counted',
  /data\.requests/.test(today) && /Accept &amp; book/.test(today) && /Decline/.test(today));
check('the shared appointment form uses a discipline-neutral example',
  !clinicPage.includes('Nadi Pariksha'));
check('the migration chain adds custom_domain only once',
  !/ALTER TABLE doctors ADD COLUMN custom_domain TEXT/.test(domainsMigration));

/* ------------------------------------------------------------------------ */
console.log('\nNo clinical content crosses the boundary\n');

/* The control plane must never learn what TCOS knows. Only an opaque tenant
   reference goes out. */
const CLINICAL = /patient|diagnos|prescription|medicine|complaint|lab_|visit|pharmac/i;
const sent = source.slice(source.indexOf('resolveWorkspace({'), source.indexOf('return { mode'));
check('only an opaque reference is sent to the platform',
  !CLINICAL.test(sent), sent.replace(/\s+/g, ' ').trim().slice(0, 80));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
