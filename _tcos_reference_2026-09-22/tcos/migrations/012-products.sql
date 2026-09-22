-- The three products: AyurCOS, HomeoCOS, AlloCOS.
--
-- One platform, one database, one API. This column is the whole of what
-- separates them for a given doctor: which workspace she signs into, which
-- practice packs she starts with, and which medicine system she sees first.
--
-- It is NOT a permission and it is NOT a data boundary. Tenant isolation is
-- still doctor_id on every clinical row, exactly as before, and it does not
-- care which product she uses. Two doctors on two different products who
-- share a patient are handled the same way two Ayurveda doctors always were:
-- separate records, and cross-clinic history only with the patient's consent.
--
-- The doctor cannot change this herself. It follows her registration - a
-- BHMS is not licensed to issue what an MBBS issues - so only the platform
-- sets it, at the point it verifies her certificate.
--
-- Existing doctors default to ayurcos because that is the only product that
-- existed when they were onboarded.

ALTER TABLE doctors ADD COLUMN product TEXT NOT NULL DEFAULT 'ayurcos';

CREATE INDEX IF NOT EXISTS idx_doctors_product ON doctors(product);
