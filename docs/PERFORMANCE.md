# Performance Notes

This document summarizes practical performance behavior for the current importer implementation.

## 1) Why `bulkWrite` is the persistence baseline

`MongoPoiRepository` writes one page with one unordered bulk operation:

- fewer DB round-trips than one write per POI,
- better throughput at page boundaries,
- resilient to per-document write failures with `{ ordered: false }`.

Combined with upsert-by-`externalId`, it preserves idempotent write behavior during retries.

## 2) In-batch dedupe impact

Before writing, docs are deduped by `externalId` (last occurrence wins).

- avoids conflicting upserts for duplicate keys in the same page,
- reduces unnecessary update workload,
- keeps write behavior deterministic per page.

## 3) Concurrency and page size tradeoffs

`pageSize`:

- larger page: fewer HTTP calls and fewer bulk writes, but higher memory and larger retry blast radius,
- smaller page: lower memory and quicker failure recovery, but more request overhead.

`concurrency` (transform fan-out only):

- higher values can improve throughput for CPU-heavy transforms,
- too high increases CPU/GC pressure and can flatten gains.

## 4) Complexity (current model)

Per page:

- transform stage: `O(n)` for `n = pageSize`,
- dedupe stage: `O(n)` using a hash map,
- write stage: `O(k)` operations where `k <= n` (unique externalIds in page).

Per run:

- approximately linear in imported records: `O(totalRecords)`.

## 5) Recommended defaults (current code)

From the current runtime defaults:

- `concurrency = 10`
- `pageSize = 100`
- `maxPages = 1000`
- `startOffset = 0`
- HTTP timeout = `8000ms`

Suggested tuning flow:

1. keep defaults for baseline stability,
2. increase `pageSize` gradually while watching memory and retry cost,
3. increase `concurrency` only while throughput scales,
4. keep safety caps enabled to avoid accidental overload.
