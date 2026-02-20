# Roadmap / Commit Plan

Use small, meaningful commits (Conventional Commits). Each commit should keep the project runnable and CI green.

---

## FASE A — Foundation (scaffold + baseline)

1. `chore: bootstrap project scripts and tsconfig`
2. `chore: add eslint baseline`
3. `chore: add github actions ci pipeline`
4. `chore: add docker-compose mongodb for local dev`
5. `test: add unit tests for poi transformation`
6. `feat: implement poi transformation`
7. `test: add e2e import test with fake ocm server (scaffold)`
8. `feat: implement importer skeleton with fetch + paging stub`
9. `feat: implement mongo repository bulk upserts (externalId unique)`
10. `test(e2e): assert mongo insert + idempotent re-import + update dataset`
11. `chore: add minimal server smoke test (optional)`
12. `docs: document local dev, tests and ci`

> Note: In this challenge scope, prefer “basic but correct” over over-engineering (no advanced scheduler/metrics).

---

## FASE B — Import Robustness (core of the challenge)

> Goal: robust concurrent import with complete pagination, validated retries, advanced error handling, proven idempotency, edge-case tests, and documented performance reasoning.

### B1 — Pagination completa y controlada
1. `test(import): add multi-page pagination tests`
2. `feat(import): add pagination controls (pageSize/maxPages/startOffset)`

### B2 — Retry validado (429/5xx/timeout) + Retry-After
3. `test(http): add tests for retries on 429/5xx and network errors`
4. `feat(http): implement timeout with AbortController`
5. `feat(http): respect Retry-After header for 429 responses`
6. `test(e2e): simulate 429 with Retry-After in fake ocm server`

### B3 — Error handling avanzado (clasificación + fallos parciales)
7. `test(import): skip invalid POIs and continue importing`
8. `feat(import): classify errors and handle invalid POIs without failing job`
9. `feat(http): treat 4xx (except 429) as fatal errors`

### B4 — Idempotencia demostrada (insert + reimport + update)
10. `test(e2e): prove idempotent upserts (no duplicates on reimport)`
11. `test(e2e): prove updates overwrite existing docs (dataset update)`
12. `feat(repo): dedupe externalIds within batch before bulkWrite`

### B5 — Edge cases (calidad real)
13. `test(import): cover exact-multiple pageSize termination case`
14. `test(import): cover retry without Retry-After fallback backoff`
15. `test(import): validate results unchanged across concurrency levels`

### B6 — Performance reasoning documentado
16. `docs: add performance and scalability reasoning for importer`

---

## FASE C — Documentation & Professional Polish (Part 1 alignment)

1. `docs: add full project overview and assumptions`
2. `docs: add architecture diagram and data flow`
3. `docs: add api usage notes (OpenChargeMap) and auth approach`
4. `docs: add database schema, indexes, and storage strategy (UUIDv4)`
5. `docs: add deployment instructions (k8s resources overview)`
6. `docs: add reliability and scalability notes (timeouts, fault tolerance)`
7. `docs: describe graphql integration approach (conceptual)`
8. `docs: describe monitoring and logging approach (conceptual)`

---

## FASE D — Runtime Safety, Sanitized Logging, and Scaling Notes

> Implementation details and completion tracking: `docs/CHANGELOG.md` and `docs/SCALING.md`.

1. `feat(config): enforce safe caps for concurrency/pageSize/maxPages/timeout`
2. `feat(logging): sanitize logs to avoid raw payload leakage`
3. `docs: add horizontal scaling strategy (partitioning + job leasing + distributed rate limit)`

---

## Maintenance Track (Post-Phase D)

1. `chore(testing): add local e2e wrapper with docker lifecycle automation`
