import { importPois } from "../../src/application/import-pois/importPois.usecase";
import { defaultImporterConfig } from "../../src/application/import-pois/importer.config";
import type { OpenChargeMapClient } from "../../src/ports/OpenChargeMapClient";
import type { PoiDoc, PoiRepository } from "../../src/ports/PoiRepository";

const createCapturingRepo = () => {
  const batches: PoiDoc[][] = [];
  const repo: PoiRepository = {
    upsertMany: async (docs) => {
      batches.push(docs);
      return { upserted: docs.length, modified: 0 };
    }
  };

  return { repo, batches };
};

describe("importPois invalid POI handling", () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("skips invalid POIs and continues importing remaining items", async () => {
    const pages = [
      [
        { ID: 1, AddressInfo: { Title: "POI 1" } },
        { AddressInfo: { Title: "Missing ID" } },
        { ID: 2, AddressInfo: { Title: "POI 2" } },
        { ID: "not-a-number", AddressInfo: { Title: "Bad ID" } }
      ],
      [{ ID: 3, AddressInfo: { Title: "POI 3" } }],
      []
    ];
    let fetchCount = 0;

    const client: OpenChargeMapClient = {
      fetchPois: async () => pages[fetchCount++] ?? []
    };

    const { repo, batches } = createCapturingRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 4, concurrency: 3 }
    });

    expect(fetchCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    const skipLog1 = JSON.parse(String(warnSpy.mock.calls[0][0])) as Record<string, unknown>;
    const skipLog2 = JSON.parse(String(warnSpy.mock.calls[1][0])) as Record<string, unknown>;
    expect(skipLog1).toEqual({
      event: "import.poi_skipped",
      reason: "Invalid POI: missing ID",
      offset: 0,
      pageSize: 4,
      skippedCount: 1
    });
    expect(skipLog2).toEqual({
      event: "import.poi_skipped",
      reason: "Invalid POI: ID is not numeric",
      offset: 0,
      pageSize: 4,
      skippedCount: 2
    });
    expect(JSON.stringify(skipLog1)).not.toContain("AddressInfo");
    expect(JSON.stringify(skipLog1)).not.toContain("Missing ID");

    expect(batches).toHaveLength(2);
    expect(batches[0].map((doc) => doc.externalId)).toEqual([1, 2]);
    expect(batches[1].map((doc) => doc.externalId)).toEqual([3]);

    const completion = JSON.parse(String(logSpy.mock.calls[0][0])) as {
      event: string;
      processed: number;
      skipped: number;
      total: number;
      pagesProcessed: number;
      skippedInvalid: number;
      skippedByCode?: { invalid_poi?: number };
    };
    expect(completion).toEqual({
      event: "import.completed",
      processed: 3,
      skipped: 2,
      pagesProcessed: 2,
      total: 3,
      skippedInvalid: 2,
      skippedByCode: { invalid_poi: 2 }
    });
  });

  it("imports page with 2 valid + 1 invalid record and completes with skipped count", async () => {
    const pages = [
      [
        { ID: 100, AddressInfo: { Title: "POI 100" } },
        { AddressInfo: { Title: "Invalid - no id", Secret: "should-not-leak" } },
        { ID: 101, AddressInfo: { Title: "POI 101" } }
      ],
      []
    ];
    let fetchCount = 0;

    const client: OpenChargeMapClient = {
      fetchPois: async () => pages[fetchCount++] ?? []
    };

    const { repo, batches } = createCapturingRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 3, concurrency: 2 }
    });

    expect(fetchCount).toBe(2);
    expect(batches).toHaveLength(1);
    expect(batches[0].map((doc) => doc.externalId)).toEqual([100, 101]);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const skipLog = JSON.parse(String(warnSpy.mock.calls[0][0])) as Record<string, unknown>;
    expect(skipLog).toEqual({
      event: "import.poi_skipped",
      reason: "Invalid POI: missing ID",
      offset: 0,
      pageSize: 3,
      skippedCount: 1
    });
    expect(JSON.stringify(skipLog)).not.toContain("Secret");
    expect(JSON.stringify(skipLog)).not.toContain("should-not-leak");

    const completion = JSON.parse(String(logSpy.mock.calls[0][0])) as {
      event: string;
      processed: number;
      skipped: number;
      pagesProcessed: number;
      total: number;
      skippedInvalid: number;
      skippedByCode?: { invalid_poi?: number };
    };
    expect(completion).toEqual({
      event: "import.completed",
      processed: 2,
      skipped: 1,
      pagesProcessed: 1,
      total: 2,
      skippedInvalid: 1,
      skippedByCode: { invalid_poi: 1 }
    });
  });

  it("fails the import for non-POI-validation errors", async () => {
    const client: OpenChargeMapClient = {
      fetchPois: async () => [{ ID: 1, AddressInfo: { Title: "POI 1" } }]
    };

    const repo: PoiRepository = {
      upsertMany: async () => {
        throw new Error("mongo write failed");
      }
    };

    await expect(
      importPois({
        client,
        repo,
        config: { ...defaultImporterConfig, pageSize: 10, concurrency: 2 }
      })
    ).rejects.toThrow("mongo write failed");
  });
});
