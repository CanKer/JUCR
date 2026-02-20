#!/usr/bin/env bash
set -euo pipefail

MONGO_SERVICE="${MONGO_SERVICE:-mongo}"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/jucr}"
OCM_BASE_URL="${OCM_BASE_URL:-http://127.0.0.1:3999}"
OCM_API_KEY="${OCM_API_KEY:-test}"
FAKE_OCM_PORT="${FAKE_OCM_PORT:-3999}"
AUTO_START_DOCKER="${AUTO_START_DOCKER:-1}"

started_mongo=0
fake_pid=""

cleanup() {
  if [[ -n "${fake_pid}" ]]; then
    kill "${fake_pid}" >/dev/null 2>&1 || true
  fi

  if [[ "${started_mongo}" -eq 1 ]]; then
    docker compose stop "${MONGO_SERVICE}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run local Mongo-backed E2E tests." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  if [[ "${AUTO_START_DOCKER}" = "1" ]] && command -v open >/dev/null 2>&1; then
    echo "Docker daemon is not running. Attempting to start Docker Desktop..."
    open -a Docker >/dev/null 2>&1 || true

    for _ in $(seq 1 60); do
      if docker info >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done
  fi
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker and rerun this command." >&2
  exit 1
fi

if docker compose ps --status running --services | grep -qx "${MONGO_SERVICE}"; then
  echo "Mongo service '${MONGO_SERVICE}' is already running. Reusing existing container."
else
  echo "Starting Mongo service '${MONGO_SERVICE}'..."
  docker compose up -d "${MONGO_SERVICE}"
  started_mongo=1
fi

echo "Building project..."
npm run build

echo "Starting fake OCM server on port ${FAKE_OCM_PORT}..."
FAKE_OCM_PORT="${FAKE_OCM_PORT}" node dist/src/fake-ocm-server.js >/tmp/jucr-fake-ocm.log 2>&1 &
fake_pid=$!
sleep 1

echo "Running Mongo-backed E2E tests..."
REQUIRE_MONGO_E2E=1 \
MONGO_URI="${MONGO_URI}" \
OCM_BASE_URL="${OCM_BASE_URL}" \
OCM_API_KEY="${OCM_API_KEY}" \
npm run test:e2e
