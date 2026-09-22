/* =========================================================================
   AI drafts: what the model read, before a doctor agreed with it.

   THE ONE RULE. A draft is not a lab report. It lives in its own table, it
   is invisible to the chart, and confirming one is what creates the real
   record. Nothing here can leak into a patient's history by being forgotten.

   The easy version would have been to write extracted values straight into
   lab_values with a `verified` flag. That flag defaults to false, every
   screen then has to remember to filter on it, and the day one screen
   forgets, a number nobody checked is being read as a result. Two tables
   cannot be confused; a boolean can.

   Rejected drafts are kept. "The model read this wrong" is the only evidence
   anyone will have when tuning the prompt, and deleting the failures means
   learning nothing from them.

   Every query is scoped by doctor_id. There are no exceptions in this file.
   ========================================================================= */

import { newId, nowIso } from '@tharigopula/core/lib';
import { notFound, badRequest } from '@tharigopula/core/lib';

const changedRows = result => Number(result &&
  (result.meta ? result.meta.changes : result.changes) || 0);

export const drafts = {
  /* Store what the model returned, verbatim. The payload is kept whole -
     including values that are later corrected - because the correction is
     the useful signal. */
  async create(db, doctorId, { patientId, fileId, kind, result, usage, costPaise }) {
    const id = newId('draft');
    const draft = result.draft;

    const check = draft.name_check || {};

    await db.prepare(
      `INSERT INTO ai_drafts
         (id, doctor_id, patient_id, file_id, kind, legible, legibility_problem,
          name_verdict, name_on_page,
          payload, status, input_tokens, cached_tokens, output_tokens,
          cost_paise, model)
       VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?)`
    ).bind(
      id, doctorId, patientId || null, fileId || null, kind || 'lab_report',
      draft.legible ? 1 : 0,
      draft.legible ? null : (draft.legibility_problem || 'The page could not be read.'),
      check.verdict || 'not_checked',
      (draft.patient && draft.patient.name) || null,
      JSON.stringify(draft),
      usage.inputTokens, usage.cachedTokens, usage.outputTokens,
      costPaise, usage.model
    ).run();

    return this.byId(db, doctorId, id);
  },

  async byId(db, doctorId, id) {
    const row = await db.prepare(
      `SELECT * FROM ai_drafts WHERE doctor_id = ? AND id = ?`
    ).bind(doctorId, id).first();
    if (!row) throw notFound('That reading is not on your list.');
    return shape(row);
  },

  /* The review queue. Pending first because that is the only status anyone
     opens this screen to act on. */
  async list(db, doctorId, { status = 'pending', patientId = null, limit = 50 } = {}) {
    const rows = patientId
      ? await db.prepare(
          `SELECT * FROM ai_drafts
            WHERE doctor_id = ? AND status = ? AND patient_id = ?
            ORDER BY created_at DESC LIMIT ?`
        ).bind(doctorId, status, patientId, limit).all()
      : await db.prepare(
          `SELECT * FROM ai_drafts
            WHERE doctor_id = ? AND status = ?
            ORDER BY created_at DESC LIMIT ?`
        ).bind(doctorId, status, limit).all();

    return (rows.results || []).map(shape);
  },

  async pendingCount(db, doctorId) {
    const row = await db.prepare(
      `SELECT COUNT(*) AS n FROM ai_drafts WHERE doctor_id = ? AND status = 'pending'`
    ).bind(doctorId).first();
    return row ? row.n : 0;
  },

  /* Marks the draft as accepted and records which real report it became.
     The caller creates the lab report first, so a draft can never point at a
     report that does not exist. */
  async confirm(db, doctorId, id, { labReportId, reviewedBy }) {
    const draft = await this.byId(db, doctorId, id);
    if (draft.status !== 'pending') {
      throw badRequest('That reading has already been ' + draft.status + '.');
    }
    const result = await db.prepare(
      `UPDATE ai_drafts
          SET status = 'confirmed', lab_report_id = ?, reviewed_by = ?, reviewed_at = ?
        WHERE doctor_id = ? AND id = ? AND status = 'pending'`
    ).bind(labReportId, reviewedBy, nowIso(), doctorId, id).run();
    if (changedRows(result) !== 1) {
      throw badRequest('That reading has already been handled. Refresh the review queue.');
    }
    return this.byId(db, doctorId, id);
  },

  async reject(db, doctorId, id, { reason, reviewedBy }) {
    const draft = await this.byId(db, doctorId, id);
    if (draft.status !== 'pending') {
      throw badRequest('That reading has already been ' + draft.status + '.');
    }
    const result = await db.prepare(
      `UPDATE ai_drafts
          SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = ?
        WHERE doctor_id = ? AND id = ? AND status = 'pending'`
    ).bind(String(reason || '').slice(0, 300) || null, reviewedBy, nowIso(), doctorId, id).run();
    if (changedRows(result) !== 1) {
      throw badRequest('That reading has already been handled. Refresh the review queue.');
    }
    return this.byId(db, doctorId, id);
  },

  /* What the reading actually cost this month, measured rather than
     estimated, so the Money screen is honest about AI spend. */
  async spendPaise(db, doctorId, month) {
    const row = await db.prepare(
      `SELECT COALESCE(SUM(cost_paise), 0) AS paise, COUNT(*) AS reads
         FROM ai_drafts
        WHERE doctor_id = ? AND substr(created_at, 1, 7) = ?`
    ).bind(doctorId, month).first();
    return { paise: row ? row.paise : 0, reads: row ? row.reads : 0 };
  }
};

