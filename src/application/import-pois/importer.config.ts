export type ImporterConfig = {
  concurrency: number;
  pageSize: number;
  maxPages: number;
  startOffset: number;
  dataset?: string;
  modifiedSince?: string;
};

export const defaultImporterConfig: ImporterConfig = {
  concurrency: 10,
  pageSize: 100,
  maxPages: 1000,
  startOffset: 0
};
