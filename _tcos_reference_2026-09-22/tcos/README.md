# TCOS — Tharigopula Clinical Operating System

One clinical and practice-management platform, sold to individual doctors
across India as **three products**:

| Product | Discipline | Sign-in mark |
| --- | --- | --- |
| **AyurCOS** | Ayurveda | `assets/ayurcos-logo.svg` |
| **HomeoCOS** | Homeopathy | `assets/homeocos-logo.svg` |
| **AlloCOS** | Allopathy | `assets/allocos-logo.svg` |

They are **one codebase, one Worker, one database**. A doctor registers once
with TCOS; after her certificate is verified the platform activates the
correct workspace.

## What is shared and what is separate

The rule: **isolate what the doctor sees, share what the patient is.**

**Shared** — patients, the medicine catalogue, billing, pharmacy, stock,
labs, appointments, consent, the platform console, tenant isolation and the
permission gates. One person is one patient record even if he sees an
Ayurveda doctor in March and an allopath in June, and his medication history
spans both, which is the only way anyone catches an interaction.

**Separate** — branding, the consultation form (practice packs), the
prescription layout, which medicine system is preselected, and some wording.
All of it lives in `js/products.js` and `js/clinic-registry.js`.

A product may reorder or preselect a medicine system. **No product removes
one**: a homeopath whose patient is already on allopathic thyroxine has to be
able to record that.

Adding a fourth discipline is an entry in `js/products.js`. It is never a new
repository.

## How a doctor joins

There is no self-signup. A prescription issued through TCOS carries our name,
so every doctor is verified before they can issue one.

1. **She applies** from `index.html` (the landing page) → `POST /apply`.
   This writes to `doctor_applications` and creates **nothing she can sign
   into**. No password is taken, and none is stored.
2. **We verify** her registration number against the council register. The
   queue is the Applications tab of the admin console.
3. **We approve** → `POST /admin/applications/:id/approve`. This is the call
   that creates the doctor, on the product matching her discipline. It
   returns a temporary password **once** — it is stored only as a hash, so
   it must be handed over on the call.
4. **She signs in and must change it** before anything opens.

One open application per mobile number, enforced by a partial unique index,
so a doctor who submits the form three times does not produce three rows to
review. A rejected application is kept, never deleted.

## Stack

Vanilla HTML + JS + hand-written CSS. **No framework and no frontend build
step.** One Worker (ES modules), a hand-rolled router, D1 (SQLite), R2 and
plain `node` tests. The OpenAI call uses `fetch`, so the deployed application
does not carry an AI SDK.

## Where things are

| | |
|---|---|
| App | Cloudflare Pages project `tcos` → https://tcos.pages.dev |
| API | Cloudflare Worker `tcos-api` |
| Database | Cloudflare D1 `tcos-db` |
| Files | R2 buckets `tcos-files` and isolated `tcos-staging-demo-files` |

## Running the demo locally

Build the database, then start the API and the static server:

```powershell
npx wrangler d1 execute tcos-db --local --file=schema.sql -y
npx wrangler d1 migrations apply tcos-db --local
npx wrangler d1 execute tcos-db --local --file=scripts/seed-ayurcos-bootstrap.sql -y
npx wrangler d1 execute tcos-db --local --file=scripts/seed-platform-owner-local.sql -y
npx wrangler d1 execute tcos-db --local --file=scripts/seed-accounts-demo.sql -y
npx wrangler d1 execute tcos-db --local --file=scripts/seed-operations-demo.sql -y
npx wrangler d1 execute tcos-db --local --file=scripts/seed-owner-console-demo.sql -y
npx wrangler d1 execute tcos-db --local --file=scripts/seed-ayurcos-demo.sql -y
npx wrangler d1 execute tcos-db --local --file=scripts/seed-expanded-demo.sql -y
npx wrangler d1 execute tcos-db --local --file=scripts/seed-health-insights-demo.sql -y
npx wrangler d1 execute tcos-db --local --file=scripts/seed-longitudinal-demo.sql -y
npx wrangler d1 execute tcos-db --local --file=scripts/seed-products-demo.sql -y
npx wrangler d1 execute tcos-db --local --file=scripts/seed-drug-catalogue-demo.sql -y
```

