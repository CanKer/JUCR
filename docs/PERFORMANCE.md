# PERFORMANCE

This document summarizes current performance choices for the POI importer and how to tune them safely.

## Why `bulkWrite` in Mongo repository

- The importer transforms each page and persists it with a single `bulkWrite` call.
- This minimizes network round-trips compared with one write per POI.
- Using unordered bulk operations (`ordered: false`) lets Mongo continue processing independent operations even if one fails.
- Upsert by `externalId` keeps repeated imports idempotent at the storage layer.

## Why batch dedupe exists

- A single page can contain repeated `externalId` values.
- The repository dedupes the page batch before `bulkWrite`.
- This avoids conflicting upsert operations for the same key in one bulk request and reduces unnecessary writes.

## `pageSize` tradeoffs

- Larger `pageSize`:
- Fewer HTTP requests and fewer Mongo write calls.
- Higher memory use per page and larger retry blast radius when a page fails.
- Smaller `pageSize`:
- Lower memory use and faster recovery for failed pages.
- More request overhead and more write operations.

Practical default: keep `pageSize` moderate, then tune after measuring CI/local run times.

## `concurrency` tradeoffs

- Concurrency only controls transformation fan-out before persistence.
- Higher concurrency can improve throughput when transform cost is non-trivial.
- Very high concurrency can increase CPU pressure and GC overhead with little gain.
- Lower concurrency is more predictable and easier to debug.

Use the smallest value that meets import-time targets.

## Horizontal scaling (conceptual)

Current implementation is single-runner. To scale horizontally in future phases:

- Split import ranges into deterministic windows.
- Use Mongo leases for window ownership.
- Keep POI upserts idempotent by stable unique key.
- Advance global cursor only after all windows up to boundary are done.

This preserves correctness while enabling multi-worker throughput.
