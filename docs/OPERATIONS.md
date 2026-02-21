# Operations Guide

This document describes how to operate the JUCR POI Importer in a production-like environment.

The importer is designed to be:

- Stateless
- Idempotent
- Safe to re-run
- Guarded against infinite loops
- Defensive against malformed external data

## 1. Running the Import

### Manual Execution

```bash
npm run build
node dist/src/cli/import.js
```

Required environment variables:

- `OCM_BASE_URL`
- `MONGO_URI`

Optional environment variables:

- `OCM_API_KEY`
- `IMPORT_CONCURRENCY`
- `IMPORT_PAGE_SIZE`
- `IMPORT_MAX_PAGES`
- `IMPORT_START_OFFSET`
- `IMPORT_DATASET`
- `IMPORT_MODIFIED_SINCE`
- `OCM_TIMEOUT_MS`

## 2. Safe Re-Execution

The importer is safe to re-run because:

- MongoDB enforces a unique index on `externalId`.
- Upserts are used instead of inserts.
- Duplicate data does not corrupt storage.

Re-running the importer will:

- Update existing records when needed.
- Insert new records.
- Not duplicate existing POIs.

## 3. Handling Failures

### API Failures

- `5xx` -> retried automatically
- `429` -> respects `Retry-After`
- `4xx` (except `429`) -> fails fast

### Mongo Failures

- Repository errors are treated as fatal.
- Import process exits with error.
- No partial corruption occurs due to idempotent writes.

## 4. Observing Execution

At the end of execution, a structured summary is logged:

- `pagesProcessed`
- `processed`
- `skippedInvalid`
- `skippedByCode`

This allows operators to validate expected behavior quickly.

## 5. Reprocessing Strategy

If data corruption or external API inconsistency is detected:

- The importer can be re-run safely.
- Specific shards (future extension) can be reprocessed independently.

## 6. Production Considerations

In a production deployment:

- Mongo should use authentication and TLS.
- Environment variables must be configured securely.
- The importer should run as a scheduled job (for example, cron or Kubernetes Job).
- Horizontal scaling requires job partitioning (see `docs/SCALING.md`).

## 7. Non-Goals

This importer does not:

- Provide scheduling logic.
- Provide a distributed job queue.
- Perform automatic rollback.

Those concerns belong to orchestration infrastructure, not the importer core.
