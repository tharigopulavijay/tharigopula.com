-- Flexible staff duties, structured clinic operations, compliance, and support.

ALTER TABLE clinic_users ADD COLUMN capabilities TEXT;

ALTER TABLE doctors ADD COLUMN weekly_hours TEXT NOT NULL DEFAULT '{}';
ALTER TABLE doctors ADD COLUMN certificate_name TEXT;
ALTER TABLE doctors ADD COLUMN certificate_status TEXT NOT NULL DEFAULT 'not_uploaded';
ALTER TABLE doctors ADD COLUMN certificate_submitted_at TEXT;

CREATE TABLE IF NOT EXISTS support_requests (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  created_by  TEXT NOT NULL,
  category    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal',
  status      TEXT NOT NULL DEFAULT 'open',
  admin_note  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_support_doctor ON support_requests(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_requests(status, created_at DESC);
