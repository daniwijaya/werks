import { and, eq } from "drizzle-orm";
import { getDatabase } from "../../db/client.ts";
import { jobCategories, jobSources, jobs, syncRuns } from "../../db/schema.ts";
import { fetchJobicyJobs, fetchJobicyStatuses } from "./jobicy.ts";

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
};

export async function syncApprovedJobicySources(): Promise<JobicySyncResult[]> {
  const { db } = getDatabase();
  const sources = await db.select().from(jobSources).where(
    and(eq(jobSources.sourceType, "jobicy"), eq(jobSources.isActive, true), eq(jobSources.permissionStatus, "approved")),
  );
  const results: JobicySyncResult[] = [];

  for (const source of sources) {
    const [run] = await db.insert(syncRuns).values({ sourceId: source.id }).returning({ id: syncRuns.id });
    try {
      const existing = await db.select({ id: jobs.id, externalId: jobs.externalId }).from(jobs).where(eq(jobs.sourceId, source.id));
      const previousStatuses = await fetchJobicyStatuses(existing.map((job) => job.externalId));
      // Status and feed requests share Jobicy's one-request-per-second IP limit.
      if (existing.length) await new Promise((resolve) => setTimeout(resolve, 1_050));
      const batch = await fetchJobicyJobs();
      let insertedCount = 0;
      let updatedCount = 0;
      let closedCount = 0;

      await db.transaction(async (tx) => {
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

        for (const previousJob of existing) {
          const status = previousStatuses.get(previousJob.externalId);
          if (status === "closed") {
            await tx.update(jobs).set({ status: "closed" }).where(eq(jobs.id, previousJob.id));
            closedCount += 1;
          } else if (status === "active") {
            await tx.update(jobs).set({ status: "active", lastSeenAt: now }).where(eq(jobs.id, previousJob.id));
          }
          // Unknown jobs stay unchanged until the source confirms a status.
        }
      });

      const skippedCount = Math.max(0, batch.fetchedCount - batch.jobs.length);
      await db.update(syncRuns).set({
        finishedAt: new Date(),
        status: "succeeded",
        fetchedCount: batch.fetchedCount,
        acceptedCount: batch.jobs.length,
        insertedCount,
        updatedCount,
        skippedCount,
        metadata: { closedCount },
      }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({ lastSuccessfulSyncAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(jobSources.id, source.id));
      results.push({ sourceId: source.id, sourceName: source.sourceName, fetchedCount: batch.fetchedCount, acceptedCount: batch.jobs.length, insertedCount, updatedCount, skippedCount, closedCount });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Jobicy synchronization error.";
      await db.update(syncRuns).set({ finishedAt: new Date(), status: "failed", errorMessage: message }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({ lastError: message, updatedAt: new Date() }).where(eq(jobSources.id, source.id));
      results.push({ sourceId: source.id, sourceName: source.sourceName, fetchedCount: 0, acceptedCount: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0, closedCount: 0, error: message });
    }
  }

  return results;
}
