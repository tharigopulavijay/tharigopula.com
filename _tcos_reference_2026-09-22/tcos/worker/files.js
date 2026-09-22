/* =========================================================================
   Files: lab reports, certificates, logos.

   R2 has no row-level security, exactly like D1, so the same discipline
   applies and it is enforced in two places at once:

     1. Every key begins with the doctor id, and the key is BUILT here from
        ids we generated - never from anything a caller sent. A filename of
        "../../other-clinic/x.pdf" cannot escape, because the filename never
        reaches the key.

     2. Every read looks the row up in D1 scoped by doctor_id first, and
        only then fetches the object. Nothing is served by key alone.

   The second one is what matters. Serving straight from a key would mean a
   guessed key returns another clinic's patient's lab report.

   WHAT IS NOT ALLOWED IN, and why it is an allowlist rather than a
   blocklist: SVG can carry script and would run on our origin; HTML the
   same. A blocklist of dangerous types is a list somebody forgets to add to.
   ========================================================================= */

import { newId, badRequest, notFound, ApiError } from '@tharigopula/core/lib';

/* Diagnostic documents and photographs. Office formats are accepted for AI
   text extraction; PDF remains preferred because it preserves page images,
   tables and charts. */
const ALLOWED = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/vnd.oasis.opendocument.text': 'odt',
  'text/plain': 'txt'
};

const MAX_BYTES = 15 * 1024 * 1024;   /* One scanned report. Comfortable. */

const KINDS = new Set(['certificate', 'lab_report', 'logo', 'attachment']);

