import { OpenChargeMapHttpClient } from "../../src/infrastructure/openchargemap/OpenChargeMapHttpClient";
import { importPois } from "../../src/application/import-pois/importPois.usecase";
import { defaultImporterConfig } from "../../src/application/import-pois/importer.config";
import type { PoiDoc, PoiRepository } from "../../src/ports/PoiRepository";

/**
 * E2E (stage 1):
 * - Uses fake OCM HTTP server to validate integration across HTTP -> use-case -> transform -> repository port.
 * - Uses an in-memory repository test double to keep this commit runnable before Mongo repository implementation.
 */
describe("importPois (e2e)", () => {
  it("imports POIs from fake OCM and persists transformed docs via repository port", async () => {
    const baseUrl = process.env.OCM_BASE_URL ?? "http://localhost:3999";
    const apiKey = process.env.OCM_API_KEY ?? "test";
    const client = new OpenChargeMapHttpClient(baseUrl, apiKey);
    const persisted: PoiDoc[] = [];

    const repo: PoiRepository = {
      upsertMany: async (docs) => {
        persisted.push(...docs);
        return { upserted: docs.length, modified: 0 };
      }
    };

    await importPois({ client, repo, config: { ...defaultImporterConfig, pageSize: 50 } });

    expect(persisted).toHaveLength(25);
    expect(persisted[0]?.externalId).toBe(1);
    expect(typeof persisted[0]?._id).toBe("string");
    expect(persisted.every((doc) => Number.isInteger(doc.externalId))).toBe(true);
  });
});
