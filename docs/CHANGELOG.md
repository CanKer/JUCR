# CHANGELOG

This document follows `docs/ROADMAP.md` and records actual implementation progress by roadmap item.

Conventions:
- `Status`: `DONE` | `IN_PROGRESS` | `TODO`
- `Commits`: commit SHAs where the work was implemented
- `Paths`: key files affected by each item

Last updated: 2026-02-20

---

## PHASE A - Foundation (scaffold + baseline)

### A1 - `chore: bootstrap project scripts and tsconfig`
Status: `DONE`  
Commits: `90b0215`  
Paths:
- `package.json`
- `tsconfig.json`
- `jest.config.cjs`

Details:
- Bootstrapped the initial Node + TypeScript + Jest project structure.
- Added baseline scripts (`build`, `typecheck`, `test`, `test:unit`, `test:e2e`, `start`).
- Set `node >=20` to rely on native `fetch`.

### A2 - `chore: add eslint baseline`
Status: `DONE`  
Commits: `f28d1c7`  
Paths:
- `eslint.config.mjs`
- `package.json`
- `package-lock.json`

Details:
- Added a working ESLint baseline for `src/` and `tests/`.
- Updated dependency versions for ESLint/Jest/ts-jest compatibility.
- Stabilized the `npm run lint` command.

### A3 - `chore: add github actions ci pipeline`
Status: `DONE`  
Commits: `90b0215`, `00a1dbb`  
Paths:
- `.github/workflows/ci.yml`

Details:
- Added CI pipeline with: install, lint, typecheck, build, unit tests, fake OCM server, e2e tests.
- Added MongoDB service to CI.
- Updated fake OCM build path to `dist/src/fake-ocm-server.js`.

### A4 - `chore: add docker-compose mongodb for local dev`
Status: `DONE`  
Commits: `90b0215`  
Paths:
- `docker-compose.yml`

Details:
- Added a minimal Docker Compose setup for local MongoDB on port `27017`.

### A5 - `test: add unit tests for poi transformation`
Status: `DONE`  
Commits: `90b0215`  
Paths:
- `tests/unit/transformPoi.test.ts`

Details:
- Added test coverage for `ID -> externalId` mapping.
- Added validation case for missing `ID`.

### A6 - `feat: implement poi transformation`
Status: `DONE`  
Commits: `90b0215`  
Paths:
- `src/core/poi/transformPoi.ts`
- `src/core/poi/poi.types.ts`

Details:
- Generates UUIDv4 `_id`.
- Normalizes numeric `externalId`.
- Persists raw source payload in `raw`.
- Parses `lastUpdated` from OCM timestamp fields when available.

### A7 - `test: add e2e import test with fake ocm server (scaffold)`
Status: `DONE`  
Commits: `e372212`  
Paths:
- `tests/e2e/importPois.e2e.test.ts`
- `jest.config.cjs`

Details:
- Added the initial e2e test shape against fake OCM.
- This was later expanded into full Mongo-backed assertions in A10.

### A8 - `feat: implement importer skeleton with fetch + paging stub`
Status: `DONE`  
Commits: `90b0215`, `00a1dbb`  
Paths:
- `src/application/import-pois/importPois.usecase.ts`
- `src/infrastructure/openchargemap/OpenChargeMapHttpClient.ts`
- `src/ports/OpenChargeMapClient.ts`
- `src/application/import-pois/importer.config.ts`

Details:
- Implemented OCM HTTP client using native `fetch`.
- Added retry for transient failures (429/5xx/network).
- Implemented paginated import flow (`offset` + `pageSize`) until exhaustion.
- Added `dataset` support for deterministic test scenarios.

Key snippet (paging loop):
```ts
while (true) {
  const raw = await client.fetchPois({ limit: config.pageSize, offset, dataset: config.dataset });
  if (raw.length === 0) break;
  const docs = await Promise.all(raw.map((r) => limit(async () => transformPoi(r))));
  await repo.upsertMany(docs);
  offset += raw.length;
  if (raw.length < config.pageSize) break;
}
```

