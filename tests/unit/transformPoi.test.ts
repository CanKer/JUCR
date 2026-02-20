import { InvalidPoiError, transformPoi } from "../../src/core/poi/transformPoi";

describe("transformPoi", () => {
  it("maps ID to externalId and assigns uuid", () => {
    const poi = transformPoi({ ID: 123, AddressInfo: { Title: "X" } });
    expect(poi.externalId).toBe(123);
    expect(typeof poi._id).toBe("string");
    expect(poi._id.length).toBeGreaterThan(10);
  });

  it("throws if ID is missing", () => {
    expect(() => transformPoi({} as any)).toThrow(InvalidPoiError);
  });

  it("throws InvalidPoiError when ID cannot be coerced to number", () => {
    expect(() => transformPoi({ ID: Symbol("bad") } as any)).toThrow(InvalidPoiError);
  });
});
