# Data Studio system audit

Review updated 27 September 2026. Current source: `E:\Custom automation\datastudio`, commit `99bedf0e16940e9115e1a58f99beafd2b93db84c`. This report covers the existing product and the next data-source milestone. It does not authorize or perform the build prompts embedded in the reference playbook.

## Assessment

Keep the existing architecture and improve it in focused stages. Data Studio has substantial implemented functionality, including real ingestion and execution. It is a useful foundation for the proposed custom automation platform, but the governance claims are stronger than the enforcement demonstrated by this audit. Access-control and data-isolation defects should be resolved before adding sensitive customer sources or expanding shared use.

Start with the complete data-source journey: connect or upload, discover, inspect, configure ingestion, commit a version, explore it under the user's permissions, and monitor or recover a failed run. A new database engine is not the first missing component.

## Evidence and limits

I accessed both supplied ChatGPT conversations, **idea designer** and **Automation Platform Assessment**, and extracted the text of the supplied Data Studio Master Build Playbook. I reviewed the repository documentation, migrations, connector implementations, queue, ingestion/version logic, permissions, policy projection, and downstream API paths.

On 25 September, the original 20 tests passed against a disposable PostgreSQL instance: 9 unit and 11 integration tests. TypeScript checks passed for all four packages. Nine additional regression checks were then added in this audit folder; all nine failed at their intended assertions, exposing the defects below. The original 11 integration tests continued to pass in that run. The tests used synthetic data and did not access production datasets.

The source changed substantially before the review resumed on 27 September. The latest implementation includes new storage, BI, operations, and type-checking features. The affected code paths were re-inspected at the commit above; the nine findings remain present in source. September 25 runtime results must not be represented as a full test of the September 27 code. Current validation status is recorded in the companion validation notes.

This is an architecture and targeted correctness/security review, not an exhaustive penetration test or proof of every screen, connector format, failure mode, or production-scale workload. The live sign-in page was observed, but an authenticated browser journey was not completed. Natural-language AI, real R2, external notifications, disaster recovery, and the large taxi dataset were not independently exercised in this audit.

The application source, credentials, production database, and production data volumes were not modified. Audit files and disposable test images/containers were created separately.

## What the system currently contains

| Layer | Implementation inspected | Assessment |
|---|---|---|
| Application shell | React/Vite, contextual workspace, Explore, Prepare, Model, Metrics, Quality, Catalog, Lineage, AI, Publish, Monitor | Broad functional UI connected to APIs; full browser coverage still needed |
| Metadata and jobs | PostgreSQL 16; tenants, workspaces, environments, connections, assets, versions, runs, audit, later BI/ops migrations | Appropriate division of responsibilities; environment isolation and concurrency need work |
| Source connectors | PostgreSQL plus CSV/TSV, Excel, JSON/NDJSON, Parquet file paths | Real source implementations; other catalog connectors remain planned |
| Data execution | Embedded DuckDB; API query paths plus separate worker | Retain; prove resource limits and full-data operations on the target PC |
| Dataset storage | Partitioned Parquet files and manifests, append/merge, optimization, retention, versions | Added since the initial review; deserves concurrent-writer and recovery tests |
| Explore and preparation | Full-data grid, formulas, pivots, type checks, visual graph, immutable pipeline versions | Implemented depth; alternate reads must use the same policies |
| Model, metrics, quality | Relationships, metrics, rules, quarantine and publication checks | Certification currently accepts missing evaluation evidence |
| AI and dashboards | Governed SQL surface, saved answers, conversations, rollups and dashboards | Good query-time boundary in several paths; saved results require viewer-time authorization |
| Operations and backup | Schedules, alerts, R2/S3-compatible replication, cold tier, metadata backup and restore code | Current code and handoff describe these; real external integrations not independently validated here |
| Custom operational apps | Future records/forms/workflows/approvals layer | Not yet implemented; keep separate from analytical storage |

S3-compatible backup/replication is different from an S3 folder **source connector**. The former now exists in the code; the latter is still marked planned. Likewise, PostgreSQL query-in-place is currently a limited live preview, not a complete federated processing engine.

## Confirmed defects and remediation

Severity indicates implementation priority. The reproduction evidence below was obtained on September 25; current source locations were checked again on September 27.

