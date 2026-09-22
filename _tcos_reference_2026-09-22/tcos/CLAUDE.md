# TCOS — Tharigopula Clinical Operating System

A clinical and practice-management platform sold to **individual doctors across
India**. Built by Tharigopula Technologies (Vijay Tharigopula).

## Three products, one codebase

TCOS ships as **AyurCOS** (Ayurveda), **HomeoCOS** (Homeopathy) and **AlloCOS**
(Allopathy). They are one codebase, one Worker and one database wearing three
faces. A doctor registers once with TCOS; the platform verifies her
certificate and activates the right workspace.

**The rule: isolate what the doctor sees, share what the patient is.**

- **Shared** — patients, the medicine catalogue, billing, pharmacy, stock,
  labs, appointments, consent, the platform console, and every rule below.
- **Separate** — branding, practice packs, prescription layout, which medicine
  system is preselected, some wording. All of it in `js/products.js`.

`doctors.product` is the whole of the difference. It is **not** a permission
and **not** a data boundary: tenant isolation is still `doctor_id`, and it does
not care which product a doctor uses. A doctor cannot change her own product —
it follows her registration, so only the platform sets it.

**A product may reorder or preselect a medicine system. No product removes
one.** An Ayurveda-only build once deleted homeopathy from the list; that fork
is exactly what this design exists to prevent. A homeopath whose patient is
already on allopathic thyroxine must be able to record it.

Adding a fourth discipline (Unani, Siddha) is an entry in `js/products.js`.
It is never a new repository.

> **TCOS is a product, not one clinic's software.** Sri Ashwin Holistic Care is
> the first customer, and her website lives in a **separate repo**
> (`sri-ashwin-holistic-care`) on a **separate Cloudflare project**
> (`sri-ashwin`). A client repo may know TCOS's URL. **TCOS must never know a
> client's name.** One customer was once hardcoded in here and it had to be cut
> out — do not let it back in.

---

## Where things are

| | |
|---|---|
| Folder | `E:\tharigopula.com\products\tcos` — see the workspace map in `E:\tharigopula.com\CLAUDE.md` |
| Repo | `github.com/tharigopulavijay/tharigopula-clinical-os` (private) |
| App | Cloudflare Pages project `tcos` → https://tcos.pages.dev |
| API | Cloudflare Worker `tcos-api` → `tcos-api.hello-tharigopula.workers.dev` |
| Database | Cloudflare D1 `tcos-db` |
| Files | Cloudflare R2 bucket `tcos-files` — enabled 30 Aug 2026 |
| Control plane | `platform/control-plane` in this workspace — bound in **shadow** only, and the binding is still commented out in `wrangler.jsonc` |

Deploy: `npx wrangler deploy` (API) and
`npx wrangler pages deploy . --project-name tcos --branch main --commit-dirty=true` (app).

**GitHub → Pages auto-deploy has been unreliable.** Deploy with wrangler and
verify the change is actually live before reporting it done.

---

## Stack

Vanilla HTML + JS + hand-written CSS. **No framework, no build step.** One
Worker (ES modules), a hand-rolled router, D1 (SQLite), plain `node` tests.

**Exactly one runtime dependency: `@anthropic-ai/sdk`.** It is the only one,
and it was added deliberately for the document reader — talking to the API by
hand would mean hand-rolling streaming, retries and tool schemas, which is more
code to be wrong about, not less. `package.json` had no `dependencies` at all
before it, and the next addition should have to argue for itself the same way.

Nothing else may be added without a reason that survives being said out loud.
Scripts that could pull a dependency do not: `scripts/logo-tool.js` decodes and
resizes PNGs over `node:zlib` rather than bringing in sharp.

---

## The rules that are not negotiable

**1. Tenant isolation.** D1 has no row-level security, so it lives in the code.
Every function touching a clinical table takes `doctorId` first and its SQL says
`WHERE doctor_id = ?`. `test/isolation.test.js` scans **every** module with SQL
and fails if one is unscoped. **Three** named exceptions only:
`repo.sharedHistory` (consent-gated), `patientview.js` (token-scoped, spans
clinics by design) and `platform.platformPatients` (the admin roster; a
separate assertion proves it reads nothing clinical).

