import assert from "node:assert/strict";
import test from "node:test";
import { fetchJobicyJobs, fetchJobicyStatuses, isJobicyListingUrl, mapJobicyJob } from "../../lib/aggregation/jobicy.ts";

const indonesiaJob = {
  id: 456,
  url: "https://jobicy.com/jobs/indonesia-product-designer",
  jobTitle: "Product Designer",
  companyName: "Example Indonesia",
  jobIndustry: ["Web, UI & UX Design"],
  jobType: ["Full-Time"],
  jobGeo: "Remote — Indonesia",
  pubDate: "2026-11-19T04:20:15Z",
};

test("Jobicy listing URLs are limited to the official HTTPS listing host", () => {
  assert.equal(isJobicyListingUrl("https://jobicy.com/jobs/a-role"), true);
  assert.equal(isJobicyListingUrl("https://evil.example/jobs/a-role"), false);
  assert.equal(isJobicyListingUrl("http://jobicy.com/jobs/a-role"), false);
  assert.equal(isJobicyListingUrl("https://jobicy.com/company/a-role"), false);
});

test("Jobicy mapping only accepts explicitly Indonesia-eligible design listings", () => {
  const mapped = mapJobicyJob(indonesiaJob);
  assert.ok(mapped);
  assert.equal(mapped.countryCode, "ID");
  assert.equal(mapped.sourceUrl, indonesiaJob.url);
  assert.equal(mapped.applicationUrl, indonesiaJob.url);
  assert.equal(mapped.description, null);
  assert.deepEqual(mapped.categories, ["Product Design", "UI/UX Design"]);

  assert.equal(mapJobicyJob({ ...indonesiaJob, jobGeo: "APAC" }), null);
  assert.equal(mapJobicyJob({ ...indonesiaJob, jobGeo: "Philippines" }), null);
  assert.equal(mapJobicyJob({ ...indonesiaJob, jobTitle: "Backend Engineer" }), null);
});

test("Jobicy feed fetch applies verified filters, paginates, and deduplicates", async () => {
  const requests: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const firstPage = !url.searchParams.has("cursor");
    const job = { ...indonesiaJob };
    const payload = {
      success: true,
      jobs: firstPage ? [job] : [job, { ...job, id: 457, url: "https://jobicy.com/jobs/second" }],
      nextCursor: firstPage && url.searchParams.get("industry") === "design-multimedia" && url.searchParams.get("geo") === "apac" ? "cursor-token" : null,
    };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await fetchJobicyJobs({ fetchImpl, minimumIntervalMs: 0, delay: async () => undefined });
  assert.equal(requests.length, 5);
  assert.deepEqual(requests.slice(0, 2).map((url) => url.searchParams.get("industry")), ["design-multimedia", "design-multimedia"]);
  assert.equal(requests[1].searchParams.get("cursor"), "cursor-token");
  assert.equal(result.fetchedCount, 2);
  assert.equal(result.jobs.length, 2);
});

test("Jobicy status requests batch IDs and return explicit statuses", async () => {
  const calls: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const ids = (url.searchParams.get("ids") ?? "").split(",");
    return new Response(JSON.stringify({
      success: true,
      jobs: ids.map((id) => ({ id, status: id === "1" ? "active" : "closed" })),
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const ids = Array.from({ length: 101 }, (_, index) => String(index + 1));
  const result = await fetchJobicyStatuses(ids, { fetchImpl, minimumIntervalMs: 0, delay: async () => undefined });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get("ids")?.split(",").length, 100);
  assert.equal(calls[1].searchParams.get("ids"), "101");
  assert.equal(result.get("1"), "active");
  assert.equal(result.get("101"), "closed");
});
