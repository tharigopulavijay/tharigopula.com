/* =========================================================================
   Point the tests at the core too.

   The five modules moved to @tharigopula/core; the suites that exercise them
   were still reading files that no longer exist. Same discipline as
   adopt-core.js: exact swaps, counted, and it stops rather than guesses.

   Run:  node scripts/adopt-core-tests.js [--write]
   ========================================================================= */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const write = process.argv.includes('--write');

/* Each entry: the import line as it stands -> what it becomes. Written out in
   full rather than pattern-matched, because there are only seven of them and
   a wrong guess here breaks a security suite. */
const SWAPS = [
  ["import { configured, from, deliver, health } from '../worker/email.js';",
   "import { email } from '@tharigopula/core/comms';\n" +
   "const { configured, from, deliver, health } = email;"],

  ["const health = (await import('../worker/sms.js')).health;",
   "const health = (await import('@tharigopula/core/comms')).sms.health;"],

  ["import { canSend, templateIdFor, TEMPLATE_VARS } from '../worker/sms.js';",
   "import { sms } from '@tharigopula/core/comms';\n" +
   "const { canSend, templateIdFor, TEMPLATE_VARS } = sms;"],

  ["} from '../worker/lib.js';", "} from '@tharigopula/core/lib';"],
  ["} from '../worker/security.js';", "} from '@tharigopula/core/auth';"],
  ["import { sha256 } from '../worker/lib.js';",
   "import { sha256 } from '@tharigopula/core/lib';"],
  ["import { verifyPlatformAccess } from '../worker/access.js';",
   "import { verifyPlatformAccess } from '@tharigopula/core/auth';"],
  ["import { normaliseMobile } from '../worker/lib.js';",
   "import { normaliseMobile } from '@tharigopula/core/lib';"],

  /* The welcome wording moved back to TCOS with the template, so the
     assertion about what it says follows it. */
  ["readFileSync('worker/email.js', 'utf8')",
   "readFileSync('worker/email-templates.js', 'utf8')"]
];

const files = readdirSync('test').filter(f => f.endsWith('.js')).map(f => 'test/' + f);
let changed = 0, applied = 0;

for (const path of files) {
  let text = readFileSync(path, 'utf8');
  const before = text;
  for (const [from, to] of SWAPS) {
    if (!text.includes(from)) continue;
    const count = text.split(from).length - 1;
    if (count !== 1) {
      console.error('  AMBIGUOUS  ' + path + ': "' + from.slice(0, 40) +
        '" appears ' + count + ' times. Nothing written.');
      process.exit(1);
    }
    text = text.replace(from, to);
    applied++;
  }
  if (text !== before) {
    changed++;
    if (write) writeFileSync(path, text);
    console.log('  ' + (write ? 'rewrote ' : 'would rewrite ') + path);
  }
}

/* Anything still reaching for a module that has left is a suite that will
   fail with ENOENT rather than a useful message. */
const stragglers = [];
for (const path of files) {
  const text = readFileSync(path, 'utf8');
  for (const gone of ['lib.js', 'security.js', 'access.js', 'sms.js', 'email.js']) {
    if (new RegExp("worker/" + gone.replace('.', '\\.')).test(text)) {
      stragglers.push(path + ' -> worker/' + gone);
    }
  }
}

console.log('\n' + changed + ' test files, ' + applied + ' imports repointed.');
if (stragglers.length) {
  console.log('\nStill pointing at moved modules:\n  ' + stragglers.join('\n  ') + '\n');
  if (write) process.exit(1);
}
console.log('');