`seed-accounts-demo.sql` must run **before** `seed-operations-demo.sql`: the
staff rows it creates are what the later file's activity hangs off.

Then, in two terminals:

```powershell
npx wrangler dev --local --port 8787
node scripts/serve-demo.js
```

Open <http://localhost:8899/demo.html>.

### Demo sign-ins

| Role | Login | Password |
| --- | --- | --- |
| Doctor · AyurCOS | `9000000001` | `DoctorDemo2026` |
| Doctor · HomeoCOS | `9000000011` | `DoctorDemo2026` |
| Doctor · AlloCOS | `9000000021` | `DoctorDemo2026` |
| Front desk | `9000000002` | `FrontDesk2026` |
| Pharmacist | `9000000003` | `Pharmacy2026` |
| Clinical assistant | `9000000004` | `Assistant2026` |

The platform owner is intentionally not a shared demo credential. On a fresh
local database, open the admin console and use the one-time bootstrap with
`owner@tcos.local` to choose a password. Staging and production use the exact
Cloudflare Access owner identity configured by the platform operator.

Patients do not sign in. They open an unguessable read-only link, e.g.
`p.html#demo-vijay-read-only-link-2026-x`.

Append `?product=ayurcos`, `?product=homeocos` or `?product=allocos` to
`tcos-login.html` to see any product's branding without deploying three sites.

**These hashes are peppered with the local demo pepper in `.dev.vars` and are
worthless against production.** Never run the seeds against a real database.

### The example worth looking at

Vijay is `DEMO-1001` at the AyurCOS clinic and `ALO-1003` at the AlloCOS
clinic — one person, one patient record, two doctors on two different
products. His Ayurvedic antacids and his allopathic Pantoprazole appear in
one medication history. Neither doctor can read the other's clinical notes
without his consent.

## Tests

```powershell
npm test
```

265 assertions across tenant isolation, server-side role gates, immutable
prescriptions, gap-free numbering, consent-gated shared history, pharmacy
safety, onboarding and the AI identity gate. `test/isolation.test.js` scans
every module with SQL and fails on an unscoped clinical statement.

## AI diagnostic-document flow

The doctor must choose a patient before uploading. GPT-5.6 Luna performs a
low-cost preflight: legibility, patient name and a page inventory that marks
advertisements, covers and duplicate pages. Exact matches continue; initials,
expanded names and missing names require clinician confirmation; clearly
different names stop unless a clinician makes an explicit audited override.

Only then does GPT-5.6 Terra transcribe the clinical pages into `ai_drafts`.
The original document stays beside the extracted values, doubtful characters
are highlighted and nothing enters `lab_reports` until a clinician confirms
the values. OpenAI response storage is disabled (`store: false`). Configure
the staging secret interactively — never put it in a file or chat:

```powershell
npx wrangler secret put OPENAI_API_KEY --env staging
```

`store: false` is not the same as Zero Data Retention: standard API abuse
monitoring may retain inputs and outputs for up to 30 days. Use synthetic or
explicitly consented test reports in staging. Do not enable this for real
clinic traffic until the patient notice/consent, data-processing terms and an
eligible OpenAI retention arrangement have been reviewed.

## The medicine catalogue

`scripts/seed-drug-catalogue-demo.sql` seeds a curated working subset across
all four systems, including homeopathic remedies with potencies.

The full catalogue is generated by `scripts/build-drug-seed.js` from two
public datasets (1,272 allopathic molecules with 6,318 strengths, plus 360
Ayurvedic herbs) and needs those source files present. **It has no homeopathy
source**, so HomeoCOS depends on the curated file above until one is added.

The catalogue is a typing aid. It decides nothing, blocks nothing, and the
doctor can always type what is not in it. Every row records its source.
