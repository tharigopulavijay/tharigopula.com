-- =========================================================================
-- Where a booking came from.
--
-- Vijay: "we need to bring the different platforms integration so that
-- doctors can track their different lead platforms from one place."
--
-- ONE INBOX, MANY SOURCES.
-- The obvious build is a new `appointment_leads` table beside the existing
-- `appointment_requests`. That is wrong, and wrong in the exact way the ask
-- is trying to fix: the doctor would end up watching two lists, and the
-- whole point is that she watches one. A booking is a booking whether it
-- arrived from her own page, from Practo, or from somebody ringing the desk.
--
-- So the existing table gains three columns and keeps its screen, its
-- accept/decline flow and its link to a real appointment.
-- =========================================================================

-- website | practo | justdial | google | whatsapp | phone | walk_in | other
--
-- Deliberately a free TEXT rather than a constrained set: a new lead portal
-- appearing is a Tuesday, and a doctor should not wait for a migration to
-- record where her patients came from. The screen groups whatever it finds.
ALTER TABLE appointment_requests ADD COLUMN source TEXT NOT NULL DEFAULT 'website';

-- The booking id at the far end - Practo's booking_id, Justdial's lead id.
--
-- This is what makes re-delivery safe. Every one of these platforms retries
-- when it does not get a clean 200, and a retried booking that becomes a
-- second row is a second patient in the diary at the same time. The unique
-- index below is what actually prevents it; this column is the key.
ALTER TABLE appointment_requests ADD COLUMN external_ref TEXT;

-- What the far end actually sent, as JSON.
--
-- Kept because these formats are undocumented and change without notice. The
-- first time a doctor says "Practo says 4pm but TCOS says 4:30", the only
-- useful thing is the bytes that arrived. Holds no clinical content - a lead
-- is a name, a number and a time.
ALTER TABLE appointment_requests ADD COLUMN source_payload TEXT;

-- One booking per source per doctor. The guard against double-booking on a
-- retry, enforced by the database rather than by remembering to check.
--
-- Partial, because rows from the clinic's own page have no external ref and
-- there would otherwise be only one of them ever.
CREATE UNIQUE INDEX IF NOT EXISTS idx_request_external
  ON appointment_requests(doctor_id, source, external_ref)
  WHERE external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_request_source
  ON appointment_requests(doctor_id, source, created_at DESC);

-- The shared secret a lead platform puts in the webhook URL.
--
-- Per doctor, so one clinic's leaked secret cannot post bookings into
-- another's diary, and so it can be rotated for one clinic without
-- disturbing anybody else. Null until she turns the feature on: a secret
-- that exists is a secret that can leak, so it is not minted in advance.
ALTER TABLE doctors ADD COLUMN lead_webhook_secret TEXT;
