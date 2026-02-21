# Architecture

## Goal
Import Points of Interest (POIs) from OpenChargeMap into MongoDB with:
- concurrency control
- efficient retrieval and persistence
- idempotent writes (no duplicates)
- retries for transient failures
- unit tests + at least one E2E test
- docker-compose local env
- CI pipeline

## Key design choices
- **Native fetch** (Node 20) for HTTP calls.
- **Bulk upsert** into MongoDB for efficiency.
- **Idempotency** via `externalId` unique index + upsert.
- **Concurrency limiter** implemented in `src/shared/concurrency` (no external libs).
- **Retry policy** in `src/shared/retry` with exponential backoff for transient errors (429/5xx/network).

## Folder structure (hexagonal-ish)
- `src/core` – domain types + transformations
- `src/ports` – interfaces (OpenChargeMapClient, PoiRepository)
- `src/application` – use-cases (importPois)
- `src/infrastructure` – adapters (http client, mongo repo)
- `src/shared` – cross-cutting (retry, concurrency, config)
- `tests/unit` – unit tests
- `tests/e2e` – end-to-end tests (mongo + fake OCM server)

## Import flow (target)
1. Fetch pages from OpenChargeMap sequentially using offset-based pagination.
2. Transform POIs concurrently per page with bounded concurrency.
3. Persist using MongoDB bulk upsert with UUIDv4 as `_id`.
4. Retry transient HTTP failures with backoff (`429`, `5xx`, network/timeout).
5. Emit structured logs (JSON) for retries, skipped records, and run summary.

## Non-goals (for this delivery)
- No production scheduler / watermark orchestration.
- No metrics system (Datadog/Prometheus) in code; only minimal logs.
- No public API endpoints required (import logic only).
