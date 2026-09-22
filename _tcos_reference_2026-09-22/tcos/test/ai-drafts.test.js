/* =========================================================================
   What the model read, and the wall between it and the record.

   Vijay's line is the specification: "one value here and there is a big 0
   for us". So these assertions are about the wall, not about the reading.
   The model can be wrong; that is expected and survivable. What must never
   happen is a number nobody checked appearing in a patient's chart as
   though a doctor had written it.

   Run:  node test/ai-drafts.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { applyMigration } from './migrate.js';
import { drafts } from '../worker/drafts.js';
import { labReports } from '../worker/repo.js';

const readingsUi = readFileSync('js/readings.js', 'utf8');
import { ai } from '../worker/ai.js';
const { withCompleteness } = ai;

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* ---------------------------------------------------------------- set up */

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('schema.sql', 'utf8'));
/* Only the two pieces of migration 018 used by this focused test. The
   migration test helper intentionally has a tiny SQL parser and migration
   009 contains inline comments with semicolons, so applying that unrelated
   file here would test the helper rather than AI confirmation. */
db.exec(`CREATE TABLE clinic_users (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE
);
ALTER TABLE lab_reports ADD COLUMN practitioner_id TEXT REFERENCES clinic_users(id);`);

/* ai_drafts references files(id), so 022 has to be here even though nothing
   below reads a file - a foreign key to a table that does not exist fails at
   INSERT, not at CREATE, which makes it look like a bug in the insert. */
for (const file of ['migrations/002-prescriptions-and-pharmacy.sql',
                    'migrations/019-cost-tracking.sql',
                    'migrations/022-files.sql',
                    'migrations/023-ai-drafts.sql',
                    'migrations/039-lab-report-provenance.sql']) {
  for (const problem of applyMigration(db, file)) {
    console.log('  MIGRATION FAILED: ' + problem);
    failed++;
  }
}

/* D1's async surface over node:sqlite's sync one, so worker/drafts.js runs
   here exactly as it runs in production rather than against a mock that
   agrees with whatever it is told. */
const shim = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    return {
      bind(...args) {
        return {
          async first() { return stmt.get(...args) ?? null; },
          async all() { return { results: stmt.all(...args) }; },
          async run() { return stmt.run(...args); }
        };
      }
    };
  },
  async batch(statements) {
    db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      db.exec('COMMIT');
      return results;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
};

db.exec(`INSERT INTO doctors (id, mobile, full_name, clinic_name, password_hash, password_salt)
         VALUES ('doc_a','9000000001','Dr A','A Clinic','x','y'),
                ('doc_b','9000000002','Dr B','B Clinic','x','y')`);
db.exec(`INSERT INTO patients (id, mobile, full_name) VALUES ('pat_1','9111111111','Meena')`);

/* Real file rows rather than invented ids. ai_drafts.file_id is a foreign
   key, and the point of keeping the original document is that it is still
   there to check against when a value is disputed - a draft pointing at a
   file that never existed would defeat that. */
db.exec(`INSERT INTO files (id, doctor_id, r2_key, kind, content_type, bytes) VALUES
  ('file_1','doc_a','doc_a/lab_report/file_1','lab_report','image/jpeg',482000),
  ('file_2','doc_a','doc_a/lab_report/file_2','lab_report','image/jpeg',311000),
  ('file_3','doc_a','doc_a/lab_report/file_3','lab_report','application/pdf',96000),
  ('file_9','doc_b','doc_b/lab_report/file_9','lab_report','image/png',225000)`);

/* Built through withCompleteness, the same function the reader runs its own
   output through, so the missed-heading arithmetic is exercised here rather
   than assumed. */
const reading = (rows, opts = {}) => ({
  draft: withCompleteness({
    legible: opts.legible !== false,
    legibility_problem: opts.legible === false ? 'Too blurred to read the numbers.' : null,
    report_name: 'Complete Blood Count',
    reported_on: '2026-08-30',
    headings_visible: opts.headingsVisible || ['Complete Blood Count'],
    patient: { name: opts.nameOnPage || 'Meena Kumari', age: '34', sex: 'F', id_on_report: 'UH-4471' },
    sample: { collected_at: '2026-08-29 08:10', type: 'Whole blood (EDTA)' },
    lab: { name: 'City Diagnostics', accreditation: 'NABL', signed_by: 'Dr S Rao' },
    sections: rows.length ? [{ title: 'Complete Blood Count', rows }] : [],
    unrecognised: opts.unrecognised || [],
    name_check: opts.nameCheck || { verdict: 'same_person', note: null }
  })
});
const usage = { inputTokens: 2300, cachedTokens: 2000, outputTokens: 600, model: 'claude-opus-5' };

