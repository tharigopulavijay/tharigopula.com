# Client website AI bot — one component, many clients

**Status:** specification, nothing built.
**Audience:** Codex and Claude. Either may implement; claim it first.
**Written by:** Claude, 19 October 2026, at Vijay's request.

A client wants an AI assistant on their website that guides visitors. Vijay
wants **one reusable component** used across every client rather than a
rebuild each time, and wants it to share the OpenAI account TCOS already
pays for.

The second half of that needs care. Read the boundary section before
designing anything.

---

## 1. The boundary that matters most

**Share the OpenAI ACCOUNT. Do not share the TCOS key, the TCOS Worker, or
the TCOS spend guard.**

Four reasons, each independently sufficient:

1. **TCOS's circuit breaker is platform-wide.** `worker/aiops.js` enforces
   ₹1,000/hour and ₹4,000/day across the whole platform and opens a breaker
   for 20 minutes when tripped. A single client's website getting traffic —
   or scraped — would trip that breaker and **stop AI working for real
   doctors mid-consultation**. A marketing bot must never be able to
   degrade a clinical system.
2. **Billing cannot be attributed.** `ai_spend` is keyed by `doctor_id`.
   Bot traffic would land against a clinic or against nothing, and Vijay
   could not tell a client what their bot cost.
3. **The threat models are opposites.** TCOS's AI sits behind doctor
   authentication and reads documents a clinician already approved. A
   website bot is **public, unauthenticated and adversarial** — prompt
   injection, jailbreaks, scraping for free model access, and people typing
   things no clinic ever would. Nothing public should share a process with
   patient records.
4. **"TCOS must never know a client's name."** That rule is in TCOS's
   `CLAUDE.md` and exists because a customer was once hardcoded in and had
   to be cut out. A client bot inside TCOS reintroduces exactly that.

**Therefore:** a separate Cloudflare Worker, its own D1, its own
`OPENAI_API_KEY` secret — the same OpenAI *account* and billing, a
**different API key** so usage is attributable and revocable per product.
Create it as a second key in the OpenAI dashboard, named for this service.

---

## 2. What it is

A single Worker serving a small embeddable widget, multi-tenant from day
one.

```
<script src="https://bot.tharigopula.com/w.js" data-site="acme"></script>
```

One line on any client site. `data-site` selects the tenant; everything
else — branding, knowledge, limits — is configuration held server-side.

### Components

| Piece | Responsibility |
| --- | --- |
| `w.js` | The embed. Injects a launcher and panel, no framework, no dependencies. |
| Worker API | `POST /chat` (answer), `GET /config/:site` (branding), admin routes. |
| D1 | tenants, their content, conversations, per-tenant spend. |
| Vectorize or D1 FTS | Retrieval over the client's own content. |

### Why not a third-party widget

Vijay already pays for the model. A hosted bot service is a second bill, a
second place client conversations live, and no control over what the bot is
allowed to say. The expensive part of building it ourselves is the safety
work below — which a hosted service does not give us control over anyway.

---

## 3. Multi-tenant model

One row per client, and nothing about a client in code.

```
tenants
  id            TEXT PRIMARY KEY      -- 'acme'
  name          TEXT                  -- shown in the panel header
  origins       TEXT                  -- JSON array of allowed origins
  system_prompt TEXT                  -- what this bot is and is not
  greeting      TEXT
  theme         TEXT                  -- JSON: accent colour, position
  monthly_paise INTEGER               -- hard spend cap for THIS client
  status        TEXT                  -- active | paused | over_budget
```

**`origins` is the access control.** `/chat` checks the `Origin` header
against that client's list and refuses anything else. Without it the embed
is an open proxy to a paid model, which is the single most likely way this
turns into a surprise bill.

---

## 4. Answering: retrieval first, always

The bot answers **from the client's own content**, not from the model's
world knowledge. A general-purpose model on a plumber's website will invent
prices, confirm appointments nobody booked, and answer questions about
competitors.

```
visitor question
  → embed + retrieve top N chunks of THIS tenant's content
  → if nothing relevant: say so, offer the contact route. STOP.
  → else: answer using those chunks only, cite which page
```

The system prompt must state plainly: answer only from the provided
context; if it is not there, say you do not know and point to the contact
page. **Never invent a price, a date, an availability or a policy.**

