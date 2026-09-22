-- =========================================================================
-- TCOS - Cloudflare D1 schema
--
-- D1 is SQLite. It has no row-level security, so tenant isolation is
-- enforced in application code instead of by the database. That places the
-- whole burden on discipline, so the rules are written down here and the
-- data layer is the ONLY place allowed to build SQL:
--
--   1. Every clinical table carries doctor_id.
--   2. Every query goes through db/repo.js, never a raw statement in a route.
--   3. Every repo function takes the authenticated doctor_id and includes
--      "WHERE doctor_id = ?". No exceptions, including counts and deletes.
--   4. Cross-doctor reads are possible ONLY through an active consent grant,
--      and only via the consented* functions, which log every access.
--   5. test/isolation.test.js proves the above and must stay green.
--
-- Migrate to Postgres with RLS when doctor count or revenue justifies it;
-- the column layout is deliberately Postgres-compatible.
-- =========================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- doctors
-- One row per doctor. This IS the tenant. A doctor never sees another
-- doctor's row, patient list, prescriptions, stock or reports.
CREATE TABLE IF NOT EXISTS doctors (
  id                TEXT PRIMARY KEY,
  mobile            TEXT NOT NULL UNIQUE,       -- verified at signup, used for OTP
  mobile_verified   INTEGER NOT NULL DEFAULT 0,
  email             TEXT,
  full_name         TEXT NOT NULL,
  qualification     TEXT,
  registration_no   TEXT,
  clinic_name       TEXT NOT NULL,
  tagline           TEXT,
  address           TEXT,
  website           TEXT,
  logo_key          TEXT,                        -- R2 object key, not the image
  theme_ink         TEXT DEFAULT '#1B4A34',
  theme_accent      TEXT DEFAULT '#C9973E',
  patient_prefix    TEXT DEFAULT 'TCOS',
  practice_packs    TEXT NOT NULL DEFAULT '[]',  -- JSON array of pack ids
  line              TEXT NOT NULL DEFAULT 'doctor',
  plan              TEXT NOT NULL DEFAULT 'basic',
  feature_overrides TEXT NOT NULL DEFAULT '{}',  -- JSON, admin per-doctor switches
  trial_offer       TEXT,
  trial_ends_on     TEXT,
  status            TEXT NOT NULL DEFAULT 'active', -- active | suspended
  password_hash     TEXT,                        -- PBKDF2, salted, per row
  password_salt     TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_sign_in_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_doctors_mobile ON doctors(mobile);

-- ------------------------------------------------------------- sessions
-- Opaque session tokens. Stored hashed so a database leak does not hand
-- someone a working session.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  user_agent  TEXT,
  csrf_hash   TEXT,
  revoked_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_doctor ON sessions(doctor_id);

-- ------------------------------------------------------------ otp_codes
-- Used for doctor signup/reset AND for patient consent. Codes are stored
-- hashed; attempts are capped; a code is single-use.
CREATE TABLE IF NOT EXISTS otp_codes (
  id          TEXT PRIMARY KEY,
  purpose     TEXT NOT NULL,          -- doctor_signup | doctor_reset | patient_consent
  mobile      TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  context     TEXT,                   -- JSON: eg which doctor is requesting consent
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_mobile_purpose ON otp_codes(mobile, purpose);

-- ---------------------------------------------------------------- patients
-- GLOBAL, not per doctor. A person is one human being with one record,
-- identified by their verified mobile number. This is what lets history
-- follow the patient from one doctor to the next.
--
-- Nothing clinical lives here. Only identity.
CREATE TABLE IF NOT EXISTS patients (
  id              TEXT PRIMARY KEY,
  mobile          TEXT NOT NULL UNIQUE,
  mobile_verified INTEGER NOT NULL DEFAULT 0,
  full_name       TEXT NOT NULL,
  sex             TEXT,
  date_of_birth   TEXT,
  blood_group     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_patients_mobile ON patients(mobile);

-- --------------------------------------------------------- doctor_patients
-- Which patients are on a given doctor's list, and that doctor's own notes
-- about them. Scoped: a doctor only ever lists rows where doctor_id = self.
CREATE TABLE IF NOT EXISTS doctor_patients (
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  local_ref     TEXT,                  -- the doctor's own patient number
  first_seen_on TEXT NOT NULL DEFAULT (date('now')),
  last_seen_on  TEXT,
  private_notes TEXT,                  -- never shared, even under consent
  archived_at   TEXT,
  PRIMARY KEY (doctor_id, patient_id)
);
CREATE INDEX IF NOT EXISTS idx_dp_doctor ON doctor_patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_dp_patient ON doctor_patients(patient_id);

-- ------------------------------------------------------------ visits
CREATE TABLE IF NOT EXISTS visits (
  id           TEXT PRIMARY KEY,
  doctor_id    TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visited_on   TEXT NOT NULL,
  visit_type   TEXT,                   -- first | follow_up | online
  complaints   TEXT,
  diagnosis    TEXT,
  vitals       TEXT,                   -- JSON
  findings     TEXT,                   -- JSON, practice-pack fields
  advice       TEXT,
  follow_up_on TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id, visited_on);

-- ------------------------------------------------------- prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id    TEXT REFERENCES visits(id) ON DELETE SET NULL,
  rx_number   TEXT,
  issued_on   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | issued
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rx_doctor ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_rx_patient ON prescriptions(patient_id, issued_on);

-- Medicine lines. `system` is what makes one shared table work for every
-- discipline: an Ayurvedic doctor prescribes allopathic medicine too.
CREATE TABLE IF NOT EXISTS prescription_items (
  id              TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  doctor_id       TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  medicine_name   TEXT NOT NULL,
  system          TEXT NOT NULL DEFAULT 'allopathy',
  dose            TEXT,
  frequency       TEXT,
  duration        TEXT,
  instructions    TEXT,
  attributes      TEXT NOT NULL DEFAULT '{}',  -- JSON, validated per practice pack
  sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rxi_prescription ON prescription_items(prescription_id);

-- ------------------------------------------------------- lab reports
CREATE TABLE IF NOT EXISTS lab_reports (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  report_name   TEXT NOT NULL,
  reported_on   TEXT NOT NULL,
  source        TEXT,                  -- lab | patient_upload
  status        TEXT NOT NULL DEFAULT 'awaiting_verification',
  verified_by   TEXT,
  verified_at   TEXT,
  file_key      TEXT,                  -- R2 object key
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_doctor ON lab_reports(doctor_id);
CREATE INDEX IF NOT EXISTS idx_lab_patient ON lab_reports(patient_id, reported_on);

CREATE TABLE IF NOT EXISTS lab_values (
  id            TEXT PRIMARY KEY,
  lab_report_id TEXT NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  analyte       TEXT NOT NULL,
  value         TEXT,
  unit          TEXT,
  reference     TEXT,
  flag          TEXT                    -- normal | high | low | critical
);
CREATE INDEX IF NOT EXISTS idx_labval_report ON lab_values(lab_report_id);

-- ---------------------------------------------------- pharmacy stock
-- Batch and expiry are not optional. Stock without expiry dates will
-- eventually tell a doctor to dispense something out of date.
CREATE TABLE IF NOT EXISTS stock_items (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  system        TEXT NOT NULL DEFAULT 'allopathy',
  form          TEXT,                   -- tablet | syrup | churna | oil
  unit          TEXT,
  reorder_level REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stock_doctor ON stock_items(doctor_id);

CREATE TABLE IF NOT EXISTS stock_batches (
  id            TEXT PRIMARY KEY,
  stock_item_id TEXT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  batch_no      TEXT,
  expires_on    TEXT NOT NULL,
  quantity      REAL NOT NULL DEFAULT 0,
  cost_price    REAL,
  sale_price    REAL,
  received_on   TEXT NOT NULL DEFAULT (date('now'))
);
CREATE INDEX IF NOT EXISTS idx_batch_item ON stock_batches(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_batch_expiry ON stock_batches(doctor_id, expires_on);

CREATE TABLE IF NOT EXISTS stock_movements (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  batch_id      TEXT NOT NULL REFERENCES stock_batches(id) ON DELETE CASCADE,
  patient_id    TEXT REFERENCES patients(id) ON DELETE SET NULL,
  direction     TEXT NOT NULL,          -- in | out | adjust | expired
  quantity      REAL NOT NULL,
  reason        TEXT,
  moved_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_move_doctor ON stock_movements(doctor_id, moved_at);

-- =======================================================================
-- CONSENT - the mechanism that lets history follow the patient
--
-- A doctor may read another doctor's records for a patient ONLY while an
-- active grant exists. The patient creates the grant by approving an OTP
-- sent to their own mobile - they are standing in the clinic, so it costs
-- about ten seconds.
--
-- Without this, any doctor could look up any person's medical history by
-- typing a mobile number. That is the difference between a feature and a
-- data breach.
-- =======================================================================
CREATE TABLE IF NOT EXISTS consent_grants (
  id                TEXT PRIMARY KEY,
  patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  granted_to_doctor TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  scope             TEXT NOT NULL DEFAULT 'full_history',
  method            TEXT NOT NULL DEFAULT 'patient_otp',
  granted_at        TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at        TEXT NOT NULL,
  revoked_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_consent_lookup
  ON consent_grants(patient_id, granted_to_doctor, expires_at);

-- Every cross-doctor read is recorded. The patient can see this list, and
-- so can we if anyone ever asks who looked at what.
CREATE TABLE IF NOT EXISTS consent_access_log (
  id           TEXT PRIMARY KEY,
  grant_id     TEXT NOT NULL REFERENCES consent_grants(id) ON DELETE CASCADE,
  patient_id   TEXT NOT NULL,
  reader_id    TEXT NOT NULL,           -- the doctor doing the reading
  owner_id     TEXT NOT NULL,           -- the doctor whose record was read
  record_type  TEXT NOT NULL,
  record_id    TEXT,
  accessed_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_calog_patient ON consent_access_log(patient_id, accessed_at);

-- ------------------------------------------------------------ audit + usage
CREATE TABLE IF NOT EXISTS audit_events (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT,
  actor       TEXT NOT NULL,            -- doctor:<id> | platform:<email> | system
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  detail      TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_doctor ON audit_events(doctor_id, created_at);

-- One immutable line per countable action. Written from day one because a
-- usage history cannot be reconstructed later.
CREATE TABLE IF NOT EXISTS usage_events (
  id              TEXT PRIMARY KEY,
  doctor_id       TEXT NOT NULL,
  event_type      TEXT NOT NULL,        -- patient_created | rx_issued | ai_run | ...
  quantity        REAL NOT NULL DEFAULT 1,
  unit            TEXT,
  provider        TEXT,
  model           TEXT,
  estimated_cost  REAL,
  idempotency_key TEXT UNIQUE,          -- stops double counting on retry
  metadata        TEXT,
  occurred_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_usage_doctor ON usage_events(doctor_id, occurred_at);

-- ------------------------------------------------------ platform team
-- Who may use the admin console. Separate from doctors entirely.
CREATE TABLE IF NOT EXISTS platform_team (
  email      TEXT PRIMARY KEY,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'viewer',  -- owner | admin | support | finance | viewer
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  removed_at TEXT
);
-- ---------------------------------------------------------------------------
-- 010  Billing.
--
-- A clinic that cannot hand over a receipt is not a business, it is a hobby.
-- This is the last thing Dr. Ashwin still does on paper.
--
-- The shape follows prescriptions deliberately, because the two documents
-- have the same legal character: once handed to a patient, what it says
-- happened. So:
--
--   * A draft is freely editable and has no number.
--   * Issuing assigns a gap-free number and freezes the lines.
--   * A mistake is cancelled with a stated reason, never quietly edited.
--   * Payments are appended, never overwritten, so part payments and the
--     order they arrived in stay readable.
--
-- Money is stored in paise, as integers. A REAL column would let 0.1 + 0.2
-- become 0.30000000000000004 and a day's takings would stop reconciling
-- against the cash box for reasons nobody could find.
--
-- On tax: the rate is per invoice and defaults to zero, because in India a
-- clinical establishment's own healthcare services are generally exempt while
-- medicines sold across the counter are not. TCOS does not decide which a
-- given line is - that is between the clinic and its accountant - it only
-- records what the clinic says and shows the working on the printed copy.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id  TEXT NOT NULL REFERENCES patients(id),
  visit_id    TEXT,

  invoice_no  TEXT,                -- assigned on issue, never before
  status      TEXT NOT NULL DEFAULT 'draft',   -- draft | issued | cancelled
  issued_on   TEXT,

  -- all in paise
  subtotal    INTEGER NOT NULL DEFAULT 0,
  discount    INTEGER NOT NULL DEFAULT 0,
  tax_rate    REAL    NOT NULL DEFAULT 0,      -- percent, e.g. 5 or 12
  tax_amount  INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,

  note            TEXT,
  cancelled_at    TEXT,
  cancel_reason   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_doctor  ON invoices(doctor_id, issued_on DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(doctor_id, patient_id);
-- Two invoices sharing a number would make the books unauditable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_no
  ON invoices(doctor_id, invoice_no) WHERE invoice_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS invoice_items (
  id          TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  doctor_id   TEXT NOT NULL,       -- denormalised so isolation holds on this table too
  kind        TEXT NOT NULL DEFAULT 'other',  -- consultation | medicine | procedure | lab | other
  description TEXT NOT NULL,
  quantity    REAL    NOT NULL DEFAULT 1,
  unit_price  INTEGER NOT NULL DEFAULT 0,     -- paise
  amount      INTEGER NOT NULL DEFAULT 0,     -- paise
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items ON invoice_items(invoice_id, sort_order);

-- Appended, never edited. A patient who pays half today and half next week
-- leaves two rows, and both stay.
CREATE TABLE IF NOT EXISTS payments (
  id          TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  doctor_id   TEXT NOT NULL,
  amount      INTEGER NOT NULL,    -- paise
  method      TEXT NOT NULL,       -- cash | upi | card | bank | other
  reference   TEXT,                -- UPI ref, last four digits, cheque no
  received_on TEXT NOT NULL,
  received_by TEXT,                -- clinic_users.id, or null for the doctor
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_doctor  ON payments(doctor_id, received_on DESC);

-- Same gap-free scheme as prescriptions: one counter per clinic per year.
CREATE TABLE IF NOT EXISTS invoice_sequences (
  doctor_id TEXT NOT NULL,
  year      INTEGER NOT NULL,
  next_no   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (doctor_id, year)
);

-- What she charges, so a consultation does not get typed in from memory at a
-- slightly different price every time.
CREATE TABLE IF NOT EXISTS fee_items (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'consultation',
  description TEXT NOT NULL,
  unit_price  INTEGER NOT NULL DEFAULT 0,   -- paise
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fee_items ON fee_items(doctor_id, active);