### A9 - `feat: implement mongo repository bulk upserts (externalId unique)`
Status: `DONE`  
Commits: `00a1dbb`  
Paths:
- `src/infrastructure/mongo/MongoPoiRepository.ts`
- `src/infrastructure/mongo/mongo.indexes.ts`

Details:
- Implemented `MongoPoiRepository` with `bulkWrite` + `updateOne` + `upsert: true`.
- Upsert key is `externalId`.
- Ensured unique index on `externalId` during repository initialization.
- Added `close()` for connection lifecycle handling.

Key snippet (upsert operation):
```ts
updateOne: {
  filter: { externalId: doc.externalId },
  update: {
    $setOnInsert: { _id: doc._id, externalId: doc.externalId },
    $set: { lastUpdated: doc.lastUpdated, raw: doc.raw }
  },
  upsert: true
}
```

### A10 - `test(e2e): assert mongo insert + idempotent re-import + update dataset`
Status: `DONE`  
Commits: `00a1dbb`, `9209ae1`  
Paths:
- `tests/e2e/importPois.e2e.test.ts`
- `src/fake-ocm-server.ts`

Details:
- Added Mongo-backed e2e tests for three scenarios:
- Initial import (`small`) inserts 25 documents.
- Re-import (`small`) keeps count stable (no duplicates).
- Updated import (`update`) changes existing documents without identity drift.
- Added stronger idempotency assertions (`_id` stability for same `externalId`).

### A11 - `chore: add minimal server smoke test (optional)`
Status: `DONE`  
Commits: `cca084e`  
Paths:
- `src/server.ts`
- `tests/unit/server.smoke.test.ts`

Details:
- Refactored `server.ts` to export `createServer()`.
- Guarded runtime start with `if (require.main === module)`.
- Added minimal smoke test to verify expected HTTP response payload.

### A12 - `docs: document local dev, tests and ci`
Status: `DONE`  
Commits: `653b6a6`  
Paths:
- `README.md`

Details:
- Updated README with local setup, importer run command, environment variables, and CI flow.
- Aligned documentation with current project behavior and scripts.

---

## PHASE B - Import Robustness (core of the challenge)

Overall status: `IN_PROGRESS`  
Plan reference: `docs/ROADMAP.md` (PHASE B section)

### B1 - Pagination completeness and controls

#### B1.1 - `test(import): add multi-page pagination tests`
Status: `DONE`  
Commits: `ffc6c06`, `feat(import): add pagination controls (pageSize/maxPages/startOffset)` (amended)  
Paths:
- `tests/unit/importPois.pagination.test.ts`
- `tests/e2e/importPois.e2e.test.ts`

Details:
- Added focused unit tests for paginated imports across more than three pages.
- Added explicit coverage for exact-multiple `pageSize` behavior (trailing empty fetch).
- Added coverage for max-page cut-off and full-page responses to prevent infinite-loop regressions.
- Added e2e coverage for a large dataset (`large`) to validate multi-page behavior end-to-end.

#### B1.2 - `feat(import): add pagination controls (pageSize/maxPages/startOffset)`
Status: `DONE`  
Commits: `feat(import): add pagination controls (pageSize/maxPages/startOffset)` (amended)  
Paths:
- `src/application/import-pois/importer.config.ts`
- `src/application/import-pois/importPois.usecase.ts`
- `tests/unit/importPois.pagination.test.ts`
- `tests/e2e/importPois.e2e.test.ts`

Details:
- Added pagination controls:
- `startOffset` to begin imports from a specific offset.
- `maxPages` to cap page processing per run.
- Added finite defaults (`startOffset: 0`, `maxPages: 1000`) to keep runs deterministic.
- Import now stops when:
- no items are returned,
- a partial page is returned (`page.length < pageSize`),
- processed pages reach `maxPages`.
- Added config validation guards for invalid paging values.
- Import completion log includes `pagesProcessed`.

