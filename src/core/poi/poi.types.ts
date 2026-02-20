export type RawPoi = Record<string, unknown>;

export type PoiDoc = {
  _id: string;
  externalId: number;
  lastUpdated?: Date;
  raw: Record<string, unknown>;
};
