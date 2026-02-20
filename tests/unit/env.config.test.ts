import { loadEnv } from "../../src/shared/config/env";

describe("loadEnv", () => {
  it("uses defaults and validates default OCM base URL", () => {
    const env = loadEnv({});

    expect(env).toEqual({
      MONGO_URI: "mongodb://localhost:27017/jucr",
      OCM_API_KEY: "",
      OCM_BASE_URL: "https://api.openchargemap.io/v3"
    });
  });

  it.each([
    "http://localhost:3999",
    "https://api.openchargemap.io/v3"
  ])("accepts valid OCM_BASE_URL with http/https: %s", (baseUrl) => {
    const env = loadEnv({ OCM_BASE_URL: baseUrl });
    expect(env.OCM_BASE_URL).toBe(baseUrl);
  });

  it("rejects non-absolute OCM_BASE_URL values", () => {
    expect(() => loadEnv({ OCM_BASE_URL: "/v3/poi" })).toThrow(
      "OCM_BASE_URL must be a valid absolute http/https URL. Received: /v3/poi"
    );
  });

  it("rejects unsupported OCM_BASE_URL schemes", () => {
    expect(() => loadEnv({ OCM_BASE_URL: "ftp://example.com" })).toThrow(
      "OCM_BASE_URL must use http or https scheme. Received: ftp://example.com"
    );
  });
});
