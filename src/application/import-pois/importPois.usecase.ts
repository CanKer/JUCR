import type { OpenChargeMapClient } from "../../ports/OpenChargeMapClient";
import type { PoiRepository } from "../../ports/PoiRepository";
import { createLimiter } from "../../shared/concurrency/limiter";
import { transformPoi } from "../../core/poi/transformPoi";
import type { ImporterConfigInput } from "./importer.config";
import { resolveImporterConfig } from "./importer.config";
import {
  classifyTransformFailure,
  createImportRunSummaryTracker,
  wrapRepositoryFailure
} from "./import.error-handler";

/**
 * Imports POIs in pages and persists them using repository bulk upserts.
 */
export const importPois = async (
  deps: { client: OpenChargeMapClient; repo: PoiRepository; config: ImporterConfigInput }
): Promise<void> => {
  const { client, repo } = deps;
  const config = resolveImporterConfig(deps.config);
  const extractExternalId = (rawPoi: unknown): number | undefined => {
    if (typeof rawPoi !== "object" || rawPoi == null) return undefined;
    const id = (rawPoi as { ID?: unknown }).ID;

    if (typeof id === "number") {
      return Number.isSafeInteger(id) && id > 0 ? id : undefined;
    }

    if (typeof id === "string") {
      const normalized = id.trim();
      if (!/^\d+$/.test(normalized)) return undefined;
      const parsed = Number.parseInt(normalized, 10);
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
    }

    return undefined;
  };

  const limit = createLimiter(config.concurrency);
  let offset = config.startOffset;
  const summaryTracker = createImportRunSummaryTracker();

  while (true) {
    if (summaryTracker.pagesProcessed() >= config.maxPages) break;

    const currentPage = summaryTracker.nextPageNumber();
    const raw = await client.fetchPois({
      limit: config.pageSize,
      offset,
      modifiedSince: config.modifiedSince,
      dataset: config.dataset
    });

    if (raw.length === 0) break;

    // Transform concurrently (bounded), skipping invalid POIs without failing whole page.
    const transformed = await Promise.allSettled(raw.map((r) => limit(async () => transformPoi(r))));
    const docs = transformed.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        return [result.value];
      }

      const decision = classifyTransformFailure(result.reason, {
        page: currentPage,
        offset,
        pageSize: config.pageSize,
        index,
        externalId: extractExternalId(raw[index])
      });
      if (decision.action === "skip") {
        const skippedCount = summaryTracker.addSkipped(decision.code);
        // eslint-disable-next-line no-console
        console.warn(JSON.stringify({ ...decision.log, skippedCount }));
        return [];
      }

      throw decision.error;
    });

    // Persist
    if (docs.length > 0) {
      try {
        await repo.upsertMany(docs);
      } catch (error) {
        throw wrapRepositoryFailure(error, { page: currentPage, offset });
      }
    }

    summaryTracker.addProcessedPage();
    summaryTracker.addImported(docs.length);
    offset += raw.length;

    // Last page
    if (raw.length < config.pageSize) break;
  }

  console.log(JSON.stringify({ event: "import.completed", ...summaryTracker.summary() }));
};
