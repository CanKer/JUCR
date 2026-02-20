export type ImporterConfig = {
  concurrency: number;
  pageSize: number;
  dataset?: string;
  modifiedSince?: string;
};

export const defaultImporterConfig: ImporterConfig = {
  concurrency: 10,
  pageSize: 100
};
