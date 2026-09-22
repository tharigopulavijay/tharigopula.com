-- =========================================================================
-- 023  What the model read, before a doctor agreed with it.
--
-- A draft is deliberately NOT a lab_report. It is a separate table, and
-- confirming one is what creates the real record.
--
-- Storing extracted values straight into lab_values with a "verified" flag
-- would be the easy version and the wrong one: the flag would default to
-- false, every screen would have to remember to filter on it, and the day
-- one screen forgets, a number nobody checked is being read as a result.
-- Two tables cannot be confused. A draft is invisible to the chart until
-- somebody turns it into a report.
--
-- The per-value confidence the model reports is kept, so the review screen
-- can put the doubtful ones in front of her rather than making her check
-- forty numbers at the same speed.
--
-- rejected drafts are kept too. "The model read this wrong" is the only
-- evidence anyone will have when tuning the prompt, and deleting it means
-- learning nothing from the failures.
-- =========================================================================

CREATE TABLE IF NOT EXISTS ai_drafts (
  id           TEXT PRIMARY KEY,
  doctor_id    TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id   TEXT REFERENCES patients(id) ON DELETE SET NULL,
  file_id      TEXT REFERENCES files(id) ON DELETE SET NULL,

  kind         TEXT NOT NULL DEFAULT 'lab_report',

  -- Whether the page could be read at all, and if not, what to tell whoever
  -- photographed it. This is the field that stops a blurred page becoming
  -- invented numbers.
  legible      INTEGER NOT NULL DEFAULT 1,
  legibility_problem TEXT,

  -- Does the name printed on the page belong to the patient this is being
  -- filed against?  same_person | spelling_variant | different_person |
  -- no_name_on_page | not_checked
  --
  -- Columns rather than only fields inside the payload, so the review queue
  -- can put a mismatch at the top without parsing every draft it lists.
  -- Filing a report to the wrong chart is the second way this feature could
  -- hurt somebody, and unlike a misread digit nobody catches it by looking
  -- harder at the numbers.
  name_verdict TEXT,
  name_on_page TEXT,

  -- The whole extraction as the model returned it - every section, every row,
  -- and everything that fitted no field at all. Kept verbatim, including what
  -- was later corrected, because the correction is the useful signal.
  payload      TEXT NOT NULL,

  -- pending -> confirmed | rejected. Nothing reaches the chart at 'pending'.
  status       TEXT NOT NULL DEFAULT 'pending',
  lab_report_id TEXT REFERENCES lab_reports(id) ON DELETE SET NULL,
  reviewed_by  TEXT,
  reviewed_at  TEXT,
  reject_reason TEXT,

  -- Measured, not estimated: the real token counts for this read.
  input_tokens  INTEGER,
  cached_tokens INTEGER,
  output_tokens INTEGER,
  cost_paise    INTEGER,
  model         TEXT,

  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drafts_doctor
  ON ai_drafts(doctor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_patient
  ON ai_drafts(doctor_id, patient_id);
-- The queue orders "needs attention" first, and that reads this.
CREATE INDEX IF NOT EXISTS idx_drafts_name_check
  ON ai_drafts(doctor_id, status, name_verdict);

-- Reading a document is metered like messages: it is a real per-use cost
-- that scales with how busy a clinic is, and the Money screen already
-- prices ai_document. This just makes the rate honest about the model.
UPDATE cost_rates
   SET note = 'Claude Opus 5 reading one report: about 2300 input tokens and 600 output at $5/$25 per million. Measured per read and recorded on the draft.'
 WHERE id = 'ai_document';
