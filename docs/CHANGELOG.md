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

Overall status: `TODO`  
Plan reference: `docs/ROADMAP.md` (PHASE B section)

Pending items:
- B1.1 `test(import): add multi-page pagination tests`
- B1.2 `feat(import): add pagination controls (pageSize/maxPages/startOffset)`
- B2.3 `test(http): add tests for retries on 429/5xx and network errors`
- B2.4 `feat(http): implement timeout with AbortController`
- B2.5 `feat(http): respect Retry-After header for 429 responses`
- B2.6 `test(e2e): simulate 429 with Retry-After in fake ocm server`
- B3.7 `test(import): skip invalid POIs and continue importing`
- B3.8 `feat(import): classify errors and handle invalid POIs without failing job`
- B3.9 `feat(http): treat 4xx (except 429) as fatal errors`
- B4.10 `test(e2e): prove idempotent upserts (no duplicates on reimport)`
- B4.11 `test(e2e): prove updates overwrite existing docs (dataset update)`
- B4.12 `feat(repo): dedupe externalIds within batch before bulkWrite`
- B5.13 `test(import): cover exact-multiple pageSize termination case`
- B5.14 `test(import): cover retry without Retry-After fallback backoff`
- B5.15 `test(import): validate results unchanged across concurrency levels`
- B6.16 `docs: add performance and scalability reasoning for importer`

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

