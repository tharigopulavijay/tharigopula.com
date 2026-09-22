/* =========================================================================
   Split WhatsApp the way email was split: transport to the core, the words
   and the patient shape back to TCOS.

   Vijay, looking at the core: "here whatsapp is missing i think sms and
   email are there whatsapp is missing."

   Right, and it was the wrong one to leave behind. The Meta Cloud API module
   is the most valuable of the three - it carries HMAC webhook verification,
   timing-safe comparison, fail-closed semantics, opt-out handling and dedupe
   keys, all expensive to rebuild and all identical in a school or a factory.

   WHAT DECIDES THE LINE. Two things in that file know what TCOS sells:

     TEMPLATES   appointment_reminder and record_ready, whose variables are
                 patientName, clinicName, doctorName. A school reminds a
                 parent about a fee, not a patient about a doctor.
     refusalFor  reads patient.whatsapp_opt_in and patient.full_name off a
                 TCOS row.

   Everything else - sending, signing, verifying, deduping, opting out - has
   no opinion about any of it.

   This script does the mechanical half and refuses if the file is not the
   shape it expects. The two halves are then hand-finished, because a
   webhook signature check is not something to let a regex rewrite.

   Run:  node scripts/adopt-whatsapp.js
   ========================================================================= */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const CORE = 'E:/tharigopula.com/platform/core';
const source = readFileSync('worker/whatsapp.js', 'utf8');

/* The exports that stay with TCOS, because they name what TCOS sells. */
const PRODUCT_EXPORTS = ['TEMPLATES', 'refusalFor', 'fill'];

for (const name of PRODUCT_EXPORTS) {
  if (!new RegExp('^export (const|function) ' + name + '\\b', 'm').test(source)) {
    console.error('  whatsapp.js does not export ' + name +
      ' where expected. Nothing written.');
    process.exit(1);
  }
}

/* Cut points, by the exact export lines. Each block runs to the next export. */
function blockOf(name) {
  const start = source.search(new RegExp('^export (const|function|async function) ' + name + '\\b', 'm'));
  if (start < 0) return null;
  const after = source.slice(start + 10);
  const next = after.search(/^export (const|function|async function) /m);
  return { start, end: next < 0 ? source.length : start + 10 + next };
}

/* Take the product blocks out, keep the rest for the core. */
const cuts = PRODUCT_EXPORTS.map(blockOf).filter(Boolean)
  .sort((a, b) => b.start - a.start);

let core = source;
const taken = [];
for (const cut of cuts) {
  taken.unshift(core.slice(cut.start, cut.end));
  core = core.slice(0, cut.start) + core.slice(cut.end);
}

if (!/verifySignature/.test(core)) {
  console.error('  the signature check did not survive the cut. Nothing written.');
  process.exit(1);
}
if (/patientName|clinicName|doctorName|whatsapp_opt_in/.test(core)) {
  console.error('  product concepts remain in the core half. Nothing written.');
  process.exit(1);
}

mkdirSync(CORE + '/src/comms', { recursive: true });
writeFileSync(CORE + '/src/comms/whatsapp.js', core);
writeFileSync('worker/whatsapp-templates.js', taken.join('\n'));

console.log('  core   <- ' + core.split('\n').length + ' lines (transport, signing, dedupe)');
console.log('  tcos   <- ' + taken.join('\n').split('\n').length +
  ' lines (templates, refusalFor, fill)');
console.log('\nBoth halves written. Hand-finish the imports, then run both suites.\n');
