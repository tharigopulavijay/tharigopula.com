#!/usr/bin/env node
/* =========================================================================
   Which model reads YOUR reports most accurately?

   WHY THIS EXISTS. Nobody - not me, not a pricing table, not a benchmark
   run on American lab reports - can tell you which model reads a Hyderabad
   diagnostics printout most accurately. That is a question about these
   documents. It is cheap to answer and expensive to guess at.

   WHAT IT DOES. Runs one document through several extraction models and
   diffs them value by value. Where they agree you have real evidence,
   because errors from differently-trained models are not correlated. Where
   they disagree you have the short list worth checking by hand.

   That is also the production design worth aiming at: two models must agree,
   and your validator checks the three values they argued about instead of
   forty values at one speed. Two cheap models cross-checked cost less than
   one expensive model and catch more.

     node scripts/compare-readers.js report.jpg "Vijay Tharigopula"
     node scripts/compare-readers.js report.pdf "Vijay Tharigopula" gpt-5.4-mini,gpt-5.6-terra

   Needs OPENAI_API_KEY in the environment or in .dev.vars.
   ========================================================================= */

import { readFileSync, existsSync } from 'node:fs';
import { extname, basename } from 'node:path';
import { ai } from '../worker/ai.js';

const TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.pdf': 'application/pdf'
};

const DEFAULT_MODELS = ['gpt-5.4-mini', 'gpt-5.6-terra'];

const [file, expectedName, modelList] = process.argv.slice(2);

if (!file) {
  console.log('\n  Compare extraction models on one of your own reports.\n');
  console.log('    node scripts/compare-readers.js <file> "patient name" [model,model]\n');
  console.log('  Default models: ' + DEFAULT_MODELS.join(', '));
  console.log('  Available:      ' + Object.keys(ai.rates).join(', ') + '\n');
  process.exit(1);
}
if (!existsSync(file)) { console.error('\n  No such file: ' + file + '\n'); process.exit(1); }

const contentType = TYPES[extname(file).toLowerCase()];
if (!contentType) {
  console.error('\n  ' + extname(file) + ' cannot be read. Use a PDF or a photo.\n');
  process.exit(1);
}

/* The key comes from .dev.vars if the environment has none. That file is
   gitignored and already holds PEPPER, so the key lives in one place and
   never goes into shell history. */
function keyFromDevVars() {
  try {
    const line = readFileSync('.dev.vars', 'utf8').split('\n')
      .find(l => l.trim().startsWith('OPENAI_API_KEY'));
    return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : null;
  } catch (_) { return null; }
}

const apiKey = process.env.OPENAI_API_KEY || keyFromDevVars();
if (!apiKey) {
  console.error('\n  No API key, so there is nothing to call.\n');
  console.error('  1. platform.openai.com  ->  API keys  ->  Create');
  console.error('  2. Open  products/tcos/.dev.vars');
  console.error('  3. Add:  OPENAI_API_KEY=sk-...\n');
  console.error('  That file is gitignored and never leaves your machine.\n');
  process.exit(1);
}

const env = { OPENAI_API_KEY: apiKey };
const models = (modelList ? modelList.split(',') : DEFAULT_MODELS).map(m => m.trim());
const bytes = readFileSync(file);
const line = () => console.log('  ' + '-'.repeat(82));

console.log('\n  ' + basename(file) + '  ' + Math.round(bytes.length / 1024) + ' KB');
console.log('  filing against: ' + (expectedName || '(none given)'));
console.log('  models: ' + models.join('  vs  ') + '\n');

/* ------------------------------------------------------- preflight once */

