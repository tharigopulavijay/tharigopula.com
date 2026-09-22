-- =========================================================================
-- Letting a patient put a report into her own record, from her own phone.
--
-- The doctor rarely holds the report; the patient does, usually as photos.
-- So the desk shows a QR, she scans it, and the pictures land against her
-- record. Vijay: "doctor can scan with mobile and add the photos and save,
-- or he can take customer phone and scan and give."
--
-- WHY A SEPARATE TABLE FROM patient_access_links
-- Those are READ links: ninety days, so a patient can open her prescription
-- whenever she likes. This is a WRITE link, and the two must not share a
-- lifetime or a token space. A write link is minutes long and used once or
-- twice at a counter; a ninety-day write link posted into a family WhatsApp
-- group is a stranger uploading into a medical record.
--
-- WHAT THE TOKEN CAN DO
-- Add files to ONE patient at ONE clinic. It cannot read the record, cannot
-- see a prescription, cannot list what is already there. That is deliberate:
-- the QR is shown across a counter and photographed by whoever is standing
-- nearby, so it must be worth nothing to them.
--
-- Only the HASH is stored. A leaked database does not hand anybody a live
-- upload link, which is the same reasoning as sessions and access links.
-- =========================================================================

CREATE TABLE IF NOT EXISTS patient_upload_links (
  id           TEXT PRIMARY KEY,
  doctor_id    TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TEXT NOT NULL,

  -- Who at the clinic put it on screen. A file arriving in a record is a
  -- thing somebody should be answerable for.
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),

  -- A counter rather than a single used_at: a patient photographing four
  -- pages of a report is the normal case, not an abuse of the link.
  uploads      INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  revoked_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_upload_links_patient
  ON patient_upload_links(doctor_id, patient_id, created_at);

-- Expiry is checked on every use, so this only keeps the sweep cheap.
CREATE INDEX IF NOT EXISTS idx_upload_links_expiry
  ON patient_upload_links(expires_at);
