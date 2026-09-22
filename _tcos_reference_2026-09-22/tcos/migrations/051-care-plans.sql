-- =========================================================================
-- The diet, lifestyle and exercise plan.
--
-- Vijay asked twice how a doctor writes one. She could not: the prescription
-- sheet has rendered a plan since 10 Sep 2026 and there was nowhere to keep
-- it. This is that place.
--
-- ONE PLAN PER VISIT, per clinic. The plan is advice given at a
-- consultation - "prepared for this consultation" is what the sheet says -
-- so it belongs to the visit, and a second save updates rather than adds.
-- The UNIQUE below is what makes that true rather than hoped for.
--
-- CLINIC-SCOPED, unlike allergies. What a homeopath advises a patient to eat
-- is her clinical opinion, not a fact about the patient, and it is not for
-- another clinic to publish under its own name. Tenant isolation applies:
-- every read carries doctor_id.
--
-- JSON TEXT rather than child tables. Each field is a short list the doctor
-- typed, read back whole and never queried across - "find every patient told
-- to avoid sugar" is not a question this product asks. Normalising it would
-- buy nothing and cost five tables and five joins. If that question ever
-- arrives, the lists are still there to normalise from.
-- =========================================================================

CREATE TABLE IF NOT EXISTS care_plans (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id    TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,

  -- [{ "when": "Breakfast", "plan": "Vegetable upma" }, ...]
  meals       TEXT,
  -- ["Vegetables", "Pulses"] and so on
  prefer      TEXT,
  avoid       TEXT,
  routine     TEXT,
  -- [{ "name": "Chin tucks", "amount": "10 reps", "when": "Twice daily" }]
  exercises   TEXT,
  precautions TEXT,

  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One plan per visit. Saving the desk twice must update the plan, never
-- leave the patient holding two.
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_plans_visit
  ON care_plans(doctor_id, visit_id);

CREATE INDEX IF NOT EXISTS idx_care_plans_patient
  ON care_plans(doctor_id, patient_id);
