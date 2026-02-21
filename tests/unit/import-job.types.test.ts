import type {
  ImportJob,
  ImportJobCursor,
  ImportJobError,
  ImportJobStatus
} from "../../src/core/jobs/ImportJob";
import type { ImportJobRepository } from "../../src/ports/ImportJobRepository";

describe("import job design stubs", () => {
  it("compiles job model and repository contract types", () => {
    const status: ImportJobStatus = "pending";
    const cursor: ImportJobCursor = { kind: "offset", offset: 0, limit: 100 };
    const err: ImportJobError = { message: "temporary failure", at: new Date() };

    const job: ImportJob = {
      jobId: "job-1",
      shardKey: "country:US",
      status,
      attempts: 0,
      cursor,
      lastError: err,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const repo: ImportJobRepository | null = null;
    expect(repo).toBeNull();
    expect(job.status).toBe("pending");
    expect(job.cursor.kind).toBe("offset");
  });
});
