-- =========================================================================
-- 034  The AI scribe: a consultation listened to, and notes drafted from it.
--
-- A doctor talks to a patient for ten minutes and then types for three.
-- This is the three minutes back. She taps record, the conversation is
-- transcribed, and a draft note is written for her to correct and confirm.
--
-- THREE RULES ARE BUILT INTO THIS SHAPE
--
-- 1. NOTHING REACHES THE RECORD UNTIL SHE CONFIRMS IT. The draft lives here,
--    not in visits. It is the same wall the lab-report reader has: a model
--    may propose, only a clinician may record. A note nobody checked is
--    worse than no note, because it looks like it was checked.
--
-- 2. THE AUDIO IS DELETED. It is a patient's voice discussing their health -
--    the most sensitive thing this system will ever hold. It is kept only
--    as long as it takes to transcribe, then the R2 object is removed and
--    audio_deleted_at is stamped. What survives is text the doctor approved.
--    Retention is not a setting; it is the design.
--
-- 3. THE PATIENT AGREES, EVERY VISIT. consent_at is per consultation, not
--    per patient. Consent to be recorded once is not consent to be recorded
--    forever, and under the DPDP Act this is the patient's data, not the
--    clinic's. No consent row, no recording: the API refuses.
-- =========================================================================

CREATE TABLE IF NOT EXISTS consult_notes (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  -- Set once the doctor confirms and the note is written onto a visit.
  visit_id      TEXT REFERENCES visits(id) ON DELETE SET NULL,

  -- ---------------------------------------------------------- consent ---
  -- Recorded BEFORE the microphone opens. Who took it matters: the front
  -- desk asking is different from the doctor asking, and a complaint six
  -- months later is about exactly that.
  consent_at    TEXT NOT NULL,
  consent_by    TEXT NOT NULL,          -- 'doctor:<id>' or 'staff:<id>'

  -- ------------------------------------------------------------ audio ---
  -- NULLed when the object is deleted, so a row can never point at bytes
  -- that are gone, and a row with a key is a row still holding a voice.
  audio_key     TEXT,
  audio_seconds INTEGER,
  audio_deleted_at TEXT,

  -- ----------------------------------------------------- what was said ---
  -- Consultations in India are rarely in one language. The transcript keeps
  -- whatever was actually spoken - Hindi, Telugu, English, or all three in
  -- one sentence - because translating before the doctor has read it loses
  -- the patient's own words, which are sometimes the diagnosis.
  language      TEXT,
  transcript    TEXT,

  -- --------------------------------------------------- the drafted note ---
  -- Separate columns rather than one blob: the doctor edits section by
  -- section, and a half-corrected note must be storable.
  complaints    TEXT,
  history       TEXT,
  examination   TEXT,
  advice        TEXT,
  follow_up     TEXT,

  -- recording | transcribing | ready | confirmed | rejected | failed
  status        TEXT NOT NULL DEFAULT 'recording',
  error         TEXT,
  cost_paise    INTEGER NOT NULL DEFAULT 0,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_cn_doctor  ON consult_notes(doctor_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_cn_patient ON consult_notes(doctor_id, patient_id);

-- The sweep that deletes audio looks for exactly this: a row that still has
-- a key. Partial, because most rows will not.
CREATE INDEX IF NOT EXISTS idx_cn_audio
  ON consult_notes(audio_key) WHERE audio_key IS NOT NULL;

-- What a minute of listening costs us, so the Money screen and the spend
-- guard see it like everything else rather than it being free by omission.
INSERT OR REPLACE INTO cost_rates (id, label, category, unit, paise_per_unit, note) VALUES
 ('ai_consult_minute', 'Consultation listened to', 'ai', 'minute', 60,
  'Transcription plus the drafted note, per minute of consultation. Metered like any other AI work and stopped by the same spend guard.');