### B2 - Retry validation (429/5xx/timeout) + Retry-After

#### B2.3 - `test(http): add tests for retries on 429/5xx and network errors`
Status: `DONE`  
Commits: `test(http): add unit tests for retries on 429/5xx and fatal 4xx`  
Paths:
- `tests/unit/http-client.retry.test.ts`

Details:
- Added unit-level HTTP client tests using a local Node `http` server.
- Verified retry behavior for transient `500` responses.
- Verified retry behavior for `429` responses.
- Verified `400/401/403` are fatal (single request, no retry).
- Request counts are asserted in every scenario to validate retry policy wiring.

#### B2.4 - `feat(http): implement timeout with AbortController`
Status: `DONE`  
Commits: `feat(http): add request timeout via AbortController`  
Paths:
- `src/infrastructure/openchargemap/OpenChargeMapHttpClient.ts`
- `tests/unit/http-client.timeout.test.ts`

Details:
- Added request timeout support in `OpenChargeMapHttpClient` using `AbortController`.
- Constructor now accepts optional `timeoutMs` with default `8000`.
- Timeout aborts are classified as transient and retried by the HTTP retry policy.
- Added unit coverage validating timeout retries followed by success.

#### B2.5 (prerequisite) - `feat(retry): support custom delay for retry decisions`
Status: `DONE`  
Commits: `feat(retry): support custom delay (Retry-After) for retry decisions`  
Paths:
- `src/shared/retry/retry.ts`
- `tests/unit/retry.delay.test.ts`

Details:
- Extended retry decision contract to support both:
- boolean (`true/false`) for backward compatibility.
- object shape `{ retry: boolean; delayMs?: number }` for per-attempt custom delays.
- Added tests validating custom delay wiring and compatibility behavior.

#### B2.5 - `feat(http): respect Retry-After header for 429 responses`
Status: `DONE`  
Commits: `feat(http): respect Retry-After header for 429 responses`  
Paths:
- `src/infrastructure/openchargemap/OpenChargeMapHttpClient.ts`
- `tests/unit/http-client.retry-after.test.ts`

Details:
- Added `Retry-After` parsing for HTTP `429` responses in the OpenChargeMap client.
- Supports integer seconds format and converts to milliseconds.
- For valid `Retry-After`, retry policy receives custom delay through the shared retry utility.
- For missing/invalid header values, retry falls back to standard backoff behavior.
- Added unit test that simulates `429 + Retry-After=1` twice, then success.

#### B2.6 - `test(e2e): simulate 429 with Retry-After in fake ocm server`
Status: `DONE`  
Commits: `test(e2e): extend fake ocm server to simulate 429 with Retry-After`  
Paths:
- `src/fake-ocm-server.ts`

Details:
- Extended fake OCM server with `ratelimit` query param support.
- `ratelimit=N` returns `429` with `Retry-After: 1` for the first `N` requests, then normal responses.
- Keeps existing deterministic dataset behavior unchanged (`small`, `large`, `update`).

#### B2.7 - `test(e2e): verify importer succeeds after transient 429 and 5xx`
Status: `DONE`  
Commits: `test(e2e): verify importer succeeds after transient 429 and 5xx`  
Paths:
- `src/fake-ocm-server.ts`
- `tests/e2e/importPois.e2e.test.ts`

Details:
- Added fake server support for `fail500=N` to emit transient `500` responses.
- Added e2e test proving importer recovers after `429` transient failures with `Retry-After`.
- Added e2e test proving importer recovers after transient `500` failures.
- Both tests assert import completion and expected Mongo document count.

#### B2.8 - `test: reduce Mongo dependency for resilience scenarios`
Status: `DONE`  
Commits: `test: decouple resilience/pagination scenarios from Mongo e2e`  
Paths:
- `tests/unit/importPois.resilience.test.ts`
- `tests/e2e/importPois.e2e.test.ts`
- `.github/workflows/ci.yml`

