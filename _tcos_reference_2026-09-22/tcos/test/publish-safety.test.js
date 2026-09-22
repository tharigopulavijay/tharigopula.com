/* =========================================================================
   What is allowed to be public.

   On 7 September 2026 https://tcos.pages.dev/.dev.vars returned HTTP 200,
   298 bytes, containing the OpenAI API key and the password pepper. The
   cause was one character: `wrangler pages deploy .`

   Nobody uploaded a secret. The deploy command published the repository,
   and the repository is where the secrets live. Every private file went
   with it - the Worker source, the schema, every migration, the tests
   and the internal state document.

   This file exists so that the fix cannot be quietly undone. It checks the
   commands, then actually runs the build and inspects what came out.

   Run:  node test/publish-safety.test.js
   ========================================================================= */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, sep } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const exists = async p => { try { await stat(p); return true; } catch { return false; } };
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

/* ------------------------------------------------------- the commands --- */
console.log('\nThe deploy commands themselves\n');

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const scripts = pkg.scripts || {};

/* The exact mistake. `deploy .` publishes the repository root. */
const deploysRoot = Object.entries(scripts).some(([name, body]) =>
  !name.startsWith('//') && /pages\s+deploy\s+\.(\s|$)/.test(body));
check('no script deploys the repository root to Pages', !deploysRoot,
  JSON.stringify(Object.entries(scripts).filter(([n, b]) => !n.startsWith('//') && /pages\s+deploy\s+\./.test(b))));

check('deploy:web goes through the guarded deploy script',
  /scripts[\/\\]deploy-web\.js/.test(scripts['deploy:web'] || ''), scripts['deploy:web']);

const webGuard = await readFile('scripts/deploy-web.js', 'utf8');
check('staging and production Pages releases require committed code',
  /if \(target !== 'preview' && dirty\)/.test(webGuard));
check('the Pages release isolates Wrangler from ancestor deploy configs',
  /mkdtempSync\(join\(tmpdir\(\), 'tcos-pages-'\)\)/.test(webGuard) &&
  /'--cwd=' \+ isolatedCwd/.test(webGuard) &&
  /resolve\('dist'\)/.test(webGuard) &&
  !/--config=wrangler\.jsonc/.test(webGuard));
