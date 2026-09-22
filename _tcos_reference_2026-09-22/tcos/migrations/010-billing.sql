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
