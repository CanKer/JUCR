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
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const retry = async <T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> => {
  const { retries, minDelayMs, maxDelayMs, shouldRetry } = opts;

  let attempt = 0;
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
      if (attempt >= retries || !normalized.retry) throw err;

      const backoff =
        normalized.delayMs != null
          ? Math.max(0, normalized.delayMs)
          : Math.min(maxDelayMs, minDelayMs * Math.pow(2, attempt));
      // small jitter to avoid thundering herd (still deterministic-ish)
      const jitter = Math.floor(backoff * 0.2 * Math.random());
      await sleep(backoff + jitter);
      attempt += 1;
    }
  }
};
