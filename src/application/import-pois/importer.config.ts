export type ImporterConfig = {
  concurrency: number;
  pageSize: number;
};

export const defaultImporterConfig: ImporterConfig = {
  concurrency: 10,
  pageSize: 100
};
