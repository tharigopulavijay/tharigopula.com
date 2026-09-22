/* =========================================================================
   Joining several pages of one report into a single reading.

   Every assertion here comes from something that actually went wrong while
   reading a real 24-page master health check-up on 4 September 2026:

     the same document returned 148 values one run and 86 the next, having
     silently dropped HAEMATOLOGY, BIOCHEMISTRY and two leucocyte counts

     the completeness check then cried wolf, reporting "Test Name", "Unit"
     and "Sodium" as missing when the first two are column headers and the
     third had been captured as a row

     and reading page by page found every value twice, because a check-up
     prints its results once in a doctor's summary and again in the detail
     behind it

   None of these needs an API call to test, which is the point: the model is
   expensive and non-deterministic, and this logic is neither.

   Run:  node test/ai-merge.test.js
   ========================================================================= */

import { ai } from '../worker/ai.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const usage = { inputTokens: 1000, cachedTokens: 800, outputTokens: 400, model: 'gpt-5.4-mini' };
const page = (n, data) => ({ page: n, data, usage });

/* A split PDF restarts its own page numbers at one. Telling the model to read
   "page 7" from a one-page extract made it correctly return no values. The
   prompt must map attached-page positions back to the original report. */
const chunkRequest = ai.extractionRequest({
  expectedName: 'Vijay', clinicalPages: [7, 9], attachedOriginalPages: [7, 9],
  contentType: 'application/pdf', bytes: new Uint8Array([1]), filename: 'chunk.pdf'
});
check('a split PDF tells the model to read every attached page',
  /Transcribe every attached page/.test(chunkRequest.prompt), chunkRequest.prompt);
check('a split PDF maps attached positions to original page numbers',
  /Attached page 1 is original document page 7/.test(chunkRequest.prompt) &&
  /Attached page 2 is original document page 9/.test(chunkRequest.prompt),
  chunkRequest.prompt);
check('a full document still limits extraction to preflight-approved pages',
  /Preflight approved original document pages: 7, 9/.test(ai.extractionRequest({
    expectedName: 'Vijay', clinicalPages: [7, 9], contentType: 'application/pdf',
    bytes: new Uint8Array([1]), filename: 'full.pdf'
  }).prompt));

/* ------------------------------------------------------ crying wolf --- */
console.log('\nThe completeness check only warns about real gaps\n');

const furniture = ai.withCompleteness({
  headings_visible: ['Test Name', 'Result', 'Unit', 'Bio. Ref. Interval', 'Method'],
  sections: [{ title: 'CBC', rows: [{ analyte: 'Haemoglobin', value: '11.2' }] }],
  unrecognised: []
});
check('column headers are not reported as missing clinical sections',
  furniture.missed_headings.length === 0,
  JSON.stringify(furniture.missed_headings));

const asRow = ai.withCompleteness({
  headings_visible: ['Sodium', 'Creatinine', 'Urea'],
  sections: [{ title: 'BIOCHEMISTRY', rows: [
    { analyte: 'Sodium', value: '140' },
    { analyte: 'Creatinine', value: '0.9' },
    { analyte: 'Urea', value: '24' }
  ] }],
  unrecognised: []
});
check('a heading captured as a ROW is not reported as missing',
  asRow.missed_headings.length === 0,
  JSON.stringify(asRow.missed_headings));

/* The check still has to work, or it is worse than useless. */
const realGap = ai.withCompleteness({
  headings_visible: ['CBC', 'THYROID PROFILE'],
  sections: [{ title: 'CBC', rows: [{ analyte: 'Haemoglobin', value: '11.2' }] }],
  unrecognised: []
});
check('a section that really was not transcribed IS still reported',
  realGap.missed_headings.length === 1 &&
  /THYROID/i.test(realGap.missed_headings[0]),
  JSON.stringify(realGap.missed_headings));

/* ------------------------------------------------ the same value twice --- */
console.log('\nA value printed on two pages is one value\n');

const twice = ai.mergePages([
  page(3, { headings_visible: ['Doctor Summary'], sections: [
    { title: 'Summary', rows: [{ analyte: 'Haemoglobin', value: '11.2', page: 3 }] }],
    unrecognised: [] }),
  page(8, { headings_visible: ['HAEMATOLOGY'], sections: [
    { title: 'Complete Blood Count', rows: [
      { analyte: 'Haemoglobin', value: '11.2', unit: 'g/dL',
        reference: '13-17', method: 'Photometry', page: 8 }] }],
    unrecognised: [] })
]);
const allRows = twice.draft.sections.flatMap(s => s.rows);
check('it appears once, not twice',
  allRows.filter(r => /haemoglobin/i.test(r.analyte)).length === 1,
  allRows.length + ' rows');
check('and the copy kept is the one carrying unit, range and method',
  allRows[0].unit === 'g/dL' && allRows[0].reference === '13-17',
  JSON.stringify(allRows[0]));

/* A page whose values were duplicates is not an empty page. Measuring
   coverage after de-duplication reported eleven of twenty-one pages as empty
   on a reading where every page was read correctly. */
