# Phase 3 — Security + IAM: production access hardening

**Execution date:** 9 September 2026  
**Status:** Same-origin session and Access code complete; staging cloud
activation remains before the phase can be closed for production.
**Architecture rule:** no change to tenant, patient, specialty, organization,
subscription or clinical-record ownership.

## Conflict review

### Conflict 1 — approved artifacts are not in version control

**CONFLICT**  
The assignment names nine approved sources, but only the Product Constitution
attachment and three derived project reports could be located.

**WHY IT EXISTS**  
Earlier design work was retained in chat/attachment storage rather than the
repository. A fresh clone cannot reproduce the complete decision context.

**OPTIONS**  
1. Stop all safety work until every artifact is recovered.  
2. Recreate the missing documents from code.  
3. Continue only architecture-neutral, independently provable security fixes
and record the missing sources.

**RECOMMENDATION**  
Option 3. Never invent an “approved” artifact from the current code.

**IMPACT**  
Rate limiting, challenge verification, session revocation and data minimisation
can proceed. Permission redesign, organization hierarchy and break-glass scope
cannot be finalized from undocumented assumptions.

### Conflict 2 — secure cookies required a different staging boundary

**CONFLICT**  
The desired session target is a Secure, HttpOnly, SameSite cookie, while the
web app is on `pages.dev` and the API is on `workers.dev`.

**WHY IT EXISTS**  
Those are different sites. A cross-site cookie would require `SameSite=None`,
credentials-enabled CORS and CSRF controls, weakening the intended boundary.

**OPTIONS**  
1. Use a cross-site cookie now.  
2. Keep bearer sessions temporarily.  
3. Put app and API on same-site Tharigopula hostnames, then migrate to
HttpOnly cookies with CSRF protection and a compatibility window.

**RECOMMENDATION**  
Option 3. Serve the allow-listed browser build and API from one Worker custom
domain. Keep the production bearer path behind a server-side compatibility
switch until an independently verified production cutover.

**IMPACT**  
Staging is configured for `staging.tcos.tharigopula.com`, host-only HttpOnly
cookies and exact-origin CSRF. Production remains unchanged and its
script-readable bearer storage remains an explicit release risk.

### Conflict 3 — phishing-resistant admin MFA needs an identity decision

**CONFLICT**  
The Constitution requires phishing-resistant MFA, but the current platform
admin identity is application password only and the approved Permission Model
is absent.

**WHY IT EXISTS**  
Implementing TOTP would satisfy “two factors” but not the stronger
phishing-resistant requirement. Passkeys or Cloudflare Access require recovery,
device enrollment and owner lockout policy.

**OPTIONS**  
1. Add TOTP quickly.  
2. Add WebAuthn/passkeys in TCOS.  
3. Protect a same-site platform-console hostname with Cloudflare Access and
validate its identity assertion at the Worker, retaining application RBAC.

**RECOMMENDATION**  
Option 3 for platform operators; use passkeys as the Access authentication
method. Keep clinic-user MFA as a later, role-sensitive capability.

**IMPACT**  
Admin MFA activation is deferred until the console has an owned hostname and
the owner recovery policy is approved. Production platform administration must
not be declared Phase-3-complete before this gate.

## 1. Objective

Protect doctor, staff, application, password-recovery and platform-admin entry
points against automated abuse; ensure changed credentials terminate old
sessions; minimize unneeded access metadata; and define the safe route to
phishing-resistant admin access and HttpOnly sessions.

## 2. Scope

- Doctor/staff sign-in and doctor password recovery.
- Platform admin sign-in and one-time bootstrap.
- Public doctor applications and clinic appointment requests.
- Edge rate-limit bindings and server enforcement.
- Optional Cloudflare Turnstile rendering and mandatory Siteverify validation
when enforcement is enabled.
- Session invalidation after owner/staff password change or reissue.
- Access-boundary logging, error and retry behavior.
- Removal of raw appointment source IPs that have no operational use.
- Same-origin staging UI/API delivery from an allow-listed static build.
- Host-only HttpOnly clinic/admin cookies with hashed CSRF state.
- Cryptographic Cloudflare Access assertion verification for all `/admin`
  pages and APIs, bound to the application RBAC email.
- Security traceability and production activation gates.

## 3. Out of scope

