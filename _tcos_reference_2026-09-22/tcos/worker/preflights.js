/* Identity and page-map records that gate the expensive clinical read. */

import { newId, nowIso, badRequest, notFound } from '@tharigopula/core/lib';

const actorName = doctor => doctor.actor.isDoctor
  ? 'doctor:' + doctor.id
  : 'staff:' + doctor.actor.userId;

export const preflights = {
  async create(db, doctorId, { patientId, fileId, result, usage, costPaise }) {
    const id = newId('pre');
    const p = result.data;
    const status = !p.legible
      ? 'blocked'
      : p.name_verdict === 'same_person' ? 'approved' : 'awaiting_confirmation';
    await db.prepare(
      `INSERT INTO ai_preflights
         (id, doctor_id, patient_id, file_id, registered_name,
          name_on_document, name_verdict, name_reason, legible,
          legibility_problem, page_count, clinical_pages, excluded_pages,
          page_inventory, status, input_tokens, cached_tokens, output_tokens,
          cost_paise, model)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, doctorId, patientId, fileId, p.registered_name,
      p.name_on_document || null, p.name_verdict, p.name_reason || null,
      p.legible ? 1 : 0, p.legibility_problem || null, p.page_count || null,
      JSON.stringify(p.clinical_pages || []), JSON.stringify(p.excluded_pages || []),
      JSON.stringify(p.pages || []), status, usage.inputTokens || 0,
      usage.cachedTokens || 0, usage.outputTokens || 0, costPaise || 0,
      usage.model || null
    ).run();
    return this.byId(db, doctorId, id);
  },

  async byId(db, doctorId, id) {
    const row = await db.prepare(
      'SELECT * FROM ai_preflights WHERE doctor_id = ? AND id = ?'
    ).bind(doctorId, id).first();
    if (!row) throw notFound('That document check is not on your list.');
    return shape(row);
  },

  async approve(db, doctor, id, note) {
    const row = await this.byId(db, doctor.id, id);
    if (row.status === 'blocked') {
      throw badRequest('This document is not clear enough. Upload a clearer copy.');
    }
    if (row.status === 'rejected') throw badRequest('That document was already rejected.');
    if (row.consumedAt) throw badRequest('That document has already been read.');
    await db.prepare(
      `UPDATE ai_preflights
          SET status = 'approved', confirmed_by = ?, confirmation_note = ?,
              confirmed_at = ?
        WHERE doctor_id = ? AND id = ?`
    ).bind(actorName(doctor), String(note || '').slice(0, 300) || null,
      nowIso(), doctor.id, id).run();
    return this.byId(db, doctor.id, id);
  },

  async reject(db, doctor, id, note) {
    const row = await this.byId(db, doctor.id, id);
    if (row.consumedAt) throw badRequest('That document has already been read.');
    await db.prepare(
      `UPDATE ai_preflights
          SET status = 'rejected', confirmed_by = ?, confirmation_note = ?,
              confirmed_at = ?
        WHERE doctor_id = ? AND id = ?`
    ).bind(actorName(doctor), String(note || '').slice(0, 300) || null,
      nowIso(), doctor.id, id).run();
    return this.byId(db, doctor.id, id);
  },

  async consume(db, doctorId, id) {
    const row = await this.byId(db, doctorId, id);
    if (row.status !== 'approved') {
      throw badRequest('Confirm that this document belongs to the patient before reading it.');
    }
    if (row.consumedAt) throw badRequest('That document has already been read.');
    await db.prepare(
      `UPDATE ai_preflights SET consumed_at = ?
        WHERE doctor_id = ? AND id = ? AND status = 'approved' AND consumed_at IS NULL`
    ).bind(nowIso(), doctorId, id).run();
    return this.byId(db, doctorId, id);
  }
};

function list(value) {
  try { return JSON.parse(value || '[]'); } catch (_) { return []; }
}

function shape(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    fileId: row.file_id,
    registeredName: row.registered_name,
    nameOnDocument: row.name_on_document,
    nameVerdict: row.name_verdict,
    nameReason: row.name_reason,
    legible: !!row.legible,
    legibilityProblem: row.legibility_problem,
    pageCount: row.page_count,
    clinicalPages: list(row.clinical_pages),
    excludedPages: list(row.excluded_pages),
    pages: list(row.page_inventory),
    status: row.status,
    confirmedBy: row.confirmed_by,
    confirmationNote: row.confirmation_note,
    confirmedAt: row.confirmed_at,
    consumedAt: row.consumed_at,
    cost: {
      paise: row.cost_paise, model: row.model,
      inputTokens: row.input_tokens, cachedTokens: row.cached_tokens,
      outputTokens: row.output_tokens
    },
    createdAt: row.created_at
  };
}