Exceptions are declared **by name and position**, never by file. Four queries
once got past this check by carrying `AND doctor_id IS NOT NULL` — a clause
that matches every row and exists only because the scan looks for the string
`doctor_id`. The test now fails outright if that pattern reappears. If a query
genuinely needs to cross tenants, add it to the exception list where somebody
has to read it.

**2. Permissions are server-side.** Staff roles (front desk, pharmacist,
clinical assistant) can run the diary, patients, pharmacy and billing. **None of
them can open a clinical record.** Enforced by `gate(doctor, CAN.X)` on 40+
routes, before the handler does any work. `test/staff.test.js` reads the
router's source and proves each gate exists *and runs first*. Hiding a button is
presentation, never permission. Unknown roles fail closed.

**3. Issued documents are immutable.** Prescriptions and invoices freeze on
issue and get a gap-free number. A mistake is amended or cancelled **with a
stated reason** — never edited, never deleted. A hole in a numbered sequence
looks exactly like something being hidden.

**4. Patients are read-only.** There is no patient write path anywhere. They see
their record through an unguessable 90-day token — no account, no password.

**5. Money is integer paise.** Never floats. `0.1 + 0.2` is how a day's takings
stop matching the cash box for reasons nobody can find.

**6. One mobile number is a household.** Husband, wife, children share it. A
`UNIQUE(mobile)` constraint once silently merged a wife's records into her
husband's chart. Patients are separate people who share a number.

---

## Domain decisions worth not re-litigating

- **Patient numbers are per clinic** (`SAHC-1001`), assigned by TCOS, four
  digits growing to five. Not global: four global digits is 10,000 patients
  platform-wide, and a global counter tells every doctor how few customers
  we have.
- **Practice packs** (Ayurveda, Acupuncture, Physiotherapy…) drive which
  sections appear on a prescription. One platform, many disciplines — this is
  what stops TCOS being an Ayurveda-only tool.
- **Pharmacy dispenses FEFO** (first expiry first out); expired stock is
  quarantined, never sellable.
- **Cross-clinic history needs the patient's consent** (code to their phone),
  lasts 24h, and every record opened is logged for them to see.
- **The medicine catalogue is a typing aid.** 1,272 allopathic molecules with
  6,318 strengths, plus 360 Ayurvedic herbs. It decides nothing, blocks nothing,
  and she can always type what is not in it. Every row records its source.
- **No self-signup, and it is now enforced rather than merely stated.** A
  doctor applies from the landing page (`index.html` → `POST /apply`), which
  writes a row to `doctor_applications` and creates **nothing she can sign
  into**. Someone checks the registration number, and **approving is what
  creates the account** — `POST /admin/applications/:id/approve`, admin rank
  required, temporary password returned exactly once, `must_change_password`
  set. `test/onboarding.test.js` holds that shape in place.

  There used to be `POST /auth/signup/verify`, which minted a live clinical
  account from a name and an SMS code with nobody verifying anything, and
  the button beside it was a `mailto:` link. Both are gone.

---

## Working with Vijay

- He is business- and design-driven, not deeply technical. **Show him the
  screen, not the diff.** Screenshots and live links land; code does not.
- *"Jo dikhta hai vo bikta hai"* — when there is a choice, take the more
  impressive option for anything a client will see.
- **Do not use `sed`/`perl` one-liners or shell heredocs to edit source.** They
  have corrupted files in this repo more than once. Use the Edit tool, or a
  Node script with a guard that refuses unless the pattern matches exactly once.
- He pushes back hard and is usually right. When he is, say so plainly and
  change course — do not defend the first answer.
- Never take API keys, passwords or secrets through chat. `PEPPER` and any SMS
  key are set by him with `wrangler secret put`.

---

## Where it stands

**Built and live:** Today · Patients · Prescriptions · Pharmacy · Billing ·
Reports · My practice · Team, plus the consultation workspace, patient chart,
public clinic page, the patient's own view, and the platform admin console.
Staff capabilities are per-person tick-lists (`clinic_users.capabilities`,
overriding the role preset); support requests exist end to end; all three
products render from `js/products.js`. Doctors apply from a public landing
page and the platform approves them into an account. Files live in R2, plan
limits meter usage with a three-day reserve rather than a hard stop, doctors
connect their own domains, and the three product lockups are Vijay's own
artwork. TCOS is joined to the control plane in shadow — observed, never
obeyed. The complete local suite currently has **265 assertions green.**

**Known gaps, in the order they matter:**

