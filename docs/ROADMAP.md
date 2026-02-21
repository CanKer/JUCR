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

## FASE E — Maintenance & Reliability Improvements

> Focus: consolidate hardening, resilience, and documentation improvements for long-term maintainability and reviewer readiness.

### E1 — Pagination guardrails (no infinite loops)
1. `test(import): add pagination edge cases (exact-multiple, maxPages cut)`
2. `feat(import): add startOffset and maxPages guardrails to importer config`

**DoD**
- Import stops when page is empty OR page < pageSize OR pagesProcessed >= maxPages.
- Tests prove no infinite loop is possible.

---

### E2 — HTTP robustness (timeout + fatal 4xx)
3. `test(http): cover fatal 4xx and retryable 5xx/network errors`
4. `feat(http): add AbortController timeout to OpenChargeMapHttpClient`
5. `feat(http): treat 4xx (except 429) as fatal (no retry)`

**DoD**
- 401/403/400 fail fast without retries.
- Timeouts abort and are treated as retryable transient errors.
- Tests assert request counts (no accidental extra retries).

---

### E3 — 429 Retry-After support
6. `test(http): cover 429 retry-after behavior`
7. `feat(http): respect Retry-After header for 429 responses`
8. `feat(retry): allow custom delayMs from retry decision`

**DoD**
- If Retry-After is provided (seconds), client waits that delay before retrying (bounded).
- If missing/invalid, fallback to exponential backoff.

---

### E4 — Invalid POI resilience (skip bad records, keep job alive)
9. `test(import): skip invalid POIs and continue importing`
10. `feat(import): use allSettled for transforms and log skipped invalid records`
11. `feat(import): add run summary logging (processed/skipped/retried pages)`

**DoD**
- A single invalid record does not fail the import.
- Summary log includes counts (processed/skipped/retried).

---

### E5 — Storage hardening (batch dedupe + docs)
12. `test(repo): handle duplicate externalIds within a batch`
13. `feat(repo): dedupe externalIds before bulkWrite upsert`
14. `docs: add DATABASE.md (schema, indexes, upsert strategy)`

**DoD**
- Duplicate externalIds in the same page do not break bulkWrite behavior.
- DB schema and indexes are clearly documented.

---

### E6 — Horizontal scaling + performance docs
15. `docs: add SCALING.md (partitioning, leasing, distributed rate limit)`
16. `docs: add PERFORMANCE.md (bulkWrite, concurrency tradeoffs, complexity)`

**DoD**
- Clear conceptual plan to scale beyond a single worker (no implementation required).

---

### E7 — Final polish for reviewers
17. `docs: update README with run modes, env vars, and CI notes`
18. `chore: add check scripts (check/check:e2e) and pin node version (.nvmrc)`
19. `chore: final cleanup (remove node_modules from repo, ensure CI visible)`

**DoD**
- One command runs quality gates.
- Repo is clean and reproducible.
- CI and E2E gating are explained and visible.
