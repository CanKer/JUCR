import {
  defaultImporterConfig,
  importerCaps,
  resolveImporterConfig,
  type ImporterConfig,
} from "../../application/import-pois/importer.config";

export const runtimeCaps = {
  timeoutMs: { min: 1000, max: 30000 }
} as const;

export type RuntimeConfig = {
  importerConfig: ImporterConfig;
  timeoutMs: number;
};

const parseOptionalIntInRange = (
  env: NodeJS.ProcessEnv,
  name: string,
  range: { min: number; max: number }
): number | undefined => {
  const raw = env[name];
  if (raw == null || raw.trim() === "") return undefined;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < range.min || value > range.max) {
    throw new Error(`${name}=${raw} is out of allowed range [${range.min}..${range.max}]`);
  }

  return value;
};

export const loadRuntimeConfigFromEnv = (env: NodeJS.ProcessEnv = process.env): RuntimeConfig => {
  const importerConfig = resolveImporterConfig({
    ...defaultImporterConfig,
    concurrency:
      parseOptionalIntInRange(env, "IMPORT_CONCURRENCY", importerCaps.concurrency) ?? defaultImporterConfig.concurrency,
    pageSize:
      parseOptionalIntInRange(env, "IMPORT_PAGE_SIZE", importerCaps.pageSize) ?? defaultImporterConfig.pageSize,
    maxPages:
      parseOptionalIntInRange(env, "IMPORT_MAX_PAGES", importerCaps.maxPages) ?? defaultImporterConfig.maxPages,
    startOffset:
      parseOptionalIntInRange(env, "IMPORT_START_OFFSET", importerCaps.startOffset) ?? defaultImporterConfig.startOffset,
    dataset: env.IMPORT_DATASET?.trim() ? env.IMPORT_DATASET : undefined,
    modifiedSince: env.IMPORT_MODIFIED_SINCE?.trim() ? env.IMPORT_MODIFIED_SINCE : undefined
  });

  const timeoutMs =
    parseOptionalIntInRange(env, "OCM_TIMEOUT_MS", {
      min: runtimeCaps.timeoutMs.min,
      max: runtimeCaps.timeoutMs.max
    }) ?? 8000;

  return { importerConfig, timeoutMs };
};
