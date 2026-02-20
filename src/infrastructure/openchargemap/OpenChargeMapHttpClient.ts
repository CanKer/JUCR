import type { OpenChargeMapClient, FetchPoisParams, RawPoi } from "../../ports/OpenChargeMapClient";
import { retry } from "../../shared/retry/retry";

/**
 * Minimal HTTP client scaffold using native fetch (Node 20).
 * The actual query params and pagination strategy will be implemented in subsequent commits.
 */
export class OpenChargeMapHttpClient implements OpenChargeMapClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async fetchPois(params: FetchPoisParams): Promise<RawPoi[]> {
    const url = new URL(this.baseUrl);
    // placeholder path for future; for fake server we expose /poi
    url.pathname = url.pathname.endsWith("/") ? `${url.pathname}poi` : `${url.pathname}/poi`;

    if (params.limit != null) url.searchParams.set("limit", String(params.limit));
    if (params.offset != null) url.searchParams.set("offset", String(params.offset));
    if (params.modifiedSince) url.searchParams.set("modifiedsince", params.modifiedSince);

    const doFetch = async () => {
      const res = await fetch(url.toString(), {
        headers: {
          "X-API-Key": this.apiKey
        }
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err: any = new Error(`OCM request failed: ${res.status}`);
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
        const status = (err as any)?.status;
        return status === 429 || (typeof status === "number" && status >= 500) || status == null;
      }
    });
  }
}
