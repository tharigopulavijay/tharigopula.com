/* =========================================================================
   THE PATIENT READ PATH - the only unauthenticated endpoint in TCOS.

   Everything else requires a doctor session or an admin session. This does
   not, because the person opening it is a patient with a link and no
   account. That makes it the single most dangerous surface in the system,
   so it lives in its own file under its own rules:

     1. The TOKEN decides everything. No patient id, doctor id or any other
        selector is ever read from the request. A caller cannot ask for a
        record; they can only present a token and receive whatever it points
        at.
     2. READ ONLY. There is no write of any kind in this file, and there is
        no patient write path anywhere else in TCOS either.
     3. Never returns the doctor's private notes. Those are the doctor's own
        working thoughts, not the patient's record - the same rule that
        applies to cross-doctor sharing.
     4. Every open is counted and timestamped.

   If a future change needs a parameter from the request in here, that is the
   moment to stop and think again, not to add it.
   ========================================================================= */

import { sha256, nowIso, isPast, notFound, ApiError } from '@tharigopula/core/lib';
import { newId, plusHours } from '@tharigopula/core/lib';

/* ---- created by the doctor, from an authenticated session ---- */

export async function createLink(db, doctorId, patientId, { ttlDays = 90, createdBy }) {
  /* Confirmed by the caller to be on this doctor's list before we get here.
     Belt and braces: check again, because this hands out a credential. */
  const onList = await db.prepare(
    'SELECT 1 AS ok FROM doctor_patients WHERE doctor_id = ? AND patient_id = ?'
  ).bind(doctorId, patientId).first();
  if (!onList) throw notFound('That patient is not on your list.');

  /* 32 bytes. Long enough that guessing is not a strategy. */
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  await db.prepare(
    `INSERT INTO patient_access_links (id, token_hash, patient_id, doctor_id, created_by, expires_at)
     VALUES (?,?,?,?,?,?)`
  ).bind(newId('pal'), await sha256(token), patientId, doctorId,
    createdBy || doctorId, plusHours(ttlDays * 24)).run();

  /* Returned once. Only the hash is stored, so it cannot be looked up again. */
  return { token, expiresInDays: ttlDays };
}

export async function listLinks(db, doctorId, patientId) {
  const { results } = await db.prepare(
    `SELECT id, created_at, expires_at, revoked_at, opened_count, last_opened_at
       FROM patient_access_links
      WHERE doctor_id = ? AND patient_id = ?
   ORDER BY created_at DESC`
  ).bind(doctorId, patientId).all();
  return results || [];
}

export async function revokeLink(db, doctorId, linkId) {
  await db.prepare(
    'UPDATE patient_access_links SET revoked_at = ? WHERE id = ? AND doctor_id = ?'
  ).bind(nowIso(), linkId, doctorId).run();
}

/* ---- opened by the patient, with no account ---- */

/* One message and one status for every failure. A caller must not be able to
   tell a revoked link from an expired one from a malformed one from a link
   that never existed - each distinction is a small oracle for guessing. */
/* Whole years, the way a prescription states an age.
 *
 * Computed rather than passing the date of birth out, because this payload
 * goes to an unguessable link that could be forwarded to anyone: "42" is
 * what the sheet needs, and a full date of birth is a stronger identifier
 * than the page has any use for. Returns null when we do not know, so the
 * sheet leaves the cell out rather than printing a wrong number. */
function ageInYears(dateOfBirth) {
  if (!dateOfBirth) return null;
  const born = new Date(String(dateOfBirth).slice(0, 10));
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getUTCFullYear() - born.getUTCFullYear();
  /* Not had this year's birthday yet. */
  const month = now.getUTCMonth() - born.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < born.getUTCDate())) years--;
  return years >= 0 && years < 130 ? years : null;
}

const linkInvalid = () => new ApiError(404, 'link_invalid',
  'This link is no longer valid. Ask your doctor for a new one.');

