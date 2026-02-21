# JUCR - Scalable POI Importer

Node.js/TypeScript importer that fetches POIs from OpenChargeMap and upserts them into MongoDB.

## Quick Start

```bash
nvm use
npm ci
docker compose up -d mongo
npm run check
```

## Run Modes

Quality checks:

- `npm run check` -> `lint + typecheck + unit tests`
- `npm run check:e2e` -> `REQUIRE_MONGO_E2E=1 npm run test:e2e`

Test execution:

- `npm run test:unit`: unit-only suite.
- `npm run test:e2e`: e2e project only.
- E2E tests run only when `REQUIRE_MONGO_E2E=1`.

Example local E2E command:

```bash
REQUIRE_MONGO_E2E=1 \
MONGO_URI=mongodb://127.0.0.1:27017/jucr \
OCM_BASE_URL=http://127.0.0.1:3999 \
OCM_API_KEY=test \
npm run test:e2e
```

For E2E you need:

1. Mongo running (for example `docker compose up -d mongo`)
2. Fake OCM server running (for example `npm run start:fake-ocm`)

## Local Import Run

```bash
npm run build
npm run start:fake-ocm
```

In another terminal:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/jucr \
OCM_BASE_URL=http://127.0.0.1:3999 \
OCM_API_KEY=test \
node dist/src/cli/import.js
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017/jucr` | Mongo connection string |
| `OCM_BASE_URL` | `https://api.openchargemap.io/v3` | Base URL for OpenChargeMap API |
| `OCM_API_KEY` | `""` | API key header value |
| `OCM_TIMEOUT_MS` | `8000` | HTTP request timeout (ms) |
| `IMPORT_CONCURRENCY` | `10` | Transform concurrency per page |
| `IMPORT_PAGE_SIZE` | `100` | Fetch page size |
| `IMPORT_MAX_PAGES` | `1000` | Max pages per run (guardrail) |
| `IMPORT_START_OFFSET` | `0` | Initial offset for paging |
| `IMPORT_DATASET` | unset | Dataset selector (test/fake-server scenarios) |
| `IMPORT_MODIFIED_SINCE` | unset | Optional modified-since filter |
| `FAKE_OCM_PORT` | `3999` | Fake OCM server listen port |
| `REQUIRE_MONGO_E2E` | unset | When `1`, enables Mongo-backed E2E tests |

Use `.env.example` as baseline local template.

## CI Notes

Workflow: `.github/workflows/ci.yml`

CI runs:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `npm run test:unit`
6. fake OCM server bootstrap
7. `npm run test:e2e` with `REQUIRE_MONGO_E2E=1` and Mongo service

## Submission Cleanliness

- Node version is pinned in `.nvmrc` (`20`).
- `node_modules/` is ignored in `.gitignore`.
- Build/test artifacts (`dist/`, `coverage/`, logs) are ignored from commits.
