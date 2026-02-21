import type { ImportJob, ImportJobError } from "../core/jobs/ImportJob";

/**
 * Conceptual extension for future horizontal scaling.
 * Implementations are expected to provide atomic lease-claim semantics.
 */
export type ImportJobRepository = {
  claimNextJob(workerId: string, now: Date): Promise<ImportJob | null>;
  renewLease(jobId: string, workerId: string, now: Date): Promise<void>;
  markDone(jobId: string): Promise<void>;
  markFailed(jobId: string, err: ImportJobError): Promise<void>;
};
