/* The identity gate before an AI read spends the full extraction cost. */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { applyMigration } from './migrate.js';
import { preflights } from '../worker/preflights.js';
import { ai } from '../worker/ai.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('schema.sql', 'utf8'));
for (const file of ['migrations/002-prescriptions-and-pharmacy.sql',
                    'migrations/019-cost-tracking.sql',
                    'migrations/022-files.sql',
                    'migrations/023-ai-drafts.sql',
                    'migrations/024-ai-preflight.sql']) {
  for (const problem of applyMigration(db, file)) {
    console.log('  MIGRATION FAILED: ' + problem);
    failed++;
  }
}

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
  }
};

db.exec(`INSERT INTO doctors (id, mobile, full_name, clinic_name) VALUES
  ('doc_a','9000000001','Dr A','A Clinic'),
  ('doc_b','9000000002','Dr B','B Clinic');
INSERT INTO patients (id, mobile, full_name) VALUES
  ('pat_v','9111111111','Vijay'), ('pat_x','9222222222','Other');
INSERT INTO doctor_patients (doctor_id, patient_id) VALUES
  ('doc_a','pat_v'), ('doc_b','pat_x');
INSERT INTO files (id, doctor_id, r2_key, kind, content_type, bytes, patient_id) VALUES
  ('file_v','doc_a','doc_a/lab_report/file_v','lab_report','application/pdf',1000,'pat_v'),
  ('file_x','doc_b','doc_b/lab_report/file_x','lab_report','application/pdf',1000,'pat_x');`);

const usage = { inputTokens: 10000, cachedTokens: 0, outputTokens: 500, model: 'gpt-5.6-luna' };
const result = (verdict, printed = 'T. Vijay Kumar', legible = true) => ({
  data: {
    legible,
    legibility_problem: legible ? null : 'The first page is blurred.',
    document_type: 'diagnostic report', page_count: 27,
    registered_name: 'Vijay', name_on_document: printed,
    name_verdict: verdict, name_reason: 'The printed name needs a person to confirm it.',
    pages: [
      { page: 1, category: 'patient_identity', process: true, duplicate_of: null, reason: 'Patient details' },
      { page: 27, category: 'advertisement', process: false, duplicate_of: null, reason: 'Promotion' }
    ],
    clinical_pages: [1], excluded_pages: [27]
  }, usage
});

console.log('\nPatient identity is checked before values\n');

const exact = await preflights.create(shim, 'doc_a', {
  patientId: 'pat_v', fileId: 'file_v', result: result('same_person', 'Vijay'),
  usage, costPaise: 1
});
check('an exact match is approved automatically', exact.status === 'approved');
check('the clinical and advertisement pages stay separate',
  exact.clinicalPages[0] === 1 && exact.excludedPages[0] === 27);
check('no clinical value exists in a preflight row',
  !Object.keys(exact).some(key => /value|analyte|result/i.test(key)));

const ambiguous = await preflights.create(shim, 'doc_a', {
  patientId: 'pat_v', fileId: 'file_v', result: result('needs_confirmation'),
  usage, costPaise: 1
});
check('Vijay versus T. Vijay Kumar waits for confirmation',
  ambiguous.status === 'awaiting_confirmation');

const wrong = await preflights.create(shim, 'doc_a', {
  patientId: 'pat_v', fileId: 'file_v', result: result('different_person', 'Vinay'),
  usage, costPaise: 1
});
check('Vijay versus Vinay is stopped before extraction',
  wrong.status === 'awaiting_confirmation');

const doctor = { id: 'doc_a', actor: { isDoctor: true } };
const overridden = await preflights.approve(shim, doctor, wrong.id,
  'Checked the paper and patient; this is the correct report.');
check('a clinician can make an explicit, recorded override',
  overridden.status === 'approved' && overridden.confirmedBy === 'doctor:doc_a' &&
  /Checked/.test(overridden.confirmationNote));

const consumed = await preflights.consume(shim, 'doc_a', overridden.id);
check('an approved preflight can be consumed by one full read', !!consumed.consumedAt);
let twice = null;
try { await preflights.consume(shim, 'doc_a', overridden.id); } catch (error) { twice = error; }
check('the same approval cannot buy a second read', twice && /already been read/.test(twice.message));

const blocked = await preflights.create(shim, 'doc_a', {
  patientId: 'pat_v', fileId: 'file_v', result: result('no_name_on_document', null, false),
  usage, costPaise: 1
});
let blurryApproval = null;
try { await preflights.approve(shim, doctor, blocked.id, 'continue'); }
catch (error) { blurryApproval = error; }
check('a blurred identity page cannot be overridden',
  blurryApproval && /clearer copy/.test(blurryApproval.message));

let crossClinic = null;
try { await preflights.byId(shim, 'doc_b', ambiguous.id); }
catch (error) { crossClinic = error; }
check('another clinic cannot read the preflight', crossClinic && crossClinic.status === 404);

console.log('\nThe model policy reflects the business rule\n');

const source = readFileSync('worker/ai.js', 'utf8');
check('the cheap model performs preflight',
  ai.models.preflight === 'gpt-5.6-luna');
check('the higher-accuracy model performs extraction',
  ai.models.extraction === 'gpt-5.6-terra');
check('shared first names are explicitly ambiguous, not silently matched',
  /shared first name alone is never enough for same_person/.test(source));
check('Vijay versus Vinay is explicitly a different person',
  /Vijay vs Vinay/.test(source));
check('Responses application state is disabled', /store: false/.test(source));

const lunaCost = ai.costPaise(usage, 100);
check('preflight cost uses Luna rates, measured from tokens', lunaCost === 26,
  'got ' + lunaCost + ' paise');

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
