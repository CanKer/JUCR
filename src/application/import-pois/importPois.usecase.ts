import type { OpenChargeMapClient } from "../../ports/OpenChargeMapClient";
import type { PoiRepository } from "../../ports/PoiRepository";
import { createLimiter } from "../../shared/concurrency/limiter";
import { transformPoi } from "../../core/poi/transformPoi";
import type { ImporterConfig } from "./importer.config";

/**
 * Imports POIs in pages and persists them using repository bulk upserts.
 */
export const importPois = async (
  deps: { client: OpenChargeMapClient; repo: PoiRepository; config: ImporterConfig }
): Promise<void> => {
  const { client, repo, config } = deps;
  const limit = createLimiter(config.concurrency);
  let offset = 0;
  let total = 0;

  while (true) {
    const raw = await client.fetchPois({
      limit: config.pageSize,
      offset,
      modifiedSince: config.modifiedSince,
      dataset: config.dataset
    });

    if (raw.length === 0) break;

    // Transform concurrently (bounded)
    const docs = await Promise.all(raw.map((r) => limit(async () => transformPoi(r))));

    // Persist
    await repo.upsertMany(docs);

    total += docs.length;
    offset += raw.length;

    // Last page
    if (raw.length < config.pageSize) break;
  }

  console.log(JSON.stringify({ event: "import.completed", total }));
};
