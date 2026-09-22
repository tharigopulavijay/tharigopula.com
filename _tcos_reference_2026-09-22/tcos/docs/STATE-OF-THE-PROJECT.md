# TCOS — State of the project

**For a reviewing engineer or AI.** Everything here was verified against the
running code, staging services and the production database on **9 September 2026**, not
recalled from memory.

**Owner:** Vijay Tharigopula, Tharigopula Technologies
**Repo:** `E:\tharigopula.com\products\tcos` (default release branch: `main`)
**Live:** `https://tcos-api.hello-tharigopula.workers.dev` · `https://tcos.pages.dev`

---

## 0. How to review this

The project is a clinical operating system for independent Indian medical
practices. It holds real patient records, so the interesting bugs are not
crashes — they are **silent wrongness**: a message that looks sent and
wasn't, a cost that reads right and isn't, a query that forgets which
clinic it belongs to.

Section 15 lists every class of bug already found here. **Those patterns
recur.** If you are hunting, start there rather than with a general sweep.

Run the suite first:

```
npm test
```

Expect **938 assertions, 0 failures**, across 32 files.

---

## 1. What it is

A multi-tenant clinical system whose present workspace boundary is one
practice owner: patients, practitioners, visits, prescriptions, lab reports,
pharmacy stock, billing, staff logins, a read-only patient portal, and an AI
that reads uploaded lab reports and proposes values for clinician review.

**Three products from one codebase**, selected by the `product` column on
`doctors`:

| Product | System of medicine |
|---|---|
| **AyurCOS** | Ayurveda |
| **HomeoCOS** | Homeopathy |
| **AloCOS** | Allopathy |

Same engine, different clinical vocabulary and print layout.

---

## 2. Stack and deployment

| | |
|---|---|
| API | Cloudflare Workers (ES modules), `worker/index.js`; `tcos-api` / `tcos-api-staging` |
| Database | Cloudflare D1 (SQLite), binding `DB`; `tcos-db` / `tcos-staging-demo-db` |
| File storage | Cloudflare R2, binding `FILES`; `tcos-files` / `tcos-staging-demo-files` |
| Front end | Cloudflare Pages, projects `tcos` / `tcos-staging` — plain HTML/CSS/JS |
| Framework | **None.** No React or bundler. A safety build copies only allow-listed public files into `dist/`. |
| Dependencies | **Three**: `jose`, `pdf-lib`, `wrangler` |
| Cron | `30 13 * * *` (19:00 IST) — nightly appointment reminders |
| Hand-written JS | ~14,500 lines |

Deploy only through the guarded commands:

```
npm run deploy:api:staging
npm run deploy:web:staging
npm run deploy:api
npm run deploy:web
```

**There is a staging environment** defined in `wrangler.jsonc` (`tcos-staging`,
own D1 and R2). Commands without `-e` target production.

The obsolete `tcos-demo` and `ayurcos-demo` Pages projects, Workers and D1
databases were deleted on 8 September. The unbound `tcos-staging-db` was
exported to `_backups/tcos/retired-tcos-staging-db-2026-09-08.sql` before
deletion; its empty `tcos-staging-files` bucket was deleted. No other product,
portfolio or Tharigopula website resource was changed.

---

## 3. Invariants — the six rules

These are enforced in code and, where possible, by tests. **Treat a
violation as a bug even if nothing visibly breaks.**

1. **Tenant isolation.** Every query touching clinical data is scoped
   `WHERE doctor_id = ?`. `test/isolation.test.js` scans the source for
   queries that forgot, with a named exception list.
2. **Permissions are checked on the server.** `gate(doctor, CAN.X)` in the
   router. Hiding a button in the UI is not access control.
3. **Issued documents are immutable.** Once a prescription or invoice is
   issued it is never edited. Corrections are new documents
   (`/prescriptions/:id/amend`).
4. **Patients read, never write.** The portal (`/p/:token`) has no write path.
5. **Money is integer paise.** Never a float, never a decimal string.
6. **One mobile number is a household.** `patients.mobile` is UNIQUE per
   person, and `householdOn(mobile)` returns everyone on that number. A
   mother booking for her family is the normal case, not an edge case.

Two more that emerged later and matter as much:

7. **No raw SQL in `worker/index.js`.** SQL lives in `repo.js` or a domain
   module. Enforced by `test/isolation.test.js`.
