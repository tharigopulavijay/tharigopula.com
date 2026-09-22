# The prescription desk — build brief

**Written 10 September 2026, from Vijay's review of the live product against
the AyurCOS port kit reference.**

Reference implementation: `AyurCOS-port-kit.zip` (doctor-clinical.html,
prescription.html, css/prescription-v3.css, js/prescription-patient.js).

> **Get inspired, do not copy.** Vijay's own words: *"copying the code is not
> just copying because our architecture is different... taking and moulding
> and getting inspired from there and building the view, that's how we make
> difference."* The reference is a single-clinic prototype with browser
> storage. TCOS is multi-tenant with a Worker and D1. Take the LAYOUT, the
> INFORMATION ORDER and the DOCUMENT FEEL. Write the code against our APIs.

---

## 1. The correction that drives everything else

The patient must **not** get a separately designed page. Vijay:

> *"what's the use of creating prescription on the doctor side, it should be
> the same reflection from there right... the real customer needs to see it
> that way."*

He is right, and the current build gets it wrong: `js/patient.js` renders its
own card layout that shares nothing with what the doctor composed. Two designs
for one thing, guaranteed to drift.

**There is ONE prescription document.** The doctor writes it. The patient sees
the same document. A shared renderer produces both.

The reference already shows how to reconcile that with things a patient should
not see — the Investigation History sheet is headed **"Doctor reference · Not
part of patient handout"**. So:

**The document is a list of PAGES, and every page declares its audience.**

| Page | Audience | Notes |
| --- | --- | --- |
| Prescription | `both` | Clinical examination, therapy, medicines |
| Personalised Diet & Yoga Plan | `both` | Marked "Patient handout: Page 2" |
| Investigation History | `doctor` | Trends and movement; never in the handout |

Rendering rule: doctor view renders every page; patient view renders pages
whose audience is `both`. One renderer, one stylesheet, one source of truth.

---

## 2. Screen layout

Three panes, from the reference:

```
┌──────────┬───────────────────────────────┬──────────────┐
│ QUEUE    │        THE DOCUMENT           │  HISTORY     │
│          │                               │              │
│ + Add    │  ┌─────────────────────────┐  │ Open a       │
│ walk-in  │  │ Clinic name             │  │ prescription │
│          │  │ Patient · Age/Sex · Wt  │  │              │
│ [search] │  │ ① Clinical examination  │  │ 10 Sep 2026  │
│          │  │ ② Therapy               │  │  Current     │
│ Raghav   │  │ ③ Prescription & diet   │  │ 08 Aug 2026  │
│  Waiting │  │                         │  │ 11 May 2026  │
│ Meera    │  │ Doctor's signature      │  │ 12 Feb 2026  │
│  In cons │  │ address · phone · web   │  │              │
│ Ananya   │  └─────────────────────────┘  │              │
│  Current │  ┌─ page 2: Diet & Yoga ──┐   │              │
│ ...      │  └─────────────────────────┘  │              │
└──────────┴───────────────────────────────┴──────────────┘
```

Top bar: patient selector · Status (Draft/Issued) · zoom − 100% + ·
**Save draft** · **Share on WhatsApp** · **Print / Save PDF**

**The doctor never leaves this screen.** Vijay: *"every patient is managed in
this same prescription page only, doctor need not go up and down."*

### Left — the queue
- **+ Add new / walk-in patient** at the top. Opens an inline form, not a
  different page.
- Search by name, mobile or patient ID.
- Rows: initials avatar, name, age/sex, and a **status**: Waiting ·
  In consultation · Current · Due today · Reports pending · Upcoming ·
  Not scheduled.
- Clicking a row loads that patient's document in the middle pane.

### Middle — the document
Bordered sheet on a tinted ground, so it reads as paper. Numbered sections with
serif headings. Two-column label/value rows with alternating shading. **The
doctor types straight into the sheet** — what is on screen is what prints.

### Right — prescription history
Past prescriptions, newest first, each with date, title and status. Clicking
one opens it read-only beside the current draft.

---

## 3. Non-negotiables

1. **TCOS must never know a client's name.** The port kit is full of Sri
   Ashwin branding, address, phone and logo. Every one of those must come from
   the tenant's own `doctors` row. If a clinic name appears in the source, the
   port is wrong. See CLAUDE.md.
