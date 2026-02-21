# POI Input Contract

This document defines the minimum required contract for POI ingestion.

The importer is designed to be tolerant and forward-compatible with OpenChargeMap.

---

## 1. Required Field

Only one field is strictly required:

- `ID` (numeric or numeric string)

Rules:

- Must be convertible to a positive integer.
- Used as `externalId` for idempotent storage.
- Missing or invalid ID results in record rejection.

---

## 2. Optional Fields

All other fields are optional, including:

- `DateLastStatusUpdate`
- `AddressInfo`
- `Connections`
- `OperatorInfo`
- Any additional metadata

Invalid or missing optional fields:

- Do not invalidate the POI.
- Are preserved in `raw` as received.

---

## 3. Storage Model

Stored document structure:

```ts
{
  _id: string; // UUIDv4
  externalId: number;
  lastUpdated?: Date;
  raw: Record<string, unknown>;
}
```

## 4. Schema Evolution Strategy

Because the full raw payload is preserved:

- Schema changes from OpenChargeMap do not break ingestion.
- Additional fields are automatically persisted.
- No rigid schema enforcement is applied beyond the required ID.

---

## 5. Corrupt Data Handling

Examples of invalid POIs:

- Missing ID
- Non-numeric ID
- ID <= 0

Such records:

- Are skipped.
- Do not fail the import job.
- Are logged safely.

---

## 6. Compatibility Goal

The importer prioritizes:

- Compatibility over strict validation.
- Data integrity via unique externalId.
- Resilience against upstream inconsistencies.
