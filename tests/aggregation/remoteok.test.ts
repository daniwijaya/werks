import assert from "node:assert/strict";
import test from "node:test";
import { assessRemoteOkGeography, fetchRemoteOkJobs, mapRemoteOkListing, remoteOkRejectionReasons, type RemoteOkListing } from "../../lib/aggregation/remoteok.ts";
import { sourceSeed } from "../../lib/aggregation/source-seed.ts";
import { getJobSourcePresentation } from "../../lib/job-attribution.ts";

const jakartaDesigner: RemoteOkListing = {
  id: 98123,
  url: "https://remoteok.com/remote-jobs/98123-product-designer",
  apply_url: "https://jobs.example.com/apply/98123",
  position: "Senior Product Designer",
  company: "Example Co",
  location: "Remote — Jakarta, Indonesia",
  tags: ["design", "remote"],
  date: "2026-11-22T10:00:00Z",
};

test("Remote OK maps only permitted listing fields and retains source/apply URLs", () => {
  const mapped = mapRemoteOkListing(jakartaDesigner);
  assert.ok(mapped);
  assert.equal(mapped.externalId, "98123");
  assert.equal(mapped.sourceUrl, jakartaDesigner.url);
  assert.equal(mapped.applicationUrl, jakartaDesigner.apply_url);
  assert.equal(mapped.countryCode, "ID");
  assert.equal(mapped.workArrangement, "remote");
  assert.equal(mapped.description, null);
  assert.equal(mapped.salaryMinimum, null);
  assert.deepEqual(mapped.categories, ["Product Design"]);
});

test("Remote OK accepts explicit Indonesia and unrestricted worldwide eligibility while preserving the label", () => {
  const worldwide = { ...jakartaDesigner, id: 98124, location: "Worldwide" };
  const mappedWorldwide = mapRemoteOkListing(worldwide);
  assert.ok(mappedWorldwide);
  assert.equal(mappedWorldwide.locationText, "Worldwide");
  assert.equal(mappedWorldwide.countryCode, null);
  assert.deepEqual(remoteOkRejectionReasons(worldwide), []);
  assert.deepEqual(remoteOkRejectionReasons({ ...worldwide, location: "Anywhere" }), []);
});

test("Remote OK rejects explicit Indonesia exclusions and sends geographic conflicts to manual review", () => {
  assert.deepEqual(remoteOkRejectionReasons({ ...jakartaDesigner, location: "Worldwide except Indonesia" }), ["outside_indonesia_eligibility"]);
  assert.deepEqual(remoteOkRejectionReasons({ ...jakartaDesigner, location: "Worldwide, US only" }), ["outside_indonesia_eligibility"]);
  assert.deepEqual(remoteOkRejectionReasons({ ...jakartaDesigner, location: "Jakarta, Indonesia; US-only employment" }), ["ambiguous_geography"]);
  assert.deepEqual(remoteOkRejectionReasons({ ...jakartaDesigner, location: "Worldwide, APAC only" }), ["ambiguous_geography"]);
});

test("Remote OK infers Southeast Asia eligibility, but APAC and generic remote need review", () => {
  const sea = mapRemoteOkListing({ ...jakartaDesigner, id: 98129, location: "Remote — Southeast Asia" });
  assert.ok(sea);
  assert.equal(sea.locationText, "Remote — Southeast Asia");
  assert.equal(sea.countryCode, null);
  assert.deepEqual(remoteOkRejectionReasons({ ...jakartaDesigner, location: "Remote" }), ["ambiguous_geography"]);
  assert.deepEqual(remoteOkRejectionReasons({ ...jakartaDesigner, location: "APAC" }), ["ambiguous_geography"]);
  assert.deepEqual(remoteOkRejectionReasons({ ...jakartaDesigner, location: null }), ["ambiguous_geography"]);
  assert.deepEqual(remoteOkRejectionReasons({ ...jakartaDesigner, location: "Singapore only" }), ["outside_indonesia_eligibility"]);
  assert.deepEqual(remoteOkRejectionReasons({ ...jakartaDesigner, location: "Europe" }), ["outside_indonesia_eligibility"]);
  assert.deepEqual(remoteOkRejectionReasons({ ...jakartaDesigner, location: "Southeast Asia — Singapore and Malaysia only" }), ["outside_indonesia_eligibility"]);
  assert.equal(assessRemoteOkGeography("Indonesia").basis, "explicit_indonesia");
  assert.equal(assessRemoteOkGeography("Worldwide").basis, "inferred_worldwide");
  assert.equal(assessRemoteOkGeography("Southeast Asia").basis, "inferred_southeast_asia");
});

test("Remote OK rejects non-design roles, malformed source URLs, and missing identity", () => {
  assert.ok(remoteOkRejectionReasons({ ...jakartaDesigner, position: "Software Engineer" }).includes("title_not_design_role"));
  assert.ok(remoteOkRejectionReasons({ ...jakartaDesigner, url: "https://evil.example/job/98123" }).includes("invalid_original_url"));
  assert.ok(remoteOkRejectionReasons({ ...jakartaDesigner, id: undefined, company: "" }).includes("missing_identity"));
});

