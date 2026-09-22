/* =========================================================================
   Build the directory that is allowed to be public.

   WHY THIS FILE EXISTS
   --------------------
   On 7 September 2026 an audit found that https://tcos.pages.dev/.dev.vars
   returned HTTP 200. It held the OpenAI API key and the password PEPPER.
   Not because anyone uploaded them: because the deploy command was

       wrangler pages deploy .

   and "." is the whole repository. Every private file - the Worker source,
   the schema, the migrations, the tests, the internal documents - was being
   published on every deploy, and any new local file would be published too.

   THE RULE THIS ENFORCES
   ----------------------
   A file is public only if it is named here. Not "not excluded" - NAMED.
   A deny-list fails the day somebody adds a file nobody thought to deny,
   which is exactly how a secret got published. An allow-list fails the
   other way: a new browser asset is missing until someone adds it, which is
   a visible bug rather than an invisible leak.

   Then it checks its own work. Anything in the built directory that smells
   like a secret, a schema or an internal document stops the build. The
   check is deliberately redundant with the allow-list: it is the part that
   still works when somebody edits the allow-list carelessly.

   Run:  node scripts/build-public.js
   ========================================================================= */

import { readdir, stat, mkdir, copyFile, rm, readFile, writeFile } from 'node:fs/promises';
import { join, relative, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');

/* ------------------------------------------------------- what is public --- */

/* Whole directories of browser assets. Everything under these is served. */
const PUBLIC_DIRS = ['js', 'css', 'assets'];

/* Individual files at the root. Every page the browser can navigate to,
   plus the two files Cloudflare itself reads. */
const PUBLIC_FILES = [
  'robots.txt',
  '_headers',
  /* Installing TCOS on a doctor's phone needs both of these AT THE ROOT.
     The manifest is what makes the browser offer to install it at all, and
     a service worker may only control pages at or below its own path - so
     one served from /js/ would control nothing.

     They are named here rather than picked up by a directory rule because
     that is the whole point of an allow-list: a new public file is a
     deliberate line somebody wrote, not a side effect. */
  'manifest.webmanifest',
  'sw.js',
  /* The owner console installs as its own app, with its own icon, so the
     platform owner can open it from a home screen like anything else.
     NOT called admin.webmanifest on purpose: Cloudflare Access protects
     every path beginning /admin, and a manifest that answers with a login
     challenge instead of JSON is a manifest the browser cannot read - so
     the install option would simply never appear, silently. */
  'owner.webmanifest'
];

/* Every .html at the root is a page. Listing them by hand would go stale
   the first time a screen is added, so the rule is the extension - but a
   .html anywhere else (docs, node_modules, a coverage report) is NOT
   picked up, because only the root is scanned. */
const PUBLIC_ROOT_EXT = ['.html'];

/* Extensions that must never reach the public directory, whatever an
   allow-list says. .sql is the schema, .md is internal writing, .jsonc is
   the Wrangler config with binding IDs in it. */
const FORBIDDEN_EXT = ['.sql', '.md', '.jsonc', '.toml', '.vars', '.env', '.log'];

/* Filenames that must never reach it either. */
const FORBIDDEN_NAMES = [
  '.dev.vars', 'package.json', 'package-lock.json', 'wrangler.jsonc',
  'wrangler.toml', 'schema.sql', 'CLAUDE.md', 'README.md', '.gitignore'
];

/* Content that means a secret got through even though the filename looked
   innocent - a key pasted into a comment, a config baked into a script.
   These are shapes, not values: no real key is written in this file. */
const SECRET_SHAPES = [
  { name: 'OpenAI key',        re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI project key', re: /\bsk-proj-[A-Za-z0-9_-]{20,}/ },
  { name: 'Resend key',        re: /\bre_[A-Za-z0-9_-]{20,}/ },
  { name: 'Razorpay key',      re: /\brzp_(live|test)_[A-Za-z0-9]{10,}/ },
  { name: 'AWS key',           re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  /* An assignment to something named like a secret, with a value long
     enough to be one. Catches PEPPER=..., authkey: "...", token = '...'. */
  { name: 'assigned secret',
    re: /\b(PEPPER|AUTHKEY|AUTH_KEY|API_KEY|APIKEY|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN)\b\s*[:=]\s*["']?[A-Za-z0-9_\-+/=]{16,}/i }
];

/* Files that legitimately contain those words without containing a secret:
   this build script itself, if it ever ends up scanned. */
const SHAPE_EXEMPT = new Set([]);

/* ------------------------------------------------------------- helpers --- */

const problems = [];
let copied = 0;

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function copyInto(sourceFile) {
  const rel = relative(ROOT, sourceFile);
  const target = join(OUT, rel);
  await mkdir(join(target, '..'), { recursive: true });
  await copyFile(sourceFile, target);
  copied++;
  return rel;
}

/* ---------------------------------------------------------------- build --- */

console.log('\nBuilding the public directory from an allow-list.\n');

/* Start from nothing. A stale dist/ is how a file that was removed from the
   allow-list keeps being deployed.

   On Windows the directory itself is often held open by something outside
   this process - the search indexer, an antivirus scanner, a static server
   that served it once - and rmdir then fails with EBUSY or EPERM while
   every file inside deletes perfectly well. The build used to die there,
   which is a refusal to publish over a file handle rather than over
   anything about the files.

   So the CONTENTS are what must go, and that is what the guarantee actually
   needs: an empty dist/ is indistinguishable from a new one. Removing the
   directory too is attempted and allowed to fail. What is not allowed to
   fail is emptying it - if anything is still in there afterwards the build
   stops, because that is the case this exists to prevent. */
await emptyOut();
await mkdir(OUT, { recursive: true });

async function emptyOut() {
  let entries = [];
  try { entries = await readdir(OUT); } catch (_) { return; }
  for (const name of entries) {
    await rm(join(OUT, name), { recursive: true, force: true });
  }
  try { await rm(OUT, { recursive: true }); } catch (_) { /* handle held open */ }

  let left = [];
  try { left = await readdir(OUT); } catch (_) { return; }
  if (left.length) {
    console.error('\ndist/ could not be emptied - these are still in it:\n  ' +
      left.join('\n  ') + '\n\nRefusing to build on top of a stale directory.\n');
    process.exit(1);
  }
}

/* Root pages. */
const rootEntries = await readdir(ROOT, { withFileTypes: true });
for (const entry of rootEntries) {
  if (!entry.isFile()) continue;
  const isPage = PUBLIC_ROOT_EXT.includes(extname(entry.name));
  const isNamed = PUBLIC_FILES.includes(entry.name);
  if (isPage || isNamed) await copyInto(join(ROOT, entry.name));
}

/* Asset directories. */
for (const dir of PUBLIC_DIRS) {
  const from = join(ROOT, dir);
  if (!await exists(from)) { problems.push('missing public directory: ' + dir); continue; }
  for (const file of await walk(from)) await copyInto(file);
}

/* A strict script policy cannot use unsafe-inline. A few legacy pages still
   contain static inline bootstrap scripts, so the build hashes their exact
   bytes and allows only those bytes. Editing even one character changes the
   hash on the next build; injected script remains blocked. This keeps the
   policy deployable while those scripts are moved into modules gradually. */
const inlineScriptHashes = new Set();
for (const entry of rootEntries) {
  if (!entry.isFile() || extname(entry.name) !== '.html') continue;
  const html = await readFile(join(OUT, entry.name), 'utf8');
  const inline = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(inline)) {
    /* The HTML parser normalises CRLF and lone CR to LF before a browser
       validates an inline-script CSP hash. Hashing the Windows checkout's
       raw CRLF bytes therefore produced a policy that worked in Linux CI
       but blocked every inline script in a Windows-built deployment. */
    const browserSource = match[1].replace(/\r\n?/g, '\n');
    const digest = createHash('sha256').update(browserSource, 'utf8').digest('base64');
    inlineScriptHashes.add("'sha256-" + digest + "'");
  }
  if (/\son[a-z]+\s*=/i.test(html)) {
    problems.push('inline event handler would be blocked by CSP: ' + entry.name);
  }
}

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://challenges.cloudflare.com " +
    [...inlineScriptHashes].sort().join(' '),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  /* THE API GOES HERE OR THE WHOLE APP STOPS.
   *
   * Every screen in TCOS talks to the Worker, which is a DIFFERENT origin
   * from the pages - so 'self' does not cover it. Omitting it does not
   * degrade anything gracefully: the browser blocks every fetch, sign-in
   * included, and the app looks alive while being completely inert.
   *
   * That is exactly what happened between the CSP being added and
   * 10 Sep 2026. The doctor application form was the visible symptom -
   * its Turnstile config fetch was blocked, so no widget rendered, so no
   * token existed, so every application was rejected - but sign-in and
   * every other screen were equally dead.
   *
   * Both API origins are listed because the same built directory is
   * deployed to production and to staging, and a staging build that can
   * only reach production is worse than one that reaches nothing. */
  "connect-src 'self' https://challenges.cloudflare.com " +
    'https://tcos-api.hello-tharigopula.workers.dev ' +
    'https://tcos-api-staging.hello-tharigopula.workers.dev',
  "frame-src 'self' blob: https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests'
].join('; ');
const headersPath = join(OUT, '_headers');
let headers = await readFile(headersPath, 'utf8');
headers = headers.replace(/^(\/\*\r?\n)/,
  '$1  Content-Security-Policy: ' + csp + '\n');
await writeFile(headersPath, headers, 'utf8');

/* ------------------------------------------------- fingerprint the assets --- */

/* WHY THE FILENAMES CARRY A HASH.
 *
 * Three times Vijay opened a page after a deploy and saw the previous
 * build - "I see no change", "same old thing" - and the last one was a
 * script that had been fixed and redeployed while the edge kept serving
 * the broken copy. `?v=1` does not help: the query never changes, so
 * neither does the cache key, and a stale entry outlives the fix.
 *
 * A content hash in the NAME cannot go wrong. Change a byte and it is a
 * different file at a different URL that nothing has ever cached. Nobody
 * has to remember to bump anything, which is the point - the version
 * number only worked when somebody remembered, and nobody did.
 *
 * HTML keeps its own name and is never cached hard, so a new page always
 * points at the new assets.
 */
const fingerprinted = new Map();

for (const dir of ['js', 'css']) {
  const from = join(OUT, dir);
  if (!await exists(from)) continue;
  for (const file of await walk(from)) {
    const bytes = await readFile(file);
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    const rel = relative(OUT, file).split(sep).join('/');
    const dot = rel.lastIndexOf('.');
    const hashed = rel.slice(0, dot) + '.' + hash + rel.slice(dot);
    await copyFile(file, join(OUT, hashed));
    fingerprinted.set(rel, hashed);
  }
}

/* Rewrite every reference. The originals are left in place: a page that
   somebody bookmarked mid-deploy, or a hand-written path this rewrite did
   not match, still resolves rather than 404ing. */
let rewritten = 0;
for (const page of await walk(OUT)) {
  if (!page.endsWith('.html')) continue;
  let html = await readFile(page, 'utf8');
  const before = html;
  for (const [plain, hashed] of fingerprinted) {
    /* Matches href="js/x.js", src="js/x.js?v=2", "/js/x.js" - anything
       ending in the plain path, with or without a query. */
    const pattern = new RegExp(
      '(["\'(])(/?)' + plain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\?[^"\'()]*)?(["\')])', 'g');
    html = html.replace(pattern, '$1$2' + hashed + '$4');
  }
  if (html !== before) { await writeFile(page, html, 'utf8'); rewritten++; }
}

console.log('  ' + fingerprinted.size + ' assets fingerprinted, ' +
  rewritten + ' pages rewritten.');

/* ---------------------------------------------------------- verify it --- */

/* Everything below re-checks the directory that was just built, on the
   assumption that the code above is wrong. */

const built = await walk(OUT);

for (const file of built) {
  const rel = relative(OUT, file);
  const name = rel.split(sep).pop();

  if (FORBIDDEN_NAMES.includes(name)) {
    problems.push('forbidden file reached dist: ' + rel);
    continue;
  }
  if (FORBIDDEN_EXT.includes(extname(name))) {
    problems.push('forbidden extension reached dist: ' + rel);
    continue;
  }

  /* Binary assets are not scanned for text shapes - a PNG will match a
     random regex eventually and the failure would be meaningless. */
  if (/\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|mp4|webm)$/i.test(name)) continue;
  if (SHAPE_EXEMPT.has(rel)) continue;

  const text = await readFile(file, 'utf8');
  for (const shape of SECRET_SHAPES) {
    if (shape.re.test(text)) {
      problems.push('possible ' + shape.name + ' inside ' + rel);
    }
  }
}

/* Directories that must NOT have been created at all. Checked by name so
   that a future "public/docs" alias is caught too. */
for (const forbidden of ['worker', 'migrations', 'test', 'docs', 'scripts', 'node_modules', '.git', '.wrangler']) {
  if (await exists(join(OUT, forbidden))) {
    problems.push('private directory reached dist: ' + forbidden + '/');
  }
}

/* The build is worthless if it produced nothing. */
if (copied === 0) problems.push('nothing was copied - the allow-list matched no files');
if (!await exists(join(OUT, 'index.html'))) problems.push('dist/index.html is missing');

/* --------------------------------------------------------------- report --- */

if (problems.length) {
  console.log('REFUSED. This directory is not safe to publish:\n');
  for (const problem of problems) console.log('  - ' + problem);
  console.log('\nNothing was deployed. Fix the above and run again.\n');
  process.exit(1);
}

console.log('  ' + copied + ' files -> dist/');
console.log('  no private file, schema, document or secret shape in the output.');
console.log('\nSafe to deploy:  npm run deploy:web\n');
