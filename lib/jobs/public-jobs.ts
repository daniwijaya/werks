import { createHash } from "node:crypto";
import { and, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDatabase } from "../../db/client.ts";
import { jobCategories, jobEligibilityDecisions, jobSources, jobs } from "../../db/schema.ts";
import type { Job } from "../../types/job.ts";
import { isSourceEligibleForSync } from "../aggregation/compliance.ts";

const PUBLIC_JOB_LIMIT = 250;

export type PublicJobRow = {
  id: string;
  externalId: string;
  sourceId: string;
  title: string;
  companyName: string;
  sourceUrl: string;
  applicationUrl: string | null;
  locationText: string | null;
  employmentType: string | null;
  workArrangement: "remote" | "hybrid" | "on_site" | null;
  originalPostedAt: Date | null;
  expiresAt: Date | null;
  status: "active" | "expired" | "closed";
  eligibilityDecision: "eligible" | "manual_review" | "excluded" | null;
  sourceName: string;
  sourceIsActive: boolean;
  complianceStatus: "approved" | "review_required" | "blocked";
  evidenceUrl: string | null;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  redistributionAllowed: boolean | null;
  attributionRequired: boolean | null;
  attributionText: string | null;
  allowedFields: string[];
};

type PublicJobCategoryRow = { jobId: string; category: string };

export type PublicJobRows = {
  jobs: PublicJobRow[];
  categories: PublicJobCategoryRow[];
};

function sourceIsPubliclyEligible(row: PublicJobRow, now: Date): boolean {
  return row.status === "active"
    && (row.eligibilityDecision === null || row.eligibilityDecision === "eligible")
    && (row.expiresAt === null || row.expiresAt.getTime() > now.getTime())
    && isSourceEligibleForSync({
      isActive: row.sourceIsActive,
      complianceStatus: row.complianceStatus,
      evidenceUrl: row.evidenceUrl,
      reviewNotes: row.reviewNotes,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy,
      redistributionAllowed: row.redistributionAllowed,
      attributionRequired: row.attributionRequired,
      attributionText: row.attributionText,
      allowedFields: row.allowedFields,
    });
}

function publicId(sourceName: string, externalId: string): string {
  return createHash("sha256").update(`${sourceName}\0${externalId}`).digest("base64url").slice(0, 22);
}

export function mapPublicJobRows(rows: PublicJobRows, now = new Date()): Job[] {
  const categoriesByJob = new Map<string, string[]>();
  for (const { jobId, category } of rows.categories) {
    const categories = categoriesByJob.get(jobId) ?? [];
    categories.push(category);
    categoriesByJob.set(jobId, categories);
  }

  return rows.jobs.flatMap((row) => {
    if (!sourceIsPubliclyEligible(row, now)) return [];
    const allowed = new Set(row.allowedFields);
    if (!allowed.has("title") || !allowed.has("companyName") || !allowed.has("sourceUrl")) return [];
    const title = row.title.trim();
    const companyName = row.companyName.trim();
    if (!title || !companyName || !row.sourceUrl) return [];

    return [{
      id: publicId(row.sourceName, row.externalId),
      title,
      companyName,
      location: allowed.has("locationText") ? row.locationText ?? "" : "",
      ...(allowed.has("workArrangement") && row.workArrangement
        ? { workMode: row.workArrangement === "on_site" ? "On-site" : row.workArrangement === "remote" ? "Remote" : "Hybrid" }
        : {}),
      ...(allowed.has("employmentType") && row.employmentType ? { employmentType: row.employmentType } : {}),
      designDisciplines: allowed.has("designDisciplines") ? categoriesByJob.get(row.id) ?? [] : [],
      sourceName: row.sourceName,
      sourceUrl: row.sourceUrl,
      ...(allowed.has("applicationUrl") && row.applicationUrl ? { applicationUrl: row.applicationUrl } : {}),
      attributionRequired: row.attributionRequired === true,
      ...(row.attributionRequired && row.attributionText ? { attributionText: row.attributionText } : {}),
      ...(allowed.has("originalPostedAt") && row.originalPostedAt
        ? { publishedAt: row.originalPostedAt.toISOString() }
        : {}),
      status: "active" as const,
    }];
  });
}

export async function readEligibleJobRows(): Promise<PublicJobRows> {
  const { db } = getDatabase();
  const now = new Date();
  const jobRows = await db.select({
    id: jobs.id,
    externalId: jobs.externalId,
    sourceId: jobs.sourceId,
    title: jobs.title,
    companyName: jobs.companyName,
    sourceUrl: jobs.sourceUrl,
    applicationUrl: jobs.applicationUrl,
    locationText: jobs.locationText,
    employmentType: jobs.employmentType,
    workArrangement: jobs.workArrangement,
    originalPostedAt: jobs.originalPostedAt,
    expiresAt: jobs.expiresAt,
    status: jobs.status,
    eligibilityDecision: jobEligibilityDecisions.decision,
    sourceName: jobSources.sourceName,
    sourceIsActive: jobSources.isActive,
    complianceStatus: jobSources.complianceStatus,
    evidenceUrl: jobSources.evidenceUrl,
    reviewNotes: jobSources.reviewNotes,
    reviewedAt: jobSources.reviewedAt,
    reviewedBy: jobSources.reviewedBy,
    redistributionAllowed: jobSources.redistributionAllowed,
    attributionRequired: jobSources.attributionRequired,
    attributionText: jobSources.attributionText,
    allowedFields: jobSources.allowedFields,
  }).from(jobs)
    .innerJoin(jobSources, eq(jobs.sourceId, jobSources.id))
    .leftJoin(jobEligibilityDecisions, and(
      eq(jobEligibilityDecisions.sourceId, jobs.sourceId),
      eq(jobEligibilityDecisions.externalJobId, jobs.externalId),
    ))
    .where(and(
      eq(jobs.status, "active"),
      eq(jobSources.isActive, true),
      eq(jobSources.complianceStatus, "approved"),
      eq(jobSources.redistributionAllowed, true),
      isNotNull(jobSources.evidenceUrl),
      isNotNull(jobSources.reviewNotes),
      isNotNull(jobSources.reviewedAt),
      isNotNull(jobSources.reviewedBy),
      isNotNull(jobSources.attributionRequired),
      sql`${jobSources.allowedFields} @> '["title", "companyName", "sourceUrl"]'::jsonb`,
      or(eq(jobSources.attributionRequired, false), isNotNull(jobSources.attributionText)),
      or(isNull(jobEligibilityDecisions.decision), eq(jobEligibilityDecisions.decision, "eligible")),
      or(isNull(jobs.expiresAt), gt(jobs.expiresAt, now)),
    ))
    .orderBy(sql`${jobs.originalPostedAt} DESC NULLS LAST`, desc(jobs.aggregatedAt))
    .limit(PUBLIC_JOB_LIMIT);

  if (jobRows.length === 0) return { jobs: [], categories: [] };
  const categoryRows = await db.select({ jobId: jobCategories.jobId, category: jobCategories.category })
    .from(jobCategories)
    .where(inArray(jobCategories.jobId, jobRows.map((job) => job.id)));

  return { jobs: jobRows, categories: categoryRows };
}

export type PublicJobsResult = { status: "success"; jobs: Job[] } | { status: "error"; jobs: [] };

export async function loadPublicJobs(
  readRows: () => Promise<PublicJobRows> = readEligibleJobRows,
): Promise<PublicJobsResult> {
  try {
    const rows = await readRows();
    return { status: "success", jobs: mapPublicJobRows(rows) };
  } catch {
    return { status: "error", jobs: [] };
  }
}
