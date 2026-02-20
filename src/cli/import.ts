import { loadEnv } from "../shared/config/env";
import { OpenChargeMapHttpClient } from "../infrastructure/openchargemap/OpenChargeMapHttpClient";
import { MongoPoiRepository } from "../infrastructure/mongo/MongoPoiRepository";
import { importPois } from "../application/import-pois/importPois.usecase";
import { defaultImporterConfig } from "../application/import-pois/importer.config";

(async () => {
  const env = loadEnv();

  const client = new OpenChargeMapHttpClient(env.OCM_BASE_URL, env.OCM_API_KEY);
  const repo = new MongoPoiRepository(env.MONGO_URI);

  await importPois({ client, repo, config: defaultImporterConfig });
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
