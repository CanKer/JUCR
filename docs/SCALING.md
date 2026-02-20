# Horizontal Scaling Strategy

This document describes how the current POI importer can scale to millions of records and multiple workers without changing core domain boundaries.

## 1) Work partitioning

Use deterministic partitions so workers can process in parallel with low overlap:

- Time windows: split by `[from, to)` using fixed window sizes (for incremental imports).
- Geographic shards: split by country or bounding boxes when full refresh is required.
- Hybrid approach: shard by geography, then process time windows per shard.

Key rule: each partition must have a stable unique key so jobs are idempotent at scheduling level.

## 2) Job leasing / claiming

Use a shared `import_windows` collection (or equivalent queue) with statuses like `pending`, `leased`, `done`, `failed`.

- Workers claim jobs atomically (`findOneAndUpdate`) and set `lease.owner` + `lease.until`.
- Expired leases are reclaimable, so crashed workers do not block progress.
- Retries increment attempt counters and keep error metadata for observability.

This avoids duplicate processing of the same partition at the same time.

## 3) Distributed rate limiting

Per-process retry/backoff is not enough when many workers run concurrently. Add a distributed token bucket in Redis:

- Shared bucket key per upstream API (or per API key).
- Before each request, workers consume one token.
- If no token is available, workers wait until refill time.
- Refill rate is tuned to provider limits and adjusted by environment.

This keeps global request volume under provider limits across all workers.

## 4) Idempotency and duplicate requests

Idempotent DB upserts make retries safe at storage level:

- Re-importing the same POI key updates existing records instead of creating duplicates.
- Partial failures can be retried without corrupting state.

However, idempotent upserts do not prevent duplicate HTTP requests across workers. Without proper partition leasing and distributed rate limiting, multiple workers can still fetch the same external data, increasing cost and rate-limit pressure.

