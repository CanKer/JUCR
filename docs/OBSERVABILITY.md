# Observability Strategy

This document describes logging, monitoring, and alerting considerations.

The current implementation provides structured logs and deterministic behavior suitable for production extension.

---

## 1. Logging

Structured JSON logging is used.

Logs include:

- HTTP status codes
- Retry attempts
- Page offsets
- Processed/skipped counts

Logs intentionally exclude:

- Full raw POI payloads
- API keys
- HTTP response bodies

This minimizes risk of sensitive data exposure.

---

## 2. Key Metrics (Recommended)

If instrumented in production, the following metrics would be exposed:

### Import Metrics

- import_pages_processed_total
- import_records_processed_total
- import_records_skipped_total
- import_failures_total

### HTTP Metrics

- ocm_requests_total
- ocm_retries_total
- ocm_rate_limit_responses_total
- ocm_timeouts_total

### Storage Metrics

- mongo_bulk_writes_total
- mongo_write_failures_total

---

## 3. Alerting Strategy

Suggested alerts:

- High rate of 5xx from OCM
- Excessive 429 responses
- Import failure rate > threshold
- Zero records processed unexpectedly
- Mongo write failures

---

## 4. Tracing (Future Phase)

Distributed tracing could be added via:

- OpenTelemetry instrumentation
- Correlation IDs per import run
- Trace context propagation

Not implemented in this challenge.

---

## 5. Operational Health Signals

Healthy import characteristics:

- Gradual page progression
- Limited retries
- Stable throughput
- No fatal 4xx bursts

Degraded characteristics:

- Continuous retries
- Rapid 429 accumulation
- Early fatal failures