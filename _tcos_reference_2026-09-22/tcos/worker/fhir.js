/* =========================================================================
   TCOS records as FHIR R4 bundles.

   WHY THIS IS THE FIRST PIECE OF ABDM TO BUILD. Everything else in the
   integration waits on the National Health Authority: sandbox credentials,
   milestone sign-off, a security review, production access. This does not.
   It is the largest single piece of work in milestone M3, it needs no
   credentials, and it can be tested offline against the specification.

   It is also worth having on its own. A clinic that leaves TCOS should be
   able to take its records in a format the next system understands, and
   "your data is yours, in a standard format" is a promise worth being able
   to keep whether or not ABDM ever certifies us.

   WHAT ABDM ACTUALLY WANTS. Not raw FHIR - the India-specific profiles
   published by NRCeS. The three that matter for a clinic:

     Prescription Record    what she prescribed
     Diagnostic Report      what the lab found
     OP Consultation        the visit itself

   Each is a Bundle of type "document", whose FIRST entry must be a
   Composition describing what the bundle is, followed by the resources it
   references.

   NOTHING HERE TALKS TO A GATEWAY. It builds documents. Sending them is a
   separate job that needs credentials TCOS does not yet have, and this file
   deliberately has no network access so it cannot accidentally become one.
   ========================================================================= */

/* ABDM identifier systems. Written out rather than inlined so a change to a
   national URL is one edit, not a search. */
const SYSTEM = {
  abha: 'https://healthid.ndhm.gov.in',
  hpr: 'https://doctor.ndhm.gov.in',
  hfr: 'https://facility.ndhm.gov.in',
  snomed: 'http://snomed.info/sct',
  loinc: 'http://loinc.org',
  ucum: 'http://unitsofmeasure.org'
};

/* The India profiles this file produces. */
const PROFILE = {
  prescription: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/PrescriptionRecord',
  diagnostic: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/DiagnosticReportRecord',
  consultation: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord'
};

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/* A reference inside a document bundle points at the entry's fullUrl, so
   both are built from one id and cannot drift apart. */
const urn = id => 'urn:uuid:' + id;

/* ---------------------------------------------------------------- people */

/* The patient, as ABDM wants to see them.

   The ABHA number is included ONLY when the clinic actually holds one.
   Inventing a placeholder identifier would produce a bundle that validates
   and describes the wrong person, which is worse than one that is rejected. */
function patientResource(patient, id) {
  const identifiers = [];
  if (patient.abha_number) {
    identifiers.push({
      system: SYSTEM.abha,
      value: patient.abha_number,
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                         code: 'MR', display: 'Medical record number' }] }
    });
  }

  const resource = {
    resourceType: 'Patient',
    id,
    name: [{ text: patient.full_name }],
    gender: fhirGender(patient.sex)
  };
  if (identifiers.length) resource.identifier = identifiers;
  if (patient.date_of_birth) resource.birthDate = patient.date_of_birth;
  if (patient.mobile) {
    resource.telecom = [{ system: 'phone', value: patient.mobile, use: 'mobile' }];
  }
  return resource;
}

/* FHIR accepts male | female | other | unknown, and nothing else. A record
   whose sex was never captured is "unknown", which is true - guessing would
   put a fact into a national record that nobody asserted. */
function fhirGender(sex) {
  const s = String(sex || '').trim().toLowerCase();
  if (s === 'm' || s === 'male') return 'male';
  if (s === 'f' || s === 'female') return 'female';
  if (s === 'o' || s === 'other') return 'other';
  return 'unknown';
}

function practitionerResource(doctor, id) {
  const resource = {
    resourceType: 'Practitioner',
    id,
    name: [{ text: doctor.full_name }]
  };
  /* HPR id when the doctor has registered. Absent otherwise - the registry
     id is the doctor's to obtain, and a fabricated one is a false claim
     about a national register. */
  if (doctor.hpr_id) {
    resource.identifier = [{ system: SYSTEM.hpr, value: doctor.hpr_id }];
  }
  if (doctor.qualification) {
    resource.qualification = [{ code: { text: doctor.qualification } }];
  }
  return resource;
}

