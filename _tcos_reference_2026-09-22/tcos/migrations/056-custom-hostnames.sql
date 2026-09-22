-- =========================================================================
-- What a doctor's own domain actually needs.
--
-- Vijay, after trying a domain he owned: "I see only the link but nothing more
-- than that, how would you connect using that."
--
-- He is right, and the gap was structural rather than cosmetic. The screen
-- collected a domain, stored it, looked up its DNS and reported "verifying"
-- - and a doctor who did everything correctly would still have reached
-- nothing, because Cloudflare refuses to serve a hostname that is not
-- registered to the account. Proved on 12 September 2026 by pointing
-- a domain we controlled at our address by hand:
--
--   over HTTPS  the TLS handshake FAILS - no certificate exists for her name
--   over HTTP   409, Cloudflare rejecting a hostname it does not know
--
-- No DNS record she could create would have changed either answer. The
-- missing piece is Cloudflare for SaaS (custom hostnames): it is what
-- issues a certificate for a domain we do not own and what tells the edge
-- to accept it.
--
-- These columns are what that conversation needs remembering between
-- requests. Everything else was already here.
-- =========================================================================

-- Cloudflare's id for her domain. Without it we cannot ask how the
-- certificate is getting on, and cannot delete it when she disconnects -
-- which would both cost money for a hostname nobody uses AND lock the domain
-- out of every other Cloudflare account, including hers if she came back.
ALTER TABLE doctors ADD COLUMN custom_hostname_id TEXT;

-- And a SECOND one, for www.
--
-- A custom hostname covers exactly one name. A doctor who connects
-- drclinic.com and puts that on her signboard will still have patients who
-- type www.drclinic.com out of habit, and that is a different hostname as far
-- as the edge is concerned. Registering only the one she typed would mean
-- half her patients get a certificate error - which is worse than no website,
-- because a browser security warning on a doctor's domain looks like she has
-- been hacked.
--
-- Only set when she connects an apex (drclinic.com). If she connects
-- clinic.drclinic.com, there is no www to add.
ALTER TABLE doctors ADD COLUMN custom_hostname_www_id TEXT;

-- Every DNS record she must create, exactly as Cloudflare worded it, as JSON.
--
-- Stored rather than fetched on demand for one practical reason: she will
-- open her registrar in another tab, get halfway through, and come back
-- tomorrow. The records must be the same strings she half-copied yesterday.
-- Re-deriving them risks showing her a fresh challenge for a record she has
-- already entered, and she has no way to tell which one is real.
ALTER TABLE doctors ADD COLUMN custom_domain_records TEXT;

-- What the certificate is doing, in Cloudflare's own words - pending
-- validation, pending issuance, active, or a failure with a reason. Held
-- separately from custom_domain_status because the hostname can be correctly
-- pointed at us while the certificate is still minutes away, and telling a
-- doctor "not working" during that window is wrong.
ALTER TABLE doctors ADD COLUMN custom_domain_ssl_status TEXT;
