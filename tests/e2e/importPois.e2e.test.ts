import { MongoClient } from "mongodb";
import { OpenChargeMapHttpClient } from "../../src/infrastructure/openchargemap/OpenChargeMapHttpClient";
import { importPois } from "../../src/application/import-pois/importPois.usecase";
import { defaultImporterConfig } from "../../src/application/import-pois/importer.config";
import { MongoPoiRepository } from "../../src/infrastructure/mongo/MongoPoiRepository";

type PersistedPoi = {
  _id: string;
  externalId: number;
  lastUpdated?: Date;
  raw?: {
    AddressInfo?: {
      Title?: string;
    };
  };
};

const identitySnapshot = (docs: PersistedPoi[]) =>
  docs
    .map((doc) => ({ externalId: doc.externalId, _id: doc._id }))
    .sort((a, b) => a.externalId - b.externalId);

const run = process.env.REQUIRE_MONGO_E2E === "1";

(run ? describe : describe.skip)("importPois (mongo e2e)", () => {
  const mongoUri = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/jucr";
  const dbName = "jucr";
  const colName = "pois";

  const baseUrl = process.env.OCM_BASE_URL ?? "http://127.0.0.1:3999";
  const apiKey = process.env.OCM_API_KEY ?? "test";

  let client: MongoClient;

  beforeAll(async () => {
    client = new MongoClient(mongoUri);
    await client.connect();
  });

  beforeEach(async () => {
    await client.db(dbName).collection(colName).deleteMany({});
  });

  afterAll(async () => {
    await client.close();
  });

  it("imports small dataset and is idempotent", async () => {
    const ocm = new OpenChargeMapHttpClient(baseUrl, apiKey);
    const repo = new MongoPoiRepository(mongoUri, dbName, colName);

    await importPois({
      client: ocm,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5, dataset: "small" }
    });

    const pois = client.db(dbName).collection<PersistedPoi>(colName);
    const firstDocs = await pois.find().toArray();
    expect(firstDocs).toHaveLength(25);
    const firstIdentities = identitySnapshot(firstDocs);

    await importPois({
      client: ocm,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5, dataset: "small" }
    });

    const secondDocs = await pois.find().toArray();
    expect(secondDocs).toHaveLength(25);
    expect(identitySnapshot(secondDocs)).toEqual(firstIdentities);

    const duplicateExternalIds = await pois.aggregate([
      { $group: { _id: "$externalId", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    expect(duplicateExternalIds).toHaveLength(0);

    await repo.close();
  });

  it("updates existing docs when dataset changes", async () => {
    const ocm = new OpenChargeMapHttpClient(baseUrl, apiKey);
    const repo = new MongoPoiRepository(mongoUri, dbName, colName);
    const pois = client.db(dbName).collection<PersistedPoi>(colName);

    await importPois({
      client: ocm,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5, dataset: "small" }
    });

    const before = await pois.findOne({ externalId: 1 });
    const beforeId = before?._id;
    expect(before?.raw?.AddressInfo?.Title).toBe("POI 1");

    await importPois({
      client: ocm,
      repo,
      config: { ...defaultImporterConfig, pageSize: 10, concurrency: 5, dataset: "update" }
    });

    const after = await pois.findOne({ externalId: 1 });
    expect(after?._id).toBe(beforeId);
    expect(after?.raw?.AddressInfo?.Title).toBe("POI 1 (updated)");
    expect(await pois.countDocuments()).toBe(25);

    await repo.close();
  });

});