export const files = {
  async put(db, env, doctor, { kind, name, contentType, body, bytes,
                               patientId, labReportId, uploadedBy }) {
    if (!env.FILES) {
      throw new ApiError(503, 'files_unavailable',
        'File storage is not switched on for this deployment.');
    }
    if (!KINDS.has(kind)) throw badRequest('Unknown kind of file.');
    if (!ALLOWED[contentType]) {
      throw badRequest('Upload a PDF, Word document, RTF, text file or photo. ' +
        (contentType ? contentType + ' is not accepted.' : ''));
    }
    if (!bytes || bytes <= 0) throw badRequest('That file is empty.');
    if (bytes > MAX_BYTES) {
      throw badRequest('That file is larger than 15 MB. Photograph the page rather than scanning at full resolution.');
    }

    const id = newId('fil');
    /* Built entirely from ids we made. The original name is kept as a
       column for display and never touches the key. */
    const key = doctor.id + '/' + kind + '/' + id;

    await env.FILES.put(key, body, {
      httpMetadata: { contentType },
      /* Enough to identify an orphan in the bucket without opening D1. */
      customMetadata: { doctorId: doctor.id, kind, fileId: id }
    });

    try {
      await db.prepare(
        `INSERT INTO files (id, doctor_id, r2_key, kind, original_name,
           content_type, bytes, patient_id, lab_report_id, uploaded_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(id, doctor.id, key, kind,
        name ? String(name).slice(0, 180) : null,
        contentType, bytes, patientId || null, labReportId || null,
        uploadedBy || null).run();
    } catch (error) {
      /* The row is what makes the object reachable. Without it the bytes
         are unreferenced and would count against storage forever, so the
         object goes back out. */
      try { await env.FILES.delete(key); } catch (_) {}
      throw error;
    }

    return { id, kind, name, contentType, bytes };
  },

  /* Scoped by doctor first, always. */
  async metaFor(db, doctorId, fileId) {
    return db.prepare(
      `SELECT * FROM files
        WHERE id = ? AND doctor_id = ? AND deleted_at IS NULL`
    ).bind(fileId, doctorId).first();
  },

  async open(db, env, doctorId, fileId) {
    const meta = await this.metaFor(db, doctorId, fileId);
    if (!meta) throw notFound('That file is not here.');
    const object = await env.FILES.get(meta.r2_key);
    if (!object) throw notFound('That file is no longer stored.');
    return { meta, object };
  },

  async listFor(db, doctorId, { patientId, kind } = {}) {
    const where = ['doctor_id = ?', 'deleted_at IS NULL'];
    const binds = [doctorId];
    if (patientId) { where.push('patient_id = ?'); binds.push(patientId); }
    if (kind) { where.push('kind = ?'); binds.push(kind); }
    const { results } = await db.prepare(
      `SELECT id, kind, original_name, content_type, bytes, patient_id,
              lab_report_id, created_at
         FROM files WHERE ` + where.join(' AND ') +
      ' ORDER BY created_at DESC LIMIT 300'
    ).bind(...binds).all();
    return results || [];
  },

  /* Soft delete in D1, hard delete in R2. The row stays so the chart can
     still say a document was here and who removed it; the bytes go, because
     keeping them would be paying to store something nobody can reach. */
  async remove(db, env, doctor, fileId, { reason, by }) {
    const meta = await this.metaFor(db, doctor.id, fileId);
    if (!meta) throw notFound('That file is not here.');
    if (!reason || !String(reason).trim()) {
      throw badRequest('Say why this file is being removed. It stays on the record.');
    }
    try { await env.FILES.delete(meta.r2_key); } catch (_) {}
    await db.prepare(
      `UPDATE files SET deleted_at = datetime('now'), deleted_by = ?, delete_reason = ?
        WHERE id = ? AND doctor_id = ?`
    ).bind(by || null, String(reason).trim().slice(0, 200), fileId, doctor.id).run();
    return { removed: fileId };
  },

  /* A certificate or a logo is the one upload that changes the doctor's own
     row. It lives here rather than in the route because the router holds no
     SQL - test/isolation.test.js enforces that, and it is the rule that
     keeps every query somewhere a reviewer can find it. */
  async attachToDoctor(db, doctorId, kind, file) {
    if (kind === 'certificate') {
      await db.prepare(
        `UPDATE doctors SET certificate_file_id = ?, certificate_name = ?,
                certificate_status = 'pending_review',
                certificate_submitted_at = datetime('now')
          WHERE id = ?`
      ).bind(file.id, file.name || 'certificate', doctorId).run();
    } else if (kind === 'logo') {
      await db.prepare('UPDATE doctors SET logo_file_id = ? WHERE id = ?')
        .bind(file.id, doctorId).run();
    }
  },

  /* The document behind a registration, for whoever is verifying it. */
  async certificateFor(db, doctorId) {
    const doctor = await db.prepare(
      'SELECT id, certificate_file_id FROM doctors WHERE id = ?').bind(doctorId).first();
    if (!doctor || !doctor.certificate_file_id) return null;
    return this.metaFor(db, doctor.id, doctor.certificate_file_id);
  },

  /* Real bytes, for the storage allowance - not an estimate. */
  async bytesUsed(db, doctorId) {
    const row = await db.prepare(
      'SELECT COALESCE(SUM(bytes), 0) AS bytes FROM files WHERE doctor_id = ? AND deleted_at IS NULL'
    ).bind(doctorId).first();
    return row ? row.bytes : 0;
  }
};

/* A file is served through the Worker, never from a public R2 URL, so the
   scoping above actually applies. These headers stop the browser doing
   anything clever with it. */
export function fileHeaders(meta, { download } = {}) {
  return {
    /* The stored type, not the one the client asked for. */
    'Content-Type': meta.content_type,
    'Content-Length': String(meta.bytes),
    /* Blocks a PDF viewer or image renderer from being talked into treating
       the bytes as something executable. */
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Content-Disposition': (download ? 'attachment' : 'inline') +
      '; filename="' + String(meta.original_name || 'document')
        .replace(/[^\w.\- ]/g, '_').slice(0, 100) + '"',
    /* Patient records are not cached by anything in between. */
    'Cache-Control': 'private, no-store'
  };
}
