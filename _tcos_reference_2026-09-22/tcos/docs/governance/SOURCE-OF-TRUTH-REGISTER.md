# Clinical OS source-of-truth register

**Created:** 9 September 2026  
**Branch:** `codex/production-hardening`  
**Purpose:** prevent an approved architecture document from existing only in
one chat, one attachment folder, or one laptop.

## Authority order

When two sources disagree, use this order until the owner records a different
decision:

1. Clinical OS Product Constitution.
2. A dated Decision Register entry that explicitly amends the Constitution.
3. Master Blueprint and domain/capability/permission matrices.
4. Approved phase output.
5. Current implementation and tests.
6. Historical audit or state report.

Code does not silently overrule product policy. A disagreement is raised as a
conflict and either the code or the governing artifact is corrected.

## Inventory verified in this checkout

| Source named by the owner | Version-controlled source | Status |
|---|---|---|
| Clinical OS Product Constitution | Not yet imported. Current approved copy is the Codex attachment `d37499d0-3f4f-464c-9918-76c415ba8e0c/pasted-text.txt`, SHA-256 `7F6538593C17FD43BF0E416103FE5661034520D08F47823C4A29FFA4913C9F23` | Available on this machine only; must be imported without rewriting it |
| Clinical OS Master Blueprint | Not found | Missing from repository |
| Capability Map | `worker/staff.js` and permission tests are executable evidence, but not the approved artifact | Approved document missing |
| Domain Model | `schema.sql`, 47 migrations and domain modules are executable evidence, but not the approved artifact | Approved document missing |
| Decision Register | No dedicated register found | Missing from repository |
| Specialty Matrix | `js/products.js` and `js/clinic-registry.js` are executable evidence, but not the approved artifact | Approved document missing |
| Organization Capability Matrix | No approved artifact found | Missing from repository |
| Permission Model | `worker/staff.js`, `worker/index.js`, `test/staff.test.js` are executable evidence, but not the approved artifact | Approved document missing |
| Integration Catalog | Provider modules and `wrangler.jsonc` are executable evidence, but not the approved artifact | Approved document missing |
| Previous approved phase outputs | `docs/PRODUCT-CONSTITUTION-ALIGNMENT-2026-09-08.md`, `docs/STATE-OF-THE-PROJECT.md`, release and audit reports | Partial |

## Governance rule established by Phase 3

Missing governance files do not stop a narrowly bounded safety fix that:

- changes no tenant, specialty, organization, entitlement or clinical model;
- closes an independently reproducible vulnerability;
- is backward-compatible while inactive;
- carries tests and a reversible rollout switch.

Any change to those architectural areas remains blocked until the relevant
approved artifact is imported or the owner records an explicit decision.

## Required repository layout

Approved artifacts should be imported under `docs/governance/` with stable
names, original approval dates and content hashes. Amendments belong in a
Decision Register entry; do not edit history until it says what the current
implementation happens to do.
