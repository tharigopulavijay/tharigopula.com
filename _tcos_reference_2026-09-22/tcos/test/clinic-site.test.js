/* =========================================================================
   A clinic's page, served on the clinic's OWN address.

   The Worker has resolved a host to a clinic ever since custom domains were
   built, and then answered with JSON. A patient who typed drdevi.com into
   her phone got a wall of curly braces. Everything needed to serve her a
   website was already there; the last step returned the data instead of the
   page.

   What this holds in place:

     1. HTML, not JSON, at the root of a clinic host.
     2. ONE renderer. The shell is the real built file, fetched and
        rewritten - never a second copy of the page built in the Worker.
        Three hand-built copies of the prescription drifted apart before one
        renderer replaced them; this is the same mistake waiting to be made.
     3. The asset paths become absolute, WITH their content hashes, which
        the Worker could not have guessed - the build stamps them at publish
        time. A relative path resolves against the clinic's domain, where
        nothing is served.
     4. No inline script, so the policy needs no per-slug hash.

   Run:  node test/clinic-site.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nHer address serves her page\n');

/* A stub app origin that serves the REAL built shell, so the rewrite is
   tested against the file that actually ships rather than a fixture. */
/* The BUILT shell when one exists, because that is what the Worker fetches
   in production and it is the only version whose asset names carry content
   hashes. Falling back to the source keeps the suite runnable before a
   build, but then the hash assertion below is checking a weaker thing - so
   it says which it used. */
const built = (() => { try { return readFileSync('dist/clinic.html', 'utf8'); }
                       catch (_) { return null; } })();
const realShell = built || readFileSync('clinic.html', 'utf8');
console.log('  (shell under test: ' + (built ? 'dist/clinic.html, fingerprinted' :
  'clinic.html source - run a build for the stronger check') + ')\n');
let fetched = 0;
globalThis.fetch = async (url) => {
  fetched++;
  if (String(url).endsWith('/clinic.html')) {
    return new Response(realShell, { status: 200 });
  }
  return new Response('nope', { status: 404 });
};

const { clinicSiteResponse, clinicSiteFallback } =
  await import('../worker/clinicsite.js');

const env = { APP_ORIGIN: 'https://tcos.pages.dev' };

const response = await clinicSiteResponse(env, 'vijay-hospital');
const html = await response.text();

/* ------------------------------------------------- it is a web page --- */

check('the clinic host gets HTML, not JSON', response.status === 200 &&
  /text\/html/.test(response.headers.get('Content-Type') || ''),
  response.headers.get('Content-Type'));
