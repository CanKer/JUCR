export type PoiDoc = {
  _id: string;          // UUIDv4
  externalId: number;   // OpenChargeMap ID
  lastUpdated?: Date;
  raw: Record<string, unknown>;
};

export interface PoiRepository {
  upsertMany(docs: PoiDoc[]): Promise<{ upserted: number; modified: number }>;
}