8. **Nothing is advertised that is not built.** `test/plans.test.js` reads
   the plans file and the router together — a feature can only appear on the
   pricing screen if a route backs it.

---

## 4. Module map

`worker/` — 33 modules, no circular imports. `worker/index.js` currently
exposes 153 route declarations.

| Module | Lines | Responsibility |
|---|---|---|
| `index.js` | 3161 | Router only. 153 route declarations. Auth, permission gates, response shaping. |
| `repo.js` | 1699 | All clinical SQL. Every function takes `doctorId` first. |
| `ai.js` | 885 | OpenAI Responses + Batch API. Page-by-page extraction, merge, costing. |
| `platform.js` | 989 | Platform owner operations: exact team capabilities, tenants, applications, patient operations, aggregate insights and support. |
| `aiops.js` | 383 | AI spend guard: circuit breaker, parked queue, alerts. |
| `fhir.js` | 347 | FHIR R4 bundles for ABDM. No network access by design. |
| `billing.js` | 427 | Invoices, payments, gap-free numbering and retry safety. |
| `quota.js` | 266 | Plan limits, metering, overage. |
| `staff.js` | 287 | Clinic users, roles, capabilities, actor identity, temporary passwords. |
| `messaging.js` | 259 | Channel choice, consent, de-duplication, nightly run. |
| `whatsapp.js` | 252 | Meta Cloud API + `wa.me` links + webhook parsing. |
| `sms.js` | 225 | MSG91 + DLT template gating + health check. |
| `patientview.js` | 218 | The read-only portal. |
| `drafts.js` | 215 | AI output held for human confirmation. |
| `costs.js` | 294 | Revenue, provider usage, cash/imputed business costs and margin per clinic. |
| `domains.js` | 194 | Custom clinic web addresses. |
| `files.js` | 194 | R2 upload/download, scoped by doctor. |
| `publicpage.js` | 256 | The clinic's public page and idempotent request acceptance. |
| `schedule.js` | 182 | Weekly hours and closures. |
| `abha.js` | 143 | ABHA/HPR/HFR validation. |
| `email.js` | 138 | Resend + health check. |
| `lib.js` | 134 | ids, hashing, errors, mobile/email normalisation. |
| `otp.js` | 130 | Generate, hash, store, expire, verify. Provider-agnostic. |
| `preflights.js` | 119 | Cost estimate before an AI run. |
| `reports.js` | 94 | Lab report shaping. |
| `pdf.js` | 85 | pdf-lib page splitting, grouped. |
| `thari-platform.js` | 61 | Shadow client for the control plane. |
| `subscriptions.js` | — | Razorpay plans, hosted checkout, signed/idempotent webhooks, renewal reserve and entitlement changes. |
| `security.js` | — | Purpose-separated edge controls plus an exact, digested D1 failed-credential backstop. |
| `turnstile.js` | — | Server-side challenge verification, action and hostname binding. |

---

## 5. Data model

**59 application tables, plus the D1 migration ledger, in both staging and
production after this release.** Both migration ledgers are current through
049. Grouped:

- **Identity/tenancy** — `doctors`, `clinic_users`, `sessions`,
  `admin_sessions`, `platform_team`, `doctor_invites`, `doctor_applications`
- **Patients** — `patients`, `doctor_patients`, `patient_sequences`,
  `patient_access_links`, `patient_registration_operations`
- **Clinical** — `visits`, `prescriptions`, `prescription_items`,
  `lab_reports`, `lab_values`, `rx_sequences`
- **Consent** — `consent_grants`, `consent_access_log`
- **Pharmacy** — `stock_items`, `stock_batches`, `stock_movements`,
  `stock_operations`, `drug_catalogue`, `drug_strengths`
- **Money** — `invoices`, `invoice_items`, `invoice_sequences`, `payments`,
  `fee_items`, `plan_limits`, `plan_prices`, `plan_grace`, `cost_rates`,
  `usage_events`, `subscription_plan_catalog`, `subscriptions`,
  `subscription_payments`, `payment_webhook_events`, `business_costs`
- **AI** — `ai_drafts`, `ai_preflights`, `ai_spend`, `ai_breaker`,
  `ai_queue`, `ai_limits`
- **Messaging** — `messages`, `otp_codes`
- **Scheduling** — `appointments`, `appointment_requests`, `clinic_closures`
- **ABDM** — `abdm_care_contexts`
- **Ops/security** — `audit_events`, `support_requests`, `support_messages`, `files`,
  `auth_throttles`, `d1_migrations`

