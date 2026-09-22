-- Platform admin sign-in.
--
-- Kept deliberately separate from doctors: a different table, a different
-- session store, a different endpoint prefix. Someone who compromises a
-- doctor account gains nothing here, and an admin session can never be
-- mistaken for a doctor session by requireDoctor().

ALTER TABLE platform_team ADD COLUMN password_hash TEXT;
ALTER TABLE platform_team ADD COLUMN password_salt TEXT;
ALTER TABLE platform_team ADD COLUMN last_sign_in_at TEXT;

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL REFERENCES platform_team(email) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions(email);

-- Invites. A temporary password is shown to the platform team exactly once,
-- at creation. It is never stored in the clear and never retrievable later -
-- if it is lost, issue a new one.
CREATE TABLE IF NOT EXISTS doctor_invites (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  invited_by    TEXT NOT NULL,
  identifier    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  first_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_invites_doctor ON doctor_invites(doctor_id);
