-- =========================================================================
-- Passkeys: signing in with the fingerprint, face or screen lock the device
-- already has.
--
-- Vijay: "as an owner i can login from anywhere, my tab or pc or laptop or
-- phone, and we have multiple email ids ... remove that dependency. i have
-- my own user id and pwd, why do i need that consistency. ... if mobile app
-- we need to make that it should be embedded to the mobile app fingerprint
-- or pattern or the mobile lock - just give that fingerprint and thats it,
-- we are in."
--
-- WHAT THIS REPLACES. The owner console sat behind Cloudflare Access, which
-- identified him by whichever Cloudflare ACCOUNT a browser was signed into.
-- That tied a clinical platform's console to a browser session on a
-- third-party dashboard, and it locked him out four times.
--
-- A passkey is strictly better for this: the private key never leaves the
-- device, it cannot be phished or replayed, it is bound to this exact
-- hostname by the browser itself, and it is released only when the person
-- present unlocks it - fingerprint, face or the device PIN. Enrol one per
-- device and every device works, with no shared email anywhere.
--
-- ONE TABLE FOR BOTH SIDES. `scope` is 'platform' for a console account and
-- 'clinic' for a doctor or staff member, and `subject` is the platform
-- email or the clinic_users/doctors id. The verification is identical, so
-- writing it twice would mean maintaining two copies of signature checking
-- - which is the last thing in this codebase that should exist twice.
-- =========================================================================

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id             TEXT PRIMARY KEY,
  -- The credential id the authenticator generated, base64url. UNIQUE
  -- because it is what the browser hands back at sign-in to say which key
  -- it used, and two rows answering to one id is an ambiguity we would
  -- resolve by guessing.
  credential_id  TEXT NOT NULL UNIQUE,
  scope          TEXT NOT NULL CHECK (scope IN ('platform', 'clinic')),
  subject        TEXT NOT NULL,
  -- SubjectPublicKeyInfo, base64url. Taken from the browser's own
  -- getPublicKey(), so no COSE/CBOR decoding is needed anywhere.
  public_key     TEXT NOT NULL,
  -- COSE algorithm: -7 is ES256, -257 is RS256. Stored because the
  -- signature cannot be verified without knowing which it is.
  algorithm      INTEGER NOT NULL,
  -- The authenticator's own counter. A value that fails to advance is how
  -- a cloned key announces itself.
  sign_count     INTEGER NOT NULL DEFAULT 0,
  -- "Vijay's phone". His words, so a list of devices means something.
  label          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_used_at   TEXT,
  revoked_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_webauthn_subject
  ON webauthn_credentials (scope, subject, revoked_at);

-- Challenges are issued by the server and spent exactly once.
--
-- Without this table the whole scheme is decoration: a signature over a
-- challenge the client chose is a signature an attacker can also obtain
-- and replay. The row is the proof that THIS signature answers a question
-- we asked, a moment ago, and have not asked anybody else.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  challenge   TEXT PRIMARY KEY,
  scope       TEXT NOT NULL CHECK (scope IN ('platform', 'clinic')),
  -- Null when signing in: the browser tells us which credential it used,
  -- and the credential tells us who that is.
  subject     TEXT,
  purpose     TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expiry
  ON webauthn_challenges (expires_at);
