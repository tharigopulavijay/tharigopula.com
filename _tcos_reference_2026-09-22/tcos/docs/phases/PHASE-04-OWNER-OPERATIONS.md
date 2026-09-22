# PHASE 04 — OWNER OPERATIONS AND BUSINESS CONTROL

## 1. Objective

Turn the platform admin page into the working TCOS owner console: accountable
support, delegated employee access, payment-owned entitlements, complete
business-cost tracking, useful patient operations and privacy-preserving health
intelligence.

## 2. Scope

- Replace shared demo administration with one real owner identity.
- Give platform employees exact, server-enforced areas of access.
- Make support requests readable conversations with assignment and internal notes.
- Separate communication-provider readiness from delivery claims.
- Record cash costs, imputed owner time, shared allocations and clinic-specific costs.
- Show subscriptions and whether a plan came from payment or a manual override.
- Let the owner inspect a patient's operational footprint without clinical content.
- Show de-identified diagnosis, test and laboratory trends above a safe cohort floor.
- Seed realistic, unmistakably fictional staging examples.

## 3. Out of scope

- Clinical break-glass access to a named patient's notes, medicines or lab values.
- Live Razorpay activation or plan changes within an existing subscription.
- Cloudflare Access policy automation for newly added platform employees.
- Email/SMS notifications for new support messages.
- ICD/SNOMED terminology normalisation and advanced epidemiology.
- Production deployment; this phase is verified on staging first.

## 4. Personas

- Platform owner — sees every owner-console area and delegates work.
- Platform administrator — broad operational access, never owner delegation.
- Support employee — applications, clinic operations, communications and support.
- Finance employee — costs and subscriptions only.
- Reviewer — applications and clinic list only by default.
- Doctor/clinic staff — opens requests and continues their own conversations.

## 5. User stories

- As the owner, I can add an employee and tick only the jobs they may perform.
- As a support worker, I can open a long request, assign it and reply without
  receiving finance or team-management access.
- As the owner, I can see cash leaving the bank separately from the value of my time.
- As the owner, I can see whether clinic access was set by payment or by a human.
- As the owner, I can inspect where a patient is registered and how much activity
  exists without reading confidential clinical content.
- As the owner, I can see sufficiently large health trends for education and product
  decisions without singling out a patient.
- As a doctor, I can read and continue the support conversation from My Practice.

## 6. Detailed workflows

### Employee access

1. Owner chooses Add employee.
2. Owner enters name/email, chooses a starting role and adjusts exact checkboxes.
3. The server generates a high-entropy temporary password and stores only its hash.
4. The password is shown once; the owner separately allows the same email through
   Cloudflare Access.
5. On first inner sign-in, all data areas remain blocked until the employee replaces
   the temporary password.
6. Access edits/removal require recent password reauthentication and are audited.

### Support

1. Clinic creates a request; request and opening message commit together.
2. Platform worker opens the full thread and may assign it to a support-capable peer.
3. A public reply is visible to the clinic; an internal note never crosses that API.
4. First-response and resolution timestamps are retained.
5. A clinic reply reopens a resolved request.

### Plan authority

1. A signed, idempotent Razorpay event writes the subscription snapshot.
2. Active payment sets the product plan immediately and clears grace.
3. Expiry returns the clinic to Basic after the defined reserve without deleting data.
4. A manual owner override requires a written reason and is labelled as manual.
5. A later signed payment event becomes authoritative again.

### Cost management

1. Owner records label, category, vendor, scope, amount, cadence and dates.
2. Shared costs apply only their TCOS allocation percentage.
3. Annual costs are amortised monthly; one-time costs affect their own month.
4. Cash and imputed amounts remain separate and combine into true economic cost.
5. Archiving stops future contribution while retaining historical evidence.

### Patient intelligence

1. A patient row opens identity, clinic relationships and activity counts.
2. The view is audited and contains no complaint, diagnosis, medicine or lab value.
3. A separate Health insights area aggregates diagnoses, test names and laboratories.
4. Any exact group representing fewer than five distinct patients is suppressed.

