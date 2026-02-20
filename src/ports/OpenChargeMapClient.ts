export type RawPoi = Record<string, unknown>;

export type FetchPoisParams = {
  offset?: number;
  limit?: number;
  modifiedSince?: string; // ISO string if supported
  dataset?: string; // used by fake OCM server in tests
};

export interface OpenChargeMapClient {
  fetchPois(params: FetchPoisParams): Promise<RawPoi[]>;
}