- Changes to clinical access, patient consent, tenant boundaries or specialty
packs.
- Patient account authentication (separate identity/consent phase).
- Final break-glass clinical access.
- Production domain/cookie migration.
- Cloudflare Access enrollment and recovery rehearsal.
- WAF dashboard rules beyond in-code Workers rate-limit bindings.
- Legal certification or a claim of regulatory compliance.

## 4. Personas

- Practice owner doctor.
- Practitioner in a multi-doctor practice.
- Front desk, pharmacist and clinical assistant.
- Applicant doctor without an account.
- Patient asking a clinic for an appointment.
- Tharigopula owner/admin/support/finance/viewer.
- Security/operations responder.
- Automated attacker, credential stuffer and form spammer.

## 5. User stories

- As a clinic user, I receive the same non-enumerating sign-in response whether
the account or password is wrong.
- As a legitimate user, I am told when to retry instead of seeing a generic
failure after excessive attempts.
- As a doctor resetting a password, every session opened with the old owner
credential stops immediately while staff remain working.
- As a staff member whose password is reset, my old sessions stop immediately.
- As an applicant or platform operator, I can complete a managed human
challenge when automated abuse protection is enabled.
- As an operator, I can distinguish rate-limit rejection, challenge rejection
and challenge-service failure without seeing a mobile, email or patient name.
- As a patient, my network address is not retained when the product never uses
it.

## 6. Detailed workflows

### Clinic sign-in

1. Browser gets `/security/challenge` configuration.
2. If enabled, it renders Turnstile with action `clinic_signin`.
3. Browser submits identifier, password and single-use token.
4. Worker normalizes the identifier and builds a private digest; a second
digest bounds attempts sprayed across many identifiers from one source.
5. `AUTH_RATE_LIMITER` allows both checks or returns 429 with `Retry-After: 60`.
6. When enabled, Worker calls Siteverify and checks success, action and exact
app hostname.
7. Existing constant-message credential verification runs.
8. On secure staging, Worker stores the session and CSRF hashes, returns the
CSRF value and sets the session only as a host-only HttpOnly cookie. Legacy
production continues returning the opaque token while compatibility is on.
9. Challenge resets after every submission.

### Same-origin browser session

1. The custom Worker hostname serves the allow-listed `dist/` assets and APIs.
2. Sign-in rotates to a new opaque session and independent CSRF value.
3. JavaScript receives only the CSRF value; the credential is HttpOnly.
4. Every unsafe cookie-authenticated request must carry the exact configured
origin and matching `X-CSRF-Token`.
5. The server stores hashes only and clears the cookie on sign-out.
6. When cookie enforcement is enabled, a readable bearer header is ignored.

### Platform Access boundary

1. Cloudflare Access authenticates the operator before `/admin` reaches TCOS.
2. TCOS verifies assertion signature, issuer and application audience.
3. The verified Access email is overwritten into an internal request header.
4. Admin password/session and application RBAC still run as an independent
inner door; their email must match the Access identity.

### Password reset

1. Reset-start follows the rate-limit and `password_reset` challenge flow.
2. Response remains non-enumerating.
3. Existing OTP delivery limit and five-attempt verification remain authority.
4. New password hash and revocation of every owner session commit in one D1
transaction.
5. Staff sessions are preserved because they use separate credentials.

### Staff password change/reissue

1. Actor proves the current password, or owner issues a temporary password.
2. Password update and all sessions for that exact staff user are changed in
one D1 transaction.
3. Self-change removes the browser's now-invalid token and returns to sign-in.
4. Reissue sets `must_change_password=1`.

### Platform sign-in/bootstrap

The independent admin limiter runs first, then the `platform_signin` or
`platform_bootstrap` challenge, then existing admin credential/RBAC handling.
Clinic tokens remain unusable on platform routes.

Both sign-in workflows then use an exact D1 failed-credential backstop keyed by
a digest of purpose + normalized identifier + Cloudflare source address. Four
failures remain retryable; the fifth starts a five-minute clinic-user block or
fifteen-minute platform-admin block. A valid sign-in clears only that exact
identifier/source pair. This avoids a global account-lockout attack while
making the credential limit deterministic when the edge limiter admits a burst.

### Public application and booking

Doctor applications use a normalized mobile digest, independent public limit
and `doctor_application` challenge. Public appointment requests use a
clinic+mobile digest plus the existing exact per-mobile/day D1 limit. Raw source
IP is no longer persisted.

## 7. State transitions

