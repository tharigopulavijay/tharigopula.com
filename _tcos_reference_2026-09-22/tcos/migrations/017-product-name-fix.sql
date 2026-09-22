-- =========================================================================
-- 017  HomoCOS -> HomeoCOS, AloCOS -> AlloCOS.
--
-- The finished logos spell the names properly, and a product id that does
-- not match its own name is the kind of thing nobody fixes later. Doing it
-- now costs three demo rows; doing it after doctors are onboarded means
-- every URL, every stored preference and every support conversation carries
-- the misspelling forever.
-- =========================================================================

UPDATE doctors SET product = 'homeocos' WHERE product = 'homocos';
UPDATE doctors SET product = 'allocos'  WHERE product = 'alocos';

UPDATE doctor_applications SET discipline = 'homeocos' WHERE discipline = 'homocos';
UPDATE doctor_applications SET discipline = 'allocos'  WHERE discipline = 'alocos';
