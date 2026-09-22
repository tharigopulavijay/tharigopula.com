-- Phase 3 access-boundary data minimisation.
--
-- Appointment spam is now controlled at Cloudflare's edge using a digest
-- derived from the submitted identifier. The raw source IP was never read by
-- TCOS after insertion, so retaining it had no product or security purpose.
-- Remove the old values and leave the legacy column nullable for a future
-- table rebuild rather than risking a destructive production rewrite.
UPDATE appointment_requests SET source_ip = NULL WHERE source_ip IS NOT NULL;
