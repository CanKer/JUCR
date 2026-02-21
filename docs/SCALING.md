# Horizontal Scaling Strategy

The current importer is single-worker, but the architecture is prepared for multi-worker scaling.

Current properties that make scaling feasible:

- Stateless importer runtime
- Idempotent writes (`externalId` unique + upsert)
- Bounded retry and pagination guardrails
- Clear port boundaries for introducing orchestration components

## 1. Partitioning Model

To scale to high volume, split the workload into deterministic shards:

- Geographic shards (country or bbox ranges)
- Time-window shards (`[from, to)` on `DateLastStatusUpdate`)
- Hybrid (geography first, then windows)

Shard identity must be stable so retries and reassignment remain idempotent.

## 2. Job Leasing / Claiming

Use a shared job store with atomic lease acquisition.

Example conceptual job document:

```json
{
  "jobId": "uuid",
  "shardKey": "country:DE|window:2026-02-21T00:00:00Z..2026-02-21T01:00:00Z",
  "status": "pending",
  "leaseOwner": null,
  "leaseUntil": null,
  "attempts": 0,
  "cursor": { "startOffset": 0, "maxPages": 100 },
  "lastErrorCode": null,
  "lastErrorAt": null
}
```

Workers should:

1. Atomically claim one pending/expired-lease job.
2. Renew lease while processing.
3. Mark `done` or `failed` with attempt metadata.

This avoids duplicate active processing of the same shard.

## 3. Distributed Rate Limiting

When multiple workers run, local backoff is not enough.

Recommended approach:

- Global token bucket in Redis keyed by API key/provider
- Atomic token consumption (for example via Lua script)
- Workers wait when the shared budget is exhausted

This keeps aggregate outbound request rate within provider limits.

## 4. Idempotency Boundaries

Idempotent DB writes make retries safe:

- Replaying a page does not create duplicates.
- Partial failures can be retried safely.

But idempotent writes do not prevent duplicated outbound HTTP requests across workers.  
Leasing + distributed rate limiting are still required for efficient horizontal scale.
