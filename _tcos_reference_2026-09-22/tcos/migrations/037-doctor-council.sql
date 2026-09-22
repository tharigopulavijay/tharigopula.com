-- =========================================================================
-- 037  The council register a clinic owner belongs to.
--
-- Applications have always captured this value and additional practitioners
-- already carry it, but the owner row did not. The verification queue selected
-- doctors.council anyway, which made the whole queue return HTTP 500.
--
-- NULL is intentional for older accounts. A council must come from the doctor
-- or the reviewer; inferring one from the product would turn a likely answer
-- into a claimed fact on a regulated identity.
-- =========================================================================

ALTER TABLE doctors ADD COLUMN council TEXT;

