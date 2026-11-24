import { and, eq } from "drizzle-orm";
import { getDatabase } from "../../db/client.ts";
import { jobSources, syncRuns } from "../../db/schema.ts";
import { fetchGreenhouseJobs } from "./greenhouse.ts";
import { persistSourceJobs } from "./persist.ts";
import { isSourceEligibleForSync } from "./compliance.ts";

export type GreenhouseSyncResult = {
  sourceId: string;
  sourceName: string;
  fetchedCount: number;
  acceptedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  closedCount?: number;
  error?: string;
};

export async function syncApprovedGreenhouseSources(): Promise<GreenhouseSyncResult[]> {
  const { db } = getDatabase();
  const sources = await db.select().from(jobSources).where(
    and(eq(jobSources.sourceType, "greenhouse"), eq(jobSources.isActive, true), eq(jobSources.complianceStatus, "approved")),
  ).then((rows) => rows.filter(isSourceEligibleForSync));
  const results: GreenhouseSyncResult[] = [];

  for (const source of sources) {
    if (source.lastSuccessfulSyncAt
      && Date.now() - source.lastSuccessfulSyncAt.getTime() < Math.max(1, source.pollingIntervalHours) * 3_600_000) continue;
    const [run] = await db.insert(syncRuns).values({ sourceId: source.id }).returning({ id: syncRuns.id });
    try {
      if (!source.boardIdentifier) throw new Error("Greenhouse source has no verified board identifier.");
      const batch = await fetchGreenhouseJobs({ boardIdentifier: source.boardIdentifier, companyName: source.companyName });
      const persisted = await persistSourceJobs(db, source, batch.jobs, { completeSnapshot: true });
      await db.update(syncRuns).set({
        finishedAt: new Date(),
        status: "succeeded",
        fetchedCount: batch.fetchedCount,
        acceptedCount: batch.jobs.length,
        insertedCount: persisted.insertedCount,
        updatedCount: persisted.updatedCount,
        skippedCount: batch.fetchedCount - batch.jobs.length + persisted.skippedCount,
        metadata: { endpointUrl: batch.endpointUrl, closedCount: persisted.closedCount },
      }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({
        lastSuccessfulSyncAt: new Date(),
        lastSyncStatus: "succeeded",
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(jobSources.id, source.id));
      results.push({
        sourceId: source.id,
        sourceName: source.sourceName,
        fetchedCount: batch.fetchedCount,
        acceptedCount: batch.jobs.length,
        insertedCount: persisted.insertedCount,
        updatedCount: persisted.updatedCount,
        skippedCount: batch.fetchedCount - batch.jobs.length + persisted.skippedCount,
        closedCount: persisted.closedCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Greenhouse synchronization error.";
      await db.update(syncRuns).set({ finishedAt: new Date(), status: "failed", errorMessage: message }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({ lastSyncStatus: "failed", lastError: message, updatedAt: new Date() }).where(eq(jobSources.id, source.id));
      results.push({ sourceId: source.id, sourceName: source.sourceName, fetchedCount: 0, acceptedCount: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0, error: message });
    }
  }
  return results;
}
