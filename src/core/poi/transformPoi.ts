import { randomUUID } from "crypto";
import type { RawPoi, PoiDoc } from "./poi.types";

export class InvalidPoiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPoiError";
  }
}

/**
 * Minimal transform:
 * - extracts `ID` from OpenChargeMap payload as `externalId`
 * - stores full raw payload
 * - assigns UUIDv4 to `_id`
 *
 * This will be extended once we define the normalized schema more precisely.
 */
const parseExternalId = (value: unknown): number => {
  if (value == null) {
    throw new InvalidPoiError("Invalid POI: missing ID");
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new InvalidPoiError("Invalid POI: ID is not numeric");
    }
    if (!Number.isInteger(value) || value <= 0) {
      throw new InvalidPoiError("Invalid POI: ID must be a positive integer");
    }
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0 || !/^\d+$/.test(normalized)) {
      throw new InvalidPoiError("Invalid POI: ID is not numeric");
    }

    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new InvalidPoiError("Invalid POI: ID must be a positive integer");
    }
    return parsed;
  }

  throw new InvalidPoiError("Invalid POI: ID is not numeric");
};

const parseOptionalLastUpdated = (value: unknown): Date | undefined => {
  if (value == null) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const transformPoi = (raw: RawPoi): PoiDoc => {
  const rawRecord = raw as Record<string, unknown>;
  const externalId = parseExternalId(rawRecord.ID);
  const lastUpdated = parseOptionalLastUpdated(rawRecord.DateLastStatusUpdate);

  return {
    _id: randomUUID(),
    externalId,
    lastUpdated,
    raw
  };
};
