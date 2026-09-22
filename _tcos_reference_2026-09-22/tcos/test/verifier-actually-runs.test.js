/* =========================================================================
   The leak verifier has to actually make requests.

   scripts/verify-public.js exists because of the September 2026 incident, in
   which a leak was declared closed three times while it was still open. On
   10 September 2026 it was found to have been a no-op for its entire life:

     const SAMPLES = Number(
       ... || (process.argv[process.argv.indexOf('--samples') + 1]) || 5);

   `indexOf` returns -1 when the flag is absent, so `argv[-1 + 1]` is
   `argv[0]` - the path to node.exe. A truthy string wins the `||` chain, and
   Number("C:\\Program Files\\nodejs\\node.exe") is NaN. Every sampling loop
   was `for (let i = 0; i < NaN; i++)`, which runs zero times.

   So it made no requests, judged nothing, and printed
   "Nothing private is reachable." The header said "NaN samples per path"
   the whole time and nobody read it, including me: I ran it after the
   incident and reported the summary as a clean result.

   The script now validates the count and refuses to claim success over zero
   requests. This holds both of those in place WITHOUT touching the network -
   the real sweep is thousands of requests and does not belong in the suite.

   Run:  node test/verifier-actually-runs.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nThe verifier cannot report a clean result over zero requests\n');

const source = readFileSync('scripts/verify-public.js', 'utf8');

/* The exact expression that caused it. `indexOf(...) + 1` used as an index
   without first checking for -1 is the bug, and it reads as correct. */
check('the argv parse no longer indexes with indexOf(...) + 1 unguarded',
  !/argv\[\s*process\.argv\.indexOf\([^)]*\)\s*\+\s*1\s*\]\s*\)?\s*\|\|/.test(source),
  'the broken pattern is still in the file');

/* The count must be validated, or a typo silently disables the whole sweep
   again in some new way. */
check('the sample count is validated as a positive whole number',
  /Number\.isInteger\(SAMPLES\)/.test(source) && /SAMPLES\s*<\s*1/.test(source));

/* The claim at the end must be tied to work actually done. */
check('it refuses to claim a clean result when nothing was requested',
  /checked === 0/.test(source) && /proved nothing/i.test(source));
check('and when it did not reach every hostname',
  /checked < hostCount/.test(source));

/* Behaviour, not just source text: a bad count must stop the run. */
const run = args => spawnSync(process.execPath,
  ['scripts/verify-public.js', ...args], { encoding: 'utf8', shell: false });

const notANumber = run(['--samples', 'abc']);
check('--samples abc exits non-zero rather than sweeping NaN times',
  notANumber.status === 2, 'exit ' + notANumber.status);
check('and says what was wrong with it',
  /--samples must be a whole number/.test(notANumber.stderr || ''),
  (notANumber.stderr || '').slice(0, 80));

const zero = run(['--samples', '0']);
check('--samples 0 is refused, because zero samples prove nothing',
  zero.status === 2, 'exit ' + zero.status);

/* CONTROL: the harness can fail. If spawnSync were returning a non-zero
   status for every invocation - a missing file, a syntax error - the three
   assertions above would pass without testing anything. A valid flag must
   get PAST the guard, and it is stopped here by the missing wrangler login
   or by the network, never by the argument check. */
const valid = run(['--samples', '2', '--__stop-after-parse']);
check('CONTROL: a valid --samples gets past the argument guard',
  !/--samples must be a whole number/.test(valid.stderr || ''),
  (valid.stderr || '').slice(0, 80));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
