# First doctor production pilot

This is the release gate for TCOS's first real clinic. It is not a demo-data
script. Stop at the first failed check; do not work around a failed security,
identity, payment or clinical-integrity control.

## 1. Platform gate

- [ ] The production owner has a passkey plus an independent recovery method.
- [ ] `TURNSTILE_SECRET_KEY` is present on `tcos-api` and a live challenge passes.
- [ ] `ACCESS_ENFORCE`, `COOKIE_AUTH_ENFORCE` and `TURNSTILE_ENFORCE` are `true`.
- [ ] Owner sign-in, reauthentication, sign-out and recovery have been rehearsed.
- [x] A successful encrypted D1 backup exists off the laptop and has passed the
      workflow's decrypt-and-baseline check.
- [ ] `RESEND_API_KEY` is present and a password-reset message reaches a real inbox.
- [ ] The production OpenAI key is restricted and has a deliberate monthly budget.
- [ ] The release commit is on `main`, TCOS CI is green and the Worker/Page
      deployments both identify that commit.

## 2. Information to collect from the pilot doctor

Collect this through the TCOS application form or an approved business channel;
never put registration certificates, passwords, patient records or API secrets in
a GitHub issue or chat transcript.

- Full professional name, mobile and email.
- Clinic legal/display name, address, city, state and PIN code.
- Medical system/product requested: AyurCOS, HomeoCOS or AloCOS.
- Council, registration number and registration certificate.
- Clinic registration details where applicable.
- Consultation fees, weekly sittings and planned closures.
- Staff names, mobiles, roles and only the capabilities they need.
- Written acknowledgement that the clinic controls its patient-care data, TCOS is
  the technology processor, and AI output requires clinician review.

## 3. Identity and account gate

- [ ] The doctor submits the real Create account application.
- [ ] The platform owner checks the registration against the relevant council.
- [ ] Approval creates exactly one clinic account and returns one temporary password.
- [ ] The temporary password is handed to the doctor once through a private channel.
- [ ] First sign-in forces the doctor to choose a private password.
- [ ] The doctor signs out and signs in again with that password.
- [ ] Forgot password sends an OTP/link to the doctor's verified contact and revokes
      old sessions after reset.
- [ ] The owner cannot retrieve the doctor's chosen password.

## 4. Subscription gate

Until Razorpay test and live webhook verification are complete, use a clearly
recorded, time-bounded pilot entitlement. Do not describe manual activation as
automated payment.

- [ ] For a paid pilot, Razorpay creates the checkout/mandate.
- [ ] Only a correctly signed webhook activates the subscription.
- [ ] Duplicate webhooks do not duplicate payment, usage or entitlement rows.
- [ ] Failed payment starts the documented reserve; expiry removes only paid
      capabilities and never destroys clinical records.
- [ ] The clinic can see plan, renewal date, consumption and remaining allowance.

## 5. One complete clinical journey

Use a consenting adult test patient. Prefer a deliberately created pilot record;
do not copy an unrelated patient's historical chart merely to test the product.

- [ ] Configure clinic profile, timings, fees and one closure.
- [ ] Add one front-desk user and verify they cannot read clinical notes.
- [ ] Register the patient and confirm household/mobile matching.
- [ ] Book, arrive and begin one appointment.
- [ ] Record vitals and complete one consultation under the correct practitioner.
- [ ] Issue a prescription, amend it with a reason and prove the original is unchanged.
- [ ] Create an invoice, record a retry-safe payment and verify the balance.
- [ ] Upload a clear report and prove the AI checks patient identity before full extraction.
- [ ] Confirm selected AI values as the doctor; reject one value and preserve the audit.
- [ ] Open the patient view and prove it is read-only and revocable.
- [ ] Verify every action is attributed to the actual doctor or staff member.

## 6. Exit decision

The pilot may begin only when sections 1-4 pass. General onboarding stays closed
until the clinical journey passes, backup restoration is rehearsed, critical errors
are zero for the observation period, and the privacy/SaaS/data-processing documents
have been reviewed for the operating legal entity.

Record the pilot start date, clinic id, release commit, test evidence, open defects
and the named person who accepted the release. Never record patient clinical values
in this runbook.
