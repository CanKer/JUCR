# Changelog

All notable changes to this project will be documented in this file.

The format loosely follows Keep a Changelog principles.

---

## [1.0.0] – Initial Challenge Submission

### Added

- Hexagonal architecture with manual dependency injection.
- Concurrent import with bounded concurrency.
- Pagination with guardrails (maxPages, startOffset).
- Robust HTTP client with:
  - Timeout via AbortController
  - Retry classification (429, 5xx, network errors)
  - Retry-After header support
  - Fatal handling for 4xx (except 429)
- Idempotent MongoDB storage using:
  - UUID v4 `_id`
  - Unique index on `externalId`
  - bulkWrite upsert strategy
- Tolerant POI validation (strict only for `ID`)
- Structured logging with sanitized output.
- Unit tests covering:
  - Retry logic
  - Timeout handling
  - Pagination edge cases
  - Invalid POI handling
  - Repository behavior
- E2E tests using real MongoDB.
- Docker Compose local environment.
- CI pipeline with Mongo service.
- Documentation:
  - Architecture
  - Scaling strategy
  - ADR decisions
  - Security considerations
  - Database schema
  - Operations
  - Observability
  - Input contract