Details:
- Moved resilience and multi-page coverage (`429`, `500`, and >3 pages) to non-Mongo tests using in-memory repository doubles.
- Reworked resilience tests to use a retrying fake client (no local HTTP sockets) that simulates `429`, `500`, and timeout failures.
- Added assertions for retry attempt counts and final import results.
- Kept Mongo e2e focused on persistence semantics (idempotent upsert and updates).
- Guarded Mongo e2e execution behind:
- `const run = process.env.REQUIRE_MONGO_E2E === "1";`
- `(run ? describe : describe.skip)(...)`
- Enabled that flag in CI so full integration checks still run in pipeline.
- Improves local test reliability while preserving integration confidence in CI.

#### B2.9 - `feat(di): add composition root and wire cli through manual DI`
Status: `DONE`  
Commits: `refactor(di): move importer wiring to composition root and align resilience tests`  
Paths:
- `src/composition/root.ts`
- `src/cli/import.ts`

Details:
- Added a manual composition root that centralizes importer wiring in one place.
- `runImport()` loads env values, builds `OpenChargeMapHttpClient`, builds `MongoPoiRepository`, resolves importer config, executes import, and always closes the repository in `finally`.
- Added optional env overrides for importer behavior:
- `IMPORT_CONCURRENCY`, `IMPORT_PAGE_SIZE`, `IMPORT_MAX_PAGES`, `IMPORT_START_OFFSET`
- `IMPORT_DATASET`, `IMPORT_MODIFIED_SINCE`, `OCM_TIMEOUT_MS`
- Refactored CLI entrypoint into a thin runner that only executes `runImport()` and keeps process-level error handling.

### B3 - Advanced error handling

#### B3.7 - `test(import): skip invalid POIs and continue importing`
Status: `DONE`  
Commits: `test(import): skip invalid POIs and continue importing`  
Paths:
- `tests/unit/importPois.invalid-pois.test.ts`

Details:
- Added unit coverage for mixed-validity pages where some POIs are invalid.
- Verifies importer skips invalid items and persists remaining valid items.
- Verifies importer continues on subsequent pages and reports `skippedInvalid` in completion log.

#### B3.8 - `feat(import): classify errors and handle invalid POIs without failing job`
Status: `DONE`  
Commits: `feat(import): classify invalid POI errors and keep partial progress`, `feat(import): add structured error handler for robust partial-failure handling`  
Paths:
- `src/application/import-pois/import.error-handler.ts`
- `src/core/poi/transformPoi.ts`
- `src/application/import-pois/importPois.usecase.ts`
- `tests/unit/import.error-handler.test.ts`
- `tests/unit/transformPoi.test.ts`
- `tests/unit/importPois.invalid-pois.test.ts`

Details:
- Introduced `InvalidPoiError` in POI transformation for explicit validation-error typing.
- Added dedicated import error-handler module with:
- typed failure/skip codes,
- structured skip log payloads with page/offset/item context,
- fatal error wrappers for transform/repository failures,
- run-summary tracker for processed/skipped counters.
- Import use case classifies transform failures by error type:
- `InvalidPoiError` is skipped and counted (`skippedInvalid`).
- non-validation errors are rethrown to fail fast.
- Added tests to cover:
- typed invalid-id failures,
- non-validation failures still failing the import,
- error-handler classification/wrapping behavior in isolation.

#### B3.9 - `feat(http): treat 4xx (except 429) as fatal errors`
Status: `DONE`  
Commits: `feat(http): treat non-429 4xx responses as fatal errors`  
Paths:
- `src/infrastructure/openchargemap/OpenChargeMapHttpClient.ts`
- `tests/unit/http-client.retry.test.ts`

Details:
- Made retry policy explicit for client errors:
- `429` remains retryable (with optional `Retry-After` delay),
- all other `4xx` responses are fatal and never retried.
- Expanded unit coverage to include additional `4xx` statuses (`404`, `409`, `422`) and assert single-request behavior.

