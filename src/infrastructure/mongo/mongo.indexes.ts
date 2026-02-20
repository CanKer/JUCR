/**
 * Index plan (to be applied during init / migrations):
 * - unique: { externalId: 1 }
 * - optional: { lastUpdated: 1 }
 * - optional geo: { location: "2dsphere" } if/when added
 */
export const mongoIndexes = {
  poiCollection: [
    { keys: { externalId: 1 }, options: { unique: true } }
  ]
};