check('Windows Pages deployment bypasses shell and npx re-parsing',
  /spawnSync\(process\.execPath/.test(webGuard) &&
  /node_modules\/wrangler\/bin\/wrangler\.js/.test(webGuard) &&
  /shell: false/.test(webGuard));

check('deploy:api goes through the guarded deploy script',
  /scripts[\/\\]deploy-api\.js/.test(scripts['deploy:api'] || ''), scripts['deploy:api']);
check('staging API deploy goes through the same guard',
  /scripts[\/\\]deploy-api\.js\s+staging/.test(scripts['deploy:api:staging'] || ''),
  scripts['deploy:api:staging']);

const apiGuard = await readFile('scripts/deploy-api.js', 'utf8');
check('the API guard refuses uncommitted releases',
  /if \(dirty\)/.test(apiGuard) && /Refusing to deploy uncommitted/.test(apiGuard));
check('the API guard checks the selected remote D1 ledger',
  /'d1', 'migrations', 'list', 'DB', '--remote'/.test(apiGuard));
check('production explicitly selects the top-level Worker environment',
  /const envArgs = \['--env', TARGETS\[target\]\.env \|\| ''\]/.test(apiGuard));
check('the API guard runs the complete test suite',
  /run\(process\.execPath, \['scripts\/run-tests\.js'\]/.test(apiGuard));
check('the API guard rebuilds allow-listed static assets before tests and dry run',
  /run\(process\.execPath, \['scripts\/build-public\.js'\]/.test(apiGuard) &&
  apiGuard.indexOf("['scripts/build-public.js']") < apiGuard.indexOf("['scripts/run-tests.js']"));
check('the API guard performs a Wrangler dry run before upload',
  /'deploy', '--dry-run'/.test(apiGuard));
check('every Worker operation names the TCOS Wrangler config explicitly',
  /const configArgs = \['--config', 'wrangler\.jsonc'\]/.test(apiGuard) &&
  (apiGuard.match(/\.\.\.configArgs/g) || []).length === 3);
check('the API release is strict and traceable to a commit',
  /'deploy', '--strict', '--tag'/.test(apiGuard) && /'--message'/.test(apiGuard));
check('Windows deploy arguments bypass shell and .cmd re-parsing',
  /const wrangler = \(args, options = \{\}\) => run\(process\.execPath/.test(apiGuard) &&
  /node_modules\/wrangler\/bin\/wrangler\.js/.test(apiGuard) &&
  /shell: false/.test(apiGuard));

const testRunner = await readFile('scripts/run-tests.js', 'utf8');
check('the test runner also bypasses shell chaining',
  /spawnSync\(process\.execPath, \[file\]/.test(testRunner) &&
  /shell: false/.test(testRunner));

const apiClient = await readFile('js/tcos-api.js', 'utf8');
check('a public page ignores stale local API overrides',
  /if \(IS_LOCAL\) return localStorage\.getItem\('tcos-api-base'\)/.test(apiClient) &&
  /localStorage\.removeItem\('tcos-api-base'\)/.test(apiClient));

const adminApiClient = await readFile('js/tcos-admin-api.js', 'utf8');
check('the admin console also ignores stale API overrides on public pages',
  /if \(IS_LOCAL\) return localStorage\.getItem\('tcos-api-base'\)/.test(adminApiClient) &&
  /localStorage\.removeItem\('tcos-api-base'\)/.test(adminApiClient));
check('the staging admin console cannot silently call production',
  /ON_OLD_STAGING/.test(adminApiClient) && /location\.replace/.test(adminApiClient) &&
  /staging\.tcos\.tharigopula\.com/.test(adminApiClient));
check('legacy production admin pages move to the same-origin protected console',
  /ON_LEGACY_PRODUCTION/.test(adminApiClient) &&
  /admin\.tcos\.tharigopula\.com/.test(adminApiClient));

const loginPage = await readFile('tcos-login.html', 'utf8');
check('the shared sign-in door is neutral until the account is known',
  /<title>Sign in \| TCOS<\/title>/.test(loginPage) &&
  /TCOSProducts && window\.TCOSProducts\.PLATFORM/.test(loginPage) &&
  !/<title>Sign in \| AyurCOS<\/title>/.test(loginPage));

/* This one applied the whole monolithic schema to PRODUCTION with -y. */
check('the unguarded remote schema command is gone',
  !scripts['db:remote'], scripts['db:remote']);

/* Remote schema changes go through the guarded script, not straight to
   wrangler. The repaired ledger now supports normal forward migrations, but
   only with an explicit production confirmation and a fresh backup. */
check('remote schema changes go through the guarded script',
  /scripts[\/\\]migrate-remote\.js/.test(scripts['db:migrate:remote'] || ''),
  scripts['db:migrate:remote']);

const guard = await readFile('scripts/migrate-remote.js', 'utf8');
check('and it requires explicit production confirmation',
  /--confirm-production/.test(guard));
check('and it requires a recent external backup',
  /--backup/.test(guard) && /ageMinutes > 120/.test(guard) &&
  /outside this repository/.test(guard));
check('and it verifies the ledger again after apply',
  /Verifying the production ledger after apply/.test(guard));

/* A secret file must never be committed either. */
const ignored = await readFile('.gitignore', 'utf8');
check('.dev.vars is git-ignored', /^\.dev\.vars\s*$/m.test(ignored));
check('the built directory is git-ignored', /^dist\/?\s*$/m.test(ignored));

/* And git must actually agree - a .gitignore rule is worthless if the file
   was committed before the rule was added. */
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
check('.dev.vars is not tracked by git', !tracked.includes('.dev.vars'));
check('no .dev.vars variant is tracked',
  !tracked.some(f => /(^|\/)\.(dev\.vars|env)(\.|$)/.test(f)),
  tracked.filter(f => /(^|\/)\.(dev\.vars|env)/.test(f)).join(', '));

/* ------------------------------------------- one place for the hostname --- */
console.log('\nThe app hostname is configuration, not something written out in code\n');

/* It used to appear three times in worker/index.js: the CORS allow-list,
   the platform-host check and the patient link base. Three copies is three
   chances to update two of them - and it turned moving the app off a
   hostname into a hunt through the source. That mattered on 8 Sep 2026,
   when the old hostname had to be abandoned because Cloudflare's edge kept
   serving cached copies of files already deleted from the deployment. */
/* lib.js moved to @tharigopula/core on 17 Sep 2026 and took appOrigin() with
   it, so a scan of worker/ alone found ZERO occurrences and this check would
   have passed for the wrong reason forever after - the invariant quietly
   unguarded because the file it guarded changed address. Both places are
   read, and the count is still exactly one across them. */
const CORE_LIB = 'node_modules/@tharigopula/core/src/lib';
const scanned = [
  ...(await readdir('worker')).filter(f => f.endsWith('.js'))
    .map(f => ['worker', join('worker', f), f]),
  ...(await readdir(CORE_LIB)).filter(f => f.endsWith('.js'))
    .map(f => ['core', join(CORE_LIB, f), 'core/lib/' + f])
];
const hardCoded = [];
for (const [, path, label] of scanned) {
  const text = await readFile(path, 'utf8');
  for (const line of text.split('\n')) {
    /* Comments explaining the history are fine; a value is not. */
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;
    if (/['"]https?:\/\/[a-z0-9.-]*\.pages\.dev/.test(line)) {
      hardCoded.push(label + ': ' + line.trim().slice(0, 80));
    }
  }
}
check('both the worker and the shared core were scanned',
  scanned.length > 20 && scanned.some(([where]) => where === 'core'),
  scanned.length + ' files');
/* Exactly one is allowed: the fallback inside appOrigin(), which is what
   makes it the single source of truth. Two would mean it has scattered again
   - and it did, the day the welcome email needed a sign-in link and
   platform.js reached for env.APP_ORIGIN on its own. */
check('the app hostname appears in exactly one line of code',
  hardCoded.length === 1, hardCoded.join(' | '));
check('and it is the appOrigin fallback in the shared lib, not a copy elsewhere',
  hardCoded.length === 1 && hardCoded[0].startsWith('core/lib/'), hardCoded[0]);

const wranglerConfig = await readFile('wrangler.jsonc', 'utf8');
check('the custom admin domain cannot disable the doctor-facing API hostname',
  /"workers_dev"\s*:\s*true/.test(wranglerConfig) &&
  /"preview_urls"\s*:\s*false/.test(wranglerConfig));
check('the app origin is declared in wrangler.jsonc',
  /"APP_ORIGIN"\s*:\s*"https:\/\//.test(wranglerConfig));
check('staging patient links stay on the staging app',
  wranglerConfig.includes('"APP_ORIGIN": "https://staging.tcos.tharigopula.com"'));

const router = await readFile('worker/index.js', 'utf8');
check('CORS, the host check and patient links all read that one value',
  (router.match(/appOrigin\(env\)/g) || []).length >= 2 &&
  /appHost\(env\)/.test(router));

/* ------------------------------------------- the CSP must allow the API --- */
console.log('\nThe security policy lets the app reach its own backend\n');

/* A CSP that omits the API does not degrade gracefully - the browser blocks
   every fetch and the app looks alive while being completely inert. Between
   the CSP being added and 10 Sep 2026, connect-src listed only 'self' and
   Cloudflare's challenge host, so NOTHING on tcos.pages.dev could reach the
   Worker: sign-in, patients, prescriptions, all dead. The visible symptom
   was the doctor application form silently rejecting every applicant. */
const buildSource = await readFile('scripts/build-public.js', 'utf8');
const connectSrc = (buildSource.match(/"connect-src[^,]*/) || [''])[0];

check('connect-src allows the production API',
  /tcos-api\.hello-tharigopula\.workers\.dev/.test(connectSrc), connectSrc.slice(0, 160));
check('connect-src allows the staging API',
  /tcos-api-staging\.hello-tharigopula\.workers\.dev/.test(connectSrc), connectSrc.slice(0, 160));
check('connect-src still allows the challenge host',
  /challenges\.cloudflare\.com/.test(connectSrc));

/* ---------------------------------------------------------- the build --- */
console.log('\nWhat the build actually produces\n');

const build = spawnSync(process.execPath, ['scripts/build-public.js'], { encoding: 'utf8' });
check('the build succeeds', build.status === 0, build.stdout + build.stderr);

check('dist/ was created with the sign-in page', await exists(join('dist', 'index.html')));

const built = (await exists('dist')) ? await walk('dist') : [];
check('the build produced a real site, not an empty directory', built.length > 20, String(built.length));

const builtHeaders = await readFile(join('dist', '_headers'), 'utf8');
const cspLine = builtHeaders.split(/\r?\n/).find(line =>
  line.includes('Content-Security-Policy:')) || '';
check('the deployed site has a restrictive content security policy',
  cspLine.includes("default-src 'self'") &&
  cspLine.includes("object-src 'none'") &&
  cspLine.includes("frame-ancestors 'none'") &&
  cspLine.includes('https://challenges.cloudflare.com'));
check('inline scripts are exact build-time hashes, never unsafe-inline',
  /script-src[^;]*'sha256-/.test(cspLine) &&
  !/script-src[^;]*'unsafe-inline'/.test(cspLine));
const builtLogin = await readFile(join('dist', 'tcos-login.html'), 'utf8');
const inline = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const browserHashes = [...builtLogin.matchAll(inline)].map(match =>
  createHash('sha256')
    .update(match[1].replace(/\r\n?/g, '\n'), 'utf8')
    .digest('base64'));
check('CSP hashes the browser-normalised script, including Windows builds',
  browserHashes.length > 0 && browserHashes.every(hash =>
    cspLine.includes("'sha256-" + hash + "'")));
check('a script failure cannot put a clinic password in the URL',
  /<form\s+id="signInForm"[^>]*\bmethod="post"/i.test(builtLogin));
check('transport, browser capability and framing headers ship together',
  builtHeaders.includes('Strict-Transport-Security: max-age=31536000') &&
  builtHeaders.includes('Permissions-Policy:') &&
  builtHeaders.includes('X-Frame-Options: DENY') &&
  builtHeaders.includes('Cross-Origin-Opener-Policy: same-origin'));
check('the admin shell is never cached by the browser or edge',
  /\/admin\*\s+Cache-Control: no-store, max-age=0/.test(builtHeaders));

check('Worker-generated responses receive the same baseline protections',
  router.includes('function hardenResponse(response)') &&
  router.includes("headers.set('X-Content-Type-Options', 'nosniff')") &&
  router.includes("headers.set('X-Frame-Options', 'DENY')") &&
  router.includes("headers.set('Strict-Transport-Security', 'max-age=31536000')"));

/* The files that were public on 7 September and must never be again. */
for (const forbidden of ['worker', 'migrations', 'test', 'docs', 'scripts', 'node_modules', '.wrangler', '.git']) {
  check('dist/ has no ' + forbidden + '/', !await exists(join('dist', forbidden)));
}
for (const forbidden of ['.dev.vars', 'schema.sql', 'package.json', 'package-lock.json',
                         'wrangler.jsonc', 'CLAUDE.md', 'README.md']) {
  check('dist/ has no ' + forbidden, !await exists(join('dist', forbidden)));
}

/* Nothing in the output may carry a secret, whatever it is called. */
const SHAPES = [
  ['OpenAI key', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['Resend key', /\bre_[A-Za-z0-9_-]{20,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['assigned secret', /\b(PEPPER|AUTHKEY|API_KEY|SECRET|PASSWORD|ACCESS_TOKEN)\b\s*[:=]\s*["']?[A-Za-z0-9_\-+/=]{16,}/i]
];
const hits = [];
for (const file of built) {
  if (/\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|mp4|webm)$/i.test(file)) continue;
  const text = await readFile(file, 'utf8');
  for (const [name, re] of SHAPES) if (re.test(text)) hits.push(name + ' in ' + file);
}
check('no secret shape anywhere in the published files', hits.length === 0, hits.join('; '));

/* Also: no file extension that means "this is not for the browser". */
const badExt = built.filter(f => ['.sql', '.md', '.jsonc', '.toml', '.env', '.log'].includes(extname(f)));
check('no schema, document or config file is published', badExt.length === 0,
  badExt.map(f => f.split(sep).pop()).join(', '));

/* ---------------------------------------------- the guard can still fail --- */
console.log('\nThe guard fails when it should - a check that cannot fail proves nothing\n');

/* Plant something shaped like a key in a published directory and confirm
   the build refuses. Removed again whatever happens. */
const probe = join('js', '__publish_safety_probe.js');
const { writeFile, rm } = await import('node:fs/promises');
let refused = null, refusedOutput = '';
try {
  await writeFile(probe, 'const k = "sk-proj-' + 'A'.repeat(28) + '";\n');
  const planted = spawnSync(process.execPath, ['scripts/build-public.js'], { encoding: 'utf8' });
  refused = planted.status !== 0;
  refusedOutput = planted.stdout;
} finally {
  await rm(probe, { force: true });
}
check('CONTROL: a planted key makes the build exit non-zero', refused === true);
check('CONTROL: and it names the file it found', /__publish_safety_probe/.test(refusedOutput),
  refusedOutput.slice(0, 200));

/* Leave dist/ in a good state rather than the refused one. */
spawnSync(process.execPath, ['scripts/build-public.js'], { encoding: 'utf8' });

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
