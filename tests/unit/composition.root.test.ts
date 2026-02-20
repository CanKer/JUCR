describe("composition root", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("wires dependencies and closes repository after successful import", async () => {
    process.env = { ...envSnapshot };

    const close = jest.fn().mockResolvedValue(undefined);
    const repo = { close };
    const client = {};
    const importPois = jest.fn().mockResolvedValue(undefined);
    const loadEnv = jest.fn().mockReturnValue({
      MONGO_URI: "mongodb://localhost:27017/jucr",
      OCM_API_KEY: "test-key",
      OCM_BASE_URL: "http://localhost:3999"
    });
    const mongoCtor = jest.fn().mockImplementation(() => repo);
    const httpCtor = jest.fn().mockImplementation(() => client);

    jest.doMock("../../src/shared/config/env", () => ({ loadEnv }));
    jest.doMock("../../src/application/import-pois/importPois.usecase", () => ({ importPois }));
    jest.doMock("../../src/infrastructure/mongo/MongoPoiRepository", () => ({ MongoPoiRepository: mongoCtor }));
    jest.doMock("../../src/infrastructure/openchargemap/OpenChargeMapHttpClient", () => ({
      OpenChargeMapHttpClient: httpCtor
    }));

    const { runImport } = await import("../../src/composition/root");
    await runImport();

    expect(loadEnv).toHaveBeenCalledTimes(1);
    expect(httpCtor).toHaveBeenCalledWith("http://localhost:3999", "test-key", 8000);
    expect(mongoCtor).toHaveBeenCalledWith("mongodb://localhost:27017/jucr");
    expect(importPois).toHaveBeenCalledTimes(1);
    expect(importPois).toHaveBeenCalledWith({
      client,
      repo,
      config: expect.objectContaining({
        concurrency: 10,
        pageSize: 100,
        maxPages: 1000,
        startOffset: 0
      })
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("applies importer and timeout overrides from env", async () => {
    process.env = {
      ...envSnapshot,
      OCM_TIMEOUT_MS: "1200",
      IMPORT_CONCURRENCY: "3",
      IMPORT_PAGE_SIZE: "50",
      IMPORT_MAX_PAGES: "20",
      IMPORT_START_OFFSET: "10",
      IMPORT_DATASET: "update",
      IMPORT_MODIFIED_SINCE: "2026-02-20T00:00:00.000Z"
    };

    const close = jest.fn().mockResolvedValue(undefined);
    const repo = { close };
    const client = {};
    const importPois = jest.fn().mockResolvedValue(undefined);
    const loadEnv = jest.fn().mockReturnValue({
      MONGO_URI: "mongodb://localhost:27017/jucr",
      OCM_API_KEY: "test-key",
      OCM_BASE_URL: "http://localhost:3999"
    });
    const mongoCtor = jest.fn().mockImplementation(() => repo);
    const httpCtor = jest.fn().mockImplementation(() => client);

    jest.doMock("../../src/shared/config/env", () => ({ loadEnv }));
    jest.doMock("../../src/application/import-pois/importPois.usecase", () => ({ importPois }));
    jest.doMock("../../src/infrastructure/mongo/MongoPoiRepository", () => ({ MongoPoiRepository: mongoCtor }));
    jest.doMock("../../src/infrastructure/openchargemap/OpenChargeMapHttpClient", () => ({
      OpenChargeMapHttpClient: httpCtor
    }));

    const { runImport } = await import("../../src/composition/root");
    await runImport();

    expect(httpCtor).toHaveBeenCalledWith("http://localhost:3999", "test-key", 1200);
    expect(importPois).toHaveBeenCalledWith({
      client,
      repo,
      config: {
        concurrency: 3,
        pageSize: 50,
        maxPages: 20,
        startOffset: 10,
        dataset: "update",
        modifiedSince: "2026-02-20T00:00:00.000Z"
      }
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes repository when import fails", async () => {
    process.env = { ...envSnapshot };

    const close = jest.fn().mockResolvedValue(undefined);
    const repo = { close };
    const importPois = jest.fn().mockRejectedValue(new Error("import failed"));
    const loadEnv = jest.fn().mockReturnValue({
      MONGO_URI: "mongodb://localhost:27017/jucr",
      OCM_API_KEY: "test-key",
      OCM_BASE_URL: "http://localhost:3999"
    });
    const mongoCtor = jest.fn().mockImplementation(() => repo);
    const httpCtor = jest.fn().mockImplementation(() => ({}));

    jest.doMock("../../src/shared/config/env", () => ({ loadEnv }));
    jest.doMock("../../src/application/import-pois/importPois.usecase", () => ({ importPois }));
    jest.doMock("../../src/infrastructure/mongo/MongoPoiRepository", () => ({ MongoPoiRepository: mongoCtor }));
    jest.doMock("../../src/infrastructure/openchargemap/OpenChargeMapHttpClient", () => ({
      OpenChargeMapHttpClient: httpCtor
    }));

    const { runImport } = await import("../../src/composition/root");
    await expect(runImport()).rejects.toThrow("import failed");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("fails fast when runtime caps are violated", async () => {
    process.env = {
      ...envSnapshot,
      IMPORT_CONCURRENCY: "999"
    };

    const loadEnv = jest.fn().mockReturnValue({
      MONGO_URI: "mongodb://localhost:27017/jucr",
      OCM_API_KEY: "test-key",
      OCM_BASE_URL: "http://localhost:3999"
    });

    jest.doMock("../../src/shared/config/env", () => ({ loadEnv }));
    jest.doMock("../../src/application/import-pois/importPois.usecase", () => ({ importPois: jest.fn() }));
    jest.doMock("../../src/infrastructure/mongo/MongoPoiRepository", () => ({
      MongoPoiRepository: jest.fn().mockImplementation(() => ({ close: jest.fn() }))
    }));
    jest.doMock("../../src/infrastructure/openchargemap/OpenChargeMapHttpClient", () => ({
      OpenChargeMapHttpClient: jest.fn().mockImplementation(() => ({}))
    }));

    const { runImport } = await import("../../src/composition/root");
    await expect(runImport()).rejects.toThrow("IMPORT_CONCURRENCY=999 is out of allowed range [1..50]");
  });
});