**49 migrations**, applied by filename order. Migration 049 adds accountable
support conversations, exact platform-team capabilities, plan provenance and
the business-cost ledger. Staging and production are current through 049.

Production's legacy empty ledger was repaired on 9 Sep 2026 only after a full
1,247,529-byte export (SHA-256
`82143410440191E400F35D72F64783ABA850EF3951DD151012E02DF072D98C73`).
The offline audit proved every one of the 100 migration-defined objects and 73
added columns through migration 035. It also proved migration 036 was absent.
Migrations 036–048 then succeeded against the exact production export with
`integrity_check=ok` and zero foreign-key violations before they were applied
remotely. Before migration 049, a fresh 1,263,645-byte production export
(SHA-256 `7523e19fdcdfa4d69619302f9cb9e392997700cd8057d4124c744f487768c51c`)
was audited through 048 and rehearsed through 049 with `integrity_check=ok`
and zero foreign-key violations. Migration 049 and the exact accepted commit
`c9f2ec29d7f6` were deployed on 9 Sep 2026. Production now has 49 ledger rows
and 59 application tables. No staging/demo seed was applied.

**Note:** `patients` is a SHARED table — one row per human being, not per
clinic. `doctor_patients` is the join that scopes them. The ABHA number and
WhatsApp consent live on the shared row, deliberately (see §9, §7).

---

## 6. API surface

**153 route declarations.** Auth model:

- `requireDoctor(env, request)` → resolves a session token to exactly one
  doctor id. **Handlers never choose which doctor's data to read.**
- `requireAdminCapability(env, request, capability)` → platform team with an
  exact server-enforced job list; roles are editable presets only.
- Public routes: `/health`, `/apply`, `/p/:token`, `/clinic/:slug`,
  `/webhooks/whatsapp`, `/admin/bootstrap` (one-time).

Errors are `ApiError` with a status and a plain-English message. The router
never leaks internals: unknown exceptions become a generic 500.

---

## 7. Messaging — three channels, different states

| Channel | Code | Configured in production | Blocked by |
|---|---|---|---|
| **Email (Resend)** | done | key **not yet set** | nothing — 20 min of setup |
| **SMS (MSG91)** | done | key set, ₹3,800 balance | **DLT registration** (in progress, Jio TrueConnect) |
| **WhatsApp (Meta)** | done | not configured | Meta developer app not created |
| **wa.me links** | done | **works now** | nothing |

### Design decisions worth not reversing

**OTP always goes by SMS.** Never WhatsApp. Every Indian mobile receives
SMS; WhatsApp needs a smartphone, the app and data. The person who cannot
receive a code is exactly the person locked out. Pinned by
`test/otp-sms.test.js` — a change routing codes through WhatsApp fails there.

**Consent is off by default** (`patients.whatsapp_opt_in`). A patient who
replies STOP is opted out **for every clinic** and no front desk can undo it.

**`messages.dedupe_key` is UNIQUE** and built from what a message is ABOUT,
never from the clock. The row is written BEFORE the network call, so two
overlapping timer runs cannot both win. A clinic whose patients get the same
reminder twice looks careless, and that does not recover.

**`wa.me` links use the same string** as the automatic message — asserted by
a test — so switching on the API changes nothing the patient sees.

**SMS refuses loudly without a DLT template.** The operators' own failure
mode is to drop unregistered messages in silence.

---

## 8. AI — reading lab reports

**Provider:** OpenAI Responses API + Batch API. `store: false` avoids stored
Responses application state. Batch input/output/error files are deleted after
the result is safely recorded, with a short output expiry as a backstop.
Standard provider abuse-monitoring logs may still retain request content for
up to 30 days under the provider's default policy. TCOS does not claim that
`store: false` means the provider retains nothing.

**Password-secret incident response:** the Worker supports `PEPPER_V2` as the
active secret while accepting the old `PEPPER` only long enough to re-hash a
valid account on its next sign-in. This avoids a platform-wide password reset;
dormant accounts must be reset before the exposed old pepper is removed.

**Pipeline:** upload → preflight (cheap model estimates cost) → optional
human approval → pdf-lib splits into **5-page chunks** → extract per chunk →
`mergePages` + `dedupeRows` → written to `ai_drafts`, **never** straight
into the record → clinician confirms or rejects.