let clinicalPages = null;
let preflightCost = 0;
try {
  const pre = await ai.preflight(env, {
    contentType, bytes, filename: basename(file), expectedName: expectedName || ''
  });
  clinicalPages = pre.data.clinical_pages;
  preflightCost = ai.costPaise(pre.usage);
  console.log('  PREFLIGHT (' + ai.models.preflight + ')  ₹' + (preflightCost / 100).toFixed(2));
  console.log('    legible      : ' + pre.data.legible +
    (pre.data.legibility_problem ? '  (' + pre.data.legibility_problem + ')' : ''));
  console.log('    name on page : ' + (pre.data.name_on_document || '(none)'));
  console.log('    name verdict : ' + pre.data.name_verdict + ' - ' + pre.data.name_reason);
  console.log('    pages to read: ' + (clinicalPages || []).join(', ') +
    ((pre.data.excluded_pages || []).length
      ? '   (skipped ' + pre.data.excluded_pages.join(', ') + ')' : ''));
  if (!pre.data.legible) {
    console.log('\n  Not legible, so nothing would be extracted. Stopping.\n');
    process.exit(0);
  }
} catch (error) {
  console.error('  PREFLIGHT FAILED: ' + (error.message || error) + '\n');
  process.exit(1);
}

/* --------------------------------------------------------- each model */

const runs = [];
for (const model of models) {
  process.stdout.write('\n  ' + model + ' ... ');
  const started = Date.now();
  try {
    const out = await ai.readReport(env, {
      contentType, bytes, filename: basename(file),
      expectedName: expectedName || '', clinicalPages, model
    });
    const paise = ai.costPaise(out.usage);
    runs.push({ model, draft: out.draft, paise, seconds: (Date.now() - started) / 1000 });
    console.log(out.draft.row_count + ' values, ₹' + (paise / 100).toFixed(2) +
                ', ' + ((Date.now() - started) / 1000).toFixed(1) + 's');
  } catch (error) {
    console.log('FAILED - ' + (error.message || error));
    runs.push({ model, failed: true });
  }
}

const ok = runs.filter(r => !r.failed);
if (!ok.length) {
  console.log('\n  Nothing to show - every model failed.\n');
  process.exit(1);
}

/* With one model there is nothing to diff, but the read still cost money and
   the values are the whole point of it. Printing them was worth more than the
   symmetry of insisting on two - the first real run of this script threw away
   148 values and ₹77 of reading because it had nothing to compare them to. */
if (ok.length === 1) {
  const d = ok[0].draft;
  console.log('\n  ' + (d.report_name || 'Report') +
              (d.reported_on ? '   ' + d.reported_on : ''));
  if (d.patient) {
    console.log('  patient: ' + [d.patient.name, d.patient.age, d.patient.sex,
                                 d.patient.id_on_report].filter(Boolean).join('  ·  '));
  }
  for (const section of d.sections || []) {
    console.log('\n  ' + String(section.title || 'Values').toUpperCase());
    for (const row of section.rows || []) {
      const mark = row.confidence === 'low' ? ' <?' : row.flag ? ' ' + row.flag : '';
      console.log('    ' + pad(row.analyte, 38) + pad(row.value + mark, 14) +
                  pad(row.unit || '', 12) + (row.reference || ''));
    }
  }
  if ((d.unrecognised || []).length) {
    console.log('\n  ALSO ON THE PAGE');
    for (const item of d.unrecognised) {
      console.log('    [' + item.label + '] ' +
                  String(item.text).replace(/\s+/g, ' ').slice(0, 140));
    }
  }
  console.log('');
  line();
  console.log('  ' + d.row_count + ' values in ' + (d.sections || []).length + ' section(s)' +
              '   ·   ' + lowCount(d) + ' uncertain' +
              ((d.missed_headings || []).length
                ? '   ·   LEFT OUT: ' + d.missed_headings.join(', ') : '   ·   nothing left out'));
  console.log('  ₹' + ((ok[0].paise + preflightCost) / 100).toFixed(2) +
              ' all in   ·   ' + ok[0].seconds.toFixed(1) + 's   ·   ' + ok[0].model);
  line();
  console.log('\n  Pass two models to compare them:  ... "name" gpt-5.4-mini,gpt-5.6-terra\n');
  process.exit(0);
}

