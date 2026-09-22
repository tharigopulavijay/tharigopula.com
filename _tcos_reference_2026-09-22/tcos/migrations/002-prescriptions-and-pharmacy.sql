-- =========================================================================
-- Making prescriptions legally sound, and pharmacy safe.
--
-- Three problems with what I built first, found by walking the real workflow
-- rather than the data model:
--
-- 1. AN ISSUED PRESCRIPTION COULD STILL BE EDITED.
--    The patient walks out holding paper. If the row behind it can change,
--    the paper and the record can disagree, and in any dispute the clinic
--    has no defensible answer. Issued prescriptions are now frozen; a change
--    creates a new version that points back at the one it replaces.
--
-- 2. Rx NUMBERS WERE FREE TEXT.
--    Clinical records need a number that is sequential and gap-free per
--    doctor per year, allocated atomically so two prescriptions written
--    seconds apart cannot collide.
--
-- 3. DISPENSING WAS NOT LINKED TO WHAT WAS PRESCRIBED.
--    Without that link nobody can answer "did the patient actually receive
--    what I wrote?" - which is the entire reason to keep stock in the same
--    system as prescriptions.
--
-- Deliberately NOT built: pack-size conversion (boxes to tablets). Stock is
-- counted in the unit the doctor dispenses in. Conversion tables are a
-- classic place for inventory systems to become wrong and unusable, and a
-- single practice does not need them.
-- =========================================================================

-- ---- 1. immutability and versioning ----
ALTER TABLE prescriptions ADD COLUMN issued_at TEXT;
ALTER TABLE prescriptions ADD COLUMN sequence_no INTEGER;
ALTER TABLE prescriptions ADD COLUMN amends TEXT;         -- the Rx this replaces
ALTER TABLE prescriptions ADD COLUMN superseded_by TEXT;  -- the Rx that replaced this
ALTER TABLE prescriptions ADD COLUMN amend_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_rx_status ON prescriptions(doctor_id, status, issued_on);

-- Gap-free numbering, one counter per doctor per year.
CREATE TABLE IF NOT EXISTS rx_sequences (
  doctor_id TEXT NOT NULL,
  year      INTEGER NOT NULL,
  next_no   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (doctor_id, year)
);

-- ---- 2. dispensing linked to the prescribed line ----
ALTER TABLE stock_movements ADD COLUMN prescription_item_id TEXT;
CREATE INDEX IF NOT EXISTS idx_move_rxitem ON stock_movements(prescription_item_id);

-- ---- 3. batches that must not be dispensed ----
-- A recall, damage or a failed check takes stock off the shelf without
-- pretending it was used. Expiry alone does not cover this.
ALTER TABLE stock_batches ADD COLUMN quarantined_at TEXT;
ALTER TABLE stock_batches ADD COLUMN quarantine_reason TEXT;

-- ---- 4. what a prescription line intends to dispense ----
-- Free-text "1 tablet twice daily for 30 days" cannot be checked against
-- stock. A separate number can. Nullable, because plenty of lines are advice
-- rather than something handed over.
ALTER TABLE prescription_items ADD COLUMN dispense_quantity REAL;
ALTER TABLE prescription_items ADD COLUMN stock_item_id TEXT;

-- ---- 5. visits get a status so a consultation can be in progress ----
ALTER TABLE visits ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE visits ADD COLUMN closed_at TEXT;