| Entity | From | Event | To |
|---|---|---|---|
| Rate-limit budget | available | request accepted | decremented at edge |
| Rate-limit budget | exhausted | request attempted | rejected 429; refills after 60 seconds |
| Credential failures | 0–4 in window | wrong password | incremented |
| Credential failures | 4 in window | fifth wrong password | source-pair blocked; rejected 429 |
| Credential failures | present | valid sign-in | exact source-pair row removed |
| Credential throttle | older than 24 hours | nightly retention sweep | removed |
| Challenge | disabled | config read | no-op |
| Challenge | rendered | token solved | token available |
| Challenge | token available | submitted/expired/error | reset; token unavailable |
| Server verification | pending | valid success+action+hostname | verified |
| Server verification | pending | invalid/expired/replayed | rejected 400 |
| Session | active | credential changed/reissued | revoked |
| Session | active | TTL passes | expired |
| Staff account | temporary password | successful self-change | permanent password; sessions revoked |

## 8. Business rules

1. No readable identifier or source address is used as a Cloudflare
rate-limit key or security log field.
2. Edge rate limiting is not usage accounting and may be locally approximate;
credential rejection is additionally enforced by an exact D1 backstop.
3. A rate-limit infrastructure error fails open with a structured error event
to preserve clinic continuity. An explicit exhausted verdict never fails open.
4. Turnstile is off unless `TURNSTILE_ENFORCE=true`.
5. Once enforcement is true, missing site/secret keys fail closed.
6. Rendering without server verification never counts as protected.
7. Action and hostname must match exactly.
8. Password mutation and old-session revocation are one transaction.
9. Owner password changes do not revoke staff sessions; staff changes do not
revoke another person or another clinic.
10. Public booking retains no source IP without a stated purpose and retention
period.
11. Failed-credential state uses only a one-way digest of purpose, normalized
identifier and source; raw identifiers and source addresses are not persisted.
12. Throttling is per identifier/source pair, not a global account lock, so an
attacker cannot deny access from every other connection by knowing a mobile.
13. Nonexistent accounts perform equivalent password-hash work before the
generic rejection to reduce timing enumeration.
14. A `__Host-` session cookie has no Domain attribute and always uses
`Path=/`, `HttpOnly`, `Secure` and `SameSite=Strict`.
15. Access enforcement fails closed if issuer/audience configuration is absent
or the signed assertion is missing, expired or intended for another app.

## 9. Data model changes

Migration `045-access-security.sql` clears historical
`appointment_requests.source_ip`. The nullable legacy column remains to avoid a
risky SQLite table rebuild. Migration `046-auth-throttles.sql` adds the
operational `auth_throttles` table keyed by `(scope, key_hash)`, with failure
count, window start, block expiry and update time. It stores no raw identifier
or source address and its rows expire after 24 hours. Migration
`047-secure-browser-sessions.sql` adds nullable `csrf_hash` to clinic and admin
sessions. No identity, tenant or clinical table is added.

## 10. APIs

| API | Change |
|---|---|
| `GET /security/challenge` | New; returns `{enabled, siteKey}`; never secret key |
| `POST /auth/signin` | Accepts optional `turnstileToken`; rate limited |
| `POST /auth/reset/start` | Accepts optional `turnstileToken`; rate limited |
| `POST /auth/reset/verify` | Rate limited in addition to exact OTP attempts |
| `POST /admin/signin` | Accepts optional `turnstileToken`; separate tight limit |
| `POST /admin/bootstrap` | Accepts optional `turnstileToken`; separate tight limit |
| `POST /apply` | Accepts optional token; normalized mobile; rate limited |
| `POST /clinic/:slug/request` | Rate limited by clinic+mobile digest; no raw IP write |

On cookie-enforced hosts, clinic/admin sign-in responses do not contain a
bearer credential. They set the protected cookie and return `csrfToken`.

429 responses include error code `too_many` and an accurate `Retry-After`
value: normally 60 seconds for an edge budget, five minutes for clinic
credentials and fifteen minutes for platform-admin credentials.

## 11. Events

- `security_rate_limited` — warning; scope only.
- `security_rate_limiter_unavailable` — error; scope and provider error only.
- `credential_failures_blocked` — warning; authentication scope only.
- `turnstile_misconfigured` — error; action only.
- `turnstile_verification_unavailable` — error; action and provider error.
- `turnstile_rejected` — warning; action, returned action, hostname-match
boolean and provider error codes.
- Existing successful sign-in/password/audit events remain.

