#!/usr/bin/env node
/* =========================================================================
   Read a real report, right now, from the command line.

   WHY THIS EXISTS. The reader was built, wired to routes, covered by tests -
   and had never once made an actual API call. Vijay uploaded a report and
   nothing happened, because the key was not set and nothing was deployed.
   Tests that mock the model prove the plumbing and prove nothing about
   whether it can read an Indian lab report.

   This is the shortest path from "a file on your disk" to "here is
   everything the model found in it", with no worker, no database, no
   deployment and no browser in the way. If it works here, the feature works;
   if it does not, the failure is visible in seconds instead of after a
   deploy.

     set ANTHROPIC_API_KEY=sk-ant-...            (PowerShell: $env:ANTHROPIC_API_KEY="...")
     node scripts/read-report.js report.jpg
     node scripts/read-report.js report.pdf "Vijay Tharigopula"

   The second argument is the patient the report is being filed against. Give
   it and the model checks the name on the page against it - which is the
   check that stops a report reaching the wrong chart.
   ========================================================================= */

import { readFileSync, existsSync } from 'node:fs';
import { extname, basename } from 'node:path';
import { ai } from '../worker/ai.js';

const TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf'
};

const [file, expectedName] = process.argv.slice(2);

if (!file) {
  console.log('\n  Read a diagnostic report and show everything found in it.\n');
  console.log('    node scripts/read-report.js <file> ["patient name"]\n');
  console.log('  Accepts .jpg .jpeg .png .webp .pdf');
  console.log('  Needs ANTHROPIC_API_KEY in the environment.\n');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error('\n  No such file: ' + file + '\n');
  process.exit(1);
}

const contentType = TYPES[extname(file).toLowerCase()];
if (!contentType) {
  console.error('\n  ' + extname(file) + ' cannot be read. Use a PDF or a photo.\n');
  process.exit(1);
}
/* The key comes from .dev.vars if it is not already in the environment.
   .dev.vars is gitignored and is where this repo already keeps PEPPER, so
   the key lives in one file, is never pasted into a terminal that keeps
   history, and never travels through a chat window. */
function keyFromDevVars() {
  try {
    const line = readFileSync('.dev.vars', 'utf8').split('\n')
      .find(l => l.trim().startsWith('ANTHROPIC_API_KEY'));
    if (!line) return null;
    return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') || null;
  } catch (_) { return null; }
}

const apiKey = process.env.ANTHROPIC_API_KEY || keyFromDevVars();

if (!apiKey) {
  console.error('\n  No API key, so there is nothing to call. This is the one step');
  console.error('  nobody else can do for you.\n');
  console.error('  1. Go to  console.anthropic.com  ->  API keys  ->  Create key');
  console.error('  2. Open   products/tcos/.dev.vars');
  console.error('  3. Add one line:\n');
  console.error('       ANTHROPIC_API_KEY=sk-ant-...\n');
  console.error('  That file is gitignored and never leaves your machine.\n');
  process.exit(1);
}

/* ------------------------------------------------------------------ read */

const bytes = readFileSync(file);
console.log('\n  ' + basename(file) + '  ' + Math.round(bytes.length / 1024) + ' KB' +
            (expectedName ? '\n  filing against: ' + expectedName : '\n  no patient name given, so the name check is skipped'));
console.log('  reading with claude-opus-5 ...\n');

