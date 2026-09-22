-- =========================================================================
-- 025  Repair mobile numbers that were stored in the wrong format.
--
-- Sign-in normalises a typed number to E.164 (+919812345670) before looking
-- it up. invites.createDoctor stored whatever the application form captured,
-- so every doctor approved through the console before 4 Sep 2026 has a row
-- keyed on the raw ten digits. The lookup never matches, and she is told her
-- password is wrong on an account that exists with the right password.
--
-- The code is fixed. This repairs the rows that were already written -
-- without it, the accounts stay unreachable no matter how many times the
-- password is reissued.
--
-- WHY THIS IS SAFE ON PRODUCTION DATA
--
--   It only touches rows that are NOT already normalised, and only where the
--   value is exactly ten digits beginning 6-9, which is the entire set of
--   valid Indian mobile numbers. Anything else - a landline, a placeholder,
--   a 'pending:' marker written when a doctor was invited by email, a number
--   already carrying +91 - is left exactly as it is.
--
--   It also refuses to create a collision: if the normalised form already
--   belongs to another row, this one is left alone for a human to look at
--   rather than being merged into somebody else's account. Two doctors
--   silently becoming one is far worse than one doctor still unable to sign
--   in, and the second problem is visible while the first is not.
-- =========================================================================

UPDATE doctors
   SET mobile = '+91' || mobile
 WHERE mobile IS NOT NULL
   AND mobile NOT LIKE '+%'
   AND length(mobile) = 10
   AND mobile GLOB '[6-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
   AND NOT EXISTS (
     SELECT 1 FROM doctors other
      WHERE other.mobile = '+91' || doctors.mobile
   );

-- Staff are created through a different path that already normalised, so
-- this should match nothing. It is here because "should" is not "does", and
-- a staff member locked out of her own clinic fails exactly as silently.
UPDATE clinic_users
   SET mobile = '+91' || mobile
 WHERE mobile IS NOT NULL
   AND mobile NOT LIKE '+%'
   AND length(mobile) = 10
   AND mobile GLOB '[6-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
   AND NOT EXISTS (
     SELECT 1 FROM clinic_users other
      WHERE other.mobile = '+91' || clinic_users.mobile
        AND other.id <> clinic_users.id
   );

-- Patients are registered through the clinic app, which normalises on the
-- way in, but the same repair costs nothing and the same silent failure
-- applies: a patient whose number is stored raw cannot be found by search
-- and would be registered a second time as a new person.
UPDATE patients
   SET mobile = '+91' || mobile
 WHERE mobile IS NOT NULL
   AND mobile NOT LIKE '+%'
   AND length(mobile) = 10
   AND mobile GLOB '[6-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
   AND NOT EXISTS (
     SELECT 1 FROM patients other
      WHERE other.mobile = '+91' || patients.mobile
        AND other.id <> patients.id
   );