### 1. High priority — an upload reference can traverse into another tenant

`apps/api/src/routes/uploads.ts` checks that an upload reference starts with the caller's region/tenant/workspace prefix. `apps/api/src/store.ts:23` then normalizes the path and checks only containment under the **region** root. A reference beginning with the correct prefix can include parent-directory segments and resolve into another tenant's folder within that region.

Reproduction: the audit created a synthetic CSV under a second tenant and submitted a traversal reference to the upload-inspection endpoint as the first tenant. It returned HTTP 200 instead of rejecting the reference.

Fix: resolve server-owned upload IDs; validate tenant/workspace ownership in metadata; reject traversal components; enforce canonical containment under the exact caller-owned upload root. Apply the same checks to inspect, import, type checks, reparse and chunked-upload paths. A region-only filesystem sandbox does not provide tenant isolation.

### 2. High priority — raw connection previews bypass source permissions

`apps/api/src/routes/connections.ts:132` checks `asset.preview`, which the viewer role has, then uses the connection's stored credentials to return raw source rows. It does not require source-discovery permission or apply dataset row/column policies.

Reproduction: a viewer who lacks `connection.read` successfully requested five raw rows through a known connection ID; HTTP 200 was returned instead of 403. Knowing an ID must not grant access.

Fix: introduce explicit source-discovery authorization and scope it to permitted connections. Ordinary viewers must use governed dataset reads. Define how access works before a discovered table has registered field policies.

### 3. High priority — live previews skip configured policies

`apps/api/src/routes/assets.ts:135` calls `buildProjection(fields, role, [])` in the live-source branch. It omits configured row filters and column mask/deny policies, and does not pass through the normal governed relation's region check.

Reproduction: the same viewer saw one row with a masked amount through snapshot preview, but 100 rows through live preview after the ingestion mode changed. The policy setup remained identical.

Fix: apply a common policy plan across live and materialized reads. Safely push supported policies to the source or disable live access for policy combinations the connector cannot enforce. Do not return unfiltered data as a fallback.

### 4. High priority — profile values ignore explicit masking policies

`apps/api/src/routes/assets.ts:181` builds its projection with an empty policy list. Stored profile statistics were computed over the full dataset and are not recomputed for row-filtered viewers. Explain-column paths also need review for the same issue.

Reproduction: a viewer with an explicit amount-masking policy received an unmasked minimum value (`1.00`).

Fix: load the caller's full policy set. Suppress protected value statistics and either recompute authorized statistics or explicitly withhold global statistics when row-level restrictions apply.

### 5. High priority — pipeline and formula reads bypass configured policies

`apps/api/src/services/executors.ts:460` resolves raw dataset relations. Pipeline previews in `apps/api/src/routes/pipelines.ts` mask selected field metadata after execution, but do not apply configured row filters or the complete policy set. Masking after aggregation cannot repair a query that already included unauthorized rows.

Reproduction: an analyst limited to one row in Explore received five rows in a pipeline source preview. The explicitly masked amount was not covered by the field-only masking mechanism.

Fix: resolve each input under an explicit execution identity before transformations. Carry row restrictions and derived-column policies through outputs. Audit preview, formula distributions, type-check examples, rejects, quarantine and exports, not just the main grid.

### 6. High priority — connection updates can persist plaintext secrets

The create route strips `password` and `username` from configuration, but `apps/api/src/routes/connections.ts:86` accepts a generic configuration object on update and persists/returns it. That object also enters audit history.

Reproduction: an update containing a synthetic password marker inside `config` returned the marker in the public response.

Fix: use typed configuration allowlists shared by create/update/test, reject credential-shaped fields in public configuration, and route secrets only through the vault. Review existing configuration/audit records privately for accidental secrets after the prevention fix; do not print them.

### 7. High priority — saved AI answers expose the author's result to other roles

`apps/api/src/routes/ai.ts:214` returns stored answers when the user owns the answer **or it is saved**. It does not reapply the reader's policies to stored rows and narrative. The newer shared-result/chart/export routes require the same review.

Reproduction: an administrator saved a result for row 2, while the viewer was restricted to row 1 and masked amounts. The viewer could retrieve the saved answer with HTTP 200.

