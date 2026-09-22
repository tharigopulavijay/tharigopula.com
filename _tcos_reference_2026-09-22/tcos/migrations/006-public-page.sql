-- =========================================================================
-- The doctor's public page.
--
-- Not 10,000 pages. One template reading one row, so doctor 10,000 costs
-- exactly what doctor 1 cost: nothing.
--
-- The content already exists. practice_packs is the services list, and the
-- clinic name, tagline, qualification, registration and address were all
-- filled in on "My practice". The doctor writes nothing new.
--
-- Two things this deliberately does NOT do:
--
--   * It is a clinic PAGE, not a website. A doctor promised a website
--     expects a blog and a gallery and will be disappointed by one page.
--     Promised "a page that gets you appointments", it over-delivers.
--   * A stranger can never write into a doctor's diary. The form creates a
--     REQUEST which the doctor accepts or declines on Today.
-- =========================================================================

-- The address. Unique because it is a URL.
ALTER TABLE doctors ADD COLUMN public_slug TEXT;
ALTER TABLE doctors ADD COLUMN public_page_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE doctors ADD COLUMN public_intro TEXT;
ALTER TABLE doctors ADD COLUMN public_hours TEXT;      -- free text: "Mon-Sat, 10am-1pm"
ALTER TABLE doctors ADD COLUMN custom_domain TEXT;     -- Pro+ only, served by Cloudflare for SaaS

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_slug ON doctors(public_slug)
  WHERE public_slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_domain ON doctors(custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Appointment requests come in as their own status rather than a separate
-- table: it is the same appointment, just not accepted yet. That keeps the
-- doctor's day one query instead of two.
--
-- requested -> scheduled (accepted) or cancelled (declined)

-- Who asked, before they are a patient. A request is from a stranger until
-- the doctor accepts it, so it cannot reference patients.
CREATE TABLE IF NOT EXISTS appointment_requests (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  mobile        TEXT NOT NULL,
  preferred_on  TEXT,
  preferred_time TEXT,
  reason        TEXT,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'new',   -- new | accepted | declined
  patient_id    TEXT REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  source_ip     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  handled_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_reqs_doctor ON appointment_requests(doctor_id, status, created_at);

-- Simple abuse brake: one number cannot flood a clinic with requests.
CREATE INDEX IF NOT EXISTS idx_reqs_mobile ON appointment_requests(mobile, created_at);
