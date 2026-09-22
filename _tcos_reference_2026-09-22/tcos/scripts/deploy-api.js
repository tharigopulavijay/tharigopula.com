/* =========================================================================
   Deploy the TCOS Worker only when its code and database agree.

   A Worker deploy is not just a JavaScript upload. Its routes assume a D1
   schema, and deploying code before its migration turns a tested feature
   into a live 500. Every remote API release therefore requires:

     1. a committed, reproducible git state;
     2. no unapplied D1 migration for the selected environment;
     3. a fresh allow-listed static-assets build;
     4. the complete test suite;
     5. a successful Wrangler dry run;
     6. a strict deploy tagged with its commit.

   Usage: node scripts/deploy-api.js staging
          node scripts/deploy-api.js production
   ========================================================================= */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TARGETS = {
  production: { env: null },
  staging: { env: 'staging' }
};

const target = String(process.argv[2] || '').toLowerCase();
if (!TARGETS[target]) {
  console.log('\nSay which one: node scripts/deploy-api.js staging | production\n');
  process.exit(1);
}

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    encoding: options.encoding || 'utf8',
    stdio: options.stdio || 'pipe',
    shell: false
  });
const WRANGLER = fileURLToPath(
  new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const wrangler = (args, options = {}) => run(process.execPath, [WRANGLER, ...args], options);
const git = args => run('git', args).stdout?.trim() || '';
const sha = git(['rev-parse', 'HEAD']);
const dirty = git(['status', '--porcelain']);

if (!sha) {
  console.log('\nNot a git checkout, so this release cannot be reproduced. Refusing.\n');
  process.exit(1);
}
if (dirty) {
  console.log('\nRefusing to deploy uncommitted Worker code to ' + target + '.\n');
  for (const line of dirty.split('\n').slice(0, 20)) console.log('  ' + line);
  console.log('\nCommit the exact release first. Nothing was deployed.\n');
  process.exit(1);
}

/* Wrangler treats an omitted environment as ambiguous when named envs exist.
   An explicit empty value means the top-level production environment. */
const envArgs = ['--env', TARGETS[target].env || ''];
const configArgs = ['--config', 'wrangler.jsonc'];

/* `migrations list` exits zero even when migrations ARE pending, so the
   status code alone is not enough. Wrangler prints the pending .sql names;
   any one of them means the code and database do not yet agree. */
console.log('\nChecking the ' + target + ' D1 migration ledger...\n');
const migrationCheck = wrangler([
  'd1', 'migrations', 'list', 'DB', '--remote',
  ...configArgs, ...envArgs
]);
const migrationOutput = (migrationCheck.stdout || '') + (migrationCheck.stderr || '');
if (migrationCheck.status !== 0) {
  process.stdout.write(migrationOutput);
  console.log('\nCould not verify the remote D1 ledger. Refusing to guess.\n');
  process.exit(1);
}
if (/\b\d{3}[-_][^\s|]*\.sql\b/i.test(migrationOutput)) {
  process.stdout.write(migrationOutput);
  console.log('\nThe Worker expects migrations that this database does not have.');
  console.log('Apply or baseline them deliberately before deploying code.\n');
  process.exit(1);
}

console.log('Building the allow-listed browser assets...\n');
const publicBuild = run(process.execPath, ['scripts/build-public.js'], { stdio: 'inherit' });
if (publicBuild.status !== 0) {
  console.log('\nThe browser build failed its publication-safety checks. Nothing was deployed.\n');
  process.exit(1);
}

console.log('Running the full TCOS test suite...\n');
const tests = run(process.execPath, ['scripts/run-tests.js'], { stdio: 'inherit' });
if (tests.status !== 0) {
  console.log('\nTests failed. Nothing was deployed.\n');
  process.exit(1);
}

console.log('\nBuilding the Worker without uploading it...\n');
const dryRun = wrangler([
  'deploy', '--dry-run', ...configArgs, ...envArgs
],
  { stdio: 'inherit' });
if (dryRun.status !== 0) {
  console.log('\nWrangler could not build this release. Nothing was deployed.\n');
  process.exit(1);
}

const short = sha.slice(0, 12);
console.log('\nDeploying ' + target + ' API from commit ' + short + '...\n');
const deploy = wrangler([
  'deploy', '--strict', '--tag', 'git-' + short,
  '--message', 'TCOS ' + target + ' ' + sha, ...configArgs, ...envArgs
], { stdio: 'inherit' });

process.exit(deploy.status === null ? 1 : deploy.status);
