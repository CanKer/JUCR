# ADR-0002: Not Implementing a Distributed Scheduler in This Challenge

## Status

Accepted

## Context

The importer design now includes job and leasing interfaces to support future multi-worker execution.  
A full distributed scheduler (job generation, lease orchestration, retries, rebalancing, and worker coordination) would be the next implementation step for horizontal scaling.

## Decision

A distributed scheduler is **not implemented** in this challenge.

## Rationale

- Challenge scope prioritizes importer correctness, idempotent persistence, retry robustness, and testability.
- Time is better spent hardening current behavior (pagination guardrails, HTTP resilience, invalid-record handling, storage consistency).
- The codebase now includes scaling-oriented design stubs (job model + repository contract) so scheduler implementation can be added later without breaking architecture boundaries.

## Consequences

- Runtime remains single-worker.
- No lease-claim loop is executed in production code yet.
- Horizontal scaling remains documented as a next step (`docs/SCALING.md`) and prepared by interfaces (`src/core/jobs/ImportJob.ts`, `src/ports/ImportJobRepository.ts`).
