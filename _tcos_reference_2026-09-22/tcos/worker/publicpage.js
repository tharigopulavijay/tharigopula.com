/* =========================================================================
   THE DOCTOR'S PUBLIC PAGE - the second unauthenticated surface in TCOS.

   Like the patient view, this is reachable with no account, so it lives in
   its own file under its own rules:

     1. READ of published profile information only. Clinic name, what they
        practise, address, hours. Nothing clinical, no patient exists here.
     2. Only doctors who switched it on appear. public_page_on defaults to 0
        - a doctor is never published without asking.
     3. Writing is limited to ONE thing: an appointment REQUEST. A stranger
        can never write into a doctor's diary; the doctor accepts it first.
     4. Requests are rate limited per number, because a public form is an
        invitation to whoever wants to abuse it.

   Note what is absent: no patient lookup, no availability check that would
   reveal who is booked, no way to ask whether a person is a patient here.
   ========================================================================= */

import { newId, nowIso, normaliseMobile, notFound, badRequest, tooMany } from '@tharigopula/core/lib';
import { cleanWeek, describeWeek } from './schedule.js';

/* The column is doctor-editable JSON, so a malformed value must degrade to
   "no hours set" rather than take the whole public page down with it. */
const safeJson = raw => { try { return JSON.parse(raw || '{}'); } catch (_) { return {}; } };

const MAX_REQUESTS_PER_DAY = 5;
const changedRows = result => Number(result &&
  (result.meta ? result.meta.changes : result.changes) || 0);

/* A URL-safe name from the clinic. Kept readable rather than random,
   because a doctor puts this on a visiting card. */
