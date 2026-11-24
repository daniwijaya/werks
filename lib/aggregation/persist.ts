import { randomUUID } from "node:crypto";
import { and, eq, ne, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../../db/schema.ts";
import { jobCategories, jobs } from "../../db/schema.ts";
import type { JobSource } from "../../db/schema.ts";
import { normalizeJobUrl } from "./normalize.ts";
import { isSourceEligibleForSync, restrictJobToAllowedFields } from "./compliance.ts";
import { findDuplicateCandidate, shouldCloseAfterMissing } from "./deduplicate.ts";
import type { NormalizedJob } from "./types.ts";

type Database = PostgresJsDatabase<typeof schema>;
type SnapshotOptions = { completeSnapshot: boolean };

export async function persistSourceJobs(
  db: Database,
  source: JobSource,
  incoming: NormalizedJob[],
  options: SnapshotOptions,
): Promise<{ insertedCount: number; updatedCount: number; skippedCount: number; closedCount: number }> {
  if (!isSourceEligibleForSync(source)) {
    throw new Error(`Source ${source.sourceName} is not eligible for synchronization under its current compliance assessment.`);
  }
  const permittedIncoming = incoming.map((job) => restrictJobToAllowedFields(job, source.allowedFields));
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let closedCount = 0;
  const now = new Date();
  const incomingIds = new Set(permittedIncoming.map((job) => job.externalId));

  await db.transaction(async (tx) => {
    const currentSourceJobs = await tx.select({
      id: jobs.id,
      externalId: jobs.externalId,
      status: jobs.status,
      missingFromSyncCount: jobs.missingFromSyncCount,
    }).from(jobs).where(eq(jobs.sourceId, source.id));
    const currentIds = new Set(currentSourceJobs.map((job) => job.externalId));

    for (const job of permittedIncoming) {
      if (!job.externalId || !job.title || !job.sourceUrl) {
        skippedCount += 1;
        continue;
      }
      const canonicalUrl = job.canonicalUrl ?? normalizeJobUrl(job.sourceUrl);
      const candidates = await tx.select({
        id: jobs.id,
        sourceId: jobs.sourceId,
        externalId: jobs.externalId,
        canonicalUrl: jobs.canonicalUrl,
        sourceUrl: jobs.sourceUrl,
        normalizedCompanyName: jobs.normalizedCompanyName,
        normalizedTitle: jobs.normalizedTitle,
        locationText: jobs.locationText,
        duplicateGroupId: jobs.duplicateGroupId,
      }).from(jobs).where(or(
        and(ne(jobs.sourceId, source.id), canonicalUrl ? eq(jobs.canonicalUrl, canonicalUrl) : undefined),
        and(ne(jobs.sourceId, source.id), eq(jobs.sourceUrl, job.sourceUrl)),
        and(ne(jobs.sourceId, source.id), eq(jobs.normalizedCompanyName, job.normalizedCompanyName), eq(jobs.normalizedTitle, job.normalizedTitle)),
      )).limit(60);
      const matching = findDuplicateCandidate({ ...job, canonicalUrl }, candidates, source.id);
      const duplicateGroupId = matching?.duplicateGroupId ?? (matching ? randomUUID() : null);
      if (matching && !matching.duplicateGroupId && duplicateGroupId) {
        await tx.update(jobs).set({ duplicateGroupId }).where(eq(jobs.id, matching.id));
      }

      const expired = job.expiresAt ? job.expiresAt.getTime() < now.getTime() : false;
      const values = {
        sourceId: source.id,
        externalId: job.externalId,
        sourceUrl: job.sourceUrl,
        canonicalUrl,
        applicationUrl: job.applicationUrl,
        title: job.title,
        normalizedTitle: job.normalizedTitle,
        companyName: job.companyName,
        normalizedCompanyName: job.normalizedCompanyName,
        description: job.description,
        department: job.department,
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
        expiresAt: job.expiresAt,
        sourceUpdatedAt: job.sourceUpdatedAt,
        aggregatedAt: now,
        lastSeenAt: now,
        lastVerifiedAt: now,
        missingFromSyncCount: 0,
        duplicateGroupId,
        status: expired ? "expired" as const : "active" as const,
      };
      const [saved] = await tx.insert(jobs).values(values).onConflictDoUpdate({
        target: [jobs.sourceId, jobs.externalId],
        set: values,
      }).returning({ id: jobs.id });
      await tx.delete(jobCategories).where(eq(jobCategories.jobId, saved.id));
      if (job.categories.length) {
        await tx.insert(jobCategories).values(job.categories.map((category) => ({ jobId: saved.id, category })));
      }
      if (currentIds.has(job.externalId)) updatedCount += 1;
      else insertedCount += 1;
    }

    if (options.completeSnapshot) {
      for (const existing of currentSourceJobs) {
        if (incomingIds.has(existing.externalId) || existing.status !== "active") continue;
        const misses = existing.missingFromSyncCount + 1;
        const close = shouldCloseAfterMissing(options.completeSnapshot, misses);
        await tx.update(jobs).set({
          missingFromSyncCount: misses,
          lastVerifiedAt: now,
          ...(close ? { status: "closed" as const } : {}),
        }).where(eq(jobs.id, existing.id));
        if (close) closedCount += 1;
      }
    }
  });

  return { insertedCount, updatedCount, skippedCount, closedCount };
}
