import {
  classifyTransformFailure,
  createImportRunSummaryTracker,
  ImportFatalError,
  wrapRepositoryFailure
} from "../../src/application/import-pois/import.error-handler";
import { InvalidPoiError } from "../../src/core/poi/transformPoi";

describe("import.error-handler", () => {
  it("classifies InvalidPoiError as skip with structured log payload", () => {
    const decision = classifyTransformFailure(new InvalidPoiError("Invalid POI: missing ID"), {
      page: 2,
      offset: 10,
      pageSize: 25,
      index: 3
    });

    expect(decision.action).toBe("skip");
    if (decision.action === "skip") {
      expect(decision.code).toBe("invalid_poi");
      expect(decision.log).toEqual({
        event: "import.poi_skipped",
        reason: "Invalid POI: missing ID",
        offset: 10,
        pageSize: 25
      });
    }
  });

  it("classifies unknown transform errors as fatal", () => {
    const decision = classifyTransformFailure(new Error("unexpected transform issue"), {
      page: 1,
      offset: 0,
      pageSize: 10,
      index: 0
    });

    expect(decision.action).toBe("fail");
    if (decision.action === "fail") {
      expect(decision.error).toBeInstanceOf(ImportFatalError);
      expect(decision.error.code).toBe("transform_unexpected");
      expect(decision.error.message).toContain("unexpected transform issue");
      expect(decision.error.context).toEqual({ page: 1, offset: 0, pageSize: 10, index: 0 });
    }
  });

  it("classifies non-Error transform failures as fatal with stringified message", () => {
    const decision = classifyTransformFailure("boom", {
      page: 1,
      offset: 0,
      pageSize: 10,
      index: 0
    });

    expect(decision.action).toBe("fail");
    if (decision.action === "fail") {
      expect(decision.error).toBeInstanceOf(ImportFatalError);
      expect(decision.error.message).toContain("boom");
    }
  });

  it("wraps repository failures with context", () => {
    const error = wrapRepositoryFailure(new Error("write failed"), { page: 4, offset: 300 });

    expect(error).toBeInstanceOf(ImportFatalError);
    expect(error.code).toBe("repository_write_failed");
    expect(error.message).toContain("write failed");
    expect(error.context).toEqual({ page: 4, offset: 300 });
  });

  it("wraps non-Error repository failures", () => {
    const error = wrapRepositoryFailure("write failed", { page: 4, offset: 300 });

    expect(error).toBeInstanceOf(ImportFatalError);
    expect(error.code).toBe("repository_write_failed");
    expect(error.message).toContain("write failed");
  });

  it("tracks summary totals and skipped counters", () => {
    const tracker = createImportRunSummaryTracker();

    tracker.addImported(8);
    tracker.addProcessedPage();
    expect(tracker.addSkipped("invalid_poi")).toBe(1);
    expect(tracker.addSkipped("invalid_poi")).toBe(2);
    tracker.addImported(4);
    tracker.addProcessedPage();

    expect(tracker.nextPageNumber()).toBe(3);
    expect(tracker.summary()).toEqual({
      processed: 12,
      skipped: 2,
      pagesProcessed: 2,
      total: 12,
      skippedInvalid: 2,
      skippedByCode: { invalid_poi: 2 }
    });
  });
});