export function slugify(name) {
  return String(name || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || null;
}

export async function claimSlug(db, doctorId, wanted) {
  const base = slugify(wanted);
  if (!base) throw badRequest('That name cannot be used as a web address.');
  if (base.length < 3) throw badRequest('The web address needs at least three letters.');

  /* Reserved so a doctor cannot take a path the product needs. */
  const reserved = ['admin', 'api', 'app', 'book', 'clinic', 'doctor', 'health',
    'login', 'p', 'patient', 'signin', 'signup', 'tcos', 'www'];
  if (reserved.includes(base)) throw badRequest('That web address is not available.');

  const taken = await db.prepare(
    'SELECT id FROM doctors WHERE public_slug = ? AND id != ?'
  ).bind(base, doctorId).first();
  if (taken) throw badRequest('That web address is already taken. Try adding your area, e.g. ' + base + '-kphb');

  await db.prepare('UPDATE doctors SET public_slug = ? WHERE id = ?').bind(base, doctorId).run();
  return base;
}

export async function setPublished(db, doctorId, on) {
  await db.prepare('UPDATE doctors SET public_page_on = ? WHERE id = ?')
    .bind(on ? 1 : 0, doctorId).run();
}

export async function setPageDetails(db, doctorId, { intro, hours }) {
  await db.prepare('UPDATE doctors SET public_intro = ?, public_hours = ? WHERE id = ?')
    .bind(intro || null, hours || null, doctorId).run();
}

/* ---- what the public sees ---- */

export async function profileBySlug(db, slug) {
  const doctor = await db.prepare(
    `SELECT id, clinic_name, tagline, full_name, qualification, registration_no,
            address, mobile, website, practice_packs, public_slug, public_intro,
            public_hours, weekly_hours, plan, feature_overrides, verification_status
       FROM doctors
      WHERE public_slug = ? AND public_page_on = 1 AND status = 'active'`
  ).bind(slug).first();

  /* A doctor who has not published, or is suspended, is simply not there.
     No distinction between "never existed" and "switched off". */
  if (!doctor) throw notFound('No clinic page at this address.');

  /* White-label removes the TCOS credit. Everyone else carries it, which is
     what makes these pages worth generating for free. */
  let overrides = {};
  try { overrides = JSON.parse(doctor.feature_overrides || '{}'); } catch (_) {}
  const whiteLabel = overrides.white_label === true ||
    (doctor.plan === 'pro_plus' && overrides.white_label !== false);

  return {
    slug: doctor.public_slug,
    clinicName: doctor.clinic_name,
    tagline: doctor.tagline,
    doctor: doctor.full_name,
    qualification: doctor.qualification,
    /* Only a number somebody actually checked against the council register
       goes out under our domain. An unverified doctor's page still works -
       it just does not make a claim on our behalf that we cannot stand
       behind. Publishing is gated too, so in practice this is a belt on top
       of braces; it stays because the day someone loosens that gate, this
       is what stops a fabricated number appearing on a TCOS URL. */
    registrationNo: doctor.verification_status === 'verified'
      ? doctor.registration_no : null,
    verified: doctor.verification_status === 'verified',
    address: doctor.address,
    phone: doctor.mobile,
    website: doctor.website,
    intro: doctor.public_intro,
    /* The doctor's own sentence if she wrote one, otherwise generated from
       the real schedule - so a patient sees actual sittings ("Mon-Fri
       09:00-13:00, 17:00-20:00") instead of a blank where the hours should
       be, and the two can never drift apart without her noticing. */
    hours: doctor.public_hours || describeWeek(cleanWeek(safeJson(doctor.weekly_hours))),
    weeklyHours: cleanWeek(safeJson(doctor.weekly_hours)),
    
    practicePacks: JSON.parse(doctor.practice_packs || '[]'),
    showsCredit: !whiteLabel,
    /* The id is needed to file a request against this clinic and is not
       secret - but it is never used to read anything. */
    ref: doctor.id
  };
}

/* ---- the one thing a stranger may write ---- */

export async function requestAppointment(db, slug, details) {
  const profile = await profileBySlug(db, slug);

  const name = String(details.fullName || '').trim();
  const mobile = normaliseMobile(details.mobile);
  if (!name) throw badRequest('Please enter your name.');
  if (!mobile) throw badRequest('Please enter a valid mobile number.');

  const since = new Date(Date.now() - 86400000).toISOString();
  const recent = await db.prepare(
    'SELECT COUNT(*) AS n FROM appointment_requests WHERE mobile = ? AND created_at > ?'
  ).bind(mobile, since).first();
  if (recent && recent.n >= MAX_REQUESTS_PER_DAY) {
    throw tooMany('You have already sent several requests today. The clinic will call you back.');
  }

  /* DOES THIS NUMBER ALREADY HAVE A RECORD HERE?
   *
     Checked on the server, at submission, and the answer goes to the FRONT
     DESK - never back to the phone. The obvious design is to check as she
     types and offer the names on the number, and the household model would
     make that easy. But this form is PUBLIC: anyone could type numbers
     into it and learn who attends this clinic.
   *
     Matching here gives staff exactly the same benefit - "pull up the
     existing record rather than creating a second one" - and tells the
     person holding the phone nothing they did not already know.
   *
     The first match on the number is enough. A household shares a mobile,
     so which of them this is remains the front desk's question, and it is
     one they ask at the counter anyway. */
  const existing = await db.prepare(
    `SELECT p.id FROM patients p
       JOIN doctor_patients dp ON dp.patient_id = p.id
      WHERE p.mobile = ? AND dp.doctor_id = ? AND dp.archived_at IS NULL
      LIMIT 1`
  ).bind(mobile, profile.ref).first();

  const visitType = ['first', 'follow-up'].includes(details.visitType)
    ? details.visitType : null;
  const age = Number(details.ageYears);
  const sex = ['Female', 'Male', 'Other'].includes(details.sex) ? details.sex : null;

  const id = newId('req');
  await db.prepare(
    `INSERT INTO appointment_requests (id, doctor_id, full_name, mobile,
      preferred_on, preferred_time, reason, note,
      visit_type, matched_patient_id, age_years, sex)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, profile.ref, name, mobile,
    details.preferredOn || null, details.preferredTime || null,
    details.reason || null, details.note || null,
    visitType, existing ? existing.id : null,
    Number.isFinite(age) && age > 0 && age < 130 ? Math.floor(age) : null,
    sex).run();

  /* Deliberately returns nothing about the clinic's diary, and nothing
     about whether the number matched. A request must not become a way to
     probe how busy a doctor is, or who is registered with her. */
  return { ok: true, clinicName: profile.clinicName };
}

/* ---- what the doctor does with it ---- */

export async function listRequests(db, doctorId, status = 'new') {
  const { results } = await db.prepare(
    `SELECT * FROM appointment_requests
      WHERE doctor_id = ? AND status = ? ORDER BY created_at DESC LIMIT 100`
  ).bind(doctorId, status).all();
  return results || [];
}

export async function countNewRequests(db, doctorId) {
  const row = await db.prepare(
    "SELECT COUNT(*) AS n FROM appointment_requests WHERE doctor_id = ? AND status = 'new'"
  ).bind(doctorId).first();
  return row ? row.n : 0;
}

export async function declineRequest(db, doctorId, requestId, actor) {
  const at = nowIso();
  const results = await db.batch([db.prepare(
    `UPDATE appointment_requests SET status = 'declined', handled_at = ?
      WHERE id = ? AND doctor_id = ? AND status = 'new'`
  ).bind(at, requestId, doctorId), db.prepare(
    `INSERT INTO audit_events
       (id, doctor_id, actor, action, target_type, target_id)
     SELECT ?, ?, ?, 'request_declined', 'request', id
       FROM appointment_requests
      WHERE id = ? AND doctor_id = ? AND status = 'declined' AND handled_at = ?
        AND NOT EXISTS (SELECT 1 FROM audit_events
                         WHERE doctor_id = ? AND action = 'request_declined'
                           AND target_type = 'request' AND target_id = ?)`
  ).bind(newId('aud'), doctorId, actor, requestId, doctorId, at,
    doctorId, requestId)]);
  if (changedRows(results[0]) !== 1) {
    const current = await requestById(db, doctorId, requestId);
    if (current.status === 'declined') return { request: current, repeated: true };
    throw badRequest('That request has already been accepted.');
  }
  return { request: await requestById(db, doctorId, requestId), repeated: false };
}

export async function requestById(db, doctorId, requestId) {
  const row = await db.prepare(
    'SELECT * FROM appointment_requests WHERE id = ? AND doctor_id = ?'
  ).bind(requestId, doctorId).first();
  if (!row) throw notFound('Request not found.');
  return row;
}

/* The appointment, accepted request and audit line are one transaction.
   `request_id` is unique on appointments and the INSERT only sees a request
   still in `new`, so retries and two desks accepting together converge on
   the first appointment rather than creating another believable booking. */
export async function acceptRequest(db, doctorId, requestId, {
  patientId, scheduledOn, scheduledAt, reason, actor
}) {
  const appointmentId = newId('apt');
  const at = nowIso();
  const statements = [db.prepare(
    `INSERT INTO appointments
       (id, doctor_id, patient_id, scheduled_on, scheduled_at, duration_mins,
        reason, source, request_id)
     SELECT ?, r.doctor_id, ?, ?, ?, 15, ?, 'online', r.id
       FROM appointment_requests r
      WHERE r.id = ? AND r.doctor_id = ? AND r.status = 'new'`
  ).bind(appointmentId, patientId, scheduledOn, scheduledAt || null,
    reason || 'Requested online', requestId, doctorId), db.prepare(
    `UPDATE appointment_requests
        SET status = 'accepted', handled_at = ?, patient_id = ?, appointment_id = ?
      WHERE id = ? AND doctor_id = ? AND status = 'new'
        AND EXISTS (SELECT 1 FROM appointments
                     WHERE id = ? AND doctor_id = ? AND request_id = ?)`
  ).bind(at, patientId, appointmentId, requestId, doctorId,
    appointmentId, doctorId, requestId), db.prepare(
    `INSERT INTO audit_events
       (id, doctor_id, actor, action, target_type, target_id, detail)
     SELECT ?, ?, ?, 'request_accepted', 'appointment', a.id, r.full_name
       FROM appointments a
       JOIN appointment_requests r
         ON r.id = a.request_id AND r.doctor_id = a.doctor_id
      WHERE a.id = ? AND a.doctor_id = ? AND r.id = ? AND r.status = 'accepted'`
  ).bind(newId('aud'), doctorId, actor, appointmentId, doctorId, requestId)];

  let results;
  try {
    results = await db.batch(statements);
  } catch (error) {
    if (!String(error.message || '').includes('UNIQUE')) throw error;
    results = [];
  }
  if (results.length && changedRows(results[0]) === 1) {
    return { patientId, appointmentId, repeated: false };
  }

  const current = await requestById(db, doctorId, requestId);
  if (current.status === 'accepted' && current.patient_id && current.appointment_id) {
    return {
      patientId: current.patient_id,
      appointmentId: current.appointment_id,
      repeated: true
    };
  }
  throw badRequest('That request has already been handled. Refresh the request list.');
}