### B4 - Idempotency proven (insert + reimport + update)

#### B4.10 - `test(e2e): prove idempotent upserts (no duplicates on reimport)`
Status: `DONE`  
Commits: `test(e2e): strengthen idempotent reimport proof in Mongo e2e`  
Paths:
- `tests/e2e/importPois.e2e.test.ts`

Details:
- Strengthened Mongo e2e idempotency assertions for re-importing the same dataset.
- Captures full identity snapshot (`externalId`, `_id`) after first import and verifies it is identical after second import.
- Keeps duplicate detection by aggregation to ensure there are no repeated `externalId` documents.

#### B4.11 - `test(e2e): prove updates overwrite existing docs (dataset update)`
Status: `DONE`  
Commits: `test(e2e): strengthen update overwrite proof in Mongo e2e`  
Paths:
- `tests/e2e/importPois.e2e.test.ts`

Details:
- Strengthened Mongo e2e update assertions for importing the `update` dataset after initial `small` load.
- Verifies identity stability across all documents by comparing complete (`externalId`, `_id`) snapshots before and after update import.
- Verifies updated payload overwrite by asserting every persisted title ends with `"(updated)"`.

#### B4.12 - `feat(repo): dedupe externalIds within batch before bulkWrite`
Status: `DONE`  
Commits: `feat(repo): dedupe externalIds in Mongo batch upserts`  
Paths:
- `src/infrastructure/mongo/MongoPoiRepository.ts`
- `tests/unit/mongo-poi-repository.test.ts`

Details:
- Added in-batch dedupe by `externalId` before building Mongo `bulkWrite` operations.
- Keeps only the latest document for repeated `externalId` values within the same import page.
- Added unit coverage to verify:
- only one operation per repeated key is emitted.
- latest payload wins for duplicate keys.

#### B5.15 - `test(import): validate results unchanged across concurrency levels`
Status: `DONE`  
Commits: `test(import): validate concurrency invariance in import results`  
Paths:
- `tests/unit/importPois.resilience.test.ts`

Details:
- Added a unit test that runs `importPois` twice with the same dataset and different concurrency values (`1` vs `20`).
- Verifies imported dataset equivalence by `externalId` and normalized payload snapshot.
- Confirms import output remains deterministic across concurrency settings.

#### B5.14 - `test(import): cover retry without Retry-After fallback backoff`
Status: `DONE`  
Commits: `test(http): cover fallback backoff when Retry-After is missing or invalid`  
Paths:
- `tests/unit/http-client.retry-after.test.ts`

Details:
- Added explicit coverage for `429` responses where `Retry-After` is missing or invalid.
- Verifies client falls back to default retry backoff instead of custom `Retry-After` delay.
- Keeps existing successful path coverage for valid `Retry-After` values.

#### B6.16 - `docs: add performance and scalability reasoning for importer`
Status: `DONE`  
Commits: `docs: add performance and scalability notes for importer`  
Paths:
- `docs/PERFORMANCE.md`

Details:
- Added a focused performance document covering:
- why Mongo `bulkWrite` is used,
- why in-batch dedupe exists,
- `pageSize` and `concurrency` tradeoffs,
- conceptual horizontal-scaling strategy for later phases.

Remaining Phase B items:
- None.

---

## PHASE C - Documentation & Professional Polish

Overall status: `TODO`  
Plan reference: `docs/ROADMAP.md` (PHASE C section)

Pending items:
- C1 `docs: add full project overview and assumptions`
- C2 `docs: add architecture diagram and data flow`
- C3 `docs: add api usage notes (OpenChargeMap) and auth approach`
- C4 `docs: add database schema, indexes, and storage strategy (UUIDv4)`
- C5 `docs: add deployment instructions (k8s resources overview)`
- C6 `docs: add reliability and scalability notes (timeouts, fault tolerance)`
- C7 `docs: describe graphql integration approach (conceptual)`
- C8 `docs: describe monitoring and logging approach (conceptual)`
