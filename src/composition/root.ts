import { importPois } from "../application/import-pois/importPois.usecase";
import { MongoPoiRepository } from "../infrastructure/mongo/MongoPoiRepository";
import { OpenChargeMapHttpClient } from "../infrastructure/openchargemap/OpenChargeMapHttpClient";
import { loadEnv } from "../shared/config/env";
import { loadRuntimeConfigFromEnv } from "../shared/config/runtime.config";

export const runImport = async (): Promise<void> => {
  const env = loadEnv();
  const runtimeConfig = loadRuntimeConfigFromEnv();

  const client = new OpenChargeMapHttpClient(env.OCM_BASE_URL, env.OCM_API_KEY, runtimeConfig.timeoutMs);
  const repo = new MongoPoiRepository(env.MONGO_URI);

  try {
    await importPois({ client, repo, config: runtimeConfig.importerConfig });
  } finally {
    await repo.close();
  }
};
