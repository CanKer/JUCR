import { InvalidPoiError, transformPoi } from "../../src/core/poi/transformPoi";

describe("transformPoi", () => {
  it("maps ID to externalId and assigns uuid", () => {
    const poi = transformPoi({ ID: 123, AddressInfo: { Title: "X" } });
    expect(poi.externalId).toBe(123);
    expect(typeof poi._id).toBe("string");
    expect(poi._id.length).toBeGreaterThan(10);
  });

  it("accepts numeric string ID and converts to number", () => {
    const poi = transformPoi({ ID: "123", AddressInfo: { Title: "X" } });
    expect(poi.externalId).toBe(123);
  });

  it("preserves the raw payload without validating unrelated fields", () => {
    const raw = {
      ID: "42",
      AddressInfo: null,
      ConnectorSummary: { Total: "unknown" },
      WeirdField: ["x", { deep: true }]
    };
    const poi = transformPoi(raw);

    expect(poi.externalId).toBe(42);
    expect(poi.raw).toBe(raw);
  });

  it("throws InvalidPoiError when ID is missing", () => {
    expect(() => transformPoi({} as any)).toThrow(new InvalidPoiError("Invalid POI: missing ID"));
  });

  it("throws InvalidPoiError when ID is non-numeric", () => {
    expect(() => transformPoi({ ID: Symbol("bad") } as any)).toThrow(new InvalidPoiError("Invalid POI: ID is not numeric"));
    expect(() => transformPoi({ ID: "not-a-number" } as any)).toThrow(new InvalidPoiError("Invalid POI: ID is not numeric"));
  });

  it("throws when ID is not a positive integer", () => {
    expect(() => transformPoi({ ID: 0 } as any)).toThrow(new InvalidPoiError("Invalid POI: ID must be a positive integer"));
    expect(() => transformPoi({ ID: -10 } as any)).toThrow(new InvalidPoiError("Invalid POI: ID must be a positive integer"));
    expect(() => transformPoi({ ID: 1.5 } as any)).toThrow(new InvalidPoiError("Invalid POI: ID must be a positive integer"));
    expect(() => transformPoi({ ID: Number.MAX_SAFE_INTEGER + 1 } as any)).toThrow(new InvalidPoiError("Invalid POI: ID must be a positive integer"));
    expect(() => transformPoi({ ID: "1.5" } as any)).toThrow(new InvalidPoiError("Invalid POI: ID is not numeric"));
  });

  it("parses lastUpdated from OCM date fields when valid", () => {
    const poi = transformPoi({
      ID: 50,
      DateLastStatusUpdate: "2026-02-20T10:30:00.000Z"
    } as any);

    expect(poi.lastUpdated).toBeInstanceOf(Date);
    expect(poi.lastUpdated?.toISOString()).toBe("2026-02-20T10:30:00.000Z");
  });

  it("does NOT throw when DateLastStatusUpdate is invalid; lastUpdated is undefined", () => {
    expect(() =>
      transformPoi({
        ID: 51,
        DateLastStatusUpdate: "not-a-date"
      } as any)
    ).not.toThrow();
    const poi = transformPoi({
      ID: 51,
      DateLastStatusUpdate: "not-a-date"
    } as any);
    expect(poi.lastUpdated).toBeUndefined();
  });

  it("leaves lastUpdated undefined when DateLastStatusUpdate is missing", () => {
    const poi = transformPoi({
      ID: 52,
      DateLastVerified: "2026-02-20T10:30:00.000Z"
    } as any);

    expect(poi.lastUpdated).toBeUndefined();
  });
});