No event contains the submitted email/mobile, token, password, challenge secret
or source IP.

## 12. Permissions

- Challenge configuration: unauthenticated read, public site key only.
- Sign-in/reset/application/booking: unauthenticated by definition, protected
by limiter/challenge and existing workflow validation.
- Password self-change: any authenticated clinic actor, only their credential.
- Staff reissue: existing `CAN.TEAM` server gate.
- Admin session and role model: unchanged and separate from clinic sessions.

## 13. Screens/components

- Doctor sign-in: challenge slot and safe text-only message rendering.
- Password reset: independent challenge slot.
- Landing-page application: challenge slot.
- Platform sign-in and bootstrap: independent challenge slots.
- Shared `js/security-challenge.js`: dynamic explicit rendering, token retrieval,
expiry/error handling and reset.
- Appointment request: no challenge yet because custom clinic hostnames cannot
all be placed on one hostname-bound widget; server rate controls remain.

## 14. Integrations

- Cloudflare Workers Rate Limiting bindings: three independent namespaces for
clinic auth, admin auth and public intake; separate production/staging IDs.
- Cloudflare Turnstile Siteverify: five-second network timeout, secret only in
Worker secrets.
- Cloudflare Static Assets: allow-listed `dist/` served on the staging Worker.
- Cloudflare Access: Worker independently verifies the signed JWT against the
team issuer and application audience; activation remains a staging cloud gate.
- `jose`: standards-based JWK retrieval and JWT signature/claim validation.
- D1: session transactions, exact sign-in failure throttles and existing exact
OTP/public-request limits.
- No change to OpenAI, Razorpay, R2, SMS, email or WhatsApp.

## 15. Automations

- Edge budgets refill automatically each 60-second period.
- Failed sign-ins deterministically block the exact identifier/source pair on
the fifth failure; valid sign-in clears that pair.
- The nightly scheduled job removes throttle metadata older than 24 hours.
- Browser resets challenge after every attempted submit.
- Session revocation is automatic in the credential transaction.
- No human must clear an old session after password reset.
- Alert routing from structured security events remains to be configured in
Cloudflare observability.

## 16. Notifications

- User sees an actionable wait-and-retry message on 429.
- User sees “complete security check” when unsolved and “expired/could not be
verified” for invalid tokens.
- Operator events distinguish rejection from infrastructure failure.
- Email/SMS “new sign-in” notifications are deferred pending the approved
communications policy and verified providers.

## 17. Edge cases

- Same identifier used for sign-in and reset has separate budgets because the
purpose is part of its digest.
- Same mobile asks two clinics for appointments: clinic slug separates budgets;
the existing daily mobile ceiling remains.
- Cloudflare limiter binding absent locally: request proceeds and tests remain
offline-capable.
- Limiter throws: request proceeds, degraded event emitted.
- Turnstile token replay/wrong action/wrong hostname/expiry: rejected.
- Turnstile enabled with half configuration: protected forms fail closed.
- Password-change revocation fails: password update rolls back.
- Doctor changes password while staff serve patients: staff stay active.
- Staff reset does not affect the owner or another staff member.
- A known mobile cannot be globally locked by failures from one connection.
- Distributed source addresses remain bounded by the edge identifier budget and
Turnstile once enforcement is activated.

## 18. Empty states

- Challenge disabled: its container is hidden and existing forms behave as
before.
- No active session: ordinary sign-in screen.
- No Turnstile key while disabled: no warning because rollout is deliberately
off.

## 19. Error states

- 400: challenge missing, expired, wrong action or wrong hostname.
- 401: generic wrong credentials; no account discovery.
- 429: exhausted edge budget; retry header included.
- 503: challenge enforcement configured but unavailable/misconfigured.
- Offline browser: existing “could not reach API/security check” guidance.
- Unknown server failure: generic 500; internals stay in structured logs.

## 20. Security controls

- SHA-256 purpose-separated identifier and source limiter keys.
- Exact D1 failed-credential backstop with digested identifier/source pair,
bounded retention and no global account lock.
- Separate admin and clinic/public budgets.
- Server-side challenge verification, action binding and hostname binding.
- Five-minute/single-use semantics enforced by Turnstile.
- Opaque 256-bit sessions; only hashes in D1; 12-hour TTL.
- Atomic credential change/session revocation.
- Password pepper rotation preserved.
- Non-enumerating credential and reset responses.
- Server RBAC and tenant isolation unchanged.
- No raw source-IP retention for appointment requests.
- Browser error text inserted with `textContent`, closing a reflected/stored
HTML path on the sign-in page.

