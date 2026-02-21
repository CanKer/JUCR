# Horizontal Scaling Strategy

The current importer is designed to be horizontally scalable by design, even though it runs as a single worker in this challenge.

Key properties enabling scalability:

- Stateless execution
- Idempotent storage layer (externalId unique index + upsert)
- Bounded concurrency
- Deterministic pagination guardrails
- Retry classification (429/5xx vs fatal 4xx)

---

## Minimal Multi-Worker Plan

To scale beyond a single instance:

### 1) Work Partitioning

Partition the dataset by one of:

- Country / region
- Bounding box shards
- Time windows (based on DateLastStatusUpdate)

Each partition becomes a "job shard".

---

### 2) Job Model (Conceptual)

Example Job Document:

```json
{
  "jobId": "uuid",
  "shardKey": "country:DE",
  "status": "pending | running | done | failed",
  "leaseOwner": "worker-1",
  "leaseUntil": "2026-01-01T00:00:00Z",
  "attempts": 1,
  "cursor": {
    "startOffset": 0,
    "maxPages": 100
  },
  "lastErrorCode": null,
  "lastErrorAt": null
}