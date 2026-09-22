-- A normal admin session lasts long enough for a working day. Destructive
-- actions use this separate timestamp and require the password again after a
-- short window, so an unattended browser cannot suspend clinics or reset
-- credentials merely because its session cookie is still valid.
ALTER TABLE admin_sessions ADD COLUMN reauthenticated_at TEXT;

-- Existing sessions do not receive a new proof. Their original sign-in time
-- is the strongest fact we have; sessions older than the short freshness
-- window will therefore be prompted on their first sensitive action.
UPDATE admin_sessions
   SET reauthenticated_at = created_at
 WHERE reauthenticated_at IS NULL;