const started = Date.now();
let result;
try {
  result = await ai.readReport(
    { ANTHROPIC_API_KEY: apiKey },
    { contentType, bytes, expectedName: expectedName || null }
  );
} catch (error) {
  console.error('  FAILED: ' + (error.message || error));
  if (error.status) console.error('  status: ' + error.status + '  code: ' + (error.code || '-'));
  console.error('');
  process.exit(1);
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
const d = result.draft;

/* ---------------------------------------------------------------- report */

const line = () => console.log('  ' + '-'.repeat(74));
const pad = (s, n) => String(s == null ? '' : s).padEnd(n);

if (!d.legible) {
  line();
  console.log('  NOT LEGIBLE');
  line();
  console.log('  ' + (d.legibility_problem || 'The page could not be read.'));
  console.log('\n  No values were taken. Nothing would be offered to save.\n');
  process.exit(0);
}

/* The name check first, because it is the one that stops a report reaching
   the wrong person - and it is worthless at the bottom of a long printout. */
if (d.name_check && d.name_check.verdict !== 'not_checked') {
  const alarming = d.name_check.verdict === 'different_person';
  line();
  console.log('  NAME CHECK: ' + d.name_check.verdict.replace(/_/g, ' ').toUpperCase() +
              (alarming ? '   <-- DO NOT FILE THIS WITHOUT CHECKING' : ''));
  line();
  console.log('  on the page : ' + (d.patient?.name || '(no name found)'));
  console.log('  in the record: ' + expectedName);
  if (d.name_check.note) console.log('  ' + d.name_check.note);
  console.log('');
}

line();
console.log('  ' + (d.report_name || 'Untitled report') +
            (d.reported_on ? '   ' + d.reported_on : ''));
line();
if (d.patient) {
  console.log('  patient : ' + [d.patient.name, d.patient.age, d.patient.sex,
                                d.patient.id_on_report].filter(Boolean).join('  ·  '));
  if (d.patient.referred_by) console.log('  referred: ' + d.patient.referred_by);
}
if (d.sample && (d.sample.collected_at || d.sample.type)) {
  console.log('  sample  : ' + [d.sample.type, d.sample.collected_at &&
              ('collected ' + d.sample.collected_at)].filter(Boolean).join('  ·  '));
}
if (d.lab) {
  console.log('  lab     : ' + [d.lab.name, d.lab.accreditation,
                                d.lab.signed_by].filter(Boolean).join('  ·  '));
}

let low = 0;
for (const section of d.sections || []) {
  console.log('\n  ' + (section.title || 'Values').toUpperCase());
  console.log('  ' + pad('test', 34) + pad('result', 14) + pad('unit', 12) + 'reference');
  for (const row of section.rows || []) {
    if (row.confidence === 'low') low++;
    const mark = row.confidence === 'low' ? ' <?' : row.flag ? ' ' + row.flag : '';
    console.log('  ' + pad(row.analyte, 34) + pad(row.value + mark, 14) +
                pad(row.unit || '', 12) + (row.reference || ''));
  }
}

if ((d.unrecognised || []).length) {
  console.log('\n  EVERYTHING ELSE ON THE PAGE');
  for (const item of d.unrecognised) {
    console.log('\n  [' + item.label + ']');
    for (const l of String(item.text).split('\n')) console.log('    ' + l);
  }
}

console.log('');
line();
console.log('  ' + d.row_count + ' values in ' + (d.sections || []).length + ' section(s)' +
            (low ? '   ·   ' + low + ' marked uncertain (<?)' : '   ·   none uncertain') +
            (d.unrecognised?.length ? '   ·   ' + d.unrecognised.length + ' other item(s)' : ''));

/* The completeness check: headings the model said it could see but produced
   nothing for. This is the number that says whether anything was left out. */
if ((d.missed_headings || []).length) {
  console.log('  LEFT OUT: ' + d.missed_headings.join(', '));
  console.log('  ^ visible on the page but not transcribed - this is a gap.');
} else if ((d.headings_visible || []).length) {
  console.log('  every one of the ' + d.headings_visible.length +
              ' heading(s) it could see was transcribed');
}

const paise = ai.costPaise(result.usage);
console.log('  ' + seconds + 's   ₹' + (paise / 100).toFixed(2) +
            '   (' + result.usage.inputTokens + ' in, ' + result.usage.cachedTokens +
            ' cached, ' + result.usage.outputTokens + ' out)   ' + result.usage.model);
line();
console.log('');
