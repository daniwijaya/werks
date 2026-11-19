import assert from "node:assert/strict";
import test from "node:test";
import { fetchGreenhouseJobs, greenhouseJobsEndpoint, mapGreenhouseJob } from "../../lib/aggregation/greenhouse.ts";
import { classifyDesignCategories, isIndonesiaOpportunity, normalizeWorkArrangement } from "../../lib/aggregation/normalize.ts";

test("Greenhouse endpoint is built from a board identifier and rejects URL injection", () => {
  assert.equal(greenhouseJobsEndpoint("xendit"), "https://boards-api.greenhouse.io/v1/boards/xendit/jobs");
  assert.throws(() => greenhouseJobsEndpoint("https://bad.example"), /Invalid Greenhouse board identifier/);
});

test("design classification maps supported title variants", () => {
  assert.deepEqual(classifyDesignCategories("Senior Product Designer, UX Research"), ["Product Design", "UX Research"]);
  assert.deepEqual(classifyDesignCategories("Backend Engineer"), []);
});

test("Indonesia scope and work arrangement are only inferred from explicit location text", () => {
  assert.equal(isIndonesiaOpportunity("Jakarta, Indonesia"), true);
  assert.equal(isIndonesiaOpportunity("Remote — Indonesia"), true);
  assert.equal(isIndonesiaOpportunity("Remote — Worldwide"), false);
  assert.equal(normalizeWorkArrangement("Remote — Indonesia"), "remote");
  assert.equal(normalizeWorkArrangement("Jakarta, Indonesia"), null);
});

test("Greenhouse mapping preserves source URL and leaves unavailable details null", () => {
  const job = mapGreenhouseJob({
    id: 123,
    title: "UX Designer - Developer Experience",
    absolute_url: "https://job-boards.greenhouse.io/xendit/jobs/123",
    location: { name: "Jakarta, Indonesia" },
    updated_at: "2026-11-18T08:00:00Z",
  }, { boardIdentifier: "xendit", companyName: "Xendit" });

  assert.ok(job);
  assert.equal(job.externalId, "123");
  assert.equal(job.sourceUrl, "https://job-boards.greenhouse.io/xendit/jobs/123");
  assert.equal(job.countryCode, "ID");
  assert.equal(job.description, null);
  assert.equal(job.applicationUrl, null);
  assert.equal(job.salaryMinimum, null);
  assert.deepEqual(job.categories, ["UI/UX Design"]);
});

test("fetch retries a temporary 503 and parses the published jobs response", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response("temporarily unavailable", { status: 503 });
    return new Response(JSON.stringify({ jobs: [{
      id: 234,
      title: "Product Designer",
      absolute_url: "https://job-boards.greenhouse.io/xendit/jobs/234",
      location: { name: "Jakarta, Indonesia" },
    }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await fetchGreenhouseJobs({ boardIdentifier: "xendit", companyName: "Xendit" }, { fetchImpl, retries: 1, delay: async () => undefined });
  assert.equal(calls, 2);
  assert.equal(result.fetchedCount, 1);
  assert.equal(result.jobs.length, 1);
});
