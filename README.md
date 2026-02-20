# JUCR - Scalable POI Importer

Node.js/TypeScript importer that fetches POIs from OpenChargeMap and upserts them into MongoDB.

## What This Repo Includes

- Hexagonal-ish folder structure
- Native `fetch` HTTP client with retry helper
- MongoDB bulk upsert repository (`externalId` unique)
- Fake OpenChargeMap server for deterministic E2E scenarios
- Unit and E2E tests with Jest
- GitHub Actions CI (`lint`, `typecheck`, `build`, `unit`, `e2e`)
- Docker Compose for local MongoDB

## Quick Start

```bash
npm i
docker compose up -d
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e:local
```

## Local Import Run

1. Build and start fake OCM server:

```bash
npm run build
npm run start:fake-ocm
```

2. In another terminal, run importer:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/jucr \
OCM_BASE_URL=http://127.0.0.1:3999 \
OCM_API_KEY=test \
node dist/src/cli/import.js
```

## Commands

- `npm run dev` - run local HTTP server (`dist/src/server.js`)
- `npm run build` - compile TypeScript to `dist/`
- `npm run lint` - lint `src/` and `tests/`
- `npm run typecheck` - TypeScript no-emit check
- `npm run test:unit` - unit tests
- `npm run test:e2e` - E2E tests (requires MongoDB and fake OCM server running)
- `npm run test:e2e:local` - local E2E wrapper (starts Mongo if needed, runs fake OCM + E2E, cleans up resources it started)
- `npm run start:fake-ocm` - start local fake OpenChargeMap server

## Environment Variables

- `MONGO_URI` (default: `mongodb://localhost:27017/jucr`)
- `OCM_BASE_URL` (default: `https://api.openchargemap.io/v3`)
- `OCM_API_KEY` (default: empty string)
- `FAKE_OCM_PORT` (default: `3999`)

Use `.env.example` as the local template.

## CI

Workflow file: `.github/workflows/ci.yml`

CI pipeline steps:
1. Install dependencies
2. Lint
3. Typecheck
4. Build
5. Unit tests
6. Start fake OCM server
7. Run E2E tests against Mongo service

## Local E2E Automation

Run:

```bash
npm run test:e2e:local
```

Behavior:
- Reuses existing `docker compose` Mongo service when already running.
- Starts `mongo` service automatically when not running.
- Starts fake OCM server automatically.
- Runs E2E with `REQUIRE_MONGO_E2E=1`.
- Stops fake OCM and stops Mongo only if Mongo was started by the script.

Optional env vars:
- `AUTO_START_DOCKER=1|0` (default: `1` on macOS attempts `open -a Docker` if daemon is down)
- `MONGO_SERVICE` (default: `mongo`)
- `MONGO_URI` (default: `mongodb://127.0.0.1:27017/jucr`)
- `FAKE_OCM_PORT` (default: `3999`)
- `OCM_BASE_URL` (default: `http://127.0.0.1:3999`)
- `OCM_API_KEY` (default: `test`)

## Notes

- Runtime uses Node 20+ with native `fetch`.
- POI `_id` is UUIDv4 generated in transformation.
- Idempotency is enforced via `externalId` unique index plus upsert.
