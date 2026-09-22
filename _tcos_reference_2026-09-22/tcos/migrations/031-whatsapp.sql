-- =========================================================================
-- 031  WhatsApp: consent, and a record of everything we ever sent.
--
-- Two tables' worth of caution around what is, on the surface, "send a
-- message". Both exist because of how this goes wrong in practice.
--
-- CONSENT. WhatsApp's own policy requires opt-in before a business messages
-- anyone, and under the DPDP Act a patient's number is personal data being
-- used for a new purpose. Neither is satisfied by "she gave us her number
-- at reception". So the default is off, the front desk turns it on with the
-- patient in front of them, and we record when. A patient who replies STOP
-- is opted out permanently and no clinic can turn it back on for her.
--
-- A LOG WITH A UNIQUE KEY. The reminder job runs on a timer. Timers get
-- retried, redeployed and run twice. A clinic whose patients get the same
-- reminder at 20:00 and again at 20:05 has been made to look careless by
-- its own software, and that is unrecoverable in a way a missing message is
-- not. dedupe_key is UNIQUE and derived from what the message is ABOUT, so
-- the second attempt is refused by the database rather than by whichever
-- code path happens to run.
-- =========================================================================

-- ------------------------------------------------------------- consent ---
ALTER TABLE patients ADD COLUMN whatsapp_opt_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE patients ADD COLUMN whatsapp_opt_in_at TEXT;

-- Set when the patient replies STOP. Kept separate from the flag above and
-- checked independently: an opt-out is the patient's decision about every
-- clinic, and must survive any clinic later ticking the box again.
ALTER TABLE patients ADD COLUMN whatsapp_opted_out_at TEXT;

-- ---------------------------------------------------------- the record ---
CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT REFERENCES patients(id) ON DELETE SET NULL,

  channel       TEXT NOT NULL DEFAULT 'whatsapp',
  template      TEXT NOT NULL,          -- appointment_reminder | record_ready
  to_mobile     TEXT NOT NULL,

  -- What the patient actually saw, in plain text. Not a template id: when a
  -- patient rings up asking why she got a message, the front desk needs to
  -- read the message, not decode a reference.
  body_preview  TEXT,

  -- What it was about, so a cancelled appointment can find its reminder.
  about_type    TEXT,                   -- appointment | prescription | lab_report
  about_id      TEXT,

  -- queued | sent | delivered | read | failed
  status        TEXT NOT NULL DEFAULT 'queued',
  provider_id   TEXT,                   -- Meta's message id, for delivery receipts
  error         TEXT,

  -- The thing that makes a double-send impossible. See the note above.
  dedupe_key    TEXT NOT NULL UNIQUE,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at       TEXT,
  updated_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_msg_doctor  ON messages(doctor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_patient ON messages(doctor_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_msg_about   ON messages(about_type, about_id);

-- Delivery receipts arrive keyed only by Meta's id, so this is the lookup
-- the webhook uses. Partial, because most rows never get one.
CREATE INDEX IF NOT EXISTS idx_msg_provider
  ON messages(provider_id) WHERE provider_id IS NOT NULL;
