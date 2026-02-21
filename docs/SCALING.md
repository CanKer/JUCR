# Horizontal Scaling Strategy

This importer currently runs as a single worker. The strategy below scales it horizontally without changing domain boundaries.

## 1) Partitioning model

Use deterministic partitions so multiple workers can run concurrently with minimal overlap.

- Time windows: process fixed `[from, to)` intervals for incremental imports.
- Geographic shards: split by country code or bbox ranges for full imports.
- Hybrid: shard by geography first, then paginate by time windows per shard.

Partition IDs must be stable (same inputs -> same partition key) so retries and re-claims remain safe.

## 2) Job leasing / claiming

Use a shared job store (for example `import_windows`) with lease metadata.

- Candidate statuses: `pending`, `leased`, `done`, `failed`.
- Claim operation: atomic `findOneAndUpdate` sorted by oldest partition.
- Lease fields: `owner`, `until`, `attempt`.
- Recovery: expired leases return to the candidate pool.

This ensures one active worker per partition while still allowing crash recovery.

## 3) Distributed rate limiting

Per-process backoff is not enough when many workers run at once. Add a Redis token bucket.

- Key scope: per upstream API key (or per API + region).
- Request rule: consume one token before outbound call.
- Empty bucket: wait until refill window.
- Refill policy: tuned to provider quotas.

Result: global request rate stays bounded across all workers.

## 4) Why idempotent writes still matter

Current storage writes are idempotent (`externalId` unique + upsert), which helps with retries:

- Re-running a successful partition does not create duplicates.
- Partial failures can be replayed safely.

But idempotent writes do not prevent duplicated outbound requests. Leasing + distributed rate limiting are still required to avoid waste and limit pressure.
