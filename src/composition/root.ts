import type { ImporterConfig } from "../application/import-pois/importer.config";
import { defaultImporterConfig } from "../application/import-pois/importer.config";
import { importPois } from "../application/import-pois/importPois.usecase";
import { MongoPoiRepository } from "../infrastructure/mongo/MongoPoiRepository";
import { OpenChargeMapHttpClient } from "../infrastructure/openchargemap/OpenChargeMapHttpClient";
import { loadEnv } from "../shared/config/env";

const readIntegerFromEnv = (name: string, min: number): number | undefined => {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return undefined;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }
  return value;
};

const resolveImporterConfig = (): ImporterConfig => {
  const config: ImporterConfig = {
    ...defaultImporterConfig,
    concurrency: readIntegerFromEnv("IMPORT_CONCURRENCY", 1) ?? defaultImporterConfig.concurrency,
    pageSize: readIntegerFromEnv("IMPORT_PAGE_SIZE", 1) ?? defaultImporterConfig.pageSize,
    maxPages: readIntegerFromEnv("IMPORT_MAX_PAGES", 1) ?? defaultImporterConfig.maxPages,
    startOffset: readIntegerFromEnv("IMPORT_START_OFFSET", 0) ?? defaultImporterConfig.startOffset
  };

  const dataset = process.env.IMPORT_DATASET;
  if (dataset && dataset.trim() !== "") config.dataset = dataset;

  const modifiedSince = process.env.IMPORT_MODIFIED_SINCE;
  if (modifiedSince && modifiedSince.trim() !== "") config.modifiedSince = modifiedSince;

  return config;
};

export const runImport = async (): Promise<void> => {
  const env = loadEnv();
  const timeoutMs = readIntegerFromEnv("OCM_TIMEOUT_MS", 1) ?? 8000;

  const client = new OpenChargeMapHttpClient(env.OCM_BASE_URL, env.OCM_API_KEY, timeoutMs);
  const repo = new MongoPoiRepository(env.MONGO_URI);
  const config = resolveImporterConfig();

  try {
    await importPois({ client, repo, config });
  } finally {
    await repo.close();
  }
};