/* Sections down to one list, keeping which section each row came from so the
   screen can group them again without a second pass over the payload. */
function flatten(sections) {
  const out = [];
  for (const section of sections || []) {
    for (const row of section.rows || []) {
      out.push({ ...row, section: section.title || null });
    }
  }
  return out;
}

/* One row, in the shape the screens want. The payload is parsed here so no
   caller has to remember that it is stored as text. */
function shape(row) {
  let payload = {};
  try { payload = JSON.parse(row.payload || '{}'); } catch (_) { payload = {}; }

  return {
    id: row.id,
    patientId: row.patient_id,
    fileId: row.file_id,
    kind: row.kind,
    legible: !!row.legible,
    legibilityProblem: row.legibility_problem,
    status: row.status,
    labReportId: row.lab_report_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,

    reportName: payload.report_name || null,
    reportedOn: payload.reported_on || null,

    /* Everything the page carried besides the numbers. Dropping these was
       the difference between a reader that looks complete and one that is. */
    patient: payload.patient || {},
    sample: payload.sample || {},
    lab: payload.lab || {},
    labName: (payload.lab && payload.lab.name) || null,
    nameOnReport: row.name_on_page || (payload.patient && payload.patient.name) || null,

    /* Grouped as the report groups them - "Differential Count" under a blood
       count is not the same as a loose percentage. */
    sections: Array.isArray(payload.sections) ? payload.sections : [],

    /* Anything printed on the page that fitted no field: interpretations,
       footnotes, a handwritten margin note, a section nobody anticipated. */
    unrecognised: Array.isArray(payload.unrecognised) ? payload.unrecognised : [],

    /* Headings the model could see but transcribed nothing for. The only
       honest answer to "did it get everything?" - computed by comparing its
       own inventory of the page against its own output, never asked. */
    headingsVisible: payload.headings_visible || [],
    missedHeadings: payload.missed_headings || [],

    nameCheck: payload.name_check || { verdict: row.name_verdict || 'not_checked' },
    nameVerdict: row.name_verdict || 'not_checked',

    /* Flattened across sections, because a lab_report stores one list and
       the confirm path needs that shape. The sections above are what the
       screen shows; this is what gets saved. */
    values: flatten(payload.sections),

    /* Surfaced so the review screen can put the doubtful values in front of
       her rather than making her check forty numbers at one speed. */
    lowConfidenceCount: flatten(payload.sections).filter(v => v.confidence === 'low').length,

    cost: {
      paise: row.cost_paise,
      model: row.model,
      inputTokens: row.input_tokens,
      cachedTokens: row.cached_tokens,
      outputTokens: row.output_tokens
    }
  };
}