**Live staging proof (8 Sep):** a three-page synthetic report for Vijay had
advertisements on pages 1 and 3 and four results on page 2. Preflight matched
the patient, selected only page 2 and cost ₹0.05. Extraction returned all four
values exactly, kept source page 2 and cost ₹0.86. Total ₹0.91; the output
remained a pending draft and no chart row was created.

**Cost:** about **₹3** for a typical report, ₹17 for a 21-page master
check-up. Measured, not estimated. Batch route is 50% cheaper with a 24-hour
window; `urgent` overrides to the live route.

**Spend guard (`aiops.js`):** rolling per-clinic caps, a ceiling per call, a
circuit breaker (`closed|open|half_open`) that self-resets after 20 minutes.
Refused work is **parked in `ai_queue`, not lost**. One alert, not one per
call. Verified against a real database: 40 calls × ₹4 vs a ₹150 limit → 429
(not 500), document parked, breaker opened, one ticket, **and a different
clinic was unaffected**.

---

## 9. ABDM / ABHA

**Built:** identifier columns (`patients.abha_number`, `abha_address`,
`abha_status`; `doctors.hpr_id`, `hfr_id`; `clinic_users.hpr_id`),
`abdm_care_contexts`, UI capture on the patient record and practice screen,
and `fhir.js` producing FHIR R4 prescription and diagnostic-report bundles
(20 assertions).

**Not built:** every gateway call. Blocked on `sandbox.abdm.gov.in`
credentials, which only the owner can obtain.

**Deliberate:** the ABHA checksum is NOT validated. A 14-digit ABHA is
widely believed to carry a Verhoeff check digit, but this could not be
confirmed from any authority — and a wrong rule would tell a receptionist
holding a real card that the real number is invalid. Structure only.
Nothing can be marked `verified` by hand; only the gateway may do that.

---

## 10. Plans and money

| Plan | Price/month | Patients | Staff | Messages | AI documents |
|---|---|---|---|---|---|
| Free (`basic`) | ₹0 | 100 | 1 | 0 | 0 |
| Practice (`starter`) | ₹899 | 2,000 | 3 | 100 | 60 |
| Clinic (`pro`) | ₹2,199 | 10,000 | 8 | 500 | 250 |
| Group (`pro_plus`) | ₹4,499 | 50,000 | 50 | 1,500 | 700 |

Priced against published competitors (Sep 2026): DocPulse ₹500, Halemind
₹625, Adrine ₹999, MocDoc ₹2,500, HealthRay ₹3,000, Practo Ray ₹1,000–4,000
**plus** per-appointment fees. **TCOS takes no cut of a consultation** —
that is the primary differentiator.

AI is **included**, not metered separately: at ₹3 a report, metering costs
adoption and buys nothing. Overage ₹5/document, ₹1.50/message.

**Recurring payment automation is built and deployed to staging.** Razorpay
hosts payment authentication; TCOS stores no card, bank or UPI mandate data.
A signed, idempotent webhook fetches the current provider state and changes
the clinic plan in one D1 batch. `active` grants paid access immediately;
`authenticated` alone does not. Failed renewal opens one three-day reserve,
then falls back to Free without deleting records. The doctor can refresh
provider status and stop renewal at cycle end. The platform console shows
MRR-normalised value, unfinished checkout, payment risk and cancellations.

Live provider testing is not enabled yet because the three Razorpay staging
secrets and dashboard webhook registration are owner-controlled setup steps.

---

## 11. Tests

**32 files, 938 assertions, all passing.** `npm test` runs them in order.

