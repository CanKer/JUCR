import { importPois } from "../../src/application/import-pois/importPois.usecase";
import { defaultImporterConfig } from "../../src/application/import-pois/importer.config";
import type { OpenChargeMapClient, FetchPoisParams, RawPoi } from "../../src/ports/OpenChargeMapClient";
import type { PoiRepository, PoiDoc } from "../../src/ports/PoiRepository";

const createPagedClient = (total: number) => {
  const calls: FetchPoisParams[] = [];

  const client: OpenChargeMapClient = {
    fetchPois: async (params) => {
      calls.push(params);

      const offset = params.offset ?? 0;
      const limit = params.limit ?? 100;
      const end = Math.min(total, offset + limit);
      const page: RawPoi[] = [];

      for (let id = offset + 1; id <= end; id += 1) {
        page.push({ ID: id, AddressInfo: { Title: `POI ${id}` } });
      }

      return page;
    }
  };

  return { client, calls };
};

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

describe("importPois pagination", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("imports multiple pages and stops on partial last page", async () => {
    const { client, calls } = createPagedClient(45);
    const { repo, batches } = createCapturingRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 4 }
    });

    expect(calls.map((call) => call.offset)).toEqual([0, 10, 20, 30, 40]);
    expect(calls.map((call) => call.limit)).toEqual([10, 10, 10, 10, 10]);
    expect(batches.map((batch) => batch.length)).toEqual([10, 10, 10, 10, 5]);
  });

  it("handles exact-multiple totals by fetching one trailing empty page", async () => {
    const { client, calls } = createPagedClient(20);
    const { repo, batches } = createCapturingRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 2 }
    });

    expect(calls.map((call) => call.offset)).toEqual([0, 10, 20]);
    expect(batches.map((batch) => batch.length)).toEqual([10, 10]);

    const completion = JSON.parse(String(logSpy.mock.calls[0][0])) as {
      event: string;
      total: number;
      pagesProcessed: number;
      skippedInvalid: number;
      skippedByCode?: Record<string, number>;
    };
    expect(completion).toEqual({
      event: "import.completed",
      total: 20,
      pagesProcessed: 2,
      skippedInvalid: 0,
      skippedByCode: {}
    });
  });

  it("starts pagination at configured startOffset", async () => {
    const { client, calls } = createPagedClient(25);
    const { repo, batches } = createCapturingRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, startOffset: 10, concurrency: 3 }
    });

    expect(calls.map((call) => call.offset)).toEqual([10, 20]);
    expect(batches.map((batch) => batch.length)).toEqual([10, 5]);
  });

  it("stops after maxPages even when more data is available", async () => {
    const { client, calls } = createPagedClient(35);
    const { repo, batches } = createCapturingRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, maxPages: 2, concurrency: 3 }
    });

    expect(calls.map((call) => call.offset)).toEqual([0, 10]);
    expect(batches.map((batch) => batch.length)).toEqual([10, 10]);
  });

  it("does not loop forever when pages are always full and maxPages is reached", async () => {
    const calls: FetchPoisParams[] = [];
    const { repo, batches } = createCapturingRepo();

    const client: OpenChargeMapClient = {
      fetchPois: async (params) => {
        calls.push(params);
        const limit = params.limit ?? 100;
        const offset = params.offset ?? 0;
        return Array.from({ length: limit }, (_, i) => ({
          ID: offset + i + 1,
          AddressInfo: { Title: `POI ${offset + i + 1}` }
        }));
      }
    };

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, maxPages: 3, concurrency: 3 }
    });

    expect(calls.map((call) => call.offset)).toEqual([0, 10, 20]);
    expect(batches.map((batch) => batch.length)).toEqual([10, 10, 10]);
  });
});