## 21. Audit requirements

- Successful sign-in/password reset/change continue to use `audit_events`.
- Security rejection telemetry is operational, not a clinical audit record.
- Never place credentials, tokens, OTPs, challenge payloads or identifiers in
audit detail.
- Future MFA enrollment/removal/recovery and support-access grants must be
immutable audited events.

## 22. Compliance considerations

- Data minimisation aligns with the DPDP Act principle: no indefinite network
address storage without purpose.
- Authentication telemetry must remain purpose-limited and have a retention
schedule before export to a SIEM.
- Turnstile sends challenge/connection data to Cloudflare; privacy notice and
processor inventory must name it before production enforcement.
- This phase does not establish ABDM certification, medical-device status or
legal compliance; counsel/DPO review remains required.

## 23. Analytics events

Allowed aggregate dimensions: event name, form action, environment, outcome,
HTTP status, latency bucket and timestamp. Forbidden dimensions: raw identifier,
patient/doctor name, password/OTP/token, report content and full IP.

KPIs: challenged requests, solve/rejection rate, 429 rate, verifier failures,
successful sign-ins, resets and revoked-session counts. Product analytics must
not reuse security identifiers.

## 24. Monitoring

Create alerts for:

- any `turnstile_misconfigured` in an enforced environment;
- verifier-unavailable rate over 1% for five minutes;
- admin limiter rejections above baseline;
- clinic sign-in 429 surge by environment;
- `credential_failures_blocked` surge by scope;
- session revocation transaction failures;
- unexpected challenge disabled state in production.

Dashboards and notification destinations are infrastructure activation work;
the code emits stable event names now.

## 25. Testing strategy

- Unit: key privacy/stability/purpose separation; edge allow/reject/degraded
limits; deterministic fifth-failure block, source isolation, success clear and
retention sweep; challenge enabled/disabled, form payload, action mismatch and
missing token.
- Transaction: owner and staff password/session updates; forced revocation
failure proves rollback.
- Static contract: all target routes call controls; all five browser forms
render challenges; safe message rendering; both environments declare bindings.
- Regression: tenant isolation, capabilities, onboarding, pepper rotation,
publish allow-list and full suite.
- Deployment: Wrangler dry run with the exact config; staging challenge tests
after keys are created; production remains blocked.

## 26. Acceptance criteria

- [x] Seven abusive endpoint classes have server-side rate controls.
- [x] No readable mobile/email is a limiter key or security log field.
- [x] Explicit rejection returns 429 and a retry time.
- [x] Limiter infrastructure failure preserves clinical availability and logs.
- [x] The fifth wrong credential is rejected deterministically even when the
edge limiter admits a burst.
- [x] One hostile source cannot globally lock a clinic account.
- [x] Successful authentication clears only its exact failure state.
- [x] Five TCOS-owned account forms have client and server Turnstile wiring.
- [x] Turnstile verifies success, action and exact app hostname.
- [x] Password mutation revokes exact old sessions atomically.
- [x] Owner and unrelated staff/clinic sessions remain correctly separated.
- [x] Raw appointment source IP write removed and old values have a migration.
- [x] Sign-in server messages are no longer inserted as HTML.
- [x] Security tests, core regressions, public build and Worker dry run pass.
- [x] Same-origin static app/API and host-only cookie/CSRF path implemented.
- [x] Cloudflare Access assertions are signature/issuer/audience checked and
bound to the inner platform member email.
- [x] Turnstile keys created and enforcement proved on staging.
- [x] Cloudflare Access outer gate protects `/admin*` on both the Pages and
canonical staging hostnames with an exact-owner-email allow policy.
- [ ] Same-site console protected by phishing-resistant MFA. Biometrics and
  security-key enrolment remain an owner-controlled Cloudflare action.
- [x] Same-site HttpOnly session migration proved against the deployed staging
hostname.

## 27. Definition of done

Repository implementation is done when all checked criteria pass and the exact
commit is pushed. Phase 3 production completion additionally requires the
remaining unchecked infrastructure criterion, a staging lockout/recovery rehearsal,
and an owner-approved recovery policy. Until then, release status is “staging
security rollout,” not “production IAM complete.”