test("Remote OK preserves permitted mailto application links and excludes unapproved fields", () => {
  const mapped = mapRemoteOkListing({ ...jakartaDesigner, apply_url: "mailto:jobs@example.com" });
  assert.equal(mapped?.applicationUrl, "mailto:jobs@example.com");
  assert.equal(mapRemoteOkListing({ ...jakartaDesigner, id: 98128, location: "Jakarta, Indonesia", tags: ["remote"] })?.workArrangement, null);
  const source = sourceSeed.find((candidate) => candidate.sourceType === "remoteok");
  assert.ok(source);
  assert.equal((source.allowedFields ?? []).includes("description"), false);
  assert.equal((source.allowedFields ?? []).includes("companyLogoUrl"), false);
});

test("Remote OK feed preview ignores metadata, deduplicates, and reports rejection reasons", async () => {
  const response = [
    { legal: "credit Remote OK" },
    jakartaDesigner,
    { ...jakartaDesigner, position: "Changed duplicate title" },
    { ...jakartaDesigner, id: 98127, url: "https://remoteok.com/remote-jobs/98127-product-design", position: "Product Designer", location: "Worldwide" },
    { ...jakartaDesigner, id: 98130, url: "https://remoteok.com/remote-jobs/98130-product-design", position: "Product Designer", location: "Remote — Southeast Asia" },
    { ...jakartaDesigner, id: 98125, url: "https://remoteok.com/remote-jobs/98125-ux", position: "UX Designer", location: "Remote" },
    { ...jakartaDesigner, id: 98131, url: "https://remoteok.com/remote-jobs/98131-ux", position: "UX Designer", location: "Worldwide, APAC only" },
    { ...jakartaDesigner, id: 98126, url: "https://remoteok.com/remote-jobs/98126-engineer", position: "Backend Engineer", location: "United States" },
  ];
  const result = await fetchRemoteOkJobs({
    fetchImpl: async (input) => {
      assert.equal(String(input), "https://remoteok.com/api");
      return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(result.fetchedCount, 7);
  assert.equal(result.designRelatedCount, 5);
  assert.equal(result.indonesiaEligibleCount, 1);
  assert.equal(result.inferredWorldwideEligibleCount, 1);
  assert.equal(result.inferredSoutheastAsiaEligibleCount, 1);
  assert.equal(result.eligibleGeographyCount, 3);
  assert.equal(result.worldwideManualReviewCount, 1);
  assert.equal(result.manualReviewCount, 2);
  assert.equal(result.acceptedCount, 3);
  assert.equal(result.rejectedCount, 3);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.ambiguousGeographyCount, 2);
  assert.equal(result.originalUrlValidCount, 6);
  assert.equal(result.originalUrlInvalidCount, 0);
  assert.equal(result.applicationUrlPresentCount, 6);
  assert.equal(result.applicationUrlValidCount, 6);
  assert.equal(result.applicationUrlInvalidCount, 0);
  assert.deepEqual(result.rejectionReasons, {
    ambiguous_geography: 2,
    title_not_design_role: 1,
    outside_indonesia_eligibility: 1,
  });
});

test("Remote OK retry honors at least one second between requests", async () => {
  let requests = 0;
  const waits: number[] = [];
  let now = 0;
  const result = await fetchRemoteOkJobs({
    now: () => now,
    delay: async (milliseconds) => { waits.push(milliseconds); now += milliseconds; },
    fetchImpl: async () => {
      requests += 1;
      return requests === 1
        ? new Response("busy", { status: 503 })
        : new Response(JSON.stringify([{ legal: "credit" }, jakartaDesigner]), { status: 200 });
    },
  });
  assert.equal(requests, 2);
  assert.ok(waits.some((milliseconds) => milliseconds >= 1_000));
  assert.equal(result.acceptedCount, 1);
});

test("Remote OK source assessment is approved but inactive and renders required attribution", () => {
  const source = sourceSeed.find((candidate) => candidate.sourceType === "remoteok");
  assert.ok(source);
  assert.equal(source.complianceStatus, "approved");
  assert.equal(source.isActive, false);
  assert.equal(source.attributionRequired, true);
  assert.ok(source.allowedFields?.includes("designDisciplines"));
  const presentation = getJobSourcePresentation({
    sourceName: source.sourceName,
    sourceUrl: jakartaDesigner.url!,
    applicationUrl: jakartaDesigner.apply_url,
    attributionRequired: source.attributionRequired,
    attributionText: source.attributionText,
  });
  assert.equal(presentation.attributionText, "Source: Remote OK");
  assert.equal(presentation.listingLink.href, jakartaDesigner.url);
  assert.equal(presentation.applicationLink?.href, jakartaDesigner.apply_url);
});
