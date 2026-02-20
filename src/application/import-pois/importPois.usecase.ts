import type { OpenChargeMapClient } from "../../ports/OpenChargeMapClient";
import type { PoiRepository } from "../../ports/PoiRepository";
import { createLimiter } from "../../shared/concurrency/limiter";
import { transformPoi } from "../../core/poi/transformPoi";
import type { ImporterConfig } from "./importer.config";

/**
 * Import use-case scaffold.
 * Next steps:
 * - define pagination strategy
 * - implement concurrency across pages
 * - bulk upsert to Mongo
 */
export const importPois = async (
  deps: { client: OpenChargeMapClient; repo: PoiRepository; config: ImporterConfig }
): Promise<void> => {
  const { client, repo, config } = deps;
  const limit = createLimiter(config.concurrency);

  // Placeholder: fetch a single page for now
  const raw = await client.fetchPois({ limit: config.pageSize, offset: 0 });

  // Transform concurrently (bounded)
  const docs = await Promise.all(raw.map((r) => limit(async () => transformPoi(r))));

  // Persist
  await repo.upsertMany(docs);

  // Minimal structured log
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event: "import.completed", count: docs.length }));
};