async function resolveToken(db, token) {
  if (!token || token.length < 32) throw linkInvalid();
  const link = await db.prepare(
    'SELECT * FROM patient_access_links WHERE token_hash = ?'
  ).bind(await sha256(token)).first();

  if (!link || link.revoked_at || isPast(link.expires_at)) throw linkInvalid();
  return link;
}

export async function readRecord(db, token) {
  const link = await resolveToken(db, token);
  const { patient_id: patientId, doctor_id: doctorId } = link;

  await db.prepare(
    `UPDATE patient_access_links
        SET opened_count = opened_count + 1, last_opened_at = ?
      WHERE id = ?`
  ).bind(nowIso(), link.id).run();

  /* local_ref is the clinic's own number for this person (TCOS-1001), and
     it lives on doctor_patients rather than patients because it belongs to
     the clinic, not to the human being. The sheet prints it as the UHID, so
     it has to be joined in here.

     Scoped to the doctor who issued the link, which is the same doctor the
     rest of this function is already scoped to. */
  const patient = await db.prepare(
    `SELECT p.full_name, p.mobile, p.sex, p.date_of_birth, p.blood_group,
            p.allergies, dp.local_ref
       FROM patients p
       LEFT JOIN doctor_patients dp ON dp.patient_id = p.id AND dp.doctor_id = ?
      WHERE p.id = ?`
  ).bind(doctorId, patientId).first();

  /* The doctor's own mobile is the clinic's contact number here - there is
     no separate `phone` column, and inventing one in a SELECT throws. */
  /* The clinic that issued the link, used for the page header. */
  const doctor = await db.prepare(
    `SELECT clinic_name, tagline, full_name, qualification, registration_no, address, mobile
       FROM doctors WHERE id = ?`
  ).bind(doctorId).first();

  /* Every clinic this person has attended, so each entry can say where it
     came from. */
  const { results: clinicRows } = await db.prepare(
    `SELECT DISTINCT d.id, d.clinic_name, d.full_name AS doctor_name, d.qualification
       FROM doctor_patients dp JOIN doctors d ON d.id = dp.doctor_id
      WHERE dp.patient_id = ?`
  ).bind(patientId).all();

  /* Issued prescriptions only. A draft is the doctor still thinking, and a
     superseded one has been replaced - showing either would tell the patient
     to take something the doctor did not finally prescribe. */
  const { results: prescriptions } = await db.prepare(
    `SELECT p.id, p.rx_number, p.issued_on, p.issued_at, p.doctor_id,
            d.clinic_name, COALESCE(pr.full_name, d.full_name) AS doctor_name
       FROM prescriptions p
       JOIN doctors d ON d.id = p.doctor_id
  LEFT JOIN clinic_users pr ON pr.id = p.practitioner_id
                            AND pr.doctor_id = p.doctor_id
                            AND pr.role = 'practitioner'
      WHERE p.patient_id = ?
        AND p.status = 'issued' AND p.superseded_by IS NULL
   ORDER BY p.issued_on DESC LIMIT 50`
  ).bind(patientId).all();

  const withItems = [];
  for (const rx of prescriptions || []) {
    const { results: items } = await db.prepare(
      `SELECT medicine_name, system, dose, frequency, duration, instructions
         FROM prescription_items
        WHERE prescription_id = ? AND doctor_id = ?
     ORDER BY sort_order`
    ).bind(rx.id, rx.doctor_id).all();
    withItems.push({ ...rx, items: items || [] });
  }

  /* Note what is NOT selected here: doctor_patients.private_notes. */
  const { results: visits } = await db.prepare(
    `SELECT v.visited_on, v.visit_type, v.diagnosis, v.advice, v.follow_up_on,
            v.doctor_id, d.clinic_name,
            COALESCE(pr.full_name, d.full_name) AS doctor_name
       FROM visits v
       JOIN doctors d ON d.id = v.doctor_id
  LEFT JOIN clinic_users pr ON pr.id = v.practitioner_id
                            AND pr.doctor_id = v.doctor_id
                            AND pr.role = 'practitioner'
      WHERE v.patient_id = ?
   ORDER BY v.visited_on DESC LIMIT 50`
  ).bind(patientId).all();

  const { results: labs } = await db.prepare(
    `SELECT lr.id, lr.report_name, lr.reported_on, lr.status, lr.doctor_id,
            d.clinic_name, lv.analyte, lv.value, lv.unit, lv.reference, lv.flag
       FROM lab_reports lr
       JOIN doctors d ON d.id = lr.doctor_id
  LEFT JOIN lab_values lv ON lv.lab_report_id = lr.id AND lv.doctor_id = lr.doctor_id
      WHERE lr.patient_id = ? AND lr.status = 'verified'
   ORDER BY lr.reported_on DESC LIMIT 200`
  ).bind(patientId).all();

  /* Group the flat lab join into reports. */
  const reports = [];
  for (const row of labs || []) {
    let report = reports.find(r => r.id === row.id);
    if (!report) {
      report = { id: row.id, name: row.report_name, reportedOn: row.reported_on,
                 clinic: row.clinic_name, values: [] };
      reports.push(report);
    }
    if (row.analyte) {
      report.values.push({
        analyte: row.analyte, value: row.value, unit: row.unit,
        reference: row.reference, flag: row.flag
      });
    }
  }

  const nextFollowUp = (visits || [])
    .map(v => v.follow_up_on).filter(Boolean).sort().reverse()[0] || null;

  /* One stream, newest first. A patient does not think in tables of
     visits and tables of prescriptions - they think "what happened, when,
     and who did I see". */
  const timeline = [];
  (visits || []).forEach(v => timeline.push({
    kind: 'visit', on: v.visited_on, clinic: v.clinic_name, doctor: v.doctor_name,
    title: v.diagnosis || v.visit_type || 'Consultation',
    detail: v.advice || null
  }));
  withItems.forEach(rx => timeline.push({
    kind: 'prescription', on: rx.issued_on, clinic: rx.clinic_name, doctor: rx.doctor_name,
    title: rx.items.map(i => i.medicine_name).join(', ') || 'Prescription',
    detail: rx.rx_number || null, items: rx.items
  }));
  reports.forEach(r => timeline.push({
    kind: 'report', on: r.reportedOn, clinic: r.clinic,
    title: r.name,
    flagged: r.values.filter(v => v.flag && v.flag !== 'normal').length,
    values: r.values
  }));
  timeline.sort((a, b) => String(b.on).localeCompare(String(a.on)));

  return {
    clinics: clinicRows || [],
    timeline,
    clinic: {
      name: doctor.clinic_name, tagline: doctor.tagline,
      doctor: doctor.full_name, qualification: doctor.qualification,
      registrationNo: doctor.registration_no,
      address: doctor.address, phone: doctor.mobile
    },
    patient: {
      name: patient.full_name, mobile: patient.mobile,
      sex: patient.sex, bloodGroup: patient.blood_group,
      /* The clinic's own number for her, printed on the sheet as UHID. */
      ref: patient.local_ref || null,
      /* Years, computed here rather than sent as a date, because the sheet
         wants "42" and a date of birth is a stronger identifier than the
         page needs - it is a shared link, and the less of her identity it
         carries the better. */
      age: ageInYears(patient.date_of_birth),
      /* NULL means NOT RECORDED, and the sheet says so rather than leaving
         a blank - a blank allergy line reads as "no allergies" to whoever
         is dispensing. */
      allergies: patient.allergies || null
    },
    nextFollowUp,
    prescriptions: withItems,
    visits: visits || [],
    labReports: reports,
    expiresAt: link.expires_at
  };
}

