import { runImport } from "../composition/root";

type ErrorContext = Partial<{
  page: number;
  offset: number;
  pageSize: number;
  index: number;
  externalId: number;
}>;

type CliErrorEnvelope = {
  event: "import.failed";
  name: string;
  message: string;
  code?: string;
  context?: ErrorContext;
  status?: number;
  stack?: string;
};

const allowedContextKeys: Array<keyof ErrorContext> = ["page", "offset", "pageSize", "index", "externalId"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const extractContext = (value: unknown): ErrorContext | undefined => {
  if (!isRecord(value)) return undefined;

  const sanitizedContext: ErrorContext = {};
  for (const key of allowedContextKeys) {
    const raw = value[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      sanitizedContext[key] = raw;
    }
  }

  return Object.keys(sanitizedContext).length > 0 ? sanitizedContext : undefined;
};

export const isDebugMode = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const debug = env.DEBUG?.toLowerCase();
  return debug === "1" || debug === "true";
};

export const buildCliErrorEnvelope = (err: unknown, includeStack: boolean): CliErrorEnvelope => {
  const error = err instanceof Error ? err : new Error(String(err));
  const errorRecord = isRecord(err) ? err : {};

  const envelope: CliErrorEnvelope = {
    event: "import.failed",
    name: error.name || "Error",
    message: error.message
  };

  if (typeof errorRecord.code === "string") {
    envelope.code = errorRecord.code;
  }

  const context = extractContext(errorRecord.context);
  if (context) {
    envelope.context = context;
  }

  if (typeof errorRecord.status === "number" && Number.isFinite(errorRecord.status)) {
    envelope.status = errorRecord.status;
  }

  if (includeStack && typeof error.stack === "string") {
    envelope.stack = error.stack;
  }

  return envelope;
};

export const executeImportCli = async (): Promise<void> => {
  try {
    await runImport();
  } catch (err) {
    const envelope = buildCliErrorEnvelope(err, isDebugMode());
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(envelope));
    process.exit(1);
  }
};

if (require.main === module) {
  void executeImportCli();
}
