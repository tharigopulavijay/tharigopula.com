-- =========================================================================
-- The half-written consultation.
--
-- Vijay: "already i have opened this abcd patient's prescription, now it
-- should be saved as a draft ... if he is not saving within 24 hours this
-- draft should disappear."
--
-- WHY THIS IS NOT A prescriptions ROW WITH status='draft'
-- That was the obvious answer and it is the wrong one. Saving the sheet as
-- she types would mean creating a `visits` row and a `prescriptions` row the
-- moment she clicks a name in the queue - so every patient she merely opened
-- to check something would leave a consultation in the chart, and every
-- abandoned one would leave a half-typed diagnosis in a real clinical table
-- for a nightly job to delete. Deleting clinical rows on a timer is not
-- something this software should ever do.
--
-- So the autosave goes somewhere that is explicitly NOT the record. One row
-- per patient per doctor, holding the sheet exactly as it sits on screen,
-- and nothing reads it except the screen it came from. The chart cannot see
-- it, the patient cannot see it, a report cannot count it. Deleting one
-- loses typing, never a record - which is the whole reason it is safe to
-- delete them automatically.
--
-- Same discipline as ai_drafts beside lab_reports: two tables cannot be
-- confused with each other, a status column can.
--
-- WHAT ENTERS THE RECORD IS STILL HER CLICKING SAVE. This changes what
-- survives a closed laptop. It does not change what a consultation is.
-- =========================================================================

CREATE TABLE IF NOT EXISTS consultation_drafts (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Who was typing. NULL is the clinic owner, matching prescriptions
  -- .practitioner_id. Kept so a locum's half-finished sheet is not offered
  -- back to somebody else as if they had written it.
  author      TEXT,

  -- The sheet, verbatim: complaints, examination, vitals, medicines, the
  -- plan tables, the follow-up date. JSON rather than columns because this
  -- is a scratchpad and its shape follows the screen, not the schema. A
  -- column here would have to be migrated every time the sheet gains a row.
  payload     TEXT NOT NULL,

  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),

  -- Twenty-four hours after the last keystroke, not after the first. A sheet
  -- she was working on ten minutes ago must not vanish because she opened it
  -- yesterday. Stored rather than computed so the sweep is one index scan
  -- and the rule is visible in the row itself.
  expires_at  TEXT NOT NULL
);

-- One open sheet per patient per clinic. Two would mean choosing between
-- them, and there is no honest way to choose.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cdraft_one
  ON consultation_drafts(doctor_id, patient_id);

-- The nightly sweep, and the read path that refuses an expired row before
-- the sweep has run. Both go through this.
CREATE INDEX IF NOT EXISTS idx_cdraft_expiry
  ON consultation_drafts(expires_at);
