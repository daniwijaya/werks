import { and, eq } from "drizzle-orm";
import { getDatabase } from "../../db/client.ts";
import { jobSources, jobs, syncRuns } from "../../db/schema.ts";
import { fetchJobicyJobs, fetchJobicyStatuses } from "./jobicy.ts";
import { persistSourceJobs } from "./persist.ts";
import { isSourceEligibleForSync } from "./compliance.ts";

export type JobicySyncResult = {
  sourceId: string;
  sourceName: string;
  fetchedCount: number;
  acceptedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  closedCount: number;
  error?: string;
  outcome?: "dry_run" | "synced" | "not_due";
  rawCount?: number;
  duplicateCount?: number;
  rejectedCount?: number;
  rejectionReasons?: Record<string, number>;
};

export async function syncApprovedJobicySources(options: { dryRun?: boolean } = {}): Promise<JobicySyncResult[]> {
  const { db } = getDatabase();
  const sources = await db.select().from(jobSources).where(
    and(eq(jobSources.sourceType, "jobicy"), eq(jobSources.isActive, true), eq(jobSources.complianceStatus, "approved")),
  ).then((rows) => rows.filter(isSourceEligibleForSync));
  const results: JobicySyncResult[] = [];

  for (const source of sources) {
    const empty = { sourceId: source.id, sourceName: source.sourceName, fetchedCount: 0, acceptedCount: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0, closedCount: 0 };
    if (source.lastSuccessfulSyncAt
      && Date.now() - source.lastSuccessfulSyncAt.getTime() < Math.max(1, source.pollingIntervalHours) * 3_600_000) {
      results.push({ ...empty, outcome: "not_due" });
      continue;
    }
    let runId: string | undefined;
    try {
      if (source.endpointUrl !== "https://jobicy.com/api/jobs" || source.aggregationMethod !== "official_public_api") {
        throw new Error("Jobicy source endpoint or aggregation method does not match the reviewed connector.");
      }
      // One throttle and request budget covers both feed and status calls, including retries.
      let lastRequestAt = 0;
      let requestCount = 0;
      const minimumIntervalMs = Math.max(1_050, source.minRequestIntervalSeconds * 1_000);
      const fetchImpl: typeof fetch = async (input, init) => {
        if (++requestCount > source.requestLimitPerRun) throw new Error("Jobicy request budget exceeded; incomplete snapshot was not persisted.");
        const wait = minimumIntervalMs - (Date.now() - lastRequestAt);
        if (lastRequestAt && wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        lastRequestAt = Date.now();
        return fetch(input, init);
      };
      const batch = await fetchJobicyJobs({ fetchImpl, minimumIntervalMs: 0 });
      const diagnostics = { rawCount: batch.rawCount, duplicateCount: batch.duplicateCount, rejectedCount: batch.rejectedCount, rejectionReasons: batch.rejectionReasons };
      if (options.dryRun) {
        results.push({ ...empty, ...diagnostics, outcome: "dry_run", fetchedCount: batch.fetchedCount, acceptedCount: batch.jobs.length, skippedCount: batch.rejectedCount });
        continue;
      }
      const [run] = await db.insert(syncRuns).values({ sourceId: source.id }).returning({ id: syncRuns.id });
      runId = run.id;
      const existing = await db.select({ id: jobs.id, externalId: jobs.externalId }).from(jobs).where(eq(jobs.sourceId, source.id));
      const statuses = await fetchJobicyStatuses(existing.map((job) => job.externalId), { fetchImpl, minimumIntervalMs: 0 });
      if (existing.length) {
        await db.transaction(async (tx) => {
          for (const job of existing) {
            const status = statuses.get(job.externalId);
            if (status === "active" || status === "closed") {
              await tx.update(jobs).set({ status, lastVerifiedAt: new Date() }).where(eq(jobs.id, job.id));
            }
          }
        });
      }
      const persisted = await persistSourceJobs(db, source, batch.jobs, { completeSnapshot: false });
      const closedCount = [...statuses.values()].filter((status) => status === "closed").length;
      const skippedCount = Math.max(0, batch.fetchedCount - batch.jobs.length) + persisted.skippedCount;
      await db.update(syncRuns).set({
        finishedAt: new Date(),
        status: "succeeded",
        fetchedCount: batch.fetchedCount,
        acceptedCount: batch.jobs.length,
        insertedCount: persisted.insertedCount,
        updatedCount: persisted.updatedCount,
        skippedCount,
        metadata: { closedCount, endpointUrl: batch.endpointUrl, ...diagnostics },
      }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({
        lastSuccessfulSyncAt: new Date(),
        lastSyncStatus: "succeeded",
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(jobSources.id, source.id));
      results.push({
        ...diagnostics,
        outcome: "synced",
        sourceId: source.id,
        sourceName: source.sourceName,
        fetchedCount: batch.fetchedCount,
        acceptedCount: batch.jobs.length,
        insertedCount: persisted.insertedCount,
        updatedCount: persisted.updatedCount,
        skippedCount,
        closedCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Jobicy synchronization error.";
      if (!options.dryRun) {
        if (runId) await db.update(syncRuns).set({ finishedAt: new Date(), status: "failed", errorMessage: message }).where(eq(syncRuns.id, runId));
        else await db.insert(syncRuns).values({ sourceId: source.id, finishedAt: new Date(), status: "failed", errorMessage: message });
        await db.update(jobSources).set({ lastSyncStatus: "failed", lastError: message, updatedAt: new Date() }).where(eq(jobSources.id, source.id));
      }
      results.push({ sourceId: source.id, sourceName: source.sourceName, fetchedCount: 0, acceptedCount: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0, closedCount: 0, error: message });
    }
  }
  return results;
}
