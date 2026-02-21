# Database

This project persists imported POIs in MongoDB.

## Collection

- Name: `pois`
- Source file: `src/infrastructure/mongo/MongoPoiRepository.ts`

## Document shape

Current stored fields:

- `_id: string` (UUIDv4 generated during transform)
- `externalId: number` (stable upstream key used for idempotent upserts)
- `lastUpdated?: Date`
- `raw: Record<string, unknown>` (raw POI payload snapshot)

## Indexes

Defined in `src/infrastructure/mongo/mongo.indexes.ts`:

- `externalId: 1` with `unique: true`

This index enforces one persisted document per upstream POI key.

## Upsert strategy

`MongoPoiRepository.upsertMany()` uses `bulkWrite` with `updateOne` + `upsert: true`:

- Filter: `{ externalId: doc.externalId }`
- `$setOnInsert`: `{ _id, externalId }`
- `$set`: `{ lastUpdated, raw }`
- Write mode: `{ ordered: false }`

Batch hardening:

- Incoming docs are deduped by `externalId` before `bulkWrite`.
- If a page contains duplicates, the last occurrence wins.