check('and it is a document, not a data blob',
  /<!doctype html>/i.test(html) && !/^\s*\{/.test(html));

/* ------------------------------------------------- one renderer only --- */

check('the shell is the real built file, fetched rather than rebuilt',
  html.includes('js/clinic-page') && fetched > 0);
const worker = readFileSync('worker/clinicsite.js', 'utf8');
check('the Worker does not hand-build the clinic page',
  !/<h1|<section|clinic-name|<article/i.test(worker),
  'a second renderer of this document is how three of them drifted apart');

/* ------------------------------------------------- assets resolve ----- */

const assets = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
check('every asset URL is absolute',
  assets.every(u => /^https?:\/\//.test(u)),
  assets.filter(u => !/^https?:\/\//.test(u)).join(', '));
check('and points at the app',
  assets.some(u => /^https:\/\/tcos\.pages\.dev\/js\/clinic-page\./.test(u)),
  assets.join(' '));
/* The hash is the whole reason the shell is fetched rather than written
   here: the Worker cannot know it, because the build stamps it at publish
   time. Only meaningful against a built shell. */
if (built) {
  check('carrying the content hash the build stamped on it',
    assets.some(u => /\/js\/clinic-page\.[a-f0-9]{8,}\.js$/.test(u)),
    assets.join(' '));
}
/* Fonts were already absolute and must not be mangled. */
check('URLs that were already absolute are left alone',
  assets.some(u => u.startsWith('https://fonts.googleapis.com')));

/* ------------------------------------------- the slug reaches the page --- */

check('the slug is stamped on the page element',
  /<div id="page" data-slug="vijay-hospital">/.test(html), html.slice(0, 300));
check('and not through an inline script, which would need a hash per slug',
  !/<script(?![^>]*\ssrc=)/.test(html));

const client = readFileSync('js/clinic-page.js', 'utf8');
check('the renderer prefers that attribute over the URL',
  /page\.dataset\.slug \|\|\s*\n?\s*params\.get\('c'\)/.test(client),
  'at her own address the path is "/" and there is nothing in the URL to read');
/* Same-origin on her domain: the Worker serves the page AND the API there,
   so no CORS and no cross-origin hole in the policy. */
check('and calls the API same-origin when served from her own address',
  /page\.dataset\.slug \? ''/.test(client));

/* ------------------------------------------------------- the policy --- */

const csp = response.headers.get('Content-Security-Policy') || '';
check('a policy is set - this response never passes through _headers',
  csp.length > 40, csp);
/* The app, and Cloudflare's own beacon - which the edge injects into this
   HTML whether the policy allows it or not, so blocking it only logged a
   violation on every visit to every clinic page. Nothing else. */
check('scripts only from the app and Cloudflare\'s own beacon',
  /script-src https:\/\/tcos\.pages\.dev https:\/\/static\.cloudflareinsights\.com/.test(csp),
  csp);
check('and nothing else may run on a clinic page',
  !/script-src[^;]*(unsafe-inline|unsafe-eval|\*)/.test(csp), csp);
check('nothing may frame a clinic page', /frame-ancestors 'none'/.test(csp));
check('and the API call it makes is allowed', /connect-src 'self'/.test(csp), csp);

/* Every other TCOS surface is noindex. A clinic page is the one thing that
   should be found. */
check('a clinic page is indexable', /index, follow/.test(response.headers.get('X-Robots-Tag') || ''));

/* --------------------------------------------------------- caching ---- */

const before = fetched;
await clinicSiteResponse(env, 'another-clinic');
check('the shell is not re-fetched for every visitor', fetched === before);
const second = await (await clinicSiteResponse(env, 'another-clinic')).text();
check('but each clinic still gets its own slug',
  /data-slug="another-clinic"/.test(second));

/* ------------------------------------------------- when it goes wrong --- */

globalThis.fetch = async () => new Response('down', { status: 503 });
/* Force the cache to expire by asking for a different origin. */
let failedOver = null;
try {
  failedOver = await clinicSiteResponse({ APP_ORIGIN: 'https://other.example' }, 'vijay-hospital');
} catch (error) { failedOver = error; }
check('an unreachable app origin raises rather than serving a broken page',
  failedOver instanceof Error, String(failedOver));

const redirect = clinicSiteFallback(env, 'vijay-hospital');
check('and the fallback sends her to the address that always works',
  redirect.status === 302 &&
  (redirect.headers.get('Location') || '').includes('/clinic.html?c=vijay-hospital'),
  redirect.headers.get('Location'));

/* --------------------------------------------------- it is wired in --- */

const router = readFileSync('worker/index.js', 'utf8');
check('the router serves the page at a clinic host root',
  /clinicSiteResponse\(env, site\.public_slug\)/.test(router));
check('and no longer answers that host with JSON',
  !/bySiteHost[\s\S]{0,400}json\(profile/.test(router),
  'a patient on drdevi.com would see curly braces');
check('with the fallback on failure',
  /clinicSiteFallback\(env, site\.public_slug\)/.test(router));

/* CONTROL: the greps must be able to miss. */
check('CONTROL: the files were actually read',
  html.length > 400 && router.length > 50000 && client.length > 3000);
check('CONTROL: a string nobody wrote is absent', !/zzzNotInTheShell/.test(html));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
