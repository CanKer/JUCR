export type RawPoi = Record<string, unknown>;

export type FetchPoisParams = {
  /** Optional pagination/segment controls – to be defined during implementation */
  offset?: number;
  limit?: number;
  modifiedSince?: string; // ISO string if supported
};

export interface OpenChargeMapClient {
  fetchPois(params: FetchPoisParams): Promise<RawPoi[]>;
}