| File | Asserts | Guards |
|---|---|---|
| `isolation.test.js` | 29 | tenant scoping, no raw SQL in the router |
| `clinical.test.js` | 24 | prescription and pharmacy rules |
| `clinical-transactions.test.js` | 10 | AI/manual consultation confirmation, retries and atomic audit |
| `billing-transactions.test.js` | 13 | invoice/payment rollback, numbering and retry safety |
| `appointment-transactions.test.js` | 10 | one online request becomes one appointment and retry-safe patient registration |
| `prescription-transactions.test.js` | 17 | draft, visit-link, issue, follow-up and amendment atomicity |
| `stock-transactions.test.js` | 15 | receipt, dispense, quarantine and write-off rollback/retry safety |
| `patient-registration-transactions.test.js` | 11 | shared identity, clinic numbering, rollback and retry safety |
| `staff.test.js` | 120 | role capabilities, practitioner identity and route gates |
| `onboarding.test.js` | 40 | how a doctor joins, council and mobile normalisation |
| `platform.test.js` | 21 | control-plane shadow contract and product-context correctness |
| `pepper-rotation.test.js` | 12 | password-secret rotation without locking out accounts |
| `security.test.js` | 39 | private rate keys, exact failed-credential throttling, Turnstile verification, session revocation and data minimisation |
| `session-security.test.js` | 36 | host-only cookies, exact-origin CSRF, Access JWT, reauthentication and recovery configuration |
| `owner-console.test.js` | 28 | exact employee access, support threads, true costs, plan provenance and privacy-preserving insights |
| `ai-preflight.test.js` | 16 | cost estimate before spending |
| `ai-retention.test.js` | 16 | provider-file deletion and cleanup retry |
| `ai-drafts.test.js` | 51 | model/record wall, review-shell safety, atomic confirmation, provenance and zero values |
| `ai-merge.test.js` | 22 | joining pages and preserving original page numbers |
| `fhir.test.js` | 20 | FHIR R4 bundle shape |
| `plans.test.js` | 26 | nothing advertised that is not built |
| `subscriptions.test.js` | 46 | signed/idempotent billing, entitlement automation and owner UI |
| `abha.test.js` | 34 | identifier validation |
| `whatsapp.test.js` | 54 | consent, de-duplication, templates, channel choice |
| `otp-sms.test.js` | 28 | codes go by SMS; provider failure modes |
| `email.test.js` | 23 | Resend key scope, domain verification, send failures |
| `patient-numbers.test.js` | 10 | collision-safe patient numbering |
| `scribe.test.js` | 36 | voice transcription and clinical-note drafting |
| `webhook-security.test.js` | 35 | signed Meta webhooks and request ownership at both route and repository boundaries |
| `patient-portal.test.js` | 11 | production/staging API routing and read-only portal |
| `domains.test.js` | 21 | Indian apex/subdomain DNS instructions |
| `publish-safety.test.js` | 64 | guarded releases, CSP and public-file allow-list |

Style: plain Node, no framework. Each file prints PASS/FAIL and exits
non-zero on failure. Several include a **control assertion** proving the
test can fail (e.g. a deliberately wrong password must be rejected).

---

## 12. Secrets and configuration

**Secret values never appear in the repo, in chat, or in any document.**
Set with `wrangler secret put` or the Cloudflare dashboard (type: Secret).

| Secret | Purpose | State (9 Sep 2026) |
|---|---|---|
| `PEPPER` | extra input to password hashing | **set** |
| `OPENAI_API_KEY` | AI reading | **staging: restricted key, set and live-tested; production: rotate before AI release** |
| `TURNSTILE_SECRET_KEY` | server-side bot challenge verification | **staging and production: set; production challenge enabled 9 Sep 2026** |
| `SMS_API_KEY` | MSG91 auth key | **set** (rule: User, IP security OFF) |
| `RESEND_API_KEY` | email | **not set** |
| `SMS_TEMPLATE_ID` | DLT template for OTP | not set — DLT pending |
| `SMS_TEMPLATE_REMINDER` | DLT template for reminders | not set |
| `SMS_TEMPLATE_RECORD_READY` | DLT template for record links | not set |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` / `WHATSAPP_VERIFY_TOKEN` | Meta | not set |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | recurring payment and signed events | **not set** |

Plain vars in `wrangler.jsonc`: `ALLOWED_ORIGINS`, `CLINIC_DOMAIN`,
`CLINIC_APEX_IP`, `OTP_TTL_MINUTES`, `SESSION_TTL_HOURS`,
`CONSENT_TTL_HOURS`, `AI_USD_INR`, `TURNSTILE_ENFORCE`,
`TURNSTILE_SITE_KEY`, `COOKIE_AUTH_ENFORCE`, `ADMIN_COOKIE_AUTH_ENFORCE`,
`ACCESS_ENFORCE`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`.

**Gotcha:** `wrangler deploy` replaces the whole plain-vars block from
`wrangler.jsonc`. Variables added in the dashboard as **Text** are wiped by
the next deploy. **Secrets are never touched.** Always use type Secret.

