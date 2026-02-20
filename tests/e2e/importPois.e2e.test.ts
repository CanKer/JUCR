import { OpenChargeMapHttpClient } from "../../src/infrastructure/openchargemap/OpenChargeMapHttpClient";
import { importPois } from "../../src/application/import-pois/importPois.usecase";
import { defaultImporterConfig } from "../../src/application/import-pois/importer.config";

/**
 * E2E scaffold:
 * - Assumes Mongo is running (docker-compose) and fake OCM server is started by CI step
 * - Repository is not implemented yet, so this test currently asserts that Not implemented is thrown.
 *
 * Once MongoPoiRepository is implemented, replace the expectation with real DB assertions.
 */
describe("importPois (e2e scaffold)", () => {
  it("runs importer against fake OCM server (scaffold)", async () => {
    const baseUrl = process.env.OCM_BASE_URL ?? "http://localhost:3999";
    const apiKey = process.env.OCM_API_KEY ?? "test";
    const client = new OpenChargeMapHttpClient(baseUrl, apiKey);

    // Temporary dummy repo (replace with MongoPoiRepository once implemented)
    const repo = {
      upsertMany: async () => {
        throw new Error("Not implemented");
      }
    };

    await expect(importPois({ client, repo: repo as any, config: { ...defaultImporterConfig, pageSize: 50 } }))
      .rejects
      .toThrow(/not implemented/i);
  });
});
