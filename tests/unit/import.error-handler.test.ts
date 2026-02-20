import {
  classifyTransformFailure,
  createImportRunSummaryTracker,
  ImportFatalError,
  wrapRepositoryFailure
} from "../../src/application/import-pois/import.error-handler";
import { InvalidPoiError } from "../../src/core/poi/transformPoi";

describe("import.error-handler", () => {
  it("classifies InvalidPoiError as skip with structured log payload", () => {
    const decision = classifyTransformFailure(new InvalidPoiError("Invalid POI: missing numeric ID"), {
      page: 2,
      offset: 10,
      index: 3
    });

    expect(decision.action).toBe("skip");
    if (decision.action === "skip") {
      expect(decision.code).toBe("invalid_poi");
      expect(decision.log).toEqual({
        event: "import.poi_skipped",
        code: "invalid_poi",
        reason: "Invalid POI: missing numeric ID",
        page: 2,
        offset: 10,
        index: 3
      });
    }
  });

  it("classifies unknown transform errors as fatal", () => {
    const decision = classifyTransformFailure(new Error("unexpected transform issue"), {
      page: 1,
      offset: 0,
      index: 0
    });

    expect(decision.action).toBe("fail");
    if (decision.action === "fail") {
      expect(decision.error).toBeInstanceOf(ImportFatalError);
      expect(decision.error.code).toBe("transform_unexpected");
      expect(decision.error.message).toContain("unexpected transform issue");
      expect(decision.error.context).toEqual({ page: 1, offset: 0, index: 0 });
    }
  });

  it("wraps repository failures with context", () => {
    const error = wrapRepositoryFailure(new Error("write failed"), { page: 4, offset: 300 });

    expect(error).toBeInstanceOf(ImportFatalError);
    expect(error.code).toBe("repository_write_failed");
    expect(error.message).toContain("write failed");
    expect(error.context).toEqual({ page: 4, offset: 300 });
  });

  it("tracks summary totals and skipped counters", () => {
    const tracker = createImportRunSummaryTracker();

    tracker.addImported(8);
    tracker.addProcessedPage();
    tracker.addSkipped("invalid_poi");
    tracker.addSkipped("invalid_poi");
    tracker.addImported(4);
    tracker.addProcessedPage();

    expect(tracker.nextPageNumber()).toBe(3);
    expect(tracker.summary()).toEqual({
      total: 12,
      pagesProcessed: 2,
      skippedInvalid: 2,
      skippedByCode: { invalid_poi: 2 }
    });
  });
});