/* ========================================================================
   UPLOAD LINKS - the patient putting a report into her own record.

   Deliberately separate from the read links above. Those live ninety days
   so she can open her prescription whenever she likes; this one lives
   minutes, because it is shown as a QR across a counter and photographed
   by whoever happens to be standing there.

   What the token can do: add files to ONE patient at ONE clinic. It cannot
   read the record, cannot open a prescription, cannot list what is already
   there. Worth nothing to a stranger who snaps it.
   ======================================================================== */

/* Long enough to be worth the trouble of a QR, short enough that a photo of
   the screen in someone else's pocket is useless by the time they try it.
   Four pages of a report, taken slowly, fits comfortably. */
const UPLOAD_TTL_MINUTES = 30;
const UPLOAD_MAX_FILES = 12;

export async function createUploadLink(db, doctorId, patientId, { createdBy } = {}) {
  const onList = await db.prepare(
    'SELECT 1 AS ok FROM doctor_patients WHERE doctor_id = ? AND patient_id = ?'
  ).bind(doctorId, patientId).first();
  if (!onList) throw notFound('That patient is not on your list.');

  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MINUTES * 60000).toISOString();
  await db.prepare(
    `INSERT INTO patient_upload_links
       (id, doctor_id, patient_id, token_hash, expires_at, created_by)
     VALUES (?,?,?,?,?,?)`
  ).bind(newId('upl'), doctorId, patientId, await sha256(token), expiresAt,
    createdBy || null).run();

  /* Returned once. Only the hash is stored, so it cannot be looked up
     again - a new QR is cheaper than a recoverable credential. */
  return { token, expiresAt, expiresInMinutes: UPLOAD_TTL_MINUTES };
}

