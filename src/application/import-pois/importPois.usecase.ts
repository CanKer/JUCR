import type { OpenChargeMapClient } from "../../ports/OpenChargeMapClient";
import type { PoiRepository } from "../../ports/PoiRepository";
import { createLimiter } from "../../shared/concurrency/limiter";
import { InvalidPoiError, transformPoi } from "../../core/poi/transformPoi";
import type { ImporterConfig } from "./importer.config";

/**
 * Imports POIs in pages and persists them using repository bulk upserts.
 */
export const importPois = async (
  deps: { client: OpenChargeMapClient; repo: PoiRepository; config: ImporterConfig }
): Promise<void> => {
  const { client, repo, config } = deps;
  if (!Number.isInteger(config.pageSize) || config.pageSize < 1) {
    throw new Error("pageSize must be an integer >= 1");
  }
  if (!Number.isInteger(config.maxPages) || config.maxPages < 1) {
    throw new Error("maxPages must be an integer >= 1");
  }
  if (!Number.isInteger(config.startOffset) || config.startOffset < 0) {
    throw new Error("startOffset must be an integer >= 0");
  }

  const limit = createLimiter(config.concurrency);
  const maxPages = config.maxPages;
  let offset = config.startOffset;
  let total = 0;
  let pagesProcessed = 0;
  let skippedInvalid = 0;

  while (pagesProcessed < maxPages) {
    const raw = await client.fetchPois({
      limit: config.pageSize,
      offset,
      modifiedSince: config.modifiedSince,
      dataset: config.dataset
    });

    if (raw.length === 0) break;

    // Transform concurrently (bounded), skipping invalid POIs without failing whole page.
    const transformed = await Promise.allSettled(raw.map((r) => limit(async () => transformPoi(r))));
    const docs = transformed.flatMap((result) => {
      if (result.status === "fulfilled") return [result.value];

      if (result.reason instanceof InvalidPoiError) {
        skippedInvalid += 1;
        // eslint-disable-next-line no-console
        console.warn(JSON.stringify({ event: "import.poi_skipped", reason: result.reason.message }));
        return [];
      }
      throw result.reason;
    });

    // Persist
    if (docs.length > 0) {
      await repo.upsertMany(docs);
    }

    pagesProcessed += 1;
    total += docs.length;
    offset += raw.length;

    // Last page
    if (raw.length < config.pageSize) break;
  }

  console.log(JSON.stringify({ event: "import.completed", total, pagesProcessed, skippedInvalid }));
};
