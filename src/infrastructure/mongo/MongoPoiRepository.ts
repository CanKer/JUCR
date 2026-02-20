import type { PoiRepository, PoiDoc } from "../../ports/PoiRepository";

/**
 * Mongo repository scaffold.
 * Implement using `mongodb` driver and `bulkWrite` with `updateOne` + `upsert: true`.
 */
export class MongoPoiRepository implements PoiRepository {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private readonly mongoUri: string) {}

  async upsertMany(_docs: PoiDoc[]): Promise<{ upserted: number; modified: number }> {
    throw new Error("Not implemented");
  }
}
