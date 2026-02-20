import type { OpenChargeMapClient, FetchPoisParams, RawPoi } from "../../ports/OpenChargeMapClient";
import { retry } from "../../shared/retry/retry";

type OcmRequestError = Error & {
  status?: number;
  body?: string;
  isTimeout?: boolean;
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
        if (err instanceof Error && err.name === "AbortError") {
          const timeoutError = new Error(`OCM request timeout after ${this.timeoutMs}ms`) as OcmRequestError;
          timeoutError.isTimeout = true;
          throw timeoutError;
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(`OCM request failed: ${res.status}`) as OcmRequestError;
        err.status = res.status;
        err.body = body;
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
      shouldRetry: (err) => {
        const ocmError = err as OcmRequestError;
        if (ocmError.isTimeout) return true;

        const status = ocmError.status;
        if (status === 429) return true;
        if (typeof status === "number" && status >= 500) return true;
        if (typeof status === "number") return false;
        return true;
      }
    });
  }
}
