import type { JobSource } from "../../db/schema.ts";
import type { NormalizedJob } from "./types.ts";

export const REQUIRED_SOURCE_FIELDS = ["title", "companyName", "sourceUrl"] as const;

export function isSourceEligibleForSync(source: Pick<JobSource,
  | "isActive"
  | "complianceStatus"
  | "evidenceUrl"
  | "reviewNotes"
  | "reviewedAt"
  | "reviewedBy"
  | "redistributionAllowed"
  | "attributionRequired"
  | "attributionText"
  | "allowedFields"
>): boolean {
  return source.isActive
    && source.complianceStatus === "approved"
    && source.redistributionAllowed === true
    && typeof source.attributionRequired === "boolean"
    && Boolean(source.evidenceUrl && source.reviewNotes && source.reviewedAt && source.reviewedBy)
    && REQUIRED_SOURCE_FIELDS.every((field) => source.allowedFields.includes(field))
    && (!source.attributionRequired || Boolean(source.attributionText));
}

const FIELD_TO_JOB_KEY: Record<string, keyof NormalizedJob> = {
  title: "title",
  companyName: "companyName",
  sourceUrl: "sourceUrl",
  applicationUrl: "applicationUrl",
  description: "description",
  department: "department",
  locationText: "locationText",
  countryCode: "countryCode",
  employmentType: "employmentType",
  workArrangement: "workArrangement",
  salaryMinimum: "salaryMinimum",
  salaryMaximum: "salaryMaximum",
  salaryCurrency: "salaryCurrency",
  salaryInterval: "salaryInterval",
  experienceLevel: "experienceLevel",
  originalPostedAt: "originalPostedAt",
  expiresAt: "expiresAt",
  sourceUpdatedAt: "sourceUpdatedAt",
};

export function restrictJobToAllowedFields(job: NormalizedJob, allowedFields: string[]): NormalizedJob {
  const allowed = new Set(allowedFields);
  const restricted = { ...job };
  if (!allowed.has("designDisciplines")) restricted.categories = [];
  for (const [field, key] of Object.entries(FIELD_TO_JOB_KEY)) {
    if (!allowed.has(field) && field !== "title" && field !== "companyName" && field !== "sourceUrl") {
      (restricted as unknown as Record<string, unknown>)[key] = null;
    }
  }
  return restricted;
}
