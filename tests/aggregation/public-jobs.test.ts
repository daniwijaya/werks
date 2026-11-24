import assert from "node:assert/strict";
import test from "node:test";
import { loadPublicJobs, mapPublicJobRows } from "../../lib/jobs/public-jobs.ts";
import type { PublicJobRow, PublicJobRows } from "../../lib/jobs/public-jobs.ts";

const now = new Date("2026-11-20T06:00:00.000Z");
const baseRow: PublicJobRow = {
  id: "internal-db-job-id",
  externalId: "jobicy-456",
  sourceId: "internal-db-source-id",
  title: "Product Designer",
  companyName: "Example Co",
  sourceUrl: "https://jobicy.com/jobs/product-designer",
  applicationUrl: "https://jobicy.com/jobs/product-designer",
  locationText: "Remote — Indonesia",
  employmentType: "Full-Time",
  workArrangement: "remote",
  originalPostedAt: new Date("2026-11-19T03:00:00.000Z"),
  expiresAt: null,
  status: "active",
  eligibilityDecision: null,
  sourceName: "Jobicy public jobs API",
  sourceIsActive: true,
  complianceStatus: "approved",
  evidenceUrl: "https://jobicy.com/jobs-rss-feed",
  reviewNotes: "API policy permits attributed job discovery use.",
  reviewedAt: new Date("2026-11-19T00:00:00.000Z"),
  reviewedBy: "WERKS technical audit",
  redistributionAllowed: true,
  attributionRequired: true,
  attributionText: "Source: Jobicy",
  allowedFields: ["title", "companyName", "sourceUrl", "applicationUrl", "locationText", "employmentType", "workArrangement", "originalPostedAt", "designDisciplines"],
};

const rows = (jobs: PublicJobRow[]): PublicJobRows => ({
  jobs,
  categories: [{ jobId: baseRow.id, category: "Product Design" }],
});

test("public job retrieval maps approved records to a frontend-safe Jobicy DTO", () => {
  const [job] = mapPublicJobRows(rows([baseRow]), now);
  assert.ok(job);
  assert.equal(job.title, "Product Designer");
  assert.equal(job.companyName, "Example Co");
  assert.equal(job.sourceName, "Jobicy public jobs API");
  assert.equal(job.attributionRequired, true);
  assert.equal(job.attributionText, "Source: Jobicy");
  assert.equal(job.sourceUrl, baseRow.sourceUrl);
  assert.deepEqual(job.designDisciplines, ["Product Design"]);
  assert.equal(job.applicationUrl, baseRow.applicationUrl);
  assert.equal(job.location, "Remote — Indonesia");
  assert.equal(job.workMode, "Remote");
  assert.deepEqual(job.designDisciplines, ["Product Design"]);
  assert.notEqual(job.id, baseRow.id);
  assert.notEqual(job.id, baseRow.sourceId);
});

test("inactive, unapproved, non-redistributable, and closed records are excluded", () => {
  const candidates = [
    baseRow,
    { ...baseRow, id: "inactive", sourceIsActive: false },
    { ...baseRow, id: "review", complianceStatus: "review_required" as const },
    { ...baseRow, id: "blocked", complianceStatus: "blocked" as const },
    { ...baseRow, id: "no-redistribution", redistributionAllowed: false },
    { ...baseRow, id: "unknown-attribution", attributionRequired: null },
    { ...baseRow, id: "closed", status: "closed" as const },
    { ...baseRow, id: "expired-status", status: "expired" as const },
    { ...baseRow, id: "expired-date", expiresAt: new Date("2026-11-20T05:59:59.000Z") },
  ];
  assert.deepEqual(mapPublicJobRows(rows(candidates), now).map((job) => job.id), mapPublicJobRows(rows([baseRow]), now).map((job) => job.id));
});

test("job-level manual review and excluded decisions stay out of public listings", () => {
  const candidates = [
    baseRow,
    { ...baseRow, id: "manual-review", eligibilityDecision: "manual_review" as const },
    { ...baseRow, id: "excluded", eligibilityDecision: "excluded" as const },
  ];
  assert.deepEqual(mapPublicJobRows(rows(candidates), now).map((job) => job.title), ["Product Designer"]);
});

test("fields excluded by source policy are not added to the frontend DTO", () => {
  const restricted = {
    ...baseRow,
    allowedFields: ["title", "companyName", "sourceUrl"],
    attributionRequired: false,
  };
  const [job] = mapPublicJobRows(rows([restricted]), now);
  assert.ok(job);
  assert.equal(job.location, "");
  assert.equal(job.workMode, undefined);
  assert.equal(job.employmentType, undefined);
  assert.equal(job.publishedAt, undefined);
  assert.equal(job.applicationUrl, undefined);
  assert.equal(job.attributionText, undefined);
  assert.deepEqual(job.designDisciplines, []);
  assert.equal(job.sourceUrl, baseRow.sourceUrl);
});

test("missing required fields or attribution text make a record ineligible", () => {
  assert.equal(mapPublicJobRows(rows([{ ...baseRow, allowedFields: ["title", "companyName"] }]), now).length, 0);
  assert.equal(mapPublicJobRows(rows([{ ...baseRow, attributionText: null }]), now).length, 0);
});

test("empty database results are distinct from retrieval failure", async () => {
  const empty = await loadPublicJobs(async () => ({ jobs: [], categories: [] }));
  assert.deepEqual(empty, { status: "success", jobs: [] });

  const failed = await loadPublicJobs(async () => { throw new Error("database offline"); });
  assert.deepEqual(failed, { status: "error", jobs: [] });
});

test("homepage data loader calls its server-side row reader once", async () => {
  let readCount = 0;
  const result = await loadPublicJobs(async () => {
    readCount += 1;
    return rows([baseRow]);
  });
  assert.equal(readCount, 1);
  assert.equal(result.status, "success");
  if (result.status === "success") assert.equal(result.jobs.length, 1);
});
