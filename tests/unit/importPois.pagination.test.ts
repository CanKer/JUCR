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
    const { client, calls } = createPagedClient(25);
    const { repo, batches } = createCapturingRepo();

    await importPois({
      client,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 4 }
    });

    expect(calls.map((call) => call.offset)).toEqual([0, 10, 20]);
    expect(calls.map((call) => call.limit)).toEqual([10, 10, 10]);
    expect(batches.map((batch) => batch.length)).toEqual([10, 10, 5]);
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
  });
});