## 7. State transitions

- Support: `open → in_progress → waiting → resolved`; clinic reply returns to `open`.
- Employee credential: `temporary → owner-chosen`; removal is soft and revokes sessions.
- Plan source: `legacy → manual_override | payment → payment_expired`; payment may
  supersede `manual_override`.
- Business cost: `active → archived`; old rows are not deleted.

## 8. Business rules

- Owner access cannot be delegated or edited in the ordinary employee form.
- A teammate needs at least one valid capability.
- Capability, not role rank or a hidden menu, authorises every owner-console route.
- Only support-capable active teammates can receive a ticket assignment.
- Destructive access/money actions require a fresh password proof.
- Manual plan changes require a reason.
- Provider webhooks, not the browser, prove payment.
- Business money is integer paise.
- Named patient views contain operational metadata only.
- Aggregate health groups have a hard minimum cohort of five.

## 9. Data model changes

Migration `049-owner-console-foundation.sql` adds:

- `platform_team.capabilities`, `invited_by`, `must_change_password`
- `doctors.plan_source`, `plan_override_reason`, `plan_updated_at`
- support assignment/response/resolution timestamps
- `support_messages`
- `business_costs`

## 10. APIs

- `GET /admin/me`
- `POST /admin/change-password`
- `GET|POST /admin/team`, `PATCH|DELETE /admin/team/:email`
- `GET|PATCH /admin/support/:id`, `POST /admin/support/:id/messages`
- `GET /support/:id`, `POST /support/:id/messages`
- `GET /admin/patients/:id`
- `GET /admin/analytics/health`
- `GET|POST /admin/costs`, `DELETE /admin/costs/:id`
- Existing signed subscription webhook now maintains plan provenance.

## 11. Events

Audit actions include employee addition/access change/removal, password change,
support update/reply/internal note, patient operational view, cost add/archive,
manual plan change and subscription entitlement changes.

## 12. Permissions

`applications`, `doctors`, `patients`, `analytics`, `money`, `subscriptions`,
`delivery`, `support`, `team`. Owner has all. Other roles are editable presets;
the persisted checked list is the authority. Support does not inherit finance.

## 13. Screens and components

- Capability-aware owner rail
- Team roster and employee-access dialog
- One-time credential handover and forced password-change dialog
- Full support conversation dialog
- Communications readiness panel
- Subscription provenance table
- Business cost form, cost ledger and true-margin cards
- Patient operational-detail dialog
- Health insights tables and privacy explanation

## 14. Integrations

- Cloudflare Access is the outer platform-admin identity gate.
- TCOS cookie sessions and exact capabilities are the inner gate.
- Razorpay webhooks are the future live source of subscription truth.
- MSG91, Resend and Meta health checks remain read-only in Communications.

## 15. Automations

- Payment activation and expiry apply plan access without human intervention.
- Failed renewal opens the existing three-day reserve.
- A clinic reply reopens its ticket.
- First platform reply records response time.
- Annual/shared costs are allocated automatically in monthly reports.

## 16. Notifications

The thread is visible in both consoles. Provider notifications for new/reopened
tickets are deferred until approved message templates and routing rules exist.

## 17. Edge cases

- Removed/missing/non-support assignee is refused.
- Malformed capability JSON fails closed.
- A team member with a temporary password sees no data area.
- Empty or oversized support messages are refused.
- A resolved ticket receiving a clinic response reopens.
- Zero-revenue clinics have no misleading percentage margin.
- A month with no activity points to months that do contain activity.
- Shared and annual cost rounding occurs in integer paise.

## 18. Empty states

Applications identify the public Create account source; support, employees,
subscriptions, costs and insights explain why they are empty and what creates rows.

## 19. Error states

Errors distinguish sign-in, expired Access, missing capability, required password
change, required reauthentication, invalid assignment, invalid cost and unavailable
provider state. An unreadable provider balance is unknown, never falsely zero.

## 20. Security controls