function organizationResource(doctor, id) {
  const resource = {
    resourceType: 'Organization',
    id,
    name: doctor.clinic_name
  };
  if (doctor.hfr_id) {
    resource.identifier = [{ system: SYSTEM.hfr, value: doctor.hfr_id }];
  }
  return resource;
}

/* ------------------------------------------------------------- documents */

/* The shared skeleton. Every ABDM bundle is a `document`, its first entry is
   a Composition, and the resources follow. Getting that order wrong is the
   most common reason a bundle is rejected, so it is enforced here once
   rather than remembered three times. */
function documentBundle({ profile, title, code, subject, author, custodian,
                          sections, resources, date }) {
  const compositionId = uuid();

  const composition = {
    resourceType: 'Composition',
    id: compositionId,
    meta: { profile: [profile] },
    status: 'final',
    type: code,
    subject: { reference: urn(subject.id), display: subject.display },
    date: date || now(),
    author: [{ reference: urn(author.id), display: author.display }],
    title,
    section: sections
  };
  if (custodian) composition.custodian = { reference: urn(custodian.id) };

  return {
    resourceType: 'Bundle',
    id: uuid(),
    meta: { lastUpdated: now(), profile: [profile] },
    identifier: { system: 'https://tharigopula.com/tcos', value: uuid() },
    type: 'document',
    timestamp: now(),
    entry: [
      { fullUrl: urn(compositionId), resource: composition },
      ...resources.map(r => ({ fullUrl: urn(r.id), resource: r }))
    ]
  };
}