/* ------------------------------------------------------------ the diff */

/* Matched on the analyte name, loosely, because two models will not spell
   "Total WBC count" identically. Comparison of the VALUE is exact after
   trimming - a difference of one character is exactly what we are hunting. */
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const index = draft => {
  const map = new Map();
  for (const section of draft.sections || []) {
    for (const row of section.rows || []) map.set(norm(row.analyte), row);
  }
  return map;
};

const maps = ok.map(r => ({ model: r.model, rows: index(r.draft) }));
const allKeys = [...new Set(maps.flatMap(m => [...m.rows.keys()]))];

let agree = 0, differ = 0, missing = 0;
const problems = [];

for (const key of allKeys) {
  const present = maps.filter(m => m.rows.has(key));
  if (present.length < maps.length) {
    missing++;
    const has = present.map(m => m.model).join(', ');
    problems.push(['ONLY IN ' + has,
      (present[0].rows.get(key).analyte), present.map(m =>
        m.rows.has(key) ? m.rows.get(key).value : '(absent)')]);
    continue;
  }
  const values = present.map(m => String(m.rows.get(key).value || '').trim());
  if (new Set(values).size === 1) agree++;
  else { differ++; problems.push(['DISAGREE', present[0].rows.get(key).analyte, values]); }
}

console.log('');
line();
console.log('  ' + pad('', 30) + ok.map(r => pad(r.model, 22)).join(''));
line();
for (const r of ok) { /* keep the loop for symmetry with the header */ }
console.log('  ' + pad('values found', 30) +
  ok.map(r => pad(String(r.draft.row_count), 22)).join(''));
console.log('  ' + pad('marked low confidence', 30) +
  ok.map(r => pad(String(lowCount(r.draft)), 22)).join(''));
console.log('  ' + pad('headings left out', 30) +
  ok.map(r => pad(String((r.draft.missed_headings || []).length), 22)).join(''));
console.log('  ' + pad('other items kept', 30) +
  ok.map(r => pad(String((r.draft.unrecognised || []).length), 22)).join(''));
console.log('  ' + pad('cost', 30) +
  ok.map(r => pad('₹' + (r.paise / 100).toFixed(2), 22)).join(''));
console.log('  ' + pad('seconds', 30) +
  ok.map(r => pad(r.seconds.toFixed(1), 22)).join(''));
line();

console.log('\n  AGREEMENT: ' + agree + ' values identical, ' + differ +
            ' different, ' + missing + ' found by only one model');

if (problems.length) {
  console.log('\n  THESE ARE THE ONLY VALUES WORTH CHECKING BY HAND');
  console.log('  (open the document and see which model is right)\n');
  console.log('  ' + pad('', 12) + pad('test', 32) + ok.map(r => pad(shortName(r.model), 18)).join(''));
  for (const [kind, analyte, values] of problems) {
    console.log('  ' + pad(kind === 'DISAGREE' ? '  ->' : '  ?', 12) +
                pad(analyte, 32) + values.map(v => pad(v, 18)).join(''));
  }
} else {
  console.log('\n  Every value matched. On this document, the cheaper model is enough.');
}

const both = ok.reduce((n, r) => n + r.paise, 0) + preflightCost;
console.log('\n  Reading this document on BOTH models, cross-checked: ₹' + (both / 100).toFixed(2));
console.log('  Your validator checks ' + problems.length + ' value(s) instead of ' +
            (ok[0].draft.row_count || 0) + '.');
console.log('');

function pad(s, n) { return String(s == null ? '' : s).padEnd(n); }
function shortName(m) { return m.replace(/^gpt-/, ''); }
function lowCount(draft) {
  return (draft.sections || []).reduce((n, s) =>
    n + (s.rows || []).filter(r => r.confidence === 'low').length, 0);
}
