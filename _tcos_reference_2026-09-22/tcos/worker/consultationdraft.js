/* =========================================================================
   The consultation she has not finished yet.

   THE ONE RULE. This is a scratchpad, not a record. Nothing here is a
   visit, a prescription, or anything a chart, a report or a patient can
   see. It exists so that closing a laptop mid-consultation does not lose
   twenty minutes of typing, and for nothing else.

   That is why it can be deleted on a timer. Rows in `visits` and
   `prescriptions` cannot - a half-written diagnosis is still a clinical
   record and software must not remove one because a clock went round. Rows
   here are keystrokes waiting to become a record. Losing them costs typing.

   The alternative was to write the sheet into a real draft prescription as
   she types. It would have meant a `visits` row for every patient she ever
   clicked on, and a nightly job with a DELETE aimed at a clinical table.
   Two tables cannot be confused with each other; a status column can.

   Every query is scoped by doctor_id except `sweep`, which deletes by
   expiry across the platform and reads nothing - see the note on it.
   ========================================================================= */

import { newId, nowIso, badRequest, plusHours } from '@tharigopula/core/lib';

/* Vijay set the number: "if he is not saving within 24 hours this draft
   should disappear." Measured from the last keystroke, not the first. */
export const DRAFT_HOURS = 24;

/* A sheet is a few kilobytes of text. This is not a file store, and an
   unbounded column is how one becomes one by accident. Generous enough that
   nobody writing a real consultation will ever meet it. */
const MAX_PAYLOAD = 64 * 1024;

function cleanPayload(value) {
  /* Accepts the object the screen holds, or the string it already
     serialised. Either way what is stored is text, and it must parse - a
     payload that cannot be read back is worse than no payload, because the
     screen would restore nothing while reporting that it had. */
  let text;
  if (typeof value === 'string') text = value;
  else if (value && typeof value === 'object') text = JSON.stringify(value);
  else throw badRequest('There was nothing to save.');

  if (text.length > MAX_PAYLOAD) {
    throw badRequest('This consultation is too long to keep as a draft. ' +
      'Save it properly and it will be kept in full.');
  }
  try { JSON.parse(text); } catch (_) {
    throw badRequest('That draft could not be read back, so it was not saved.');
  }
  return text;
}

const shape = row => row && {
  patientId: row.patient_id,
  author: row.author,
  payload: (() => { try { return JSON.parse(row.payload); } catch (_) { return null; } })(),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  expiresAt: row.expires_at
};

export const consultationDrafts = {
  /* Never returns an expired row, whether or not the sweep has run. The
     sweep tidies the table; THIS is what makes the promise true. A rule
     enforced only by a nightly job is a rule that is false all day. */
  async get(db, doctorId, patientId) {
    const row = await db.prepare(
      `SELECT * FROM consultation_drafts
        WHERE doctor_id = ? AND patient_id = ? AND expires_at > ?`
    ).bind(doctorId, patientId, nowIso()).first();
    return shape(row) || null;
  },

  /* Upsert. The unique index on (doctor_id, patient_id) is what makes this
     one row rather than a pile: two tabs open on the same patient overwrite
     each other, which is the correct answer - the later keystroke wins, and
     it is the same person typing. */
  async put(db, doctorId, patientId, { payload, author = null } = {}) {
    const text = cleanPayload(payload);
    const at = nowIso();
    const expires = plusHours(DRAFT_HOURS);

    await db.prepare(
      `INSERT INTO consultation_drafts
         (id, doctor_id, patient_id, author, payload, created_at, updated_at, expires_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(doctor_id, patient_id) DO UPDATE SET
         author = excluded.author,
         payload = excluded.payload,
         updated_at = excluded.updated_at,
         expires_at = excluded.expires_at`
    ).bind(newId('cdr'), doctorId, patientId, author, text, at, at, expires).run();

    return this.get(db, doctorId, patientId);
  },

  /* Called the moment the consultation becomes a real record. The
     scratchpad has done its job and keeping it would mean the screen
     offering to restore something that has already been saved properly. */
  async remove(db, doctorId, patientId) {
    await db.prepare(
      'DELETE FROM consultation_drafts WHERE doctor_id = ? AND patient_id = ?'
    ).bind(doctorId, patientId).run();
    return { cleared: patientId };
  },

  /* Which patients in the queue have a sheet waiting. Ids and times only -
     the desk marks the names, it does not preview the typing, so there is
     no reason to send it. */
  async listOpen(db, doctorId) {
    const { results } = await db.prepare(
      `SELECT patient_id, updated_at, expires_at
         FROM consultation_drafts
        WHERE doctor_id = ? AND expires_at > ?
        ORDER BY updated_at DESC LIMIT 200`
    ).bind(doctorId, nowIso()).all();
    return (results || []).map(row => ({
      patientId: row.patient_id, updatedAt: row.updated_at, expiresAt: row.expires_at
    }));
  },

  /* The nightly tidy. Deliberately NOT scoped to one doctor: expiry is a
     property of the row, not of a tenant, and a per-clinic sweep would mean
     iterating every doctor on the platform to run the same DELETE.

     This is safe here and would not be on a clinical table, because it
     reads nothing and joins nothing - it matches on a timestamp this module
     wrote and removes rows that, by then, no screen will accept back. The
     isolation test asserts that this file never touches a clinical table,
     so the exemption cannot quietly widen. */
  async sweep(db) {
    const result = await db.prepare(
      'DELETE FROM consultation_drafts WHERE expires_at <= ?'
    ).bind(nowIso()).run();
    return Number((result && result.meta && result.meta.changes) || 0);
  }
};
