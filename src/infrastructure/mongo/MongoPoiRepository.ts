import { MongoClient, type Collection } from "mongodb";
import type { PoiRepository, PoiDoc } from "../../ports/PoiRepository";
import { mongoIndexes } from "./mongo.indexes";

/**
 * Mongo repository using bulk upsert by `externalId`.
 */
export const dedupePoiDocsByExternalId = (docs: PoiDoc[]): PoiDoc[] => {
  const byExternalId = new Map<number, PoiDoc>();
  for (const doc of docs) {
    // Keep the latest value seen for each externalId inside the same batch.
    byExternalId.set(doc.externalId, doc);
  }
  return Array.from(byExternalId.values());
};

export class MongoPoiRepository implements PoiRepository {
  private client?: MongoClient;
  private collection?: Collection<PoiDoc>;

  constructor(
    private readonly mongoUri: string,
    private readonly dbName = "jucr",
    private readonly collectionName = "pois"
  ) {}

  private async getCollection(): Promise<Collection<PoiDoc>> {
    if (this.collection) return this.collection;

    this.client = new MongoClient(this.mongoUri);
    await this.client.connect();

    const db = this.client.db(this.dbName);
    const col = db.collection<PoiDoc>(this.collectionName);

    // Index creation is idempotent and guarantees unique externalId for upserts.
    for (const idx of mongoIndexes.poiCollection) {
      await col.createIndex(idx.keys, idx.options);
    }

    this.collection = col;
    return col;
  }

  async upsertMany(docs: PoiDoc[]): Promise<{ upserted: number; modified: number }> {
    if (docs.length === 0) {
      return { upserted: 0, modified: 0 };
    }

    const dedupedDocs = dedupePoiDocsByExternalId(docs);
    const col = await this.getCollection();
    const ops = dedupedDocs.map((doc) => ({
      updateOne: {
        filter: { externalId: doc.externalId },
        update: {
          $setOnInsert: {
            _id: doc._id,
            externalId: doc.externalId
          },
          $set: {
            lastUpdated: doc.lastUpdated,
            raw: doc.raw
          }
        },
        upsert: true
      }
    }));

    const res = await col.bulkWrite(ops, { ordered: false });
    return {
      upserted: res.upsertedCount ?? 0,
      modified: res.modifiedCount ?? 0
    };
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = undefined;
    this.collection = undefined;
  }
}
