import { and, eq } from "drizzle-orm";
import { getDatabase } from "../../db/client.ts";
import { jobSources, syncRuns } from "../../db/schema.ts";
import { isSourceEligibleForSync } from "./compliance.ts";
import { fetchRemoteOkJobs } from "./remoteok.ts";
import { persistSourceJobs } from "./persist.ts";
import { reconcileRemoteOkJobDecisions } from "./job-eligibility.ts";

export async function syncApprovedRemoteOkSources(options: {
  fetchImpl?: typeof fetch;
  now?: () => Date;
} = {}) {
  const { db } = getDatabase();
  const sources = await db.select().from(jobSources).where(and(
    eq(jobSources.sourceType, "remoteok"),
    eq(jobSources.isActive, true),
    eq(jobSources.complianceStatus, "approved"),
  )).then((rows) => rows.filter(isSourceEligibleForSync));
  const results = [];

  for (const source of sources) {
    const base = {
      sourceId: source.id,
      sourceName: source.sourceName,
      fetchedCount: 0,
      acceptedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      closedCount: 0,
    };
    if (source.endpointUrl !== "https://remoteok.com/api" || source.aggregationMethod !== "official_public_api") {
      results.push({ ...base, outcome: "failed" as const, error: "Remote OK source endpoint or method differs from its reviewed configuration." });
      continue;
    }
    if (source.lastSuccessfulSyncAt
      && Date.now() - source.lastSuccessfulSyncAt.getTime() < Math.max(1, source.pollingIntervalHours) * 3_600_000) {
      results.push({ ...base, outcome: "not_due" as const });
      continue;
    }

    const startedAt = options.now?.() ?? new Date();
    const [run] = await db.insert(syncRuns).values({ sourceId: source.id, startedAt }).returning({ id: syncRuns.id });
    try {
      const batch = await fetchRemoteOkJobs({
        fetchImpl: options.fetchImpl,
        requestLimitPerRun: source.requestLimitPerRun,
        minRequestIntervalSeconds: source.minRequestIntervalSeconds,
      });
      const eligibility = await reconcileRemoteOkJobDecisions(db, source.id, batch.jobEligibilityCandidates, options.now?.() ?? new Date());
      const publishableJobs = batch.jobs.filter((job) => eligibility.eligibleExternalIds.has(job.externalId));
      const persisted = await persistSourceJobs(db, source, publishableJobs, { completeSnapshot: false });
      const skippedCount = Math.max(0, batch.fetchedCount - batch.acceptedCount)
        + persisted.skippedCount + eligibility.suppressedExternalIds.size;
      const finishedAt = options.now?.() ?? new Date();
      await db.update(syncRuns).set({
        finishedAt,
        status: "succeeded",
        fetchedCount: batch.fetchedCount,
        acceptedCount: publishableJobs.length,
        insertedCount: persisted.insertedCount,
        updatedCount: persisted.updatedCount,
        skippedCount,
        metadata: {
          endpointUrl: batch.endpointUrl,
          designRelatedCount: batch.designRelatedCount,
          indonesiaEligibleCount: batch.indonesiaEligibleCount,
          worldwideManualReviewCount: batch.worldwideManualReviewCount,
          duplicateCount: batch.duplicateCount,
          ambiguousGeographyCount: batch.ambiguousGeographyCount,
          manualReviewListings: batch.manualReviewListings,
          jobLevelEligibility: {
            publishedCandidates: publishableJobs.length,
            suppressedCandidates: eligibility.suppressedExternalIds.size,
            newlyFlaggedManualReview: eligibility.newlyFlaggedManualReview,
            newlyExcluded: eligibility.newlyExcluded,
            staleDecisions: eligibility.staleDecisions,
          },
          rejectionReasons: batch.rejectionReasons,
          closedCount: 0,
          snapshotUsedForExpiration: false,
        },
      }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({
        lastSuccessfulSyncAt: finishedAt,
        lastSyncStatus: "succeeded",
        lastError: null,
        updatedAt: finishedAt,
      }).where(eq(jobSources.id, source.id));
      results.push({
        ...base,
        outcome: "synced" as const,
        fetchedCount: batch.fetchedCount,
        acceptedCount: publishableJobs.length,
        insertedCount: persisted.insertedCount,
        updatedCount: persisted.updatedCount,
        skippedCount,
        closedCount: 0,
        duplicateCount: batch.duplicateCount,
        rejectionReasons: batch.rejectionReasons,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Remote OK synchronization error.";
      const finishedAt = options.now?.() ?? new Date();
      await db.update(syncRuns).set({ finishedAt, status: "failed", errorMessage: message }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({ lastSyncStatus: "failed", lastError: message, updatedAt: finishedAt }).where(eq(jobSources.id, source.id));
      results.push({ ...base, outcome: "failed" as const, error: message });
    }
  }
  return results;
}