1. **Staging is deployed; production is still on the old release.** The exact
   production snapshot was copied to isolated `tcos-staging-db`, migrations
   011–024 were rehearsed successfully, and `tcos-api-staging` plus
   `tcos-staging.pages.dev` are live. Production D1 has not been changed.
   Its old migration ledger is empty even though schema 001–010 already exists,
   so production must use the documented compatibility release rather than a
   blind `wrangler d1 migrations apply`.

1a. **The two-stage AI document reader is deployed to staging but not
   production.** GPT-5.6 Luna first checks legibility, patient identity and
   which pages are clinical versus advertisements/covers/duplicates. Exact
   names continue; ambiguous or different names require an audited clinician
   confirmation before GPT-5.6 Terra transcribes clinical values. The result
   is still only an `ai_draft`; nothing enters `lab_reports` until a clinician
   compares it with the original and confirms it. Staging has no
   `OPENAI_API_KEY` yet, so live AI remains deliberately unavailable.
   `store:false` disables response persistence but standard API abuse logs may
   still retain content for up to 30 days. Use synthetic/consented staging data;
   real clinic rollout waits for the privacy terms and retention arrangement.

1b. **The full drug catalogue is not loaded.** `scripts/build-drug-seed.js`
   needs two public source files that are not in the repo, and it has **no
   homeopathy source at all**. Until then
   `scripts/seed-drug-catalogue-demo.sql` seeds a curated working subset
   across all four systems, homeopathic potencies included.

1c. **Payment automation needs Razorpay keys.** Plans currently refresh by
   hand. Do not ask for the keys in chat — Vijay sets them with
   `wrangler secret put`.
3. **OTP delivery is parked** by Vijay's decision. Sign-in is password-only.
4. **`clinical.tharigopula.com` does not point here yet** (A record →
   `76.76.21.21`, grey cloud). Everything is on `tcos.pages.dev`.
5. **Admin first-run is backwards** — you must fail a sign-in before the
   "set owner password" panel appears.
6. **Messages and Lab orders** are deliberately not built: one needs SMS, the
   other a diagnostics integration. A fake screen would be worse than none.

**Agreed direction for AI:** the first validated release stays in the modular
Worker so there is one observable transaction. At sustained volume the calls
move behind a Queue/Workflow and a separate `tcos-ai` Worker without changing
the API contract. R2 holds originals; every model output is a **draft the
doctor must approve**. AI never issues a prescription, finalises a note,
changes a medicine, or messages a patient. Ayurvedic vocabulary (nadi, jihva,
sparsha) must be evaluated specifically.

---

## Demo data

Rebuildable from nothing — see the README for the exact command order.
`scripts/seed-accounts-demo.sql` must run **before** `seed-operations-demo.sql`.

| Role | Login | Password |
| --- | --- | --- |
| Platform admin | `admin@tcos.demo` | `AdminDemo2026` |
| Doctor · AyurCOS | `9000000001` | `DoctorDemo2026` |
| Doctor · HomeoCOS | `9000000011` | `DoctorDemo2026` |
| Doctor · AlloCOS | `9000000021` | `DoctorDemo2026` |
| Front desk | `9000000002` | `FrontDesk2026` |
| Pharmacist | `9000000003` | `Pharmacy2026` |
| Clinical assistant | `9000000004` | `Assistant2026` |

`?product=ayurcos|homeocos|allocos` on `tcos-login.html` switches branding
without deploying three sites.

**Vijay is the example worth opening.** He is `DEMO-1001` at the AyurCOS clinic
and `ALO-1003` at the AlloCOS clinic — one person, one patient record, two
doctors on two different products, each holding their own notes. His Ayurvedic
antacids and his allopathic Pantoprazole sit in one medication history, both
treating the same reflux. Neither doctor can read the other's clinical notes
without his consent. That single patient demonstrates the whole architecture.

Latha Reddy (front desk) deliberately holds **both** front-desk and pharmacy
capabilities, because that is how a three-staff clinic runs. Her menu is built
from the union of her capabilities, so Patients appears once — `js/nav.js`
filters one canonical ordered list, which makes duplication structurally
impossible.

**A caution learned the hard way:** an earlier seed set staff capabilities with
`UPDATE` statements against rows nothing had inserted. They matched nothing,
raised no error, and left four of the five advertised logins broken while
appearing to succeed. Verify a seed by counting rows, not by reading it.
