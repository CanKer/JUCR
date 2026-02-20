import http from "http";
import type { AddressInfo } from "net";
import type { PoiDoc, PoiRepository } from "../../src/ports/PoiRepository";
import { OpenChargeMapHttpClient } from "../../src/infrastructure/openchargemap/OpenChargeMapHttpClient";
import { importPois } from "../../src/application/import-pois/importPois.usecase";
import { defaultImporterConfig } from "../../src/application/import-pois/importer.config";

type TestServer = {
  baseUrl: string;
  getRequestCount: () => number;
  close: () => Promise<void>;
};

const startOcmLikeServer = async (opts: { total: number; ratelimit?: number; fail500?: number }): Promise<TestServer> => {
  let requestCount = 0;
  let rateLimitedResponses = 0;
  let failed500Responses = 0;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/poi") {
      res.writeHead(404);
      res.end();
      return;
    }

    requestCount += 1;

    const rateLimit = opts.ratelimit ?? 0;
    if (rateLimitedResponses < rateLimit) {
      rateLimitedResponses += 1;
      res.writeHead(429, { "content-type": "application/json", "Retry-After": "1" });
      res.end(JSON.stringify({ error: "rate_limited" }));
      return;
    }

    const fail500 = opts.fail500 ?? 0;
    if (failed500Responses < fail500) {
      failed500Responses += 1;
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "temporary_server_failure" }));
      return;
    }

    const limit = Number(url.searchParams.get("limit") ?? "100");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const end = Math.min(opts.total, offset + limit);
    const items = [];
    for (let id = offset + 1; id <= end; id += 1) {
      items.push({ ID: id, AddressInfo: { Title: `POI ${id}` } });
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(items));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    getRequestCount: () => requestCount,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      })
  };
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

describe("importPois resilience without Mongo dependency", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("imports a dataset spanning more than three pages", async () => {
    const server = await startOcmLikeServer({ total: 45 });
    const { repo, docsByExternalId } = createInMemoryUpsertRepo();
    const client = new OpenChargeMapHttpClient(server.baseUrl, "test");

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5 }
    });

    expect(docsByExternalId.size).toBe(45);
    expect(server.getRequestCount()).toBeGreaterThan(3);

    await server.close();
  });

  it("recovers from transient 429 responses with Retry-After", async () => {
    const server = await startOcmLikeServer({ total: 25, ratelimit: 2 });
    const { repo, docsByExternalId } = createInMemoryUpsertRepo();
    const client = new OpenChargeMapHttpClient(server.baseUrl, "test");

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5 }
    });

    expect(docsByExternalId.size).toBe(25);

    await server.close();
  });

  it("recovers from transient 500 responses", async () => {
    const server = await startOcmLikeServer({ total: 25, fail500: 2 });
    const { repo, docsByExternalId } = createInMemoryUpsertRepo();
    const client = new OpenChargeMapHttpClient(server.baseUrl, "test");

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5 }
    });

    expect(docsByExternalId.size).toBe(25);

    await server.close();
  });
});
