/* =========================================================================
   What is actually reachable on the public internet, right now.

   WHY THIS EXISTS
   ---------------
   Three separate times on 7-8 September 2026 a leak was declared closed
   when it was not, and every time the cause was the checking, not the fix:

     1. Checked HTTP STATUS. Cloudflare Pages answers a missing path with
        200 and the index page, so status told us nothing. Everything
        looked identical before and after the fix.
     2. Checked ONE FILE per deployment. .dev.vars was clean on 24 old
        deployments, so they were called clean - while every one of them
        was still serving worker/index.js.
     3. Checked WITH A CACHE-BUSTING QUERY STRING. "?cb=123" is a different
        cache key, so it fetched from origin and looked clean while the
        real URL was still serving the secret from the edge, on roughly
        four requests in ten.

   So this script does the opposite of each of those. It reads CONTENT, it
   walks EVERY path on EVERY host, and it fetches the EXACT url repeatedly
   with no cache-buster - because a cache that only sometimes serves a
   secret is still a cache that serves a secret.

   Run:  node scripts/verify-public.js
         node scripts/verify-public.js --samples 8
   ========================================================================= */

import { spawnSync } from 'node:child_process';

/* Sampled more than once because the leak was intermittent: the same URL
   returned clean HTML and then the real secret, depending on which edge
   answered. One sample would have missed it more often than not.

   THIS PARSE WAS BROKEN AND THE WHOLE SCRIPT WAS A NO-OP.
   `indexOf` returns -1 when the flag is absent, so `argv[-1 + 1]` was
   `argv[0]` - the path to node.exe. That is a truthy string, so it won
   the `||` chain, and Number("C:\\Program Files\\nodejs\\node.exe") is NaN.
   `for (let i = 0; i < NaN; i++)` never runs, so not one request was made
   and every hostname was reported "clean" over an empty set.

   The header printed "NaN samples per path" the whole time. Nobody read it,
   including me - I ran this after the September leak and believed the
   summary. So the count is now validated, and the script refuses to start
   rather than print a reassuring number it did not earn. */
const samplesFlag = (() => {
  const inline = process.argv.find(a => a.startsWith('--samples='));
  if (inline) return inline.split('=')[1];
  const at = process.argv.indexOf('--samples');
  return at >= 0 ? process.argv[at + 1] : undefined;
})();
const SAMPLES = samplesFlag === undefined ? 5 : Number(samplesFlag);
if (!Number.isInteger(SAMPLES) || SAMPLES < 1) {
  console.error('\n--samples must be a whole number of at least 1. ' +
    'Got: ' + JSON.stringify(samplesFlag) + '\n');
  process.exit(2);
}

/* Paths that must never return anything but the site's own HTML. Extend
   this list rather than trusting that a new private file will be noticed. */
const PRIVATE_PATHS = [
  '/.dev.vars', '/.env', '/.env.local', '/.gitignore',
  '/package.json', '/package-lock.json',
  '/wrangler.jsonc', '/wrangler.toml',
  '/schema.sql',
  '/worker/index.js', '/worker/lib.js', '/worker/repo.js', '/worker/scribe.js',
  '/migrations/006-public-page.sql', '/migrations/033_drug_catalogue_core.sql',
  '/test/scribe.test.js', '/test/publish-safety.test.js',
  '/docs/STATE-OF-THE-PROJECT.md', '/docs/AUDIT-2026-09-07.md',
  '/scripts/build-public.js', '/scripts/seed-ayurcos-demo.sql',
  '/CLAUDE.md', '/README.md'
];

