-- Exact credential-failure backstop behind Cloudflare's approximate edge
-- limiter. Only purpose-separated digests are stored: never an email, mobile
-- number, source address, password or token.
CREATE TABLE IF NOT EXISTS auth_throttles (
  scope             TEXT NOT NULL,
  key_hash          TEXT NOT NULL,
  failures          INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  window_started_at TEXT NOT NULL,
  blocked_until     TEXT,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (scope, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_auth_throttles_updated
  ON auth_throttles(updated_at);
