-- =========================================================================
-- 016  Every clinic gets a working web address on day one, and its own
--      domain when it has one.
--
-- The pattern, which is the right one:
--
--   1. The moment a doctor switches her page on she gets a real, working
--      address on our domain - drdevi.tcos.in. No DNS, no registrar, no
--      waiting. She can put it on a visiting card that afternoon.
--
--   2. If she owns a domain, she types it in, we show her the exact records
--      to paste at her registrar, and once they resolve we serve her page on
--      HER domain. The free address keeps working, so nothing breaks while
--      DNS propagates and nothing breaks if she lets the domain lapse.
--
-- The second step is what makes it feel like her website rather than a page
-- we host. It is also the step most platforms get wrong by making the free
-- address disappear the moment a custom one is entered - which strands the
-- clinic for the 24 hours DNS takes.
--
--   none      she has not asked for one
--   pending   entered, records shown, nothing resolving yet
--   verifying we can see the DNS but the certificate is not issued
--   active    serving on her domain over HTTPS
--   failed    checked repeatedly and the records are wrong
--
-- Serving on her domain needs Cloudflare for SaaS custom hostnames; the
-- status column is what that process writes back to. Everything up to and
-- including showing her the records works without it.
-- =========================================================================

-- `custom_domain` itself was introduced by migration 006. Migration 016
-- turns that field into a managed lifecycle; adding it again makes every
-- clean 001–024 rebuild fail with "duplicate column name".
ALTER TABLE doctors ADD COLUMN custom_domain_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE doctors ADD COLUMN custom_domain_checked_at TEXT;
ALTER TABLE doctors ADD COLUMN custom_domain_active_at TEXT;
ALTER TABLE doctors ADD COLUMN custom_domain_error TEXT;

-- Two clinics cannot claim the same domain. Partial, so the many rows with
-- no domain do not collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_custom_domain
  ON doctors(custom_domain) WHERE custom_domain IS NOT NULL;

-- Host header lookups happen on every public page request, including the
-- ones from search engines, so both routes into a clinic are indexed.
CREATE INDEX IF NOT EXISTS idx_doctors_domain_status
  ON doctors(custom_domain_status);