export const fhir = {
  /* ------------------------------------------------------ prescription --
     Only an ISSUED prescription may be shared. A draft is not a clinical
     record, and TCOS's own rule is that a prescription freezes on issue -
     publishing an editable one into a national health record would break
     the guarantee that makes the record defensible. */
  prescription({ doctor, patient, prescription, items }) {
    if (prescription.status !== 'issued') {
      throw new Error('Only an issued prescription can be shared. This one is ' +
        prescription.status + '.');
    }

    const patientId = uuid(), practitionerId = uuid(), orgId = uuid();
    const resources = [
      patientResource(patient, patientId),
      practitionerResource(doctor, practitionerId),
      organizationResource(doctor, orgId)
    ];

    const statements = (items || []).map(item => {
      const id = uuid();
      const dosage = {};
      if (item.dose) dosage.text = [item.dose, item.frequency, item.duration]
        .filter(Boolean).join(', ');
      if (item.instructions) dosage.patientInstruction = item.instructions;

      resources.push({
        resourceType: 'MedicationRequest',
        id,
        meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest'] },
        status: 'active',
        intent: 'order',
        /* The medicine as WRITTEN. TCOS's catalogue is a typing aid that
           decides nothing, so there is no coded concept to claim here, and
           asserting a SNOMED code nobody chose would be inventing clinical
           meaning. Text is honest and the specification allows it. */
        medicationCodeableConcept: { text: item.medicine_name },
        subject: { reference: urn(patientId) },
        authoredOn: prescription.issued_at || prescription.created_at,
        requester: { reference: urn(practitionerId) },
        dosageInstruction: Object.keys(dosage).length ? [dosage] : undefined
      });
      return id;
    });

    return documentBundle({
      profile: PROFILE.prescription,
      title: 'Prescription',
      code: { coding: [{ system: SYSTEM.snomed, code: '440545006',
                         display: 'Prescription record' }] },
      subject: { id: patientId, display: patient.full_name },
      author: { id: practitionerId, display: doctor.full_name },
      custodian: { id: orgId },
      date: prescription.issued_at || prescription.created_at,
      sections: [{
        title: 'Prescription record',
        code: { coding: [{ system: SYSTEM.snomed, code: '440545006' }] },
        entry: statements.map(id => ({ reference: urn(id) }))
      }],
      resources
    });
  },

  /* --------------------------------------------------- diagnostic report --
     Every value carries the reference range exactly as the lab printed it,
     because the same analyte is reported against different ranges by
     different labs and a value without its range can be read as abnormal
     when it is not.

     Values the doctor has not confirmed never reach here - the caller passes
     a saved lab_report, and in TCOS a reading only becomes one after she has
     agreed to it. */
  diagnosticReport({ doctor, patient, report, values }) {
    const patientId = uuid(), practitionerId = uuid(), orgId = uuid();
    const resources = [
      patientResource(patient, patientId),
      practitionerResource(doctor, practitionerId),
      organizationResource(doctor, orgId)
    ];

    const observations = (values || []).map(value => {
      const id = uuid();
      const observation = {
        resourceType: 'Observation',
        id,
        status: 'final',
        code: { text: value.analyte },
        subject: { reference: urn(patientId) },
        effectiveDateTime: report.reported_on || report.created_at
      };

      /* A number stays a number and a word stays a word. Forcing "Negative"
         into a numeric field is how a result becomes unreadable. */
      const numeric = Number(String(value.value).replace(/,/g, ''));
      if (value.value !== '' && value.value != null && Number.isFinite(numeric)) {
        observation.valueQuantity = { value: numeric };
        if (value.unit) {
          observation.valueQuantity.unit = value.unit;
          observation.valueQuantity.system = SYSTEM.ucum;
        }
      } else {
        observation.valueString = String(value.value == null ? '' : value.value);
      }

      if (value.reference_range) {
        observation.referenceRange = [{ text: value.reference_range }];
      }
      resources.push(observation);
      return id;
    });

    const reportId = uuid();
    resources.push({
      resourceType: 'DiagnosticReport',
      id: reportId,
      status: 'final',
      code: { text: report.report_name },
      subject: { reference: urn(patientId) },
      effectiveDateTime: report.reported_on || report.created_at,
      performer: [{ reference: urn(orgId) }],
      result: observations.map(id => ({ reference: urn(id) }))
    });

    return documentBundle({
      profile: PROFILE.diagnostic,
      title: report.report_name || 'Diagnostic report',
      code: { coding: [{ system: SYSTEM.snomed, code: '721981007',
                         display: 'Diagnostic studies report' }] },
      subject: { id: patientId, display: patient.full_name },
      author: { id: practitionerId, display: doctor.full_name },
      custodian: { id: orgId },
      date: report.reported_on || report.created_at,
      sections: [{
        title: 'Diagnostic report',
        code: { coding: [{ system: SYSTEM.snomed, code: '721981007' }] },
        entry: [{ reference: urn(reportId) }]
      }],
      resources
    });
  },

  /* --------------------------------------------------------- validation --
     Checks the structural rules ABDM rejects bundles for, before one is ever
     sent. Not a full FHIR validator - a real one belongs in the sandbox
     round trip - but it catches the four mistakes that account for most
     rejections, and it catches them offline and for free. */
  problemsWith(bundle) {
    const problems = [];
    if (bundle.resourceType !== 'Bundle') problems.push('not a Bundle');
    if (bundle.type !== 'document') problems.push('Bundle.type must be "document"');

    const entries = bundle.entry || [];
    if (!entries.length) problems.push('the Bundle is empty');
    else if (entries[0].resource?.resourceType !== 'Composition') {
      problems.push('the first entry of a document Bundle must be the Composition');
    }

    /* Every reference must point at something inside the bundle. A dangling
       reference is the failure that looks fine until the gateway resolves
       it. */
    const present = new Set(entries.map(e => e.fullUrl).filter(Boolean));
    const dangling = [];
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      for (const [key, value] of Object.entries(node)) {
        if (key === 'reference' && typeof value === 'string' &&
            value.startsWith('urn:uuid:') && !present.has(value)) {
          dangling.push(value);
        } else walk(value);
      }
    };
    walk(entries);
    if (dangling.length) {
      problems.push(dangling.length + ' reference(s) point outside the bundle');
    }

    if (!entries.every(e => e.fullUrl)) problems.push('every entry needs a fullUrl');
    return problems;
  }
};