`/admin/sms-health` reports the live state of email and SMS without sending
anything. Surfaced in the admin console under **Communications**.

---

## 13. What is NOT built

Do not assume any of these exist:

- **Live subscription collection** — engine is on staging; Razorpay keys,
  webhook registration and a test-mode payment are still required
- **WhatsApp automation in production** — code done, Meta app not created
- **Voice prescriptions**, **AI copilot**, **rules-engine automation**,
  **white-labelling**, **public API** — all removed from the pricing screen
  because they do not exist
- **ABDM gateway calls** — identifiers and FHIR only
- **Self-service signup** — deliberate. `/auth/signup/*` are stubs that
  explain accounts are created by the team after verifying registration.
- **Multi-model AI failover** — deliberately deferred; naive failover
  multiplies cost

---

## 14. Pending work

**Blocked on the owner:**
1. Enrol Windows Hello/passkey plus a second security key and complete a
   lockout/recovery rehearsal. The production Access application protects
   `admin.tcos.tharigopula.com/admin*`; its exact-owner App Launcher is enabled
   with a six-hour session and the direct MFA enrolment page is verified reachable.
2. GitHub Pro (or Team) is required to enforce required reviews/status checks
   on this private repository; GitHub Free returned HTTP 403. Do not make the
   clinical repository public merely to obtain branch protection.
3. Razorpay test-mode API credentials plus webhook secret/registration —
   enables the first complete payment → automatic access test
4. `RESEND_API_KEY` into Cloudflare (domain already verified) — unblocks
   password reset entirely
5. DLT registration (Jio TrueConnect, in progress) → then `SMS_TEMPLATE_ID`
6. Meta developer app → Phone Number ID, WABA ID, `WHATSAPP_TOKEN`
7. ABDM sandbox credentials

**Production security cutover (9 Sep 2026):** Worker version
`a87acb13-196a-4f32-a03a-4f4dd2d7b30a` enables Turnstile and Cloudflare
Access, and enforces host-only HttpOnly cookies for the same-origin owner
console. Doctor bearer compatibility remains on only because the production
doctor app is still served by Pages on a different origin; moving that app to
a same-origin Worker hostname is the prerequisite for clinic-cookie enforcement.

**Off-laptop recovery cutover (9 Sep 2026):** GitHub Actions run
`34353952237` successfully exported `tcos-db`, encrypted it with AES-256,
verified decryption and the migration-049 database baseline, removed both
plaintext SQL copies and retained only the encrypted archive, SHA-256 checksum
and non-clinical manifest for 90 days. An independent download inspection
confirmed the stored file set and matching checksum, then removed the temporary
local copy. The dedicated Cloudflare account token is limited to D1 Read/Write;
D1 Write is required by Cloudflare's export-job endpoint.

**Code/product work outstanding:**
- Existing-subscription plan changes (upgrade/downgrade); new subscriptions,
  renewal, failure reserve, cancellation and reactivation are implemented
- Practitioner certificate submission and verification, not only owner doctor
- Bulk patient import needs a dry-run, row-level error report and one import
  idempotency boundary. Manual/online patient registration, stock receipt,
  dispensing, quarantine/write-off, visits, prescription draft/issue/follow-up/
  amendment, consultation confirmation, lab-report save/AI confirmation,
  invoices/payments and online request acceptance are atomic and retry-safe.
- Patient accounts, household member selection, consent dashboard, revocation
  and short-lived sessions to replace long-lived bearer links
- Alerting, incident response drills and the quarterly isolated-cloud restore
  rehearsal; CI and the daily encrypted off-laptop backup with per-run restore
  verification are operational
- Custom-domain provisioning through Cloudflare for SaaS
- AyurCOS end-to-end review before the first doctor goes live
- Re-tune `ai_limits` ceilings — set when reports were believed to cost 2.67×
  what they do
- Lift `email.js`/`sms.js`/`whatsapp.js`/`messaging.js` into the
  `thari-control` control plane once the first clinic is stable
  (`entitlements.communications` is already a flag in the contract)
- Both production doctors have **no email address** — until one is set,
  password recovery cannot reach them

---

## 15. Bug history — where to look

**Every bug found in this project so far has been silent wrongness, not a
crash.** These are the recurring classes. A reviewer should hunt here first.

**1. Provider says 200 and means failure.**
MSG91 answers HTTP 200 with `{"type":"error"}` for a rejected send. The
original OTP path checked only the status code, so an undelivered code was
recorded as sent. → Check every `response.ok` against the provider's actual
semantics.