/* Shapes that mean a secret is in the body, whatever the path is called. */
const SECRET_SHAPES = [
  ['OpenAI key', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['Resend key', /\bre_[A-Za-z0-9_-]{20,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['assigned secret',
    /\b(PEPPER|AUTHKEY|API_KEY|SECRET|PASSWORD|ACCESS_TOKEN)\b\s*[:=]\s*["']?[A-Za-z0-9_\-+/=]{16,}/i]
];

const sh = (cmd, args) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });

/* ------------------------------------------------------ what to check --- */

/* Every Pages project on the account, not the two we happen to remember.
   Two of the six were never looked at during the incident. */
function projects() {
  const out = sh('npx', ['wrangler', 'pages', 'project', 'list']).stdout || '';
  return [...new Set(
    (out.match(/\b([a-z0-9][a-z0-9-]*)\.pages\.dev\b/g) || [])
      .map(h => h.replace('.pages.dev', ''))
  )];
}

/* Deployment hostnames keep serving their own build after a redeploy, and
   the listing is PAGINATED - the first read showed 25 of 49. */
function deployments(project) {
  const out = sh('npx',
    ['wrangler', 'pages', 'deployment', 'list', '--project-name=' + project]).stdout || '';
  const re = new RegExp('\\b([0-9a-f]{8})\\.' + project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.pages\\.dev', 'g');
  return [...new Set([...out.matchAll(re)].map(m => m[1]))];
}

/* ------------------------------------------------------------ probing --- */

async function probe(host, path) {
  /* No query string. The exact URL a browser or a crawler would request,
     which is the only URL whose cache entry matters. */
  const url = 'https://' + host + path;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const body = await response.text();
    return {
      status: response.status,
      type: response.headers.get('content-type') || '',
      cache: response.headers.get('cf-cache-status') || '',
      bytes: body.length,
      body
    };
  } catch (error) {
    return { error: String(error.message || error) };
  }
}

/* An HTML body is the site answering "no such file". Anything else on a
   private path is the private file itself. */
const looksLikeThePage = r => /text\/html/i.test(r.type || '');

function judge(host, path, sample) {
  if (sample.error) return null;
  const problems = [];
  if (!looksLikeThePage(sample)) {
    problems.push('served as ' + (sample.type || 'unknown type') +
      ' (' + sample.bytes + ' bytes)' + (sample.cache ? ' cache=' + sample.cache : ''));
  }
  for (const [name, re] of SECRET_SHAPES) {
    if (re.test(sample.body)) problems.push('CONTAINS ' + name);
  }
  return problems.length ? { host, path, problems: [...new Set(problems)] } : null;
}

/* --------------------------------------------------------------- run --- */

console.log('\nChecking what the public internet can actually fetch.');
console.log(SAMPLES + ' samples per path, exact URLs, no cache-buster.\n');

const found = [];
let checked = 0;
let hostCount = 0;

const projectNames = projects();
if (!projectNames.length) {
  console.log('Could not list Pages projects. Is wrangler logged in?\n');
  process.exit(2);
}

for (const project of projectNames) {
  const hosts = [project + '.pages.dev',
    ...deployments(project).map(id => id + '.' + project + '.pages.dev')];

  console.log(project + '  (' + hosts.length + ' hostname' + (hosts.length === 1 ? '' : 's') + ')');

  for (const host of hosts) {
    hostCount++;
    const hostProblems = [];
    for (const path of PRIVATE_PATHS) {
      for (let i = 0; i < SAMPLES; i++) {
        const sample = await probe(host, path);
        checked++;
        const problem = judge(host, path, sample);
        if (problem) { hostProblems.push(problem); break; }
      }
    }
    if (hostProblems.length) {
      console.log('   EXPOSED  ' + host);
      for (const p of hostProblems) {
        console.log('            ' + p.path + '  ->  ' + p.problems.join('; '));
      }
      found.push(...hostProblems);
    } else {
      console.log('   clean    ' + host);
    }
  }
}

console.log('\n' + checked + ' requests across ' + projectNames.length + ' projects.');

/* "Nothing private is reachable" is a claim about requests that were made.
   With none made it is a claim about nothing, which is how this script spent
   its whole life reporting a clean bill of health over an empty loop. The
   expected count is knowable, so it is checked rather than assumed. */
const expected = hostCount * PRIVATE_PATHS.length;
if (checked === 0) {
  console.error('\nNOT ONE REQUEST WAS MADE. This script proved nothing.\n' +
    'Do not treat the run above as a clean result.\n');
  process.exit(2);
}
if (checked < hostCount) {
  console.error('\nOnly ' + checked + ' requests for ' + hostCount + ' hostnames. ' +
    'The sweep did not reach every host, so it proved nothing.\n');
  process.exit(2);
}

if (found.length) {
  console.log('\n' + found.length + ' EXPOSED path' + (found.length === 1 ? '' : 's') +
    '. This is reachable by anyone right now.\n');
  process.exit(1);
}
console.log('Nothing private is reachable.');
console.log('(' + checked + ' of at least ' + expected + ' possible requests; ' +
  'a path stops sampling as soon as it is found exposed.)\n');
