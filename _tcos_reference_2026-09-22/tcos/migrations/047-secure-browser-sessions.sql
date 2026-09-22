-- Host-only HttpOnly browser sessions use the existing opaque session token.
-- Only its hash and the CSRF token hash are stored in D1.
ALTER TABLE sessions ADD COLUMN csrf_hash TEXT;
ALTER TABLE admin_sessions ADD COLUMN csrf_hash TEXT;

