-- =========================================================================
-- 014  Verification as a gate on three features, not on the front door.
--
-- The question that produced this: does TCOS need to verify doctors at all?
-- We are a tool a doctor uses in her own clinic, not a marketplace selling
-- her to patients. Her patients already know who she is - they walked in.
-- Verifying her to use her own notebook is theatre.
--
-- That argument is right about most of the product, and wrong about exactly
-- three places, because in those three TCOS stops being her private tool
-- and starts making a claim on her behalf:
--
--   1. The public clinic page. We host a page on a TCOS URL carrying her
--      name, qualification and registration number, and a patient who finds
--      it is trusting our domain, not her waiting room. That IS the
--      marketplace situation, in miniature.
--
--   2. The registration number printed on prescriptions and that page. If
--      the number is invented, TCOS printed a false claim of medical
--      registration onto a document a pharmacist will act on.
--
--   3. Cross-clinic history. Patients are shared, so a doctor who asks can
--      reach records created by OTHER doctors once the patient approves a
--      code. Whoever we let into that graph can reach real patients
--      belonging to real practices. This is the one that matters most, and
--      it is not a risk the individual doctor accepted - it is one we
--      imposed on everyone already using the platform.
--
-- So verification gates those three and nothing else. A doctor can sign up,
-- run her whole clinic, see patients, prescribe, dispense, bill and report
-- from the first minute, unverified. What she cannot do until we have
-- checked her registration is publish under our name, print a registration
-- number we have not seen, or reach into another clinic's records.
--
-- That also turns verification from a barrier into something she wants: the
-- badge, the public page, and the shared history are the reward for it.
--
--   unverified  signed up, working, private. The default.
--   pending     she has submitted a certificate; we have not looked yet.
--   verified    somebody checked the number against the council register.
--   rejected    we looked and it did not check out. Not a silent state:
--               she is told, and she can submit again.
-- =========================================================================

ALTER TABLE doctors ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE doctors ADD COLUMN verified_at TEXT;
ALTER TABLE doctors ADD COLUMN verified_by TEXT;          -- platform_team email
ALTER TABLE doctors ADD COLUMN verification_note TEXT;    -- what was checked, or why not

CREATE INDEX IF NOT EXISTS idx_doctors_verification
  ON doctors(verification_status);

-- Every doctor already on the platform got here by Vijay creating the
-- account by hand, which is what verification means. Only the ones that
-- arrive through a self-serve route start unverified.
UPDATE doctors SET verification_status = 'verified',
                   verified_at = COALESCE(verified_at, created_at),
                   verified_by = COALESCE(verified_by, 'migrated:onboarded-by-hand')
 WHERE verification_status = 'unverified';
