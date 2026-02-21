import type { PoiDoc } from "../../src/ports/PoiRepository";
import {
  dedupePoiDocsByExternalId,
  MongoPoiRepository
} from "../../src/infrastructure/mongo/MongoPoiRepository";

describe("MongoPoiRepository", () => {
  it("dedupe helper keeps the last occurrence per externalId", () => {
    const docs: PoiDoc[] = [
      { _id: "a", externalId: 1, raw: { v: "old-1" } },
      { _id: "b", externalId: 2, raw: { v: "only-2" } },
      { _id: "c", externalId: 1, raw: { v: "new-1" } }
    ];

    const deduped = dedupePoiDocsByExternalId(docs);
    expect(deduped).toHaveLength(2);

    const byId = new Map(deduped.map((doc) => [doc.externalId, doc]));
    expect(byId.get(1)?._id).toBe("c");
    expect((byId.get(1)?.raw as { v?: string }).v).toBe("new-1");
    expect(byId.get(2)?._id).toBe("b");
  });

  it("returns early for empty batches", async () => {
    const repo = new MongoPoiRepository("mongodb://localhost:27017/jucr");
    const getCollection = jest.fn();
    (repo as unknown as { getCollection: typeof getCollection }).getCollection = getCollection;

    await expect(repo.upsertMany([])).resolves.toEqual({ upserted: 0, modified: 0 });
    expect(getCollection).not.toHaveBeenCalled();
  });

  it("returns cached collection without reconnecting", async () => {
    const repo = new MongoPoiRepository("mongodb://localhost:27017/jucr");
    const cached = { bulkWrite: jest.fn() };
    (repo as unknown as { collection?: typeof cached }).collection = cached;

    const col = await (repo as unknown as { getCollection: () => Promise<typeof cached> }).getCollection();
    expect(col).toBe(cached);
  });

  it("falls back to zero counts when bulkWrite counters are undefined", async () => {
    const repo = new MongoPoiRepository("mongodb://localhost:27017/jucr");
    const bulkWrite = jest.fn().mockResolvedValue({});
    (repo as unknown as { getCollection: () => Promise<{ bulkWrite: typeof bulkWrite }> }).getCollection =
      async () => ({ bulkWrite });

    const docs: PoiDoc[] = [{ _id: "a", externalId: 1, raw: {} }];
    await expect(repo.upsertMany(docs)).resolves.toEqual({ upserted: 0, modified: 0 });
  });

  it("dedupes repeated externalIds inside one batch before bulkWrite", async () => {
    const repo = new MongoPoiRepository("mongodb://localhost:27017/jucr");

    const bulkWrite = jest.fn().mockResolvedValue({
      upsertedCount: 2,
      modifiedCount: 0
    });

    (repo as unknown as { getCollection: () => Promise<{ bulkWrite: typeof bulkWrite }> }).getCollection =
      async () => ({ bulkWrite });

    const docs: PoiDoc[] = [
      {
        _id: "a",
        externalId: 1,
        raw: { AddressInfo: { Title: "POI 1 old" } }
      },
      {
        _id: "b",
        externalId: 2,
        raw: { AddressInfo: { Title: "POI 2" } }
      },
      {
        _id: "c",
        externalId: 1,
        raw: { AddressInfo: { Title: "POI 1 new" } }
      }
    ];

    const result = await repo.upsertMany(docs);

    expect(result).toEqual({ upserted: 2, modified: 0 });
    expect(bulkWrite).toHaveBeenCalledTimes(1);

    const [ops, options] = bulkWrite.mock.calls[0] as [Array<{ updateOne: { filter: { externalId: number }; update: { $setOnInsert: { _id: string }; $set: { raw: Record<string, unknown> } } } }>, { ordered: boolean }];
    expect(options).toEqual({ ordered: false });
    expect(ops).toHaveLength(2);

    const opByExternalId = new Map(
      ops.map((op) => [op.updateOne.filter.externalId, op.updateOne])
    );

    expect(opByExternalId.get(1)?.update.$setOnInsert._id).toBe("c");
    expect((opByExternalId.get(1)?.update.$set.raw as { AddressInfo?: { Title?: string } }).AddressInfo?.Title).toBe(
      "POI 1 new"
    );
    expect(opByExternalId.get(2)?.update.$setOnInsert._id).toBe("b");
  });
});
