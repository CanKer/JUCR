# Decisions (ADR-lite)

## D1 – Use native fetch
**Decision:** Use Node 20 native `fetch` for OpenChargeMap HTTP calls.  
**Reason:** Avoid runtime dependencies; simpler runtime environment.  
**Tradeoff:** Fewer built-in features vs axios; we implement needed behaviors (timeouts, retries) ourselves.

## D2 – Jest for tests
**Decision:** Use Jest + ts-jest.  
**Reason:** Fast setup and familiar ergonomics for team members experienced with Jest.  
**Tradeoff:** Slightly more config than Vitest in some ESM cases; acceptable for this scope.

## D3 – Concurrency limiter without external libs
**Decision:** Implement a small async limiter in `src/shared/concurrency`.  
**Reason:** Keep dependencies minimal; explicit control over behavior.  
**Tradeoff:** Less feature-rich than proven libs; covered by unit tests.

## D4 – Bulk upsert persistence
**Decision:** Use `bulkWrite` with `updateOne` + `upsert: true`.  
**Reason:** Performance and idempotency.  
**Tradeoff:** Need careful mapping of update documents; validated by repository tests.

## D5 – CI is the final gate
**Decision:** GitHub Actions runs lint + typecheck + unit + e2e.  
**Reason:** Hooks can be bypassed; CI enforces quality consistently.