Fix: share a governed query definition and re-execute for each viewer, or enforce an audience whose permissions permit every stored result value. Apply this to narrative text, cached rows, charts, downloads and answer history. A policy-aware dashboard does not automatically secure stored answer endpoints.

### 8. Medium priority — certification succeeds before rules are evaluated

`apps/api/src/routes/assets.ts:76` verifies that at least one rule exists and that no failed result exists. It does not require a current passing result for every enabled rule. Missing results therefore look safe. This certification path is weaker than the publish gate.

Reproduction: create a blocking rule without running it, then certify the dataset. Certification returned HTTP 200 instead of 422.

Fix: certify a specific dataset version against complete, current rule evidence. Missing, errored, or stale evidence must block certification. New versions and changed rules must invalidate earlier certification as appropriate.

### 9. Medium priority — environment selection changes other users' context

`apps/api/src/routes/workspace.ts:48` stores the selected environment in shared workspace settings, and authentication reads that value for every session. Major asset/connection queries scope by tenant and workspace but not environment.

Reproduction: a viewer selected test; a separately logged-in administrator's environment changed from development to test. Source inspection also shows that switching the selector does not isolate datasets.

Fix: make the selected environment session/request scoped; consistently scope resources, runs, uniqueness rules and authorization by environment. Alternatively, explicitly present the current control as a shared release label until true isolation is implemented. Capture a run's environment when it is queued.

## Additional concerns from source inspection

These require dedicated runtime checks; they are not included in the nine reproduced failures.

- **Concurrent dataset writes:** ingestion reads the previous version before processing, while `createVersion` locks only during the final metadata commit. That lock allocates version numbers but does not prove the output was based on the latest version. Concurrent append/merge/maintenance can produce a stale successor. Serialize operations per asset or use a compare-and-swap against the expected base version, with retry/rebase.
- **Retry delay:** the worker sets `queued_at` ten seconds into the future on retry, but the claim query has no `queued_at <= now()` predicate. A retry can be claimed immediately.
- **Cancellation and timeouts:** checks occur between work units. Long `engine.exec` calls need an interrupt path; a heartbeat alone does not enforce a deadline.
- **Incremental semantics:** explicitly test same-timestamp arrivals/updates, null cursors, integer cursors with a late window, timezone-aware cursors, duplicate keys, deletes and late data. The current late-window calculation casts to `TIMESTAMP` and silently ignores conversion failure. Do not describe cursor sync as CDC.
- **Drift policies:** `new_draft` behaves as a blocking policy and `quarantine` lacks a distinct implementation in the common drift checker. UI labels must reflect actual behavior.
- **HTTP workload:** full-file type-copy creation and long conversion checks occur inside request paths. Full-file CSV export uses engine execution without an explicit timeout in the examined helper. Put expensive work behind bounded jobs and cancellation.
- **E2E failure reporting:** the original `journey.mjs` catches step failures, logs them and continues without failing the process. It also hardcodes a loopback PostgreSQL source host unsuitable for the API's separate Docker container. Fix the harness before using its exit code as release evidence.
- **Documentation drift:** STATUS contains historical test counts and earlier deferred features alongside later implementations. Replace headline claims with a current, reproducible validation matrix.

## What to retain

The metadata/execution split, connector SDK, real source reads, parameterized metadata SQL, isolated source type parsing, bounded previews, transactional cursor/version commit, immutable history, parser-based SQL validation, and explicit planned connector labels are valuable. The baseline tests demonstrate real behavior. Reuse these boundaries; close the alternate paths that bypass them.

## Recommended order

1. Fix tenant-owned object resolution and source/derived-data authorization; add the failing audit cases to the permanent suite.
2. Fix credential validation, certification evidence and environment scope.
3. Complete the PostgreSQL and file source lifecycle, including concurrent imports, retries, cancel, duplicate uploads, drift and rollback.
4. Prove the full connect → import → prepare → validate → publish → query journey with separate admin, builder and viewer roles.
5. Measure the large-file workload on the target PC and validate real backup/restore with a disposable destination.
6. Add the next connector demanded by a real workflow, using the same tested contract.
7. Build the custom operational-app layer on the trusted data foundation, with a transactional record store and versioned workflows.

See `DATA_SOURCE_FIRST_MILESTONE.md` for the concrete acceptance gates.