/* Resolves a token into the one patient it may write to. Says as little as
   possible: a FIRST NAME, so the person holding the phone can tell they are
   uploading to the right record, and the clinic's name so they know where
   they are. Nothing clinical, because anyone can be holding this. */
export async function resolveUploadLink(db, token) {
  const row = await db.prepare(
    `SELECT ul.id, ul.doctor_id, ul.patient_id, ul.expires_at, ul.revoked_at,
            ul.uploads, p.full_name, d.clinic_name
       FROM patient_upload_links ul
       JOIN patients p ON p.id = ul.patient_id
       JOIN doctors d ON d.id = ul.doctor_id
      WHERE ul.token_hash = ?`
  ).bind(await sha256(String(token || ''))).first();

  if (!row) throw linkInvalid();
  if (row.revoked_at) throw linkInvalid();
  if (isPast(row.expires_at)) {
    throw new ApiError(410, 'link_expired',
      'This upload link has expired. Ask the clinic to show the code again.');
  }
  if (row.uploads >= UPLOAD_MAX_FILES) {
    throw new ApiError(429, 'link_used_up',
      'This link has already taken ' + UPLOAD_MAX_FILES + ' files. ' +
      'Ask the clinic to show the code again.');
  }

  return {
    linkId: row.id,
    doctorId: row.doctor_id,
    patientId: row.patient_id,
    /* First name only. "Lakshmi" is enough to know you are in the right
       place; a full name and a mobile number is a stranger's identity. */
    patientFirstName: String(row.full_name || '').trim().split(/\s+/)[0] || '',
    clinicName: row.clinic_name,
    uploads: row.uploads,
    remaining: UPLOAD_MAX_FILES - row.uploads
  };
}

export async function countUpload(db, linkId) {
  await db.prepare(
    `UPDATE patient_upload_links
        SET uploads = uploads + 1, last_used_at = ?
      WHERE id = ?`
  ).bind(nowIso(), linkId).run();
}

export async function revokeUploadLink(db, doctorId, linkId) {
  await db.prepare(
    'UPDATE patient_upload_links SET revoked_at = ? WHERE id = ? AND doctor_id = ?'
  ).bind(nowIso(), linkId, doctorId).run();
}
