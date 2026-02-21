export type ImporterConfig = {
  concurrency: number;
  pageSize: number;
  maxPages: number;
  startOffset: number;
  dataset?: string;
  modifiedSince?: string;
};

export type ImporterConfigInput = Partial<ImporterConfig>;

export const defaultImporterConfig: ImporterConfig = {
  concurrency: 10,
  pageSize: 100,
  maxPages: 1000,
  startOffset: 0
};

export const importerCaps = {
  concurrency: { min: 1, max: 50 },
  pageSize: { min: 1, max: 500 },
  maxPages: { min: 1, max: 100000 },
  startOffset: { min: 0, max: Number.MAX_SAFE_INTEGER }
} as const;

const assertIntegerInRange = (name: string, value: number, min: number, max: number) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name}=${String(value)} is out of allowed range [${min}..${max}]`);
  }
};

export const validateImporterConfig = (config: ImporterConfig): ImporterConfig => {
  assertIntegerInRange("concurrency", config.concurrency, importerCaps.concurrency.min, importerCaps.concurrency.max);
  assertIntegerInRange("pageSize", config.pageSize, importerCaps.pageSize.min, importerCaps.pageSize.max);
  assertIntegerInRange("maxPages", config.maxPages, importerCaps.maxPages.min, importerCaps.maxPages.max);
  assertIntegerInRange("startOffset", config.startOffset, importerCaps.startOffset.min, importerCaps.startOffset.max);
  return config;
};

const normalizeOptionalString = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
};

export const resolveImporterConfig = (input: ImporterConfigInput = {}): ImporterConfig =>
  validateImporterConfig({
    ...defaultImporterConfig,
    ...input,
    dataset: normalizeOptionalString(input.dataset),
    modifiedSince: normalizeOptionalString(input.modifiedSince)
  });
