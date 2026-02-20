import type { PoiDoc } from "../../src/ports/PoiRepository";
import { MongoPoiRepository } from "../../src/infrastructure/mongo/MongoPoiRepository";

describe("MongoPoiRepository", () => {
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