- Cloudflare Access plus HttpOnly/Secure/SameSite cookie session
- exact-origin CSRF proof
- fresh-password boundary for destructive actions
- temporary-password forced replacement
- server-side capabilities
- owner non-delegation
- provider-signed/idempotent payment events
- no clinical values in named platform patient responses
- minimum aggregate cohort
- output escaping and bounded free text

## 21. Audit requirements

Every owner write records actor/action/target. Named patient operational reads are
also audited. Support messages retain author and timestamp. Manual plan changes
retain reason and source. Costs retain creator and archive state.

## 22. Compliance considerations

Health insights are operational decision support, not diagnosis or research output.
Small groups are suppressed. Any future export, advertising audience, food-product
promotion or partner lead generation requires a separately approved purpose,
consent/legal basis, retention policy and privacy review.

## 23. Analytics events

Current durable metrics: application state, ticket volume/status/first response,
subscription state, plan source, monthly revenue/cost/margin, patient/clinic counts,
aggregate diagnosis/test/laboratory volume. UI clickstream is not added in this phase.

## 24. Monitoring

- Communications provider readiness and balance/readability
- Subscription provider setup and renewal risk
- open/urgent/resolved support counts
- cash/imputed/true cost and loss-making clinics
- existing audit, AI breaker and deployment monitoring

## 25. Testing strategy

Source-contract tests verify routes, permission gates, privacy boundaries, seeds and
UI wiring. In-memory SQLite applies migration 049 and checks its schema. Existing
tenant-isolation, transaction, payment, security and publish suites run unchanged.
Staging then receives the migration, sample data and browser verification.

## 26. Acceptance criteria

- The retired demo owner cannot sign in or return through a standard seed.
- Real owner remains the only staging owner.
- Employee access is editable by exact area and enforced by the Worker.
- Support requests open as full threads and support staff can assign without Team access.
- Internal notes never appear to clinics.
- Money distinguishes bank spend, owner time and true total cost.
- Subscription rows identify automatic payment versus manual override.
- Named patient details expose counts only; aggregates suppress cohorts below five.
- Full automated suite, build and Worker dry run pass.

## 27. Definition of done

Code, migration, staging-only examples, tests and this traceability document are
committed; staging migration and API/web deployment succeed; owner browser smoke
tests pass. Production remains a separate release decision.

## 28. Migration impact

Migration 049 is additive. Existing support opening text is copied into a first
thread message. Existing employees retain role-preset access until an exact list is
saved. Existing plans are labelled `legacy` until payment or manual change proves
their source. No clinical record is rewritten.

## 29. Future extensibility

- SLA queues, ticket tags, attachments and notification routing
- Cloudflare Access policy synchronisation with a narrowly scoped token
- department/team ownership and escalation
- budget forecasts and provider-invoice reconciliation
- ICD/SNOMED terminology mapping and region/time-window filters
- approved, audited break-glass clinical support
- consented outreach/workshop cohorts without exposing patient identities

## Conflict resolved

**CONFLICT**  
The owner requested full named medical history in the platform console, while the
approved security architecture forbids platform-wide patient-level clinical access.

**WHY IT EXISTS**  
Operational growth analysis needs useful signals, but unrestricted medical-record
access creates avoidable privacy, insider-misuse and compliance risk.

**OPTIONS**  
1. Give the owner unrestricted named clinical access.  
2. Show no clinical intelligence.  
3. Separate named operational detail from de-identified aggregate health trends.

**RECOMMENDATION**  
Option 3, implemented here. Design a tightly audited, time-limited break-glass path
only when a real clinic support case proves it is needed.

**IMPACT**  
The owner receives actionable disease/test/laboratory patterns and patient-support
context without silently broadening access to confidential records.

## Requirement traceability

