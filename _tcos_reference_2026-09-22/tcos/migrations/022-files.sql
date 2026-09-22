-- =========================================================================
-- 022  Files.
--
-- D1 holds the row, R2 holds the bytes. Nothing clinical is ever stored as
-- a blob in the database - a lab report PDF in a SQLite column makes every
-- query that touches that table slower forever.
--
-- WHY THE ORIGINAL IS KEPT. Vijay's instinct was to run documents through
-- AI, take the values, and throw the file away. Right about not hoarding,
-- wrong about the source document, and the cost is not the reason: storing
-- every clinic's lab reports for a year is about ₹2.40 a month each.
--
--   AI extraction is not lossless. If OCR reads HbA1c 7.1 as 1.1 and the
--   PDF is gone, nobody can ever check. The extracted values are the
--   convenience; the document is the evidence.
--
--   The patient wants HER report, not our transcription of it.
--
--   And rule 3 says issued documents are immutable. Deleting the thing a
--   prescription was based on contradicts the product's own promise.
--
-- So: extract the values AND keep the file. What we do not do is keep what
-- has no clinical value - a photo of a prescription the doctor already
-- typed in, a duplicate, a thumbnail.
--
-- THE KEY IS NAMESPACED BY DOCTOR. r2_key always starts with the doctor id,
-- so even a guessed key cannot cross a tenant boundary - R2 has no row
-- level security either, and the same discipline that protects D1 has to
-- protect this.
-- =========================================================================

CREATE TABLE IF NOT EXISTS files (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,

  -- '<doctor_id>/<kind>/<file_id>'. Never derived from anything a caller
  -- sent, so a crafted filename cannot escape the prefix.
  r2_key        TEXT NOT NULL UNIQUE,

  kind          TEXT NOT NULL,        -- certificate | lab_report | logo | attachment
  original_name TEXT,                 -- what she called it, for display only
  content_type  TEXT NOT NULL,
  bytes         INTEGER NOT NULL,

  -- What it belongs to, when it belongs to something.
  patient_id     TEXT REFERENCES patients(id) ON DELETE SET NULL,
  lab_report_id  TEXT REFERENCES lab_reports(id) ON DELETE SET NULL,

  uploaded_by   TEXT,                 -- doctor:<id> or staff:<id>
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),

  -- Soft delete. A file removed from a chart still existed, and a record
  -- that can be silently emptied is not a record.
  deleted_at    TEXT,
  deleted_by    TEXT,
  delete_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_files_doctor ON files(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_patient ON files(doctor_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_files_lab ON files(lab_report_id);

-- The certificate stopped being a filename with nothing behind it.
ALTER TABLE doctors ADD COLUMN certificate_file_id TEXT REFERENCES files(id);
ALTER TABLE doctors ADD COLUMN logo_file_id TEXT REFERENCES files(id);
