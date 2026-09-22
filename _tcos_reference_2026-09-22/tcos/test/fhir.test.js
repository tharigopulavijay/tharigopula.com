/* =========================================================================
   TCOS records as FHIR R4 bundles, for ABDM.

   These run offline. That is the point: the largest piece of ABDM milestone
   M3 is this translation, it needs no sandbox credentials and no gateway,
   and it can be finished and proven correct while the National Health
   Authority paperwork is still in progress.

   The assertions are the rules ABDM rejects bundles for, plus the two places
   where getting it wrong would put something untrue into a national health
   record.

   Run:  node test/fhir.test.js
   ========================================================================= */

import { fhir } from '../worker/fhir.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

if (!globalThis.crypto) globalThis.crypto = { randomUUID: () => 'id-' + Math.random() };

const doctor = {
  id: 'doc_1', full_name: 'Dr Ananya Rao', clinic_name: 'Devi Ayurvedic Clinic',
  qualification: 'BAMS', hpr_id: 'HPR-11223', hfr_id: 'HFR-99887'
};
const patient = {
  id: 'pat_1', full_name: 'Lakshmi Devi', sex: 'F', date_of_birth: '1979-04-12',
  mobile: '+919876500011', abha_number: '91-1234-5678-9012'
};
const issued = { id: 'rx_1', status: 'issued', issued_at: '2026-09-04T10:00:00Z' };
const items = [
  { medicine_name: 'Avipattikar Churna', dose: '1 tsp', frequency: 'BD',
    duration: '14 days', instructions: 'After food with warm water' }
];

/* --------------------------------------------------------- the structure */
console.log('\nThe shape ABDM will not accept anything else in\n');

const rx = fhir.prescription({ doctor, patient, prescription: issued, items });

check('it is a document Bundle', rx.resourceType === 'Bundle' && rx.type === 'document');
check('the FIRST entry is the Composition — the commonest rejection',
  rx.entry[0].resource.resourceType === 'Composition',
  rx.entry[0].resource.resourceType);
check('it declares the India prescription profile',
  (rx.meta.profile || []).some(p => /PrescriptionRecord/.test(p)));
check('every entry has a fullUrl', rx.entry.every(e => !!e.fullUrl));
check('the validator finds nothing wrong with it',
  fhir.problemsWith(rx).length === 0, fhir.problemsWith(rx).join(' | '));

/* ------------------------------------------------------- the identifiers */
console.log('\nNational identifiers, only when they are real\n');

const withIds = JSON.stringify(rx);
check('the patient carries their ABHA number', /91-1234-5678-9012/.test(withIds));
check('the doctor carries their HPR id', /HPR-11223/.test(withIds));
check('the clinic carries its HFR id', /HFR-99887/.test(withIds));

/* A fabricated identifier would produce a bundle that validates and
   describes the wrong person, or claims a registration nobody holds. */
const bare = fhir.prescription({
  doctor: { ...doctor, hpr_id: null, hfr_id: null },
  patient: { ...patient, abha_number: null },
  prescription: issued, items
});
const bareJson = JSON.stringify(bare);
check('a patient with no ABHA gets no invented identifier',
  !/healthid\.ndhm/.test(bareJson));
check('a doctor not on the registry claims no HPR id',
  !/doctor\.ndhm/.test(bareJson));
check('and the bundle is still structurally valid without them',
  fhir.problemsWith(bare).length === 0, fhir.problemsWith(bare).join(' | '));

/* ---------------------------------------------------------- the rule --- */
console.log('\nAn unissued prescription is not a clinical record\n');

let refused = null;
try {
  fhir.prescription({ doctor, patient,
    prescription: { id: 'rx_2', status: 'draft' }, items });
} catch (error) { refused = error; }
check('a draft prescription cannot be shared',
  refused !== null && /issued/i.test(refused.message),
  refused ? refused.message : 'it was allowed');

/* ------------------------------------------------------ diagnostics --- */
console.log('\nA lab report, with the range the lab actually printed\n');

const report = { id: 'lab_1', report_name: 'Complete Blood Count',
                 reported_on: '2026-08-30' };
const values = [
  { analyte: 'Haemoglobin', value: '11.2', unit: 'g/dL', reference_range: '12.0 - 15.0' },
  { analyte: 'Blood group', value: 'B Positive' },
  { analyte: 'Dengue NS1', value: 'Negative' }
];
const dx = fhir.diagnosticReport({ doctor, patient, report, values });

check('it is a valid document bundle',
  fhir.problemsWith(dx).length === 0, fhir.problemsWith(dx).join(' | '));

const observations = dx.entry.map(e => e.resource)
  .filter(r => r.resourceType === 'Observation');
const hb = observations.find(o => /haemoglobin/i.test(o.code.text));
check('a numeric result is a Quantity with its unit',
  hb.valueQuantity && hb.valueQuantity.value === 11.2 && hb.valueQuantity.unit === 'g/dL',
  JSON.stringify(hb.valueQuantity));
check('and keeps the range exactly as the lab printed it',
  hb.referenceRange[0].text === '12.0 - 15.0');

/* Forcing "Negative" into a numeric field is how a result becomes
   unreadable, or worse, becomes zero. */
const dengue = observations.find(o => /dengue/i.test(o.code.text));
check('a worded result stays a word, and never becomes a number',
  dengue.valueString === 'Negative' && !dengue.valueQuantity,
  JSON.stringify({ s: dengue.valueString, q: dengue.valueQuantity }));

const dxReport = dx.entry.map(e => e.resource)
  .find(r => r.resourceType === 'DiagnosticReport');
check('the report references every observation it produced',
  dxReport.result.length === values.length);

/* ------------------------------------------------------------ gender --- */
console.log('\nSex is one of four words, and never a guess\n');

const unknown = fhir.prescription({ doctor, patient: { ...patient, sex: null },
  prescription: issued, items });
const p = unknown.entry.map(e => e.resource).find(r => r.resourceType === 'Patient');
check('a record with no sex recorded says "unknown", not male',
  p.gender === 'unknown', p.gender);

/* ------------------------------------------------- the validator works --- */
console.log('\nThe validator has to be able to fail\n');

check('a bundle whose first entry is not a Composition is rejected',
  fhir.problemsWith({ resourceType: 'Bundle', type: 'document',
    entry: [{ fullUrl: 'urn:uuid:x', resource: { resourceType: 'Patient' } }] })
    .some(p => /Composition/.test(p)));
check('a reference pointing outside the bundle is caught',
  fhir.problemsWith({ resourceType: 'Bundle', type: 'document', entry: [
    { fullUrl: 'urn:uuid:a', resource: { resourceType: 'Composition',
      subject: { reference: 'urn:uuid:missing' } } }] })
    .some(p => /outside the bundle/.test(p)));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
