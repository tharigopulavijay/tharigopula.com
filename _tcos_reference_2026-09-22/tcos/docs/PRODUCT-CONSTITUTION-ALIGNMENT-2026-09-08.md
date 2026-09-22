# TCOS constitution alignment and delivery plan

**Reviewed:** 8 September 2026  
**Release branch:** `codex/production-hardening`  
**Purpose:** turn the Clinical OS product constitution into an executable,
traceable delivery program. This document reports the code as it exists; it
does not treat the constitution's aspirations as completed features.

## Product decision

TCOS remains **one clinical kernel with configurable specialty packs**.
AyurCOS, HomeoCOS and AlloCOS are market-facing contexts inside the same
codebase, patient identity layer and medicine catalogue. They may reorder or
preselect a system of medicine, but they do not hide the shared catalogue or
fork the platform. Clinical records remain practice-scoped and cross-practice
history requires explicit patient consent.

This is aligned with the constitution. No architecture reversal is proposed.

## Alignment scorecard

| Constitution area | Current state | Release meaning |
|---|---|---|
| One core + specialty packs | **Aligned** | Three contexts resolve from configuration, not separate apps. |
| Tenant isolation | **Strong, not finished** | Clinical SQL is scope-scanned; remaining shared-patient and admin paths still need adversarial review. |
| Practitioner identity | **Aligned for issuing flows** | Visits, timeline and prescriptions name the signed-in practitioner. |
| RBAC/ABAC | **Strong role/capability base** | Server gates exist; field-level scope and break-glass policy remain. |
| Clinical safety | **Strong base** | Issued documents are immutable; AI output is isolated until clinician confirmation; visits, prescriptions, follow-ups, reports and consultation confirmation are atomic and retry-safe. |
| Patient identity/consent | **Partial** | Household mobile and consent grants exist; patient accounts, revocation UX and sessionised access remain. |
| Pharmacy/inventory | **Working clinic core** | FEFO receipt/dispense, batches, expiry, quarantine and write-off are atomic and retry-safe; purchase orders, suppliers and recalls remain. |
| SaaS lifecycle | **Payment core on staging** | Hosted checkout, signed webhooks, automatic entitlement, reserve, cancellation and owner monitoring exist. Provider setup and plan changes remain. |
| Owner autopilot | **Partial** | Onboarding, support, cost, delivery and subscription views exist; alerts, reconciliation and runbooks remain. |
| AI | **Safe first workflow** | Report preflight, identity check, page selection, extraction, costing, cleanup and clinician review exist. |
| Interoperability | **Foundation only** | FHIR R4 output and ABHA/HPR/HFR fields exist; ABDM gateway is not connected. |
| Multi-location/hospital | **Future capability packs** | Do not sell these as complete. |
| Integration gateway | **Not yet built** | Provider calls are still product modules; control-plane extraction comes after first stable clinic. |
| Release engineering | **Staging-safe, production blocked** | Guarded deploys and public allow-list exist; production ledger baseline and CI remain mandatory. |

## Automated subscription lifecycle now implemented

```
Doctor chooses plan
  → TCOS creates bounded Razorpay hosted subscription
  → Razorpay collects mandate/payment (TCOS sees no payment credential)
  → signed event reaches TCOS
  → event id is claimed once
  → TCOS fetches current subscription directly from Razorpay
  → one D1 batch records receipt + subscription + audit + entitlement
  → doctor sees paid features immediately when provider state is active
```

Failure handling is automatic: `pending`, `halted` or `paused` opens one
three-day reserve; the nightly sweep falls back to Free after that; no care
record or uploaded file is deleted. A doctor can refresh directly against the
provider if delivery is delayed. Duplicate and out-of-order webhooks do not
double-count or roll back access.

## Gates to the first paid pilot

### Gate A — production safety

- Baseline the existing production migration ledger from a fresh export and
  schema-by-schema comparison. Do not replay migrations blindly.
- Add server-side sign-in and public-form abuse controls; configure Cloudflare
  WAF/Turnstile at the edge.
- Add phishing-resistant MFA for owner/admin and forced reauthentication for
  destructive platform actions.
- Critical clinic writes are now protected: stock receipt/dispense/quarantine/
  write-off, patient registration/linking and numbering, visit save,
  prescription draft/visit-link/issue/follow-up/amendment, invoice
  issue/edit/payment/cancellation, consultation confirmation, lab-report
  save/AI confirmation and appointment-request acceptance. Bulk import still
  needs its own dry-run and idempotency boundary before it is introduced.
- Move browser bearer sessions toward Secure, HttpOnly, SameSite cookies and
  add a strict CSP after removing inline-script/style blockers.
- Rehearse restore, define RPO/RTO, configure error/security alerts, and write
  incident and rollback runbooks.

### Gate B — commercial activation

- Owner creates Razorpay test credentials and a webhook secret directly in
  provider/Cloudflare consoles; secret values never enter source or chat.
- Register the staging webhook for subscription lifecycle and payment events.
- Sync six immutable plan snapshots, complete one test payment, verify instant
  access, replay the webhook, simulate failure/retry, cancel at cycle end and
  confirm reactivation.
- Implement upgrade/downgrade rules for an already-active subscription and
  make prorating behavior explicit before exposing that action.
- Reconcile provider subscriptions/payments nightly and create one actionable
  operations alert for drift.
- Add GST invoice/tax treatment and refund/credit-note policy before real money.

### Gate C — first real clinic

- Complete practitioner certificate upload/review and verification expiry.
- Finish patient account, household selection, consent, revocation and
  short-lived access sessions.
- Complete a role-by-role mobile and desktop acceptance run: owner doctor,
  practitioner, front desk, pharmacist, clinical assistant, platform support,
  finance and owner.
- Complete one specialty workflow per pack and one mixed-system medicine case.
- Publish privacy notice, consent wording, retention schedule, terms, support
  SLA and clinical-AI limitations reviewed for India.

## Delivery order after the safety gates

1. **Identity and consent:** patient accounts, household routing, MFA, session
   hardening and practitioner verification.
2. **Transactional correctness:** preserve the completed clinical/financial
   transaction boundaries and add the same protections to future bulk import
   and provider-reconciliation jobs before exposing them.
3. **Commercial operations:** provider reconciliation, GST/refunds, dunning,
   upgrades/downgrades and owner alerts.
4. **Communication reliability:** Resend, DLT-approved SMS and Meta WhatsApp,
   with consent, templates, delivery receipts and cost attribution.
5. **Clinic growth:** multi-location, richer scheduling, referral/lab/supplier
   adapters, then hospital capability packs behind explicit readiness gates.
6. **Interoperability:** ABDM sandbox/certification and an Integration Gateway;
   keep the clinical kernel free of provider-specific business rules.

## Definition of done for every workflow

A workflow is not complete because a page exists. It is complete only when:

- role and tenant checks occur on the server;
- normal, retry, duplicate, stale and partial-failure paths are tested;
- every clinical/financial state transition is auditable;
- no secret or private source file can enter the public artifact;
- mobile, keyboard, empty, loading, error and recovery states are usable;
- operations can see health, cost and the next required action;
- staging proves the deployed commit against its matching schema;
- rollback and data-retention consequences are known.

## Current release verdict

**Staging is suitable for continued synthetic QA. Production is not yet a
go-live candidate for paid clinics.** The current blocker is not the breadth
of TCOS; it is completing identity, transaction, operations and compliance
boundaries to the same standard as the strongest clinical workflows already
in the codebase.
