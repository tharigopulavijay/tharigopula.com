-- ---------------------------------------------------------------------------
-- 007  A medicine catalogue the doctor types against.
--
-- Reference data, not clinical data. There is deliberately no doctor_id here:
-- the list of medicines that exist in India is the same for every clinic, and
-- nothing in these two tables is about a patient. That is why they are absent
-- from the CLINICAL allowlist in test/isolation.test.js.
--
-- The catalogue is a typing aid and nothing more. It does not decide a dose,
-- it does not check an interaction, and it never overrides the doctor - she
-- can always type a medicine that is not in here. Every row records where it
-- came from so a wrong entry can be traced back to its source and fixed.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS drug_catalogue (
  id          TEXT PRIMARY KEY,        -- stable slug, e.g. 'paracetamol'
  system      TEXT NOT NULL,           -- 'allopathy' | 'ayurveda'
  name        TEXT NOT NULL,           -- what gets typed, and printed
  detail      TEXT,                    -- botanical / English name, if any
  search_text TEXT NOT NULL,           -- lowercased name + every synonym
  popularity  INTEGER NOT NULL DEFAULT 0,  -- orders the suggestion list
  source      TEXT NOT NULL,           -- provenance of THIS row
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drug_system ON drug_catalogue(system, popularity DESC);
CREATE INDEX IF NOT EXISTS idx_drug_name   ON drug_catalogue(name);

-- The strengths a molecule is actually sold in. Picked AFTER the name, which
-- is how a doctor thinks: "paracetamol" first, then "650".
CREATE TABLE IF NOT EXISTS drug_strengths (
  drug_id  TEXT NOT NULL REFERENCES drug_catalogue(id) ON DELETE CASCADE,
  strength TEXT NOT NULL,              -- '500mg', '125mg/5ml'
  -- Empty string, never NULL: SQLite permits NULLs in a non-INTEGER primary
  -- key, which would silently let the same strength be inserted twice.
  form     TEXT NOT NULL DEFAULT '',   -- 'Tablet', 'Syrup', ...
  weight   INTEGER NOT NULL DEFAULT 0, -- how common; orders the list
  PRIMARY KEY (drug_id, strength, form)
);

CREATE INDEX IF NOT EXISTS idx_strength_drug ON drug_strengths(drug_id, weight DESC);
