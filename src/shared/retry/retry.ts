export type RetryDecision =
  | boolean
  | {
      retry: boolean;
      delayMs?: number;
    };

export type RetryOptions = {
  retries: number;          // max attempts after initial try (e.g. 5 means up to 6 total tries)
  minDelayMs: number;       // base delay for backoff
  maxDelayMs: number;       // max delay cap
  shouldRetry: (err: unknown) => RetryDecision;
  onRetry?: (ctx: { attempt: number; maxAttempts: number; delayMs: number; error: unknown }) => void;
  onGiveUp?: (ctx: { attempt: number; maxAttempts: number; error: unknown }) => void;
  randomFn?: () => number;
  jitterRatio?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const retry = async <T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> => {
  const {
    retries,
    minDelayMs,
    maxDelayMs,
    shouldRetry,
    onRetry,
    onGiveUp,
    randomFn = Math.random,
    jitterRatio = 0.2
  } = opts;

  let attempt = 0;
  const maxAttempts = retries + 1;
  // attempt=0 is first try, then up to retries extra
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const decision = shouldRetry(err);
      const normalized =
        typeof decision === "boolean"
          ? { retry: decision, delayMs: undefined }
          : decision;
      if (attempt >= retries || !normalized.retry) {
        onGiveUp?.({ attempt: attempt + 1, maxAttempts, error: err });
        throw err;
      }

      const customDelayMs =
        typeof normalized.delayMs === "number" && Number.isFinite(normalized.delayMs) && normalized.delayMs >= 0
          ? normalized.delayMs
          : undefined;
      const backoff = customDelayMs != null
        ? Math.min(maxDelayMs, customDelayMs)
        : Math.min(maxDelayMs, minDelayMs * Math.pow(2, attempt));
      // small jitter to avoid thundering herd (still deterministic-ish)
      const normalizedJitterRatio = Math.min(1, Math.max(0, jitterRatio));
      const normalizedRandom = Math.min(1, Math.max(0, randomFn()));
      const jitter = Math.floor(backoff * normalizedJitterRatio * normalizedRandom);
      const waitMs = backoff + jitter;
      onRetry?.({ attempt: attempt + 1, maxAttempts, delayMs: waitMs, error: err });
      await sleep(waitMs);
      attempt += 1;
    }
  }
};
