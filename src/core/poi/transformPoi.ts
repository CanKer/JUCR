import { randomUUID } from "crypto";
import type { RawPoi, PoiDoc } from "./poi.types";

/**
 * Minimal transform:
 * - extracts `ID` from OpenChargeMap payload as `externalId`
 * - stores full raw payload
 * - assigns UUIDv4 to `_id`
 *
 * This will be extended once we define the normalized schema more precisely.
 */
export const transformPoi = (raw: RawPoi): PoiDoc => {
  const externalId = Number((raw as any).ID);
  if (!Number.isFinite(externalId)) {
    throw new Error("Invalid POI: missing numeric ID");
  }

  const lastUpdatedRaw = (raw as any).DateLastStatusUpdate ?? (raw as any).DateLastVerified ?? undefined;
  const lastUpdated = lastUpdatedRaw ? new Date(String(lastUpdatedRaw)) : undefined;

  return {
    _id: randomUUID(),
    externalId,
    lastUpdated: lastUpdated && !Number.isNaN(lastUpdated.getTime()) ? lastUpdated : undefined,
    raw
  };
};
