# JUCR – Scalable POI Importer (Scaffold)

This repository is a **starter scaffold** for the JUCR technical challenge (Part 2: scalable import into MongoDB).
It provides:
- Hexagonal-ish folder structure
- TypeScript + Jest setup
- ESLint baseline (minimal, professional)
- GitHub Actions CI (lint + typecheck + unit + e2e)
- Docker Compose for MongoDB
- A tiny HTTP server entrypoint (placeholder)
- Planning + architecture + decisions docs to keep Codex aligned

## Quick start

```bash
npm i
docker compose up -d
npm run typecheck
npm run lint
npm test
```

## Commands

- `npm run dev` – start local placeholder server (for future use)
- `npm run lint` – eslint
- `npm run typecheck` – TypeScript noEmit
- `npm run test:unit` – unit tests
- `npm run test:e2e` – e2e tests (uses MongoDB and a local fake OCM server)
- `npm run start:fake-ocm` – local fake OpenChargeMap server for E2E

## Environment

Copy `.env.example` to `.env` if you want to run locally with env vars.

## Notes

This scaffold intentionally avoids extra runtime dependencies. The importer will use **native fetch (Node 20)**.
