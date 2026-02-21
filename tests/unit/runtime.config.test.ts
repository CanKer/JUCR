import { loadRuntimeConfigFromEnv } from "../../src/shared/config/runtime.config";

describe("runtime config caps", () => {
  it("accepts boundary values within allowed caps", () => {
    const runtime = loadRuntimeConfigFromEnv({
      IMPORT_CONCURRENCY: "50",
      IMPORT_PAGE_SIZE: "500",
      IMPORT_MAX_PAGES: "100000",
      IMPORT_START_OFFSET: "0",
      OCM_TIMEOUT_MS: "30000",
      IMPORT_DATASET: "small",
      IMPORT_MODIFIED_SINCE: "2026-02-20T00:00:00.000Z"
    });

    expect(runtime).toEqual({
      timeoutMs: 30000,
      importerConfig: {
        concurrency: 50,
        pageSize: 500,
        maxPages: 100000,
        startOffset: 0,
        dataset: "small",
        modifiedSince: "2026-02-20T00:00:00.000Z"
      }
    });
  });

  it.each([
    {
      env: { IMPORT_CONCURRENCY: "51" },
      message: "IMPORT_CONCURRENCY=51 is out of allowed range [1..50]"
    },
    {
      env: { IMPORT_PAGE_SIZE: "0" },
      message: "IMPORT_PAGE_SIZE=0 is out of allowed range [1..500]"
    },
    {
      env: { IMPORT_MAX_PAGES: "100001" },
      message: "IMPORT_MAX_PAGES=100001 is out of allowed range [1..100000]"
    },
    {
      env: { IMPORT_START_OFFSET: "-1" },
      message: `IMPORT_START_OFFSET=-1 is out of allowed range [0..${Number.MAX_SAFE_INTEGER}]`
    },
    {
      env: { OCM_TIMEOUT_MS: "999" },
      message: "OCM_TIMEOUT_MS=999 is out of allowed range [1000..30000]"
    }
  ])("rejects out-of-range config: $message", ({ env, message }) => {
    expect(() => loadRuntimeConfigFromEnv(env)).toThrow(message);
  });

  it("trims optional string env values for dataset and modifiedSince", () => {
    const runtime = loadRuntimeConfigFromEnv({
      IMPORT_DATASET: "  update  ",
      IMPORT_MODIFIED_SINCE: " 2026-02-20T00:00:00.000Z "
    });

    expect(runtime.importerConfig.dataset).toBe("update");
    expect(runtime.importerConfig.modifiedSince).toBe("2026-02-20T00:00:00.000Z");
  });
});