const summaryThenDetail = ai.mergePages([
  page(3, { headings_visible: [], unrecognised: [], sections: [
    { title: 'Summary', rows: [{ analyte: 'Hb', value: '11.2', page: 3 }] }] }),
  { page: 8, pages: [8, 9], usage, data: { headings_visible: [], unrecognised: [], sections: [
    { title: 'Haematology', rows: [
      { analyte: 'Hb', value: '11.2', unit: 'g/dL', reference: '13-17', page: 8 }] }] } }
]);
check('a page whose values were de-duplicated is NOT reported as empty',
  !summaryThenDetail.draft.pages_without_values.includes(8),
  JSON.stringify(summaryThenDetail.draft.pages_without_values));
check('but a page that genuinely produced nothing still is',
  summaryThenDetail.draft.pages_without_values.includes(9),
  JSON.stringify(summaryThenDetail.draft.pages_without_values));

/* ------------------------------------------------------- disagreement --- */
console.log('\nTwo different readings of one test are BOTH shown\n');

const conflicting = ai.mergePages([
  page(3, { headings_visible: [], sections: [
    { title: 'Summary', rows: [{ analyte: 'HbA1c', value: '7.5', page: 3 }] }], unrecognised: [] }),
  page(11, { headings_visible: [], sections: [
    { title: 'Biochemistry', rows: [{ analyte: 'HbA1c', value: '7.0', page: 11 }] }], unrecognised: [] })
]);
const hba1c = conflicting.draft.sections.flatMap(s => s.rows)
  .filter(r => /hba1c/i.test(r.analyte));
check('neither reading is silently discarded', hba1c.length === 2,
  hba1c.length + ' kept');
check('and the disagreement is raised for the doctor',
  conflicting.draft.unrecognised.some(u => /Two different readings/i.test(u.label)),
  JSON.stringify(conflicting.draft.unrecognised.map(u => u.label)));
check('naming both pages, so she knows where to look',
  conflicting.draft.unrecognised.some(u => /page 3/i.test(u.text) && /page 11/i.test(u.text)));

/* ------------------------------------------------------ a failed page --- */
console.log('\nA page that could not be read is said out loud\n');

const withFailure = ai.mergePages([
  page(7, { headings_visible: [], sections: [
    { title: 'CBC', rows: [{ analyte: 'WBC', value: '8400', page: 7 }] }], unrecognised: [] }),
  { page: 8, failed: true, reason: 'The provider timed out.' }
]);
check('the good pages still produce a reading',
  withFailure.draft.sections.flatMap(s => s.rows).length === 1);
check('and the failed page is reported rather than quietly missing',
  withFailure.draft.unrecognised.some(u => /Page 8 could not be read/i.test(u.label)),
  JSON.stringify(withFailure.draft.unrecognised.map(u => u.label)));
check('the caller can see exactly which pages were read',
  JSON.stringify(withFailure.pagesRead) === '[7]' &&
  JSON.stringify(withFailure.pagesFailed) === '[8]');

/* --------------------------------------------------------------- cost --- */
console.log('\nWhat it cost is the sum of every page, not the last one\n');

const threePages = ai.mergePages([page(2, { sections: [], unrecognised: [] }),
                                  page(3, { sections: [], unrecognised: [] }),
                                  page(4, { sections: [], unrecognised: [] })]);
check('tokens add up across the pages',
  threePages.usage.inputTokens === 3000 && threePages.usage.outputTokens === 1200,
  JSON.stringify(threePages.usage));

/* ------------------------------------------------------ nothing works --- */
const allFailed = ai.mergePages([
  { page: 2, failed: true, reason: 'x' }, { page: 3, failed: true, reason: 'x' }]);
check('a document where every page failed is marked not legible',
  allFailed.draft.legible === false && !!allFailed.draft.legibility_problem);

/* ------------------------------------------------------------- rates --- */
console.log('\nA dated model id is priced as the model it is\n');

/* The API answers with a DATED id: ask for gpt-5.4-mini and the reply says
   gpt-5.4-mini-2026-03-17. An exact-key lookup never matched, so every
   reading was priced at the default model's rate - the expensive one - for
   work billed at a third of it. Every cost reported was 2.67 times the
   truth, and every one of them looked entirely plausible.

   The version before this had the same fault in a different shape, which is
   why it is now tested rather than merely rewritten. */
const tokens = m => ({ inputTokens: 100000, cachedTokens: 0, outputTokens: 50000, model: m });

check('a dated id costs the same as the plain one',
  ai.costPaise(tokens('gpt-5.4-mini-2026-03-17')) === ai.costPaise(tokens('gpt-5.4-mini')),
  ai.costPaise(tokens('gpt-5.4-mini-2026-03-17')) + ' vs ' + ai.costPaise(tokens('gpt-5.4-mini')));
check('and is not quietly priced as the expensive model',
  ai.costPaise(tokens('gpt-5.4-mini-2026-03-17')) < ai.costPaise(tokens('gpt-5.6-terra')));
check('a model nobody recognises is priced at the DEAREST rate',
  ai.costPaise(tokens('brand-new-model')) >= ai.costPaise(tokens('gpt-5.6-terra')),
  'guessing low is how a cost report lies while everything looks fine');
check('batch is exactly half of standard',
  ai.costPaise(tokens('gpt-5.4-mini'), 95, true) * 2 === ai.costPaise(tokens('gpt-5.4-mini')));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
