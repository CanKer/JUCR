import { importPois } from "../../src/application/import-pois/importPois.usecase";
import { defaultImporterConfig } from "../../src/application/import-pois/importer.config";
import type { OpenChargeMapClient, FetchPoisParams, RawPoi } from "../../src/ports/OpenChargeMapClient";
import type { PoiRepository } from "../../src/ports/PoiRepository";

type PagedClientState = {
  calls: FetchPoisParams[];
  pageSizes: number[];
};

const createFiniteClient = (total: number) => {
  const state: PagedClientState = { calls: [], pageSizes: [] };

  const client: OpenChargeMapClient = {
    fetchPois: async (params) => {
      const offset = params.offset ?? 0;
      const limit = params.limit ?? 100;
      state.calls.push(params);

      const end = Math.min(total, offset + limit);
      const page: RawPoi[] = [];
      for (let id = offset + 1; id <= end; id += 1) {
        page.push({ ID: id, AddressInfo: { Title: `POI ${id}` } });
      }

      state.pageSizes.push(page.length);
      return page;
    }
  };

  return { client, state };
};

const createFullPageClient = () => {
  const state: PagedClientState = { calls: [], pageSizes: [] };

  const client: OpenChargeMapClient = {
    fetchPois: async (params) => {
      const offset = params.offset ?? 0;
      const limit = params.limit ?? 100;
      state.calls.push(params);

      const page = Array.from({ length: limit }, (_, index) => ({
        ID: offset + index + 1,
        AddressInfo: { Title: `POI ${offset + index + 1}` }
      }));

      state.pageSizes.push(page.length);
      return page;
    }
  };

  return { client, state };
};

const createNoopRepo = (): PoiRepository => ({
  upsertMany: async (docs) => ({ upserted: docs.length, modified: 0 })
});

describe("importPois pagination edge guardrails", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("stops on exact-multiple totals after trailing empty fetch (10,10,0)", async () => {
    const { client, state } = createFiniteClient(20);

    await importPois({
      client,
      repo: createNoopRepo(),
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 2 }
    });

    expect(state.calls).toHaveLength(3);
    expect(state.pageSizes).toEqual([10, 10, 0]);
    expect(state.calls.map((call) => call.offset)).toEqual([0, 10, 20]);
  });

  it("cuts pagination after maxPages even when API keeps returning full pages", async () => {
    const { client, state } = createFullPageClient();

    await importPois({
      client,
      repo: createNoopRepo(),
      config: { ...defaultImporterConfig, pageSize: 10, maxPages: 3, concurrency: 2 }
    });

    expect(state.calls).toHaveLength(3);
    expect(state.pageSizes).toEqual([10, 10, 10]);
    expect(state.calls.map((call) => call.offset)).toEqual([0, 10, 20]);
  });

  it("starts from configured non-zero startOffset", async () => {
    const { client, state } = createFiniteClient(23);

    await importPois({
      client,
      repo: createNoopRepo(),
      config: { ...defaultImporterConfig, pageSize: 5, startOffset: 10, concurrency: 2 }
    });

    expect(state.calls[0]?.offset).toBe(10);
    expect(state.pageSizes).toEqual([5, 5, 3]);
    expect(state.calls.map((call) => call.offset)).toEqual([10, 15, 20]);
  });

  it("applies safe defaults when startOffset and maxPages are omitted", async () => {
    const { client, state } = createFiniteClient(12);

    await importPois({
      client,
      repo: createNoopRepo(),
      config: { pageSize: 5, concurrency: 2 }
    });

    expect(state.calls[0]?.offset).toBe(0);
    expect(state.calls.map((call) => call.offset)).toEqual([0, 5, 10]);
    expect(state.pageSizes).toEqual([5, 5, 2]);
  });
});
