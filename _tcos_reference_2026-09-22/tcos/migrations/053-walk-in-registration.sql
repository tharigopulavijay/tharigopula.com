-- =========================================================================
-- The patient filling in her own details while she waits.
--
-- She scans a code at the front desk, types her name and number on her own
-- phone, and the front desk gets a row to check rather than a conversation
-- to transcribe. Vijay: "till he waits he can fill up his details."
--
-- BUILT ON appointment_requests, NOT BESIDE IT
-- That table already holds "a stranger who wants to be seen", already has
-- the public submission route, the daily rate limit, and the accept flow
-- that turns a request into a patient and an appointment. A second table
-- would be the same thing with a different name, and two accept paths is
-- how one of them quietly stops being maintained.
--
-- WHY THERE IS NO PUBLIC "IS THIS NUMBER REGISTERED" LOOKUP
-- The obvious design is to check the mobile as she types and offer the
-- names on it - Vijay's "do you mean you are this, this, this". The
-- household is already modelled, so it would work. But that form is PUBLIC:
-- anyone could type numbers into it and learn who attends this clinic.
--
-- So the match happens on the SERVER, at submission, and the answer goes to
-- the FRONT DESK rather than back to the phone. Staff see "this number
-- already has a record here"; the person holding the phone learns nothing
-- they did not already know. Same benefit, no oracle - better than showing
-- names behind an OTP, because it needs no OTP and leaks nothing at all.
-- =========================================================================

-- first | follow-up. What she says she is here for, not a clinical fact -
-- the front desk confirms it either way.
ALTER TABLE appointment_requests ADD COLUMN visit_type TEXT;

-- Set by the server when the submitted mobile already belongs to somebody
-- on this clinic's list. Read only by staff. NULL means "no match found",
-- which is different from "not checked" only in that we always check.
ALTER TABLE appointment_requests ADD COLUMN matched_patient_id TEXT;

-- Age and sex, so the front desk is not asking across a counter what she
-- has already typed. Both optional: a form that refuses to submit is a
-- form she abandons and joins the queue to speak to somebody instead.
ALTER TABLE appointment_requests ADD COLUMN age_years INTEGER;
ALTER TABLE appointment_requests ADD COLUMN sex TEXT;
