import { InvalidPoiError } from "../../core/poi/transformPoi";

export type ImportSkipCode = "invalid_poi";
export type ImportFailureCode = "transform_unexpected" | "repository_write_failed";

export type ImportErrorContext = {
  page: number;
  offset: number;
  pageSize?: number;
  externalId?: number;
  index?: number;
};

type ErrorWithCause = Error & { cause?: unknown };

const toErrorMessage = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message;
  return String(reason);
};

export class ImportFatalError extends Error {
  readonly code: ImportFailureCode;
  readonly context: ImportErrorContext;
  readonly cause?: unknown;

  constructor(args: { code: ImportFailureCode; message: string; context: ImportErrorContext; cause?: unknown }) {
    super(args.message);
    this.name = "ImportFatalError";
    this.code = args.code;
    this.context = args.context;
    this.cause = args.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type TransformFailureDecision =
  | {
      action: "skip";
      code: ImportSkipCode;
      log: ImportPoiSkippedLog;
    }
  | {
      action: "fail";
      error: ImportFatalError;
    };

type ImportPoiSkippedLog = {
  event: "import.poi_skipped";
  reason: string;
  offset: number;
  pageSize: number;
  externalId?: number;
};

export const classifyTransformFailure = (
  reason: unknown,
  context: Required<Pick<ImportErrorContext, "page" | "offset" | "pageSize" | "index">> & {
    externalId?: number;
  }
): TransformFailureDecision => {
  if (reason instanceof InvalidPoiError) {
    const log: ImportPoiSkippedLog = {
      event: "import.poi_skipped",
      reason: reason.message,
      offset: context.offset,
      pageSize: context.pageSize
    };
    if (context.externalId != null) {
      log.externalId = context.externalId;
    }

    return {
      action: "skip",
      code: "invalid_poi",
      log
    };
  }

  const message = `Unexpected transform failure at page=${context.page}, offset=${context.offset}, index=${context.index}: ${toErrorMessage(reason)}`;
  const cause = reason instanceof Error ? (reason as ErrorWithCause).cause ?? reason : reason;
  return {
    action: "fail",
    error: new ImportFatalError({
      code: "transform_unexpected",
      message,
      context,
      cause
    })
  };
};

export const wrapRepositoryFailure = (reason: unknown, context: Pick<ImportErrorContext, "page" | "offset">) => {
  const message = `Repository write failed at page=${context.page}, offset=${context.offset}: ${toErrorMessage(reason)}`;
  const cause = reason instanceof Error ? (reason as ErrorWithCause).cause ?? reason : reason;
  return new ImportFatalError({
    code: "repository_write_failed",
    message,
    context,
    cause
  });
};

export type ImportRunSummary = {
  processed: number;
  skipped: number;
  pagesProcessed: number;
  total: number;
  skippedInvalid: number;
  skippedByCode: Partial<Record<ImportSkipCode, number>>;
};

export const createImportRunSummaryTracker = () => {
  let total = 0;
  let pagesProcessed = 0;
  const skippedByCode: Partial<Record<ImportSkipCode, number>> = {};

  return {
    pagesProcessed: () => pagesProcessed,
    nextPageNumber: () => pagesProcessed + 1,
    addImported: (count: number) => {
      total += count;
    },
    addProcessedPage: () => {
      pagesProcessed += 1;
    },
    addSkipped: (code: ImportSkipCode) => {
      skippedByCode[code] = (skippedByCode[code] ?? 0) + 1;
      return skippedByCode[code] ?? 0;
    },
    summary: (): ImportRunSummary => ({
      processed: total,
      skipped: skippedByCode.invalid_poi ?? 0,
      pagesProcessed,
      total,
      skippedInvalid: skippedByCode.invalid_poi ?? 0,
      skippedByCode: { ...skippedByCode }
    })
  };
};
