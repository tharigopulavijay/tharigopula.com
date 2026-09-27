# Data source foundation milestone

The milestone is complete when a builder can register a PostgreSQL source or upload a file, create a trustworthy versioned dataset, and let a restricted viewer explore only permitted data. Failure, retry, source change and rollback must preserve that guarantee.

## Keep three concepts separate

| Concept | Role in this product |
|---|---|
| Source database or file | The customer's original data; accessed with deliberately limited credentials |
| Platform metadata database | PostgreSQL stores identities, source configurations, asset definitions, policies, versions, runs and audit history |
| Analytical dataset store | Partitioned Parquet/manifests store ingested and prepared data; DuckDB processes it |

The future custom-app module additionally needs transactional business records for forms, approvals and workflow state. Analytical snapshots should not become the sole operational write store.

## Stage 1 — secure the boundaries

Deliver typed connector configuration, tenant-owned upload IDs, consistent object containment, explicit source-discovery permissions, and one policy plan for all data reads. Make saved answers and exports enforce the reader's permissions. Make certification depend on evaluated rules.

Acceptance: all nine audit regressions pass after being adapted to the intended product semantics. Add workspace and region variants. Check grid, profile, Explain Column, Prepare, formulas, type examples, rejects, AI, dashboards and exports with the same policy fixtures.

## Stage 2 — finish PostgreSQL lifecycle

The builder chooses connection name, host, port, database, TLS verification, schema/table access and timeouts; enters credentials into the vault path; tests connectivity; discovers tables and keys; previews authorized data; selects snapshot or incremental mode; reviews governance; then runs ingestion.

Acceptance examples:

- Invalid host, port, credential and certificate fail at a clearly identified step without secrets in logs/responses.
- Discovery and preview cannot reach schemas/tables beyond source permissions and platform allowlists.
- Numeric precision, big integers, timestamps/time zones, Unicode, nulls and unusual identifiers survive ingestion accurately.
- Empty tables and interrupted reads have defined outcomes.
- Repeated imports and retries do not duplicate records or advance a cursor before version commit.
- Same-timestamp updates, late arrivals, null cursors, deletions and overlapping runs have explicit, tested semantics.
- A live preview either enforces the full policy set or clearly refuses the unsupported mode.
- Credential rotation and connection disable behavior are defined and tested.

## Stage 3 — finish file lifecycle

Retain the current chunked uploads, type checks, encoding support and manifest storage. Complete the lifecycle around them.

Acceptance examples:

- Inspect → configure → import → profile → Explore works for each supported format, not only CSV.
- Resumed upload checks ownership, offset, declared size and content integrity; aborted sessions are cleaned safely.
- Duplicate bytes, duplicate names, normalized column-name collisions and append deduplication have deterministic behavior.
- The user sees repaired/rejected counts and can trace every rejected row without losing policy protections.
- Date ambiguity, leading-zero identifiers, locale decimals, rounding and time zones are preserved or require an explicit choice.
- Concurrent append/replace and maintenance operations cannot lose a committed version's data.
- Export, rollback, retention and backup restoration preserve the intended schema and permissions.

## Stage 4 — prove one complete product journey

Use synthetic orders and payments with a key, decimal amounts, customer contact fields, status and update timestamp. Include duplicate keys, missing amounts, late updates and malformed input.

Run as three users: administrator, developer and restricted viewer.

1. Connect PostgreSQL and upload a related CSV.
2. Import, inspect row counts/types and validate the first immutable versions.
3. Join and clean in Prepare; retain rejected rows and record lineage.
4. Evaluate required-value, unique-key and reconciliation rules.
5. Block certification/publication on missing or failed evidence; allow when current evidence passes.
6. Query the result in Explore, a dashboard and governed SQL; compare totals and permissions.
7. Save/share an answer and verify that a restricted reader cannot receive the author's broader result.
8. Change source data and schema; rerun, retry, cancel and rollback; confirm cursor and version correctness.
9. Restore to a separate disposable instance and verify the same dataset, policies and lineage.

## Completion evidence

Record the exact Git commit, fixture checksum, test command, test exit code, row/reject counts, source and output versions, applied policies, job duration, peak memory and disk usage. Screenshots support UI review; they do not substitute for data reconciliation.

Choose the next connector only after this path passes. The first business workflow should determine whether MySQL, SQL Server, REST or an object-storage source is next.
