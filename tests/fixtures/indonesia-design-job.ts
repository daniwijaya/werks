import type { Job } from "../../types/job.ts";

// Test-only data. Never seed into Neon or import from application/runtime code.
export const indonesiaDesignJobFixture: Job = {
  id: "fixture-only-jakarta-product-designer",
  title: "Product Designer (Fixture)",
  companyName: "WERKS Fixture Studio",
  location: "Jakarta, Indonesia",
  workMode: "Hybrid",
  employmentType: "Full-time",
  designDisciplines: ["Product Design"],
  sourceName: "Jobicy fixture (TEST DATA)",
  sourceUrl: "https://example.test/jobs/fixture-product-designer",
  applicationUrl: "https://example.test/jobs/fixture-product-designer/apply",
  attributionRequired: true,
  attributionText: "Test fixture only — no real vacancy",
  status: "active",
};
