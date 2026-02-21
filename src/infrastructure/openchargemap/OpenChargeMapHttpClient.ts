import type { OpenChargeMapClient, FetchPoisParams, RawPoi } from "../../ports/OpenChargeMapClient";
import { retry } from "../../shared/retry/retry";

type OcmRequestError = Error & {
  status?: number;
  isTimeout?: boolean;
  retryDelayMs?: number;
  requestUrl?: string;
};

/**
 * Minimal HTTP client scaffold using native fetch (Node 20).
 * The actual query params and pagination strategy will be implemented in subsequent commits.
 */
export class OpenChargeMapHttpClient implements OpenChargeMapClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 8000
  ) {}

  async fetchPois(params: FetchPoisParams): Promise<RawPoi[]> {
    const url = new URL(this.baseUrl);
    // placeholder path for future; for fake server we expose /poi
    url.pathname = url.pathname.endsWith("/") ? `${url.pathname}poi` : `${url.pathname}/poi`;

    if (params.limit != null) url.searchParams.set("limit", String(params.limit));
    if (params.offset != null) url.searchParams.set("offset", String(params.offset));
    if (params.modifiedSince) url.searchParams.set("modifiedsince", params.modifiedSince);
    if (params.dataset) url.searchParams.set("dataset", params.dataset);
    const safeRequestUrl = `${url.origin}${url.pathname}${url.search}`;

    const doFetch = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      let res: Response;
      try {
        res = await fetch(url.toString(), {
          headers: {
            "X-API-Key": this.apiKey
          },
          signal: controller.signal
        });
      } catch (err) {
        if (controller.signal.aborted) {
          const timeoutError = new Error(`OCM request timeout after ${this.timeoutMs}ms`) as OcmRequestError;
          timeoutError.isTimeout = true;
          timeoutError.requestUrl = safeRequestUrl;
          throw timeoutError;
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        await res.text().catch(() => "");
        const err = new Error(`OCM request failed: ${res.status}`) as OcmRequestError;
        err.status = res.status;
        err.requestUrl = safeRequestUrl;
        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          if (retryAfter && /^\d+$/.test(retryAfter)) {
            err.retryDelayMs = Number(retryAfter) * 1000;
          }
        }
        throw err;
      }

      const json = await res.json();
      if (!Array.isArray(json)) {
        throw new Error("OCM response is not an array");
      }
      return json as RawPoi[];
    };

    return retry(doFetch, {
      retries: 5,
      minDelayMs: 250,
      maxDelayMs: 5000,
      onRetry: ({ attempt, maxAttempts, error }) => {
        const ocmError = error as OcmRequestError;
        // eslint-disable-next-line no-console
        console.warn(JSON.stringify({
          event: "http.retry",
          status: ocmError.status ?? null,
          url: ocmError.requestUrl ?? safeRequestUrl,
          attempt,
          maxAttempts
        }));
      },
      onGiveUp: ({ attempt, maxAttempts, error }) => {
        const ocmError = error as OcmRequestError;
        // eslint-disable-next-line no-console
        console.warn(JSON.stringify({
          event: "http.give_up",
          status: ocmError.status ?? null,
          url: ocmError.requestUrl ?? safeRequestUrl,
          attempt,
          maxAttempts
        }));
      },
      shouldRetry: (err) => {
        const ocmError = err as OcmRequestError;
        if (ocmError.isTimeout) return true;

        const status = ocmError.status;
        if (status === 429) {
          return { retry: true, delayMs: ocmError.retryDelayMs };
        }
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        if (typeof status === "number" && status >= 500) return true;
        if (typeof status === "number") return false;
        return true;
      }
    });
  }
}