## 28. Migration impact

- New migrations: `045-access-security.sql`, `046-auth-throttles.sql`,
  `047-secure-browser-sessions.sql` and `048-admin-reauthentication.sql`.
- It is idempotent in effect: all non-null legacy source IPs become null.
- No table rebuild, index or lock-heavy transformation.
- Migration 046 creates one small operational table and retention index; no
clinical data or tenant ownership changes.
- Migration 047 adds two nullable hash columns; existing sessions stay valid in
compatibility mode and gain no readable CSRF value.
- Migration 048 adds a separate reauthentication timestamp. Destructive admin
  actions require a password proof no more than five minutes old.
- Staging and production both have all 48 migrations. Production's legacy
  ledger was baselined through 035 only after a verified export and full schema
  audit; 036–048 were rehearsed on that export before remote application.

## 29. Future extensibility

- Same-site custom hostnames permit HttpOnly cookies and CSRF tokens.
- Cloudflare Access assertions/passkeys can wrap platform routes without
changing clinic RBAC.
- Organization-aware MFA policy can require stronger factors for owners,
prescribers and finance roles.
- Device/session inventory can add named devices, last use and remote revoke.
- Approved break-glass can add bounded scope, two-person approval, reason,
expiry, prominent clinic notification and immutable audit.
- Security events can move to Analytics Engine/SIEM without adding PII.

## Major-function traceability

| Requirement | User | Workflow | Screen | API | Data | Permission | Event | Test |
|---|---|---|---|---|---|---|---|---|
| Stop credential stuffing | Clinic user | Sign-in | Doctor sign-in | `POST /auth/signin` | Rate-limit namespace; digested D1 failure row; session hash | Public pre-auth | `security_rate_limited`, `credential_failures_blocked` | `test/security.test.js` |
| Protect owner console | Platform operator | Admin sign-in | Platform gate | `POST /admin/signin` | Independent limiter; digested D1 failure row; admin session | Public pre-auth then platform RBAC | limiter/Turnstile events, `credential_failures_blocked`, `admin_sign_in` | security + platform tests |
| Stop application spam | Applicant | Create account | Landing form | `POST /apply` | Normalized mobile/application | Public pre-auth | limiter/Turnstile + existing audit | security + onboarding tests |
| Stop booking spam | Patient | Request callback | Clinic page | `POST /clinic/:slug/request` | Existing exact daily cap; no source IP | Public pre-auth | limiter event | security + appointment tests |
| Verify human challenge | All account actors | Solve then submit | Five form slots | `GET /security/challenge`, protected POSTs | No secret/client state in D1 | Public pre-auth | Turnstile events | security tests |
| End sessions after reset | Doctor | OTP → new password | Reset form | `POST /auth/reset/verify` | Doctors + owner sessions in one batch | Verified OTP | `password_reset` | security + OTP tests |
| End staff old sessions | Staff/owner | Change/reissue | Forced-change/team | change/reset APIs | Clinic user + exact sessions in one batch | Self or `CAN.TEAM` | password audit | security + staff tests |
| Prevent HTML session theft | Clinic user | Error/welcome render | Sign-in | n/a | n/a | n/a | n/a | static security test |

## Dependency-safe work packages

### Work package 3.1 — governance baseline

**PURPOSE**  
Identify which approved sources are actually reproducible.

**DEPENDENCIES**  
Constitution attachment, alignment report, state report and repository history.

**DATABASE**  
None.

**BACKEND**  
None.

**FRONTEND**  
None.

**SECURITY**  
Prevents code from silently becoming policy.

**TESTS**  
Manual inventory and attachment SHA-256.

**ACCEPTANCE CRITERIA**  
Source register exists and missing artifacts are explicit. **Complete.**

### Work package 3.2 — abuse controls

**PURPOSE**  
Bound credential and public-form automation before expensive work.

**DEPENDENCIES**  
Current identifier normalization and Cloudflare Workers.

**DATABASE**  
Existing OTP and appointment daily caps retained. Migration 046 adds exact,
short-lived failed-credential rows without clinical data.

**BACKEND**  
Private keys, three limiter bindings, seven guarded endpoint classes, exact D1
sign-in backstop, timing work for unknown accounts, 429 metadata and structured
failure events.

**FRONTEND**  
Existing API error display handles actionable message.

