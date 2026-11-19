import "server-only";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "../../db/client.ts";
import { jobCategories, jobSources, jobs, syncRuns } from "../../db/schema.ts";
import { fetchGreenhouseJobs } from "./greenhouse.ts";

export type GreenhouseSyncResult = {
  sourceId: string;
  sourceName: string;
  fetchedCount: number;
  acceptedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  error?: string;
};

export async function syncApprovedGreenhouseSources(): Promise<GreenhouseSyncResult[]> {
  const { db } = getDatabase();
  const sources = await db.select().from(jobSources).where(
    and(eq(jobSources.sourceType, "greenhouse"), eq(jobSources.isActive, true), eq(jobSources.permissionStatus, "approved")),
  );
  const results: GreenhouseSyncResult[] = [];

  for (const source of sources) {
    const [run] = await db.insert(syncRuns).values({ sourceId: source.id }).returning({ id: syncRuns.id });
    try {
      const batch = await fetchGreenhouseJobs({ boardIdentifier: source.boardIdentifier, companyName: source.companyName });
      let insertedCount = 0;
      let updatedCount = 0;

      await db.transaction(async (tx) => {
        const existing = await tx.select({ externalId: jobs.externalId }).from(jobs).where(eq(jobs.sourceId, source.id));
        const existingIds = new Set(existing.map((job) => job.externalId));
        const now = new Date();

        for (const job of batch.jobs) {
          const wasExisting = existingIds.has(job.externalId);
          const [saved] = await tx
            .insert(jobs)
            .values({
              sourceId: source.id,
              externalId: job.externalId,
              sourceUrl: job.sourceUrl,
              applicationUrl: job.applicationUrl,
              title: job.title,
              normalizedTitle: job.normalizedTitle,
              companyName: job.companyName,
              normalizedCompanyName: job.normalizedCompanyName,
              description: job.description,
              locationText: job.locationText,
              countryCode: job.countryCode,
              employmentType: job.employmentType,
              workArrangement: job.workArrangement,
              salaryMinimum: job.salaryMinimum,
              salaryMaximum: job.salaryMaximum,
              salaryCurrency: job.salaryCurrency,
              salaryInterval: job.salaryInterval,
              experienceLevel: job.experienceLevel,
              originalPostedAt: job.originalPostedAt,
              sourceUpdatedAt: job.sourceUpdatedAt,
              aggregatedAt: now,
              lastSeenAt: now,
              status: "active",
            })
            .onConflictDoUpdate({
              target: [jobs.sourceId, jobs.externalId],
              set: {
                sourceUrl: job.sourceUrl,
                applicationUrl: job.applicationUrl,
                title: job.title,
                normalizedTitle: job.normalizedTitle,
                companyName: job.companyName,
                normalizedCompanyName: job.normalizedCompanyName,
                description: job.description,
                locationText: job.locationText,
                countryCode: job.countryCode,
                employmentType: job.employmentType,
                workArrangement: job.workArrangement,
                salaryMinimum: job.salaryMinimum,
                salaryMaximum: job.salaryMaximum,
                salaryCurrency: job.salaryCurrency,
                salaryInterval: job.salaryInterval,
                experienceLevel: job.experienceLevel,
                originalPostedAt: job.originalPostedAt,
                sourceUpdatedAt: job.sourceUpdatedAt,
                aggregatedAt: now,
                lastSeenAt: now,
                status: "active",
              },
            })
            .returning({ id: jobs.id });

          await tx.delete(jobCategories).where(eq(jobCategories.jobId, saved.id));
          if (job.categories.length) {
            await tx.insert(jobCategories).values(job.categories.map((category) => ({ jobId: saved.id, category })));
          }
          if (wasExisting) updatedCount += 1;
          else insertedCount += 1;
        }
      });

      const skippedCount = batch.fetchedCount - batch.jobs.length;
      await db.update(syncRuns).set({
        finishedAt: new Date(),
        status: "succeeded",
        fetchedCount: batch.fetchedCount,
        acceptedCount: batch.jobs.length,
        insertedCount,
        updatedCount,
        skippedCount,
      }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({ lastSuccessfulSyncAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(jobSources.id, source.id));
      results.push({ sourceId: source.id, sourceName: source.sourceName, fetchedCount: batch.fetchedCount, acceptedCount: batch.jobs.length, insertedCount, updatedCount, skippedCount });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Greenhouse synchronization error.";
      await db.update(syncRuns).set({ finishedAt: new Date(), status: "failed", errorMessage: message }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({ lastError: message, updatedAt: new Date() }).where(eq(jobSources.id, source.id));
      results.push({ sourceId: source.id, sourceName: source.sourceName, fetchedCount: 0, acceptedCount: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0, error: message });
    }
  }

  return results;
}
