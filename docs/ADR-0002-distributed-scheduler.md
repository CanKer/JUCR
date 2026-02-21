# ADR-0002: Distributed Scheduler and Job Leasing

## Status
Accepted

## Context

Phase 2 of the challenge requires the data import process to be horizontally scalable.

The current importer is:
- Stateless
- Idempotent at the storage layer (externalId unique + upsert)
- Designed using ports/adapters (hexagonal architecture)

This makes horizontal scaling technically feasible.

However, implementing a full distributed scheduler (job leasing, distributed rate limiting, worker coordination) would introduce significant infrastructure complexity (Redis, queues, lease management, dead-letter handling) which exceeds the scope of the challenge.

The objective of this implementation is to demonstrate:
- Correctness
- Robustness
- Clear architectural extensibility
- Production-aware design decisions

Not to build a full distributed job platform.

---

## Alternatives Considered

### 1) Mongo-based Job Leasing (Implemented via collection + TTL leases)
- Workers claim jobs by setting `leaseOwner` and `leaseUntil`
- Periodic renewal
- Dead job detection
- Requires careful race-condition handling

**Rejected for this phase** due to added complexity and time constraints.

---

### 2) Redis-backed Distributed Rate Limiting (Token Bucket)
- Global token bucket per API
- Lua script for atomic token decrement
- Required to coordinate multiple workers

**Rejected for this phase** because:
- Not required for single-worker robustness
- Introduces infrastructure dependency
- Adds failure modes unrelated to core importer correctness

---

### 3) Queue-based Scheduler (BullMQ / Redis Streams / SQS)
- Decouples job generation and execution
- Enables retries, dead-letter queues

**Rejected for this phase** due to:
- Scope expansion
- Infrastructure overhead
- Additional operational concerns

---

## Decision

Do not implement a distributed scheduler in this challenge.

Instead:

- Keep importer stateless.
- Maintain idempotent upsert strategy.
- Enforce strict retry and pagination guardrails.
- Provide a documented scaling strategy (see docs/SCALING.md).
- Design extension points (ports) that would allow job orchestration in future phases.

This ensures correctness and production readiness without over-engineering.

---

## Consequences

- The importer runs as a single worker by default.
- Horizontal scaling requires a job-partitioning layer to be added.
- The current architecture allows that extension without refactoring core logic.
- Infrastructure complexity is consciously deferred.

This is an intentional architectural tradeoff.