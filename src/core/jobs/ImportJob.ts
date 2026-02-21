/**
 * Conceptual extension for future horizontal scaling.
 * This model is intentionally decoupled from current importer runtime behavior.
 */

export type ImportJobStatus = "pending" | "leased" | "done" | "failed";

export type OffsetCursor = {
  kind: "offset";
  offset: number;
  limit: number;
};

export type TimeWindowCursor = {
  kind: "time_window";
  from: Date;
  to: Date;
};

export type ImportJobCursor = OffsetCursor | TimeWindowCursor;

export type ImportJobError = {
  code?: string;
  message: string;
  at: Date;
};

export type ImportJob = {
  jobId: string;
  shardKey: string;
  status: ImportJobStatus;
  leaseOwner?: string;
  leaseUntil?: Date;
  attempts: number;
  cursor: ImportJobCursor;
  lastError?: ImportJobError;
  createdAt: Date;
  updatedAt: Date;
};
