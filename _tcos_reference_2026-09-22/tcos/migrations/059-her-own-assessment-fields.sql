-- =========================================================================
-- The doctor's own examination fields, and what of them reaches the paper.
--
-- Vijay: "she is a ayurvedic doctor so she has the assesment criteria
-- different means like nadi, naabhi, jiva, sparsh, nails soo on so each one
-- will have their own unique thing right... we cant show we need to keep cap
-- like 6 objects can only be added max. if you want more it willb e shown
-- side means you can record in the data but it would not showup in the
-- prescription reason prescription length increases."
--
-- TWO SEPARATE PROBLEMS, AND THEY ARE NOT THE SAME PROBLEM.
--
--   1. The practice packs in js/clinic-registry.js are OURS. A real
--      Ayurvedic doctor examines things we did not think of - Naabhi is not
--      in the Nadi Pariksha pack and ANG is not in any of them. Until now
--      her only options were to bend one of our labels or to lose the
--      observation. `clinic_fields` is her own vocabulary, and there is no
--      ceiling on it: what she examines is not ours to cap.
--
--   2. The prescription is a sheet of paper. Her packs alone already offer
--      nineteen examination fields, and every filled one prints today. Six
--      is the cap on what PRINTS - a different question from what she
--      records, and the only one paper has an opinion about.
--
-- SO THE CAP LIVES ON `rx_print_fields`, NOT ON THE FIELDS.
-- She records everything. She chooses six for the sheet. Everything else
-- stays in the record, visible in the app beside the prescription, and it
-- is neither lost nor hidden - it is simply not on the paper.
-- =========================================================================

-- Fields she added herself. Ours come from js/clinic-registry.js and are not
-- duplicated here - this table holds only what we did not think of.
CREATE TABLE IF NOT EXISTS clinic_fields (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL,
  -- What she types. Shown exactly as she wrote it, on screen and on paper.
  label       TEXT NOT NULL,
  -- The stable key this field's value is stored under in visits.findings.
  -- Derived from the label ONCE, at creation, and never recomputed: renaming
  -- "Naabhi" to "Nabhi" must not orphan four years of recorded values.
  slug        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  -- Retired, not deleted. A field she stops using still has values recorded
  -- against it in visits that are already issued and frozen, and a hard
  -- delete would leave those values with no label to print them under.
  archived_at TEXT,
  created_at  TEXT NOT NULL
);

-- One slug per clinic. Two fields answering to the same key would each
-- overwrite the other's value within a single consultation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_fields_slug
  ON clinic_fields(doctor_id, slug);

CREATE INDEX IF NOT EXISTS idx_clinic_fields_order
  ON clinic_fields(doctor_id, position, created_at);

-- What prints: a JSON array of field keys, in the order she wants them, at
-- most six. Names both our pack fields ("nadi.Jihva") and her own
-- ("own.naabhi"), because from the sheet's point of view there is no
-- difference between a field we supplied and one she wrote.
--
-- NULL IS NOT "PRINT NOTHING". Null means she has never opened the setting,
-- and for those clinics the sheet behaves exactly as it did before this
-- migration: every filled finding prints. Defaulting to six would silently
-- shorten the next prescription of a doctor who never asked us to.
ALTER TABLE doctors ADD COLUMN rx_print_fields TEXT;
