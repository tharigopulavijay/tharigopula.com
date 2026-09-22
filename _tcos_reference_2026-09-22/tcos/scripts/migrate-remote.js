/* =========================================================================
   Guarded TCOS production migration runner.

   Production's legacy empty ledger was repaired on 9 September 2026 after a
   full export and object-by-object audit through migration 035. Migrations
   036-048 were rehearsed on that exact export and then applied by Wrangler.
   Future migrations can now use the normal ledger, but only with a clean,
   reproducible commit and a fresh backup supplied explicitly by the operator.

   Usage:
     npm run db:migrate:remote -- \
       --confirm-production \
       --backup "E:\\secure-backups\\tcos-production-before-049.sql"

   The backup must be outside this repository, at least 1 KiB, and no more
   than two hours old. This script never creates the backup: exporting live
   clinical data is a separate, deliberate operation.
   ========================================================================= */


import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const WRANGLER = fileURLToPath(
  new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const run = (command, args, options = {}) => spawnSync(command, args, {
  cwd: root,
  encoding: 'utf8',
  stdio: options.stdio || 'pipe',
  shell: false
});
const wrangler = (args, options = {}) =>
  run(process.execPath, [WRANGLER, ...args], options);
const configArgs = ['--config', 'wrangler.jsonc', '--env', ''];

const git = run('git', ['status', '--porcelain']);
if (git.status !== 0 || git.stdout.trim()) {
  console.error('\nRefusing production migration from a dirty or unreadable git checkout.\n');
  process.exit(1);
}

console.log('\nChecking the production migration ledger...\n');
const before = wrangler(['d1', 'migrations', 'list', 'DB', '--remote', ...configArgs]);
const beforeOutput = (before.stdout || '') + (before.stderr || '');
if (before.status !== 0) {
  process.stdout.write(beforeOutput);
  console.error('\nCould not verify the production ledger. Nothing was changed.\n');
  process.exit(1);
}

const pending = [...beforeOutput.matchAll(/\b\d{3}[-_][^\s|]*\.sql\b/gi)]
  .map((match) => match[0]);
if (!pending.length) {
  console.log('Production has no pending migrations. Nothing to do.\n');
  process.exit(0);
}

const backupIndex = process.argv.indexOf('--backup');
const backupArg = backupIndex >= 0 ? process.argv[backupIndex + 1] : '';
if (!process.argv.includes('--confirm-production') || !backupArg) {
  console.error(`
Refusing to apply ${pending.length} production migration(s).

Review the pending files, create and verify a fresh production D1 export, then run:

  npm run db:migrate:remote -- --confirm-production --backup "FULL_PATH_TO_EXPORT.sql"
`);
  process.exit(1);
}

const backup = resolve(backupArg);
const relativeToRepo = relative(root, backup);
if (!isAbsolute(backupArg) ||
    (!relativeToRepo.startsWith('..') && !isAbsolute(relativeToRepo))) {
  console.error('\nThe production backup must use an absolute path outside this repository.\n');
  process.exit(1);
}
if (!existsSync(backup)) {
  console.error('\nThe supplied production backup does not exist. Nothing was changed.\n');
  process.exit(1);
}

const info = statSync(backup);
const ageMinutes = (Date.now() - info.mtimeMs) / 60_000;
if (info.size < 1024 || ageMinutes < 0 || ageMinutes > 120) {
  console.error('\nThe backup is empty, invalid, or more than two hours old. Nothing was changed.\n');
  process.exit(1);
}

const sample = readFileSync(backup, {encoding: 'utf8', flag: 'r'}).slice(0, 4096);
if (!/CREATE TABLE/i.test(sample) && !/PRAGMA\s+defer_foreign_keys/i.test(sample)) {
  console.error('\nThe supplied file does not look like a Wrangler D1 SQL export.\n');
  process.exit(1);
}

const sha256 = createHash('sha256').update(readFileSync(backup)).digest('hex');
console.log(`Backup verified: ${info.size} bytes, SHA-256 ${sha256}`);
console.log('Pending migrations:');
for (const name of [...new Set(pending)]) console.log('  ' + name);

console.log('\nApplying production migrations through Wrangler...\n');
const apply = wrangler(
  ['d1', 'migrations', 'apply', 'DB', '--remote', ...configArgs],
  {stdio: 'inherit'});
if (apply.status !== 0) process.exit(apply.status === null ? 1 : apply.status);

console.log('\nVerifying the production ledger after apply...\n');
const after = wrangler(['d1', 'migrations', 'list', 'DB', '--remote', ...configArgs]);
const afterOutput = (after.stdout || '') + (after.stderr || '');
process.stdout.write(afterOutput);
if (after.status !== 0 || /\b\d{3}[-_][^\s|]*\.sql\b/i.test(afterOutput)) {
  console.error('\nProduction still reports pending migrations. Investigate before deployment.\n');
  process.exit(1);
}

console.log('\nProduction migration ledger is current.\n');
