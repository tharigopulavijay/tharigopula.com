-- =========================================================================
-- 024  Cheap identity and page check before clinical extraction.
--
-- The preflight is a permanent audit record of what name was found and who
-- authorised continuing. It contains no test values and is never part of the
-- patient's clinical history.
-- =========================================================================

CREATE TABLE IF NOT EXISTS ai_preflights (
  id                TEXT PRIMARY KEY,
  doctor_id         TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_id           TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  registered_name   TEXT NOT NULL,
  name_on_document  TEXT,
  name_verdict      TEXT NOT NULL,
  name_reason       TEXT,
  legible           INTEGER NOT NULL DEFAULT 1,
  legibility_problem TEXT,
  page_count        INTEGER,
  clinical_pages    TEXT NOT NULL DEFAULT '[]',
  excluded_pages    TEXT NOT NULL DEFAULT '[]',
  page_inventory    TEXT NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL,
  confirmed_by      TEXT,
  confirmation_note TEXT,
  confirmed_at      TEXT,
  consumed_at       TEXT,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  cached_tokens     INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cost_paise        INTEGER NOT NULL DEFAULT 0,
  model             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (name_verdict IN ('same_person','needs_confirmation','different_person','no_name_on_document')),
  CHECK (status IN ('approved','awaiting_confirmation','blocked','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_ai_preflights_doctor
  ON ai_preflights(doctor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_preflights_file
  ON ai_preflights(doctor_id, file_id, patient_id);

UPDATE cost_rates
   SET note = 'OpenAI: low-cost identity/page preflight with GPT-5.6 Luna, then doctor-approved extraction with GPT-5.6 Terra. Actual tokens and INR cost are recorded.'
 WHERE id = 'ai_document';