Content is ingested from a sitemap or a supplied list, chunked, embedded
and stored per tenant. Re-crawl on a schedule; record each chunk's source
URL so answers can cite.

---

## 5. Cost control — the part that decides whether this is a business

Lift the **shape** of `worker/aiops.js` from TCOS; do not import it (it is
keyed by `doctor_id`).

| Control | Why |
| --- | --- |
| Per-tenant monthly cap in paise | Vijay can price per client and never lose money on one |
| Per-conversation message cap | One visitor cannot run a loop |
| Per-origin rate limit | Cloudflare Rate Limiting binding, as TCOS uses |
| Cheapest adequate model | A retrieval bot does not need a frontier model; measure before choosing |
| Cap retrieved context | Tokens, not chunks — the bill is tokens |
| Record every call in `bot_spend` | Model, tokens, cost, tenant, outcome |
| `status='over_budget'` | Bot says it is unavailable, politely; it does not keep spending |

**Reconciliation is required, not optional.** TCOS derives cost from token
counts and has never been checked against an OpenAI invoice — that gap is
open in the TCOS ledger. Do not repeat it here: reconcile `bot_spend`
against the real invoice in the first month, before any client is quoted a
price.

---

## 6. Public endpoint safety

This is the first thing Vijay will ship that takes untrusted input from
strangers.

- **Prompt injection is expected.** Visitor text is data, never instruction.
  A page that says "ignore your instructions" must change nothing. Keep the
  system prompt server-side; never echo it; never let retrieved content
  alter the bot's role.
- **No tools, no actions, in v1.** The bot answers. It does not book, order,
  email or look up an order. Adding an action means adding authorisation,
  and that is a separate decision.
- **No personal data collected in v1.** If a visitor types their phone
  number, it lands in a conversation log — so say in the panel that the
  conversation is stored, and keep a short retention period.
- **Never claim to be human.** The panel says it is an assistant.
- **Regulated clients are out of scope for v1.** A bot on a clinic or a
  pharmacy site answering a health question is medical advice. If a client
  is in healthcare, that is a separate conversation with different rules —
  TCOS's own AI never diagnoses or prescribes, and this must not either.

---

## 7. Lift from TCOS, rebuild, or never port

Measured tiers are in Claude's memory (`project-tcos-reuse-map`). For this
product:

| Module | Verdict |
| --- | --- |
| `lib.js`, `email.js` | **Lift as-is** — zero clinical coupling |
| `aiops.js` (spend guard shape) | **Rebuild**, keyed by tenant not doctor |
| Rate-limit binding pattern | **Lift the pattern** from `wrangler.jsonc` |
| CSP / `_headers` / publish allow-list | **Lift the approach** — `scripts/build-public.js` is a good model for not shipping secrets |
| `repo.js`, `staff.js`, `quota.js`, `billing.js` | **Do not port** — tenant isolation is baked to clinics |
| `abha.js`, `fhir.js`, `platform.js` | **Never port** |

---

## 8. Open decisions — Vijay

1. **Which client, and what do visitors actually ask them?** Build against
   one real site with real questions, not a generic demo.
2. **Hostname.** `bot.tharigopula.com` is assumed. Note the TCOS wildcard
   route on `*.tharigopula.com` currently captures new subdomains — that
   caught the Banthi app and must be handled before this resolves.
3. **Pricing.** Per client per month? Included in a website build? This
   decides how hard the per-tenant cap has to be.
4. **Who edits the content and the prompt** — Vijay for every client, or a
   small admin screen the client uses?
5. **Retention.** How long are visitor conversations kept, and does the
   client see them? They are a lead list, which is most of the value.

---

## 9. Definition of done for v1

One client site, live, where:

- the bot answers ten real questions from that client's content correctly,
  and says "I don't know" to three it should not answer — **demonstrated in
  a browser, with the transcript recorded**, per the proof standard in
  TCOS's `docs/AGENT-COLLABORATION.md`;
- a request from an origin not on the tenant's list is refused;
- the per-tenant monthly cap is proven by forcing it and watching the bot
  decline politely;
- `bot_spend` for that month has been reconciled against the OpenAI
  invoice and the numbers agree.

Adding the second client should then be a row in `tenants` plus content —
no code. If it is not, the component is not reusable and v1 is not done.