**2. Reading the wrong field and reporting it as fact.**
The SMS balance check read a legacy per-route endpoint that returns zero on a
unified-wallet account. It told the owner, who had just paid ₹2,950, that his
wallet was empty. → An unreadable value must be `null`, never `0`.

**3. Rate tables keyed on the wrong identifier.**
The API returns dated model ids (`gpt-5.4-mini-2026-03-17`); the rate table
was keyed on `gpt-5.4-mini`. Nothing matched, so every reading was billed at
the most expensive rate — **2.67× wrong for four days**. This happened
**twice**. → `ratesFor()` now falls back to longest-prefix match and flags
`unknownModel`.

**4. Two representations of the same value.**
A doctor's mobile was stored raw (`9812345670`) and looked up normalised
(`+919812345670`), so an approved doctor could never sign in. Fixed in
`createDoctor` plus migration 025 to repair existing rows.

**5. A flag set in one branch and not another.**
`actorFor()` set `mustChangePassword` for staff but not for doctors, so
doctors were never forced to change a temporary password.

**6. Destructuring a changed return shape.**
`files.open` returns `{ meta, object }`; the AI route did
`stored.body.arrayBuffer()`. 500 in production, no test covered that line.

**7. Cost from an unexamined library behaviour.**
Splitting a PDF one page at a time made pdf-lib copy shared fonts and images
into every page — 382 KB per page from a 2 MB document, **₹314 per
document**. Fixed by grouping 5 pages per call.

**8. Duplicate object keys.**
A `return {}` had `ok:` twice; the second silently won. Caught by reading,
not by a test.

**9. Advertising what does not exist.**
Six features were on the pricing screen with no implementation. Now guarded
by `test/plans.test.js`.

**10. Tests written but never run.**
`fhir.test.js` and `plans.test.js` existed for days without being in
`npm test` — 45 assertions that had never executed. → Check `package.json`
lists every file in `test/`.

**11. CSS specificity hiding content.**
`.auth-brand { color: #fff }` written for the dark rail also won on a pale
panel. The word "TCOS" was present, correctly sized, and invisible.

**12. Defaults that make a working screen look broken.**
The Money screen opened on the current month; all data was from the previous
one, so it showed a page of zeroes.

**13. Original and extracted page numbers are different.**
`pdf-lib` turns original page 7 into page 1 of a one-page chunk. The extraction
prompt still said “read page 7”, so the model correctly returned no values.
Every chunk now carries an explicit attached-page → original-page map, guarded
by tests and a live report run.

**14. Two clients resolving one API in different ways.**
The doctor client discarded stale browser overrides on public pages, but the
admin client did not and staging admin defaulted to production. Both clients
now select staging from the Pages hostname and remove public overrides.

**15. One application exposed through two hostnames.**
The staging platform console is reachable through both the Pages hostname and
the canonical owned hostname. Cloudflare Access now protects `/admin*` on
both `tcos-staging.pages.dev` and `staging.tcos.tharigopula.com`, using the
exact-email `Tharigopula platform owner` allow policy and a six-hour session.
Cookie-free HTTP checks return `302` plus the `Cloudflare-Access`
authentication challenge for both admin destinations, while the public
doctor sign-in returns `200`. Independent phishing-resistant MFA and recovery
enrollment are still pending and are not represented as complete.

---

## 16. Suggested review priorities

1. **Tenant isolation** — read every query in `repo.js` and confirm the
   `doctor_id` scope. `patients`, `messages` and `abdm_care_contexts` are the
   risky ones because they touch shared rows.
2. **`messaging.js` ordering** — consent → wording → claim → quota →
   deliver. Confirm a failure at each step leaves recoverable state.
3. **`quota.js`** — reservation and release. Confirm a failed AI run does not
   permanently consume allowance.
4. **`billing.js`** — gap-free invoice numbering under concurrency.
5. **`ai.js` `mergePages` / `dedupeRows`** — the merge is where a lab value
   could be silently lost or duplicated.
6. **Integer paise** — grep for any float arithmetic on money.
7. **Every `catch` that swallows** — this codebase's failure mode is silence.

---

*Verified 9 September 2026 against the running code, staging services and the production
database. Any number in this document can be re-derived from the repo; none
of it is recalled.*