**SECURITY**  
No raw identifier/source in limiter, D1 or log; independent admin budget;
identifier/source pairing avoids hostile global lockout; fail-open only for
edge-provider failure, never explicit exhaustion or D1 block.

**TESTS**  
Allow, reject, degraded, exact fifth failure, source separation, success clear,
retention, privacy, timing-work, config and route coverage.

**ACCEPTANCE CRITERIA**  
All automated checks pass. **Complete.**

### Work package 3.3 — managed human challenge

**PURPOSE**  
Escalate from throttling to bot resistance without making the browser trusted.

**DEPENDENCIES**  
WP3.2 and owned app hostname.

**DATABASE**  
None.

**BACKEND**  
Challenge config, Siteverify, action/hostname checks, timeout, safe errors.

**FRONTEND**  
Reusable explicit-render adapter and five form integrations.

**SECURITY**  
Secret server-only; rollout switch; fail-closed configuration; token reset.

**TESTS**  
Disabled/enabled, success, wrong action, missing token and static UI coverage.

**ACCEPTANCE CRITERIA**  
Code complete; staging activation and live replay test **pending owner Cloudflare
widget/secret creation**.

### Work package 3.4 — credential/session consistency

**PURPOSE**  
Make “change/reset password” mean old access is over now.

**DEPENDENCIES**  
Existing opaque sessions and D1 batch transactions.

**DATABASE**  
Atomic update+revoke; no schema addition.

**BACKEND**  
Owner-only and exact-user revocation boundaries.

**FRONTEND**  
Clear now-dead self-change token before reload.

**SECURITY**  
No cross-staff/cross-clinic revocation; rollback on failure.

**TESTS**  
Owner, staff, unrelated account and forced-failure transaction cases.

**ACCEPTANCE CRITERIA**  
All tests pass. **Complete.**

### Work package 3.5 — minimisation and injection closure

**PURPOSE**  
Remove data with no purpose and close a sign-in HTML injection path.

**DEPENDENCIES**  
WP3.2 booking limit.

**DATABASE**  
Migration 045 clears raw source IP.

**BACKEND**  
Stop accepting/storing booking IP; normalize application mobile.

**FRONTEND**  
Render sign-in messages with `textContent`.

**SECURITY**  
Less retained personal data and less token-theft surface.

**TESTS**  
Static regression plus onboarding suite.

**ACCEPTANCE CRITERIA**  
No booking IP write and no sign-in server text in `innerHTML`. **Complete.**

### Work package 3.6 — same-site sessions and admin MFA

**PURPOSE**  
Remove script-readable tokens and enforce phishing-resistant operator identity.

**DEPENDENCIES**  
Owned app/API/console hostname and Cloudflare Access configuration. Existing
platform RBAC remains authoritative inside the Access perimeter.

**DATABASE**  
Migration 047 adds only hashed CSRF state to clinic/admin sessions. Device
inventory is deliberately deferred.

**BACKEND**  
Cookie issue/expiry, exact-origin CSRF, Access assertion signature/issuer/
audience verification, and Access-email/RBAC-email binding.

**FRONTEND**  
Cookie-enforced staging stores no bearer token; both clients include cookies
and attach the non-secret CSRF value to unsafe calls. Old Pages staging links
redirect without losing path, query or patient-link fragment.

**SECURITY**  
HttpOnly/Secure/SameSite Strict host-only cookies; the Access outer gate is
active on both staging hostnames. Its phishing-resistant factor and recovery
enrollment remain cloud activation work.

**TESTS**  
Cookie flags, bearer rejection, CSRF origin/token failure, migration, signed
Access JWT, wrong audience, static admin-path ordering and browser clients.

**ACCEPTANCE CRITERIA**  
Repository, staging session and Access outer-gate configuration are complete.
Independent phishing-resistant MFA/recovery and bypass tests remain before
this package is operational; production migration remains a separate gate.

## Independent quality review

### Product

Rate limiting is invisible during normal work and gives a clear retry time.
The first implementation risked adding controls without a human challenge;
Turnstile wiring was added behind a safe rollout switch. Appointment requests
retain their existing daily limit so abuse control is layered.

### Healthcare workflow

A transient limiter outage must not lock a clinic out during patient care;
provider failures therefore degrade with alerts. An explicit abuse verdict is
still enforced. Owner password changes preserve staff continuity. These are
intentional clinical-availability decisions, not generic SaaS defaults.

### Engineering