| Requirement | User | Workflow | Screen | API | Data | Permission | Event | Test |
|---|---|---|---|---|---|---|---|---|
| Delegate work | Owner | Add/edit/remove employee | Team access | `/admin/team*` | `platform_team` | `team` + fresh proof | team audit | owner/security |
| Resolve long requests | Support | Open/assign/reply | Support dialog | `/admin/support*` | `support_requests`, `support_messages` | `support` | support audit | owner/onboarding |
| Track real cost | Owner/finance | Add/archive/report | Money | `/admin/costs*` | `business_costs`, rates/usage | `money` + fresh proof | cost audit | owner |
| Automate access | Doctor/owner | Pay/webhook/expire | Subscriptions | subscription webhook/admin list | subscriptions, doctors | signed provider/admin view | payment audit | subscriptions |
| Inspect patient operations | Owner/support | Open patient | Patient dialog | `/admin/patients/:id` | identity and counts | `patients` | patient view audit | owner/isolation |
| Find health opportunities | Owner/analyst | Review groups | Health insights | `/admin/analytics/health` | aggregate clinical counts | `analytics` | read-only | owner/isolation |

## Dependency-safe work packages

### WP1 — Schema foundation

**Purpose:** Store access, support, cost and plan provenance.  
**Dependencies:** migrations 001–048.  
**Database:** migration 049.  
**Backend/Frontend:** none.  
**Security:** additive columns, checks and foreign keys.  
**Tests:** migration applied in SQLite.  
**Acceptance criteria:** all new tables/columns exist and old support text is retained.

### WP2 — Server authority

**Purpose:** Make capabilities, support, cost and analytics enforceable.  
**Dependencies:** WP1, existing Access/cookie/CSRF/fresh-password boundary.  
**Database:** scoped queries and audited writes.  
**Backend:** platform, costs, router and subscription modules.  
**Frontend:** none.  
**Security:** fail-closed capability checks and privacy filters.  
**Tests:** owner, isolation, security and subscription suites.  
**Acceptance criteria:** direct API calls cannot bypass UI restrictions.

### WP3 — Owner and clinic interfaces

**Purpose:** Make server workflows usable.  
**Dependencies:** WP2.  
**Database:** none directly.  
**Backend:** dedicated clients.  
**Frontend:** owner console and My Practice support dialog.  
**Security:** escaped output, current-password and reauthentication flows.  
**Tests:** source-contract and build-public checks.  
**Acceptance criteria:** each permitted role sees only its useful work areas.

### WP4 — Staging evidence and release

**Purpose:** Make empty screens understandable and prove the real deployment.  
**Dependencies:** WP1–WP3.  
**Database:** fictional staging applications, subscriptions, support threads and costs.  
**Backend/Frontend:** guarded staging deploy.  
**Security:** never seed production; no shared admin credential.  
**Tests:** complete suite, build, dry run and browser smoke test.  
**Acceptance criteria:** owner can verify every requested workflow on staging.

## Five-perspective quality review

- **Product:** owner jobs are grouped by applications, customers, money,
  communications, support and team; “Delivery” is renamed to its real purpose.
- **Healthcare workflow:** doctors retain their own support history; clinical content
  remains inside the practice and consent boundaries.
- **Engineering:** payment remains authoritative, state is durable and old data is
  migrated rather than discarded.
- **Security:** the earlier role-rank leak is removed; temporary credentials and
  destructive actions have independent controls.
- **UX:** fictional staging data explains table columns; long text opens in a thread;
  empty and provider-unknown states say what they mean.

## PHASE 04 COMPLETION REPORT

**Completed:** implementation, migration, 938 passing assertions, sample data,
documentation and staging release from commit `7e3194c98569`.  
**Deferred:** live provider credentials, notifications, Access API sync, terminology
normalisation and approved break-glass access.  
**Rejected:** unrestricted platform-owner browsing of named clinical content.  
**Technical debt:** role-rank compatibility helpers remain for older security tests;
cost values are estimates until invoice reconciliation exists.  
**Open risks:** staging must be migrated before the new Worker; sample data must never
be run against production; payment automation needs a live provider rehearsal.  
**Architecture decisions added:** exact platform capabilities; payment plan
provenance; cash versus imputed cost; operational named patient view plus cohort-
protected health analytics.  
**Passed to next phase:** notification routing, live Razorpay test, Access employee
sync, terminology mapping and break-glass design.