2. **No logo. No letter mark.** Vijay's explicit instruction: *"I will not show
   any of their logo, why to spend that space — I just show the name of the
   hospital, that's it."* The clinic NAME is the identity.
3. **Letterhead mode.** A doctor ticks *"I print on my own letterhead"* and the
   header block is omitted so the sheet prints onto her paper. Store this on
   the clinic, not per prescription.
4. **Signature and footer sit at the bottom of the SHEET**, not after the
   content. Vijay: *"when data is less the doctor sign goes up — that is not a
   good habit."* Use a fixed sheet height (A4 ratio) with the footer absolutely
   positioned, or a flex column with `margin-top:auto`. It must hold for a
   two-medicine prescription and a twenty-medicine one.
5. **Issued prescriptions stay immutable.** Draft is editable; issuing freezes
   it and assigns the gap-free number. Amend or cancel with a reason — never
   edit. This is invariant 3 and the reference does not respect it, because a
   prototype has no such duty.
6. **Tenant isolation** on every query. Invariant 1.
7. **Money in integer paise.** Invariant 5.

---

## 4. What already exists

Routes, verified present in `worker/index.js`:

| Need | Route |
| --- | --- |
| Queue for today | `GET /appointments` |
| Patient search | `GET /patients`, `GET /patients/lookup` |
| Add walk-in | `POST /patients` |
| Patient record | `GET /patients/:id` |
| Prescription history | `GET /prescriptions` |
| One prescription | `GET /prescriptions/:id` |
| Save draft | `PATCH /prescriptions/:id` |
| Create | `POST /prescriptions` |
| Issue (freeze) | `POST /prescriptions/:id/issue` |
| Amend | `POST /prescriptions/:id/amend` |
| Investigation trends | `GET /patients/:id/lab-series` |
| Patient share link | `POST /patients/:id/share` |
| Patient's own view | `GET /p/:token` |
| Stock | `GET /stock`, `GET /prescriptions/:id/dispensing` |

**Pharmacy is already plumbed.** Prescription items carry `dispense_quantity`
and `stock_item_id`; `stock_movements` reference `prescriptionItemId` with an
idempotency key, so a double submit cannot deduct twice; and
`repo.prescribedVersusDispensed()` reconciles. What is missing is the WORKFLOW
— nothing links a prescribed line to a stock item without a human going to the
Pharmacy screen. Vijay: *"their pharma stock should be automatic from here
based on what they have given."*

## 5. What does not exist yet

- **Diet chart** — Ahara grid: early morning, breakfast, lunch, evening,
  dinner, foods to avoid, special instructions. Needs a tenant-scoped table.
- **Yoga / movement plan** — a per-clinic video library plus per-patient
  selections. Needs two tables.
- **Page/audience model** — the `both` vs `doctor` flag described in §1.
- **Letterhead flag** on the clinic.
- **Share on WhatsApp** — an image to paste plus the patient link. The link
  exists (`POST /patients/:id/share`); the image does not.
- **Queue status values** — Waiting, In consultation, Reports pending etc. are
  richer than the current appointment statuses.

---

## 6. Build order

1. **The document renderer, shared.** One module that turns a prescription
   into pages of HTML, with an `audience` filter. Use it in the doctor view
   AND in `js/patient.js`. This is the whole point of the brief — do it first
   or the two views drift again.
2. **The sheet.** Fixed-ratio page, numbered sections, footer and signature
   pinned to the bottom, print stylesheet, letterhead mode.
3. **Three-pane layout** with the queue and history rails.
4. **Write-in-place editing** with Save draft, then Issue.
5. **Diet and yoga pages**, with their tables.
6. **Share on WhatsApp** — image plus link.
7. **Investigation History page** — doctor audience only.
8. **Pharmacy link** — prescribing suggests the stock item; dispensing deducts.

Steps 1 and 2 are the ones that change how the product feels. Everything after
is additive.

---

## 7. What was already done, and what it got wrong

`css/patient.css` was rewritten on 9 September to make the patient page read as
paper rather than as app cards — warm ground, serif headings, medicines
weighted first, footer pushed to the bottom, no letter mark.

**That work styled the wrong thing.** It made a *separate* patient design look
better instead of making the patient see the doctor's document. Keep the visual
language — it is close to the reference and Vijay has not objected to it — but
it must become the shared renderer of §1, not a second design.