Controls are centralized, purpose-separated and independently tested. D1
transaction rollback is proved with a forced failure. Wrangler dry-run resolves
all three bindings. Edge rate limiting remains locally approximate, so sign-ins
now also have a deterministic D1 failure boundary. Exact OTP/booking limits
remain secondary boundaries where money or public writes occur.

### Security

Material fixes: brute-force/spam brake, server-side bot verification, token
revocation, raw-IP removal, safe message rendering, HttpOnly staging sessions,
CSRF validation and signed Access-identity verification. Material residual
risks: production localStorage bearer sessions, Access without independently
enforced phishing-resistant MFA/recovery, no strict CSP, and no finalized
break-glass model. None are mislabeled complete.

### UX

Challenges are hidden when disabled and reuse existing forms when enabled.
Every attempted submit resets single-use state. Errors explain completion,
expiry, outage or wait time. A live mobile/accessibility review of the rendered
Turnstile component remains part of staging activation.

## Phase 3 completion report

### Completed

- Source-of-truth inventory and conflict record.
- Three production/staging Workers rate-limit bindings.
- Seven protected endpoint classes with private digest keys.
- Exact failed-credential throttling with source isolation, timing-work for
unknown accounts and 24-hour metadata retention.
- Server-verified, action/hostname-bound Turnstile integration for five account
forms, deployed and live-proved on staging.
- Atomic owner/staff credential and session revocation.
- Sign-in HTML injection closure.
- Application mobile normalization.
- Raw appointment source-IP collection removed and migration supplied.
- Same-origin Worker static delivery, host-only HttpOnly cookies and CSRF.
- Signed Cloudflare Access JWT verification bound to platform RBAC identity.
- Staging Cloudflare Access application with a six-hour session, exact-owner
email allow policy and `/admin*` protection on both the Pages and canonical
hostnames; anonymous HTTP probes proved both return the Access challenge while
the public doctor sign-in remains available.
- 62 dedicated security/session assertions plus affected regression suites and
safe build/dry run.

### Deferred

- Production Turnstile activation after the staging soak and privacy notice.
- Cloudflare Access phishing-resistant MFA enforcement, recovery and
destructive-action reauth.
- Break-glass support access until Permission Model and two-person policy exist.
- Security alert destinations and operator runbook.

### Rejected

- TOTP as a shortcut for a phishing-resistant requirement.
- Cross-site `SameSite=None` session cookie as the final architecture.
- Storing/logging raw identifiers or IP addresses for throttling.
- Silent fail-open Turnstile misconfiguration.

### Technical debt

- Production browser sessions remain in `localStorage` pending its own
same-origin cutover; staging code rejects bearer substitution when enabled.
- Strict CSP remains blocked by inline scripts/styles and third-party fonts.
- Legacy nullable `source_ip` column remains until a safe table rebuild.
- Rate-limit provider failure currently alerts only through structured logs.

### Open risks

- Password-only platform owner.
- Script-readable bearer session if any remaining XSS exists.
- Production migration ledger is still unsafe and production cannot receive
045 or 046.
- Missing approved governance artifacts make future architecture changes unsafe.

### Architecture decisions added

- AD-SEC-001: rate limits use purpose-separated digest keys; no raw identity.
- AD-SEC-002: edge limiter failure preserves clinic availability and alerts.
- AD-SEC-003: Turnstile enforcement is explicit and server-verified.
- AD-SEC-004: credential change and old-session revocation are one transaction.
- AD-SEC-005: platform MFA target is passkey-backed Cloudflare Access on an
owned same-site console hostname.
- AD-SEC-006: final browser session target is same-site HttpOnly cookie + CSRF,
not a cross-site compatibility compromise.
- AD-SEC-007: exact credential throttling is per normalized-identity/source
digest, not a global account lock; rows expire after 24 hours.
- AD-SEC-008: staging UI and API share one Worker custom domain; only an
allow-listed static build is served.
- AD-SEC-009: every platform route requires both a verified Access identity
and matching application account/RBAC identity when enforcement is enabled.

### Requirements passed to next phase

1. Enroll recovery; enforce phishing-resistant MFA on the active platform
   Access gate and test bypass paths.
2. Complete mobile/accessibility QA for the live Turnstile component.
3. Plan the controlled production Turnstile rollout and privacy notice.
4. Add device/session management and destructive-action freshness in a later
identity package.
5. Import the missing approved architecture documents into version control.
6. Baseline production migration history before any production change.
