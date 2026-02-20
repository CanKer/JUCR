import type { OpenChargeMapClient, FetchPoisParams, RawPoi } from "../../src/ports/OpenChargeMapClient";
import type { PoiDoc, PoiRepository } from "../../src/ports/PoiRepository";
import { retry } from "../../src/shared/retry/retry";
import { importPois } from "../../src/application/import-pois/importPois.usecase";
import { defaultImporterConfig } from "../../src/application/import-pois/importer.config";

type SimulatedClientError = Error & {
  status?: number;
  isTimeout?: boolean;
  retryDelayMs?: number;
};

const createInMemoryUpsertRepo = () => {
  const docsByExternalId = new Map<number, PoiDoc>();
  const repo: PoiRepository = {
    upsertMany: async (docs) => {
      let upserted = 0;
      let modified = 0;
      for (const doc of docs) {
        if (docsByExternalId.has(doc.externalId)) {
          modified += 1;
        } else {
          upserted += 1;
        }
        docsByExternalId.set(doc.externalId, doc);
      }
      return { upserted, modified };
    }
  };

  return { repo, docsByExternalId };
};

const createRetryingFakeClient = (opts: {
  total: number;
  ratelimit?: number;
  fail500?: number;
  timeoutFailures?: number;
}) => {
  let requestAttempts = 0;
  let emitted429 = 0;
  let emitted500 = 0;
  let emittedTimeouts = 0;
  const calls: FetchPoisParams[] = [];

  const fetchPage = async (params: FetchPoisParams): Promise<RawPoi[]> => {
    requestAttempts += 1;

    if (emitted429 < (opts.ratelimit ?? 0)) {
      emitted429 += 1;
      const err = new Error("rate limited") as SimulatedClientError;
      err.status = 429;
      err.retryDelayMs = 1;
      throw err;
    }

    if (emitted500 < (opts.fail500 ?? 0)) {
      emitted500 += 1;
      const err = new Error("temporary server failure") as SimulatedClientError;
      err.status = 500;
      throw err;
    }

    if (emittedTimeouts < (opts.timeoutFailures ?? 0)) {
      emittedTimeouts += 1;
      const err = new Error("timeout") as SimulatedClientError;
      err.isTimeout = true;
      throw err;
    }

    const offset = params.offset ?? 0;
    const limit = params.limit ?? 100;
    const end = Math.min(opts.total, offset + limit);
    const page: RawPoi[] = [];

    for (let id = offset + 1; id <= end; id += 1) {
      page.push({ ID: id, AddressInfo: { Title: `POI ${id}` } });
    }

    return page;
  };

  const client: OpenChargeMapClient = {
    fetchPois: async (params) => {
      calls.push(params);
      return retry(
        () => fetchPage(params),
        {
          retries: 5,
          minDelayMs: 1,
          maxDelayMs: 5,
          shouldRetry: (error) => {
            const err = error as SimulatedClientError;
            if (err.isTimeout) return true;
            if (err.status === 429) return { retry: true, delayMs: err.retryDelayMs };
            if (typeof err.status === "number" && err.status >= 500) return true;
            if (typeof err.status === "number") return false;
            return true;
          }
        }
      );
    }
  };

  return {
    client,
    getRequestAttempts: () => requestAttempts,
    getCalls: () => calls.slice()
  };
};

describe("importPois resilience without Mongo dependency", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("imports a dataset spanning more than three pages", async () => {
    const { client, getCalls } = createRetryingFakeClient({ total: 45 });
    const { repo, docsByExternalId } = createInMemoryUpsertRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5 }
    });

    expect(docsByExternalId.size).toBe(45);
    expect(getCalls().length).toBe(5);
  });

  it("recovers from transient 429 responses with Retry-After", async () => {
    const { client, getRequestAttempts } = createRetryingFakeClient({ total: 25, ratelimit: 2 });
    const { repo, docsByExternalId } = createInMemoryUpsertRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5 }
    });

    expect(docsByExternalId.size).toBe(25);
    expect(getRequestAttempts()).toBe(5);
  });

  it("recovers from transient 500 responses", async () => {
    const { client, getRequestAttempts } = createRetryingFakeClient({ total: 25, fail500: 2 });
    const { repo, docsByExternalId } = createInMemoryUpsertRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5 }
    });

    expect(docsByExternalId.size).toBe(25);
    expect(getRequestAttempts()).toBe(5);
  });

  it("recovers from transient timeout failures", async () => {
    const { client, getRequestAttempts } = createRetryingFakeClient({ total: 25, timeoutFailures: 2 });
    const { repo, docsByExternalId } = createInMemoryUpsertRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5 }
    });

    expect(docsByExternalId.size).toBe(25);
    expect(getRequestAttempts()).toBe(5);
  });
});
