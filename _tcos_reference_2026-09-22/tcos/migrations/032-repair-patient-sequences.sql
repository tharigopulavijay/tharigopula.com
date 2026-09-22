-- =========================================================================
-- 032  Move each clinic's patient counter past the numbers already in use.
--
-- patient_sequences.next_no had fallen behind doctor_patients. The demo and
-- import paths wrote local_ref values directly without advancing the
-- counter, so the next patient added was handed DEMO-1008 when DEMO-1008
-- through DEMO-1016 were already taken.
--
-- What made that a disaster rather than an annoyance was INSERT OR IGNORE
-- in addToList: the collision was swallowed, the number was returned
-- anyway, and the API answered 201. The person was created, never joined to
-- the doctor's list, and could not be added again because their mobile was
-- now registered. From the front desk it looked like the patient simply
-- vanished.
--
-- repo.js now reads the row back and retries, so a lagging counter can no
-- longer orphan anybody. This migration removes the lag itself, so the
-- retry loop is not walking through nine taken numbers on every add.
--
-- Only ever moves the counter FORWARD. A clinic whose counter is already
-- ahead keeps it: numbers a patient has been told are not reused.
-- =========================================================================

INSERT INTO patient_sequences (doctor_id, next_no)
SELECT dp.doctor_id,
       MAX(CAST(
         -- local_ref is "<PREFIX>-<number>"; take what follows the last '-'.
         substr(dp.local_ref, instr(dp.local_ref, '-') + 1) AS INTEGER))
  FROM doctor_patients dp
 WHERE dp.local_ref IS NOT NULL
   AND instr(dp.local_ref, '-') > 0
 GROUP BY dp.doctor_id
ON CONFLICT(doctor_id) DO UPDATE
  SET next_no = MAX(next_no, excluded.next_no);