/* ------------------------------------------------------- the wall itself */

console.log('\nA draft is not a record\n');

const d1 = await drafts.create(shim, 'doc_a', {
  patientId: 'pat_1', fileId: 'file_1',
  result: reading([
    { analyte: 'Haemoglobin', value: '11.2', unit: 'g/dL', reference: '12-15', confidence: 'high' },
    { analyte: 'Platelets', value: '154', unit: '10^3/uL', reference: '150-410', confidence: 'low' }
  ]),
  usage, costPaise: 180
});

check('a new reading starts as pending', d1.status === 'pending');
check('reading a report creates no lab report by itself',
  db.prepare('SELECT COUNT(*) n FROM lab_reports').get().n === 0);
check('and no lab values',
  db.prepare('SELECT COUNT(*) n FROM lab_values').get().n === 0);

/* The reason drafts are a separate table rather than a flag: a screen that
   forgets to filter cannot accidentally read one as a result. */
check('ai_drafts and lab_reports are different tables',
  db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name IN ('ai_drafts','lab_reports')").get().n === 2);

console.log('\nWhat the doctor is shown\n');

check('per-value confidence survives the round trip',
  d1.values[1].confidence === 'low');
check('the doubtful values are counted, so she can be shown them first',
  d1.lowConfidenceCount === 1);
check('the name printed on the report is kept, so a mis-filing is catchable',
  d1.nameOnReport === 'Meena Kumari');
check('the original file is still linked', d1.fileId === 'file_1');

/* The half of the feature that stops the reader looking complete when it is
   not. Everything a report carries besides its numbers has to survive. */
check('the patient block on the page is kept',
  d1.patient.age === '34' && d1.patient.id_on_report === 'UH-4471');
check('sample timing is kept - a sample taken two days earlier reads differently',
  d1.sample.collected_at === '2026-08-29 08:10');
check('the lab and who signed it are kept',
  d1.lab.accreditation === 'NABL' && d1.lab.signed_by === 'Dr S Rao');
check('rows remember which section they came from',
  d1.values[0].section === 'Complete Blood Count');

console.log('\nAn unreadable page returns nothing to type in\n');

check('the safety review screen keeps the signed-in clinic navigation visible',
  /TCOSApi\.me\(\)/.test(readingsUi) &&
  /TCOSNav\.paint\('readings\.html', me\)/.test(readingsUi));

const blurred = await drafts.create(shim, 'doc_a', {
  patientId: 'pat_1', fileId: 'file_2',
  result: reading([], { legible: false }), usage, costPaise: 90
});
check('it is marked not legible', blurred.legible === false);
check('it carries a problem a receptionist can act on',
  /blurred/i.test(blurred.legibilityProblem));
check('and it holds no values at all', blurred.values.length === 0);

console.log('\nConfirming, rejecting, and doing neither twice\n');

/* The route creates the real report first and only then confirms the draft,
   so the draft can never point at a report that does not exist. The foreign
   key enforces that order rather than trusting it - inserting the report
   here is what the router does, in the order it does it. */
db.exec(`INSERT INTO lab_reports (id, doctor_id, patient_id, report_name, reported_on)
         VALUES ('lab_1','doc_a','pat_1','Complete Blood Count','2026-08-30')`);

const confirmed = await drafts.confirm(shim, 'doc_a', d1.id,
  { labReportId: 'lab_1', reviewedBy: 'doctor:doc_a' });
check('confirming records which report it became', confirmed.labReportId === 'lab_1');
check('and who agreed to it', confirmed.reviewedBy === 'doctor:doc_a');
check('and when', !!confirmed.reviewedAt);

let doubleConfirm = null;
try { await drafts.confirm(shim, 'doc_a', d1.id, { labReportId: 'lab_2', reviewedBy: 'x' }); }
catch (error) { doubleConfirm = error; }
check('a draft cannot be confirmed twice',
  doubleConfirm !== null && /already been confirmed/.test(doubleConfirm.message));

console.log('\nConfirming is one transaction, and one clinician decision\n');

const atomicDraft = await drafts.create(shim, 'doc_a', {
  patientId: 'pat_1', fileId: 'file_3',
  result: reading([
    { analyte: 'Absolute eosinophils', value: 0, unit: '/uL', reference: '0-500', confidence: 'high' },
    { analyte: 'HbA1c', value: '6.2', unit: '%', reference: '<5.7', flag: 'H', confidence: 'high' }
  ]),
  usage, costPaise: 175
});
const atomicReport = await labReports.confirmDraft(shim, 'doc_a', atomicDraft.id, {
  patientId: 'pat_1', reportName: 'Complete Blood Count',
  labName: 'City Diagnostics', reportedOn: '2026-08-30',
  values: atomicDraft.values
}, {
  reviewedBy: 'practitioner:usr_doctor_2', verifiedBy: 'Dr Second',
  practitionerId: null
});

check('one confirmation creates one verified clinical report',
  atomicReport.status === 'verified' && !!atomicReport.verified_at);
check('the issuing laboratory survives confirmation',
  atomicReport.lab_name === 'City Diagnostics', atomicReport.lab_name);
check('the original R2 object remains linked for later verification',
  atomicReport.file_key === 'doc_a/lab_report/file_3', atomicReport.file_key);
check('numeric zero remains zero instead of becoming blank',
  atomicReport.values[0].value !== null && Number(atomicReport.values[0].value) === 0,
  String(atomicReport.values[0].value));
check('the accepting clinician is recorded on the draft',
  (await drafts.byId(shim, 'doc_a', atomicDraft.id)).reviewedBy === 'practitioner:usr_doctor_2');
check('usage and legal audit evidence are committed with the report',
  db.prepare("SELECT COUNT(*) n FROM usage_events WHERE idempotency_key = ?")
    .get('ai-confirm:' + atomicDraft.id).n === 1 &&
  db.prepare("SELECT actor FROM audit_events WHERE target_id = ?").get(atomicReport.id).actor ===
    'practitioner:usr_doctor_2');

let atomicRetry = null;
try {
  await labReports.confirmDraft(shim, 'doc_a', atomicDraft.id, {
    patientId: 'pat_1', reportName: 'Duplicate', reportedOn: '2026-08-30', values: atomicDraft.values
  }, { reviewedBy: 'doctor:doc_a', verifiedBy: 'Dr A' });
} catch (error) { atomicRetry = error; }
check('a retry cannot create a second report, second audit or second usage line',
  atomicRetry && /already been handled/.test(atomicRetry.message) &&
  db.prepare("SELECT COUNT(*) n FROM lab_reports WHERE patient_id='pat_1'").get().n === 2 &&
  db.prepare("SELECT COUNT(*) n FROM usage_events WHERE idempotency_key = ?")
    .get('ai-confirm:' + atomicDraft.id).n === 1);

const manualReport = await labReports.create(shim, 'doc_a', {
  patientId: 'pat_1', reportName: 'Entered at the clinic', labName: 'Town Lab',
  reportedOn: '2026-09-01', values: [{ analyte: 'CRP', value: '2.4', unit: 'mg/L' }]
}, {
  actor: 'doctor:doc_a', verifiedBy: 'Dr A', practitionerId: null,
  idempotencyKey: 'manual-report-attempt-1'
});
check('a clinician-entered report is verified in the same save',
  manualReport.status === 'verified' && manualReport.verified_by === 'Dr A');
const manualRetry = await labReports.create(shim, 'doc_a', {
  patientId: 'pat_1', reportName: 'Should not replace it', reportedOn: '2026-09-01',
  values: [{ analyte: 'CRP', value: '99' }]
}, {
  actor: 'doctor:doc_a', verifiedBy: 'Dr A', practitionerId: null,
  idempotencyKey: 'manual-report-attempt-1'
});
check('retrying a manual save returns the first report without duplicating it',
  manualRetry.id === manualReport.id && manualRetry.report_name === 'Entered at the clinic' &&
  manualRetry.values.length === 1 && manualRetry.values[0].value === '2.4');
check('manual report usage and audit are written once with the clinical rows',
  db.prepare("SELECT COUNT(*) n FROM usage_events WHERE idempotency_key='lab-save:manual-report-attempt-1'")
    .get().n === 1 &&
  db.prepare("SELECT COUNT(*) n FROM audit_events WHERE target_id=? AND action='lab_report_added'")
    .get(manualReport.id).n === 1);

let manualWithoutKey = null;
try {
  await labReports.create(shim, 'doc_a', {
    patientId: 'pat_1', reportName: 'No key', reportedOn: '2026-09-01',
    values: [{ analyte: 'CRP', value: '2' }]
  }, { actor: 'doctor:doc_a', verifiedBy: 'Dr A' });
} catch (error) { manualWithoutKey = error; }
check('a manual save without a retry key is refused',
  manualWithoutKey && /save request has expired/.test(manualWithoutKey.message));

const failingDraft = await drafts.create(shim, 'doc_a', {
  patientId: 'pat_1', fileId: 'file_3',
  result: reading([{ analyte: 'Glucose', value: '98', unit: 'mg/dL', confidence: 'high' }]),
  usage, costPaise: 150
});
let failedTransaction = null;
try {
  await labReports.confirmDraft(shim, 'doc_a', failingDraft.id, {
    patientId: 'pat_1', reportName: 'Must roll back', reportedOn: '2026-08-30',
    values: [{ analyte: null, value: '98' }]
  }, { reviewedBy: 'doctor:doc_a', verifiedBy: 'Dr A' });
} catch (error) { failedTransaction = error; }
check('a failed value rolls back the report and leaves the draft pending',
  failedTransaction &&
  db.prepare("SELECT COUNT(*) n FROM lab_reports WHERE report_name='Must roll back'").get().n === 0 &&
  (await drafts.byId(shim, 'doc_a', failingDraft.id)).status === 'pending');

const d2 = await drafts.create(shim, 'doc_a', {
  patientId: 'pat_1', fileId: 'file_3',
  result: reading([{ analyte: 'HbA1c', value: '7.1', unit: '%', reference: '<5.7', confidence: 'medium' }]),
  usage, costPaise: 175
});
const rejected = await drafts.reject(shim, 'doc_a', d2.id,
  { reason: 'Read 7.1 but the page says 1.1', reviewedBy: 'doctor:doc_a' });
check('rejecting records the reason', /1\.1/.test(rejected.rejectReason));

/* Deleting the failures means learning nothing from them - the rejected
   rows are the only evidence anyone has when tuning the prompt. */
check('a rejected draft is kept, not deleted',
  db.prepare("SELECT COUNT(*) n FROM ai_drafts WHERE status='rejected'").get().n === 1);

console.log('\nNothing on the page is left behind\n');

/* A reader that transcribes the eight analytes it recognises and drops the
   interpretation, the footnote and the test it has never heard of is worse
   than useless, because it looks complete. */
const rich = await drafts.create(shim, 'doc_a', {
  patientId: 'pat_1', fileId: 'file_3',
  result: reading(
    [{ analyte: 'Serum Ferritin', value: '9', unit: 'ng/mL', reference: '13-150', flag: 'L', confidence: 'high' }],
    {
      headingsVisible: ['Complete Blood Count', 'Iron Studies', 'Interpretation'],
      unrecognised: [
        { label: 'Interpretation', text: 'Findings consistent with iron deficiency. Clinical correlation advised.' },
        { label: 'Handwritten note', text: 'repeat after 6 weeks' }
      ]
    }),
  usage, costPaise: 210
});

check('a lab\'s own interpretation is kept, as their words',
  rich.unrecognised.some(u => /iron deficiency/.test(u.text)));
check('a handwritten margin note is kept too, and not as a result',
  rich.unrecognised.some(u => u.label === 'Handwritten note') &&
  !rich.values.some(v => /repeat/i.test(v.analyte)));
check('the printed high/low flag is kept exactly as printed',
  rich.values[0].flag === 'L');

/* The completeness check: the model inventories the page first, and what it
   listed but never transcribed is computed by comparison - never asked. A
   model asked "did you miss anything?" says no. */
check('a heading it saw but transcribed nothing for is reported as a gap',
  rich.missedHeadings.length === 1 && rich.missedHeadings[0] === 'Iron Studies',
  JSON.stringify(rich.missedHeadings));
check('a heading covered by the catch-all bucket is not a gap',
  !rich.missedHeadings.includes('Interpretation'));

console.log('\nThe report belongs to this patient, or it does not\n');

/* Vijay's example: signed in as one person, the page names another. Rule
   based matching cannot do this - Indian names vary by initials, order and
   transliteration - so the model judges and we store the judgement. */
const wrongPerson = await drafts.create(shim, 'doc_a', {
  patientId: 'pat_1', fileId: 'file_1',
  result: reading([{ analyte: 'TSH', value: '3.1', unit: 'mIU/L', reference: '0.4-4.0', confidence: 'high' }], {
    nameOnPage: 'Anjaneyulu Akunamoni',
    nameCheck: { verdict: 'different_person', note: 'The page says Anjaneyulu Akunamoni, which is a different person.' }
  }),
  usage, costPaise: 170
});
check('a different name is recorded as different_person',
  wrongPerson.nameVerdict === 'different_person');
check('and it is a column, so the queue can sort on it without opening each draft',
  db.prepare("SELECT name_verdict FROM ai_drafts WHERE id = ?").get(wrongPerson.id).name_verdict === 'different_person');
check('the name actually printed is stored beside it',
  wrongPerson.nameOnReport === 'Anjaneyulu Akunamoni');
check('with a sentence a receptionist can act on',
  /different person/i.test(wrongPerson.nameCheck.note));

const spelling = await drafts.create(shim, 'doc_a', {
  patientId: 'pat_1', fileId: 'file_2',
  result: reading([{ analyte: 'TSH', value: '3.1', unit: 'mIU/L', reference: '0.4-4.0', confidence: 'high' }], {
    nameOnPage: 'Meenaa Kumari',
    nameCheck: { verdict: 'spelling_variant', note: 'The page spells it Meenaa; the record says Meena.' }
  }),
  usage, costPaise: 168
});
check('a spelling variant is NOT treated as a different person',
  spelling.nameVerdict === 'spelling_variant');

console.log('\nOne clinic cannot see another clinic\'s readings\n');

await drafts.create(shim, 'doc_b', {
  patientId: 'pat_1', fileId: 'file_9',
  result: reading([{ analyte: 'TSH', value: '4.2', unit: 'mIU/L', reference: '0.4-4.0', confidence: 'high' }]),
  usage, costPaise: 160
});

/* doc_b's reading must not appear in doc_a's queue however many doc_a has of
   its own, so this counts what the database holds rather than a fixed
   number - a hardcoded count breaks every time a case is added above, which
   teaches people to edit the number instead of reading the failure. */
const aPending = await drafts.list(shim, 'doc_a', { status: 'pending' });
const aPendingInDb = db.prepare(
  "SELECT COUNT(*) n FROM ai_drafts WHERE doctor_id='doc_a' AND status='pending'").get().n;
check('the list returns exactly this clinic\'s pending readings',
  aPending.length === aPendingInDb && aPendingInDb > 0,
  aPending.length + ' returned, ' + aPendingInDb + ' in the table');
check('and none of them belong to the other clinic',
  aPending.every(d => d.fileId !== 'file_9'));

let crossRead = null;
try { await drafts.byId(shim, 'doc_a', (await drafts.list(shim, 'doc_b'))[0].id); }
catch (error) { crossRead = error; }
check('reading another clinic\'s draft by id is a not-found, not a read',
  crossRead !== null && crossRead.status === 404);

let crossConfirm = null;
try {
  const other = (await drafts.list(shim, 'doc_b'))[0];
  await drafts.confirm(shim, 'doc_a', other.id, { labReportId: 'lab_x', reviewedBy: 'doctor:doc_a' });
} catch (error) { crossConfirm = error; }
check('and confirming one is refused the same way',
  crossConfirm !== null && crossConfirm.status === 404);

console.log('\nWhat it cost is measured, not estimated\n');

const spend = await drafts.spendPaise(shim, 'doc_a', new Date().toISOString().slice(0, 7));
const expected = db.prepare(
  "SELECT SUM(cost_paise) p, COUNT(*) n FROM ai_drafts WHERE doctor_id='doc_a'").get();
check('spend is summed from the real token counts, this clinic only',
  spend.paise === expected.p, spend.paise + 'p vs ' + expected.p + 'p');
check('and every read is counted, including the ones she rejected',
  spend.reads === expected.n);
check('cached tokens are recorded, since they are a tenth of the price',
  d1.cost.cachedTokens === 2000);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
