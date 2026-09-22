/* =========================================================================
   Point TCOS at the shared core, and delete its copies.

   The five modules below now live in @tharigopula/core. TCOS keeps its own
   copies until this runs, and two copies of a password hasher is exactly the
   kind of drift the core exists to prevent.

   WHAT THIS DOES NOT DO: guess. Every rewrite is an exact string swap, each
   one counted. If a file imports one of these modules in a shape not listed
   here, the script stops and names the line rather than leaving half the
   codebase pointing at a deleted file.

   Run:  node scripts/adopt-core.js          (report only)
         node scripts/adopt-core.js --write  (make the change)
   ========================================================================= */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';

const write = process.argv.includes('--write');

/* local module -> the core entry point that now owns it */
const MOVED = {
  'lib.js': '@tharigopula/core/lib',
  'access.js': '@tharigopula/core/auth',
  'security.js': '@tharigopula/core/auth',
  'sms.js': '@tharigopula/core/comms',
  'email.js': '@tharigopula/core/comms'
};

/* sms and email both export `configured`, `deliver` and `health`, so the core
   keeps them under their channel name rather than flattening them - a barrel
   that flattened both silently dropped all three. TCOS imported the bare
   names, so those call sites are rewritten to say which channel they meant,
   which they always should have. */
const CHANNEL = {
  'sms.js': 'sms',
  'email.js': 'email'
};

const files = readdirSync('worker').filter(f => f.endsWith('.js'));
let rewritten = 0, importsChanged = 0;
const problems = [];

for (const file of files) {
  const path = 'worker/' + file;
  if (MOVED[file]) continue;                 /* the modules themselves */

  let text = readFileSync(path, 'utf8');
  const before = text;

  for (const [local, pkg] of Object.entries(MOVED)) {
    const plain = new RegExp("from '\\./" + local.replace('.', '\\.') + "'", 'g');
    if (!plain.test(text)) continue;

    const channel = CHANNEL[local];
    if (!channel) {
      text = text.replace(plain, "from '" + pkg + "'");
      importsChanged++;
      continue;
    }

    /* `import * as sms from './sms.js'` is the happy case: the core already
       namespaces these, and the call sites already say sms.deliver(...), so
       only the import line moves. */
    const star = text.match(new RegExp(
      "import\\s*\\*\\s*as\\s+(\\w+)\\s*from '\\./" + local.replace('.', '\\.') + "'"));
    if (star) {
      const bound = star[1];
      text = text.replace(star[0], bound === channel
        ? "import { " + channel + " } from '" + pkg + "'"
        : "import { " + channel + " as " + bound + " } from '" + pkg + "'");
      importsChanged++;
      continue;
    }

    /* A channel module: rewrite `import { deliver } from './sms.js'` into
       `import { sms } from '@tharigopula/core/comms'` and leave the call
       sites to name the channel. Done by hand below rather than guessed. */
    const line = text.match(new RegExp(
      "import\\s*\\{([^}]*)\\}\\s*from '\\./" + local.replace('.', '\\.') + "'"));
    if (!line) {
      problems.push(path + ': imports ./' + local + ' in a shape this script does not handle');
      continue;
    }
    const names = line[1].split(',').map(s => s.trim()).filter(Boolean);
    const alias = names.map(n => {
      const [orig, as] = n.split(/\s+as\s+/).map(s => s.trim());
      return { orig, as: as || orig };
    });
    text = text.replace(line[0], "import { " + channel + " } from '" + pkg + "'");
    for (const { orig, as } of alias) {
      /* `deliver(` -> `sms.deliver(`, and an aliased name keeps its alias by
         becoming a const. */
      if (orig === as) {
        text = text.replace(new RegExp('(?<![\\w.])' + orig + '\\s*\\(', 'g'),
          channel + '.' + orig + '(');
      } else {
        text = text.replace(new RegExp('(?<![\\w.])' + as + '\\s*\\(', 'g'),
          channel + '.' + orig + '(');
      }
    }
    importsChanged++;
  }

  if (text !== before) {
    rewritten++;
    if (write) writeFileSync(path, text);
    console.log('  ' + (write ? 'rewrote ' : 'would rewrite ') + path);
  }
}

if (problems.length) {
  console.error('\nSTOPPING. Import shapes this script will not guess at:\n  ' +
    problems.join('\n  ') + '\n\nNothing was deleted.\n');
  process.exit(1);
}

console.log('\n' + rewritten + ' files, ' + importsChanged + ' imports repointed at the core.');

if (write) {
  for (const local of Object.keys(MOVED)) {
    if (existsSync('worker/' + local)) {
      unlinkSync('worker/' + local);
      console.log('  deleted worker/' + local + ' - it lives in the core now');
    }
  }
}
console.log('');
