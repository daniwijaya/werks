import assert from "node:assert/strict";
import test from "node:test";
import type { JobSource } from "../../db/schema.ts";
import { isSourceEligibleForSync, restrictJobToAllowedFields } from "../../lib/aggregation/compliance.ts";
import { sourceAssessmentPatch, reassessSources } from "../../lib/aggregation/source-registry.ts";
import { sourceSeed } from "../../lib/aggregation/source-seed.ts";
import type { NormalizedJob } from "../../lib/aggregation/types.ts";

const approvedSource: Pick<JobSource,
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
> = {
  isActive: true,
  complianceStatus: "approved",
  evidenceUrl: "https://example.com/api-terms",
  reviewNotes: "Terms permit this limited use with attribution.",
  reviewedAt: new Date("2026-11-20T00:00:00.000Z"),
  reviewedBy: "WERKS reviewer",
  redistributionAllowed: true,
  attributionRequired: true,
  attributionText: "Source: Example",
  allowedFields: ["title", "companyName", "sourceUrl", "applicationUrl", "locationText"],
};

const normalizedJob: NormalizedJob = {
  externalId: "42",
  title: "Product Designer",
  normalizedTitle: "product designer",
  companyName: "Example Co",
  normalizedCompanyName: "example co",
  sourceUrl: "https://example.com/jobs/42",
  canonicalUrl: "https://example.com/jobs/42",
  applicationUrl: "https://example.com/jobs/42/apply",
  description: "Full job description",
  department: "Design",
  locationText: "Jakarta, Indonesia",
  countryCode: "ID",
  employmentType: "Full-time",
  workArrangement: "hybrid",
  salaryMinimum: "1000",
  salaryMaximum: "2000",
  salaryCurrency: "USD",
  salaryInterval: "yearly",
  experienceLevel: "Mid-level",
  originalPostedAt: new Date("2026-11-19T00:00:00.000Z"),
  expiresAt: null,
  sourceUpdatedAt: null,
  categories: ["Product Design"],
};

test("inactive sources cannot enter the synchronization pipeline", () => {
  assert.equal(isSourceEligibleForSync({ ...approvedSource, isActive: false }), false);
});

test("review_required and blocked sources cannot enter the synchronization pipeline", () => {
  assert.equal(isSourceEligibleForSync({ ...approvedSource, complianceStatus: "review_required" }), false);
  assert.equal(isSourceEligibleForSync({ ...approvedSource, complianceStatus: "blocked" }), false);
});

test("approved sources must have redistribution approval, review evidence, permitted core fields, and attribution", () => {
  assert.equal(isSourceEligibleForSync(approvedSource), true);
  assert.equal(isSourceEligibleForSync({ ...approvedSource, redistributionAllowed: false }), false);
  assert.equal(isSourceEligibleForSync({ ...approvedSource, evidenceUrl: null }), false);
  assert.equal(isSourceEligibleForSync({ ...approvedSource, attributionText: null }), false);
  assert.equal(isSourceEligibleForSync({ ...approvedSource, allowedFields: ["title", "companyName"] }), false);
});

test("approved connector records discard fields outside the source allowance", () => {
  const restricted = restrictJobToAllowedFields(normalizedJob, approvedSource.allowedFields);
  assert.equal(restricted.title, normalizedJob.title);
  assert.equal(restricted.companyName, normalizedJob.companyName);
  assert.equal(restricted.sourceUrl, normalizedJob.sourceUrl);
  assert.equal(restricted.applicationUrl, normalizedJob.applicationUrl);
  assert.equal(restricted.locationText, normalizedJob.locationText);
  assert.equal(restricted.description, null);
  assert.equal(restricted.department, null);
  assert.equal(restricted.salaryMinimum, null);
  assert.deepEqual(restricted.categories, []);
  assert.deepEqual(restrictJobToAllowedFields(normalizedJob, [...approvedSource.allowedFields, "designDisciplines"]).categories, normalizedJob.categories);
});

test("attribution requirements remain recorded on the approved Jobicy source", () => {
  const jobicy = sourceSeed.find((source) => source.sourceType === "jobicy");
  assert.ok(jobicy);
  assert.equal(jobicy.attributionRequired, true);
  assert.match(jobicy.attributionText ?? "", /Jobicy/);
  assert.ok((jobicy.usageRestrictions ?? []).some((restriction) => /attribute/i.test(restriction)));
  assert.ok(jobicy.allowedFields?.includes("designDisciplines"));
});

test("all ten ATS company assessments remain review-required, inactive, and without unverified display fields", () => {
  const atsSources = sourceSeed.filter((source) => ["greenhouse", "lever", "ashby"].includes(source.sourceType));
  assert.equal(atsSources.length, 10);
  for (const source of atsSources) {
    assert.equal(source.complianceStatus, "review_required", source.sourceName);
    assert.equal(source.isActive, false, source.sourceName);
    assert.equal(source.redistributionAllowed, null, source.sourceName);
    assert.equal(source.attributionRequired, null, source.sourceName);
    assert.deepEqual(source.allowedFields, [], source.sourceName);
    assert.ok(source.evidenceUrl, source.sourceName);
    assert.ok((source.complianceEvidenceUrls?.length ?? 0) >= 5, source.sourceName);
  }
});

test("a source can be reassessed and become eligible after evidence and permissions are updated", () => {
  const sourceBeforeReview = { ...approvedSource, complianceStatus: "review_required" as const, isActive: false };
  assert.equal(isSourceEligibleForSync(sourceBeforeReview), false);
  const reassessed = { ...sourceBeforeReview, complianceStatus: "approved" as const, isActive: true };
  assert.equal(isSourceEligibleForSync(reassessed), true);
  const patch = sourceAssessmentPatch({
    complianceStatus: "approved",
    evidenceUrl: approvedSource.evidenceUrl,
    reviewNotes: "Terms were reassessed and permit this use.",
    complianceEvidenceUrls: [approvedSource.evidenceUrl as string],
    reviewedAt: new Date("2026-11-20T00:00:00.000Z"),
    reviewedBy: approvedSource.reviewedBy,
    redistributionAllowed: true,
    attributionRequired: true,
    attributionText: approvedSource.attributionText,
    allowedFields: approvedSource.allowedFields,
    usageRestrictions: [],
  });
  assert.equal(patch.complianceStatus, "approved");
  assert.equal(patch.isActive, false, "reassessment requires activation to be a separate deliberate step");
  assert.equal(typeof reassessSources, "function", "batch reassessment uses the same explicit registry path");
});
