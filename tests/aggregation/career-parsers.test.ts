import assert from "node:assert/strict";
import test from "node:test";
import { findDuplicateCandidate, shouldCloseAfterMissing } from "../../lib/aggregation/deduplicate.ts";
import { parseJsonLdJobs } from "../../lib/aggregation/jsonld.ts";
import { classifyDesignRole, normalizeJobUrl } from "../../lib/aggregation/normalize.ts";
import { parseRobotsTxt, isAllowedByRobots } from "../../lib/aggregation/robots.ts";
import { parseRssAtomJobs } from "../../lib/aggregation/rss.ts";
import { isAllowedCompanyUrl, parseSitemapXml } from "../../lib/aggregation/sitemap.ts";

test("RSS and Atom feeds normalize eligible Indonesia design jobs", () => {
  const rss = `<?xml version="1.0"?><rss><channel><item><title>Product Designer</title><link>https://careers.example.id/jobs/42?utm_source=rss</link><description><![CDATA[Design product flows]]></description><location>Jakarta, Indonesia</location><guid>job-42</guid></item></channel></rss>`;
  const result = parseRssAtomJobs(rss, { companyName: "Example PT", sourceUrl: "https://careers.example.id/feed.xml" });
  assert.equal(result.fetchedCount, 1);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0]?.canonicalUrl, "https://careers.example.id/jobs/42");
  assert.equal(result.jobs[0]?.countryCode, "ID");

  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>role-2</id><title>UX Researcher</title><link rel="alternate" href="https://careers.example.id/role/2"/><summary>Research workflows</summary><category term="Remote — Indonesia"/><updated>2026-11-01T00:00:00Z</updated></entry></feed>`;
  assert.equal(parseRssAtomJobs(atom, { companyName: "Example", sourceUrl: "https://careers.example.id/feed" }).jobs.length, 1);
});

test("JSON-LD handles graph postings, multiple locations, and rejects foreign apply URLs", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ "@graph": [
    { "@type": "JobPosting", title: "Senior Product Designer", url: "https://careers.example.id/jobs/pd", jobLocation: [
      { address: { addressLocality: "Jakarta", addressCountry: "Indonesia" } },
      { address: { addressLocality: "Singapore", addressCountry: "Singapore" } },
    ], hiringOrganization: { name: "Example" }, description: "Design product experiences." },
    { "@type": "JobPosting", title: "UX Designer", url: "https://other.example/jobs/ux", jobLocation: { address: { addressLocality: "Jakarta", addressCountry: "Indonesia" } } },
  ] })}</script>`;
  const result = parseJsonLdJobs(html, { companyName: "Example", sourceUrl: "https://careers.example.id/jobs", allowedDomains: ["example.id"] });
  assert.equal(result.fetchedCount, 2);
  assert.equal(result.jobs.length, 1);
  assert.match(result.jobs[0]?.locationText ?? "", /Jakarta/);
  assert.match(result.jobs[0]?.locationText ?? "", /Singapore/);
});

test("sitemap and robots rules respect allowed domains and paths", () => {
  const parsed = parseSitemapXml(`<sitemapindex><sitemap><loc>https://careers.example.id/jobs.xml</loc></sitemap></sitemapindex>`);
  assert.deepEqual(parsed.sitemapUrls, ["https://careers.example.id/jobs.xml"]);
  const robots = parseRobotsTxt("User-agent: *\nDisallow: /private\nAllow: /private/jobs\nSitemap: https://careers.example.id/sitemap.xml");
  assert.equal(isAllowedByRobots("https://careers.example.id/private/profile", robots), false);
  assert.equal(isAllowedByRobots("https://careers.example.id/private/jobs/1", robots), true);
  assert.equal(isAllowedCompanyUrl("https://sub.example.id/jobs/1", ["example.id"]), true);
  assert.equal(isAllowedCompanyUrl("https://example.id.evil.invalid/jobs/1", ["example.id"]), false);
  assert.equal(isAllowedCompanyUrl("http://example.id/jobs/1", ["example.id"]), false);
});

test("duplicate matching follows confidence order and missing closure requires a complete snapshot", () => {
  const weak = { sourceId: "b", externalId: "different", canonicalUrl: null, sourceUrl: "https://b.test/job", normalizedCompanyName: "acme", normalizedTitle: "designer", locationText: "Jakarta" };
  const exact = { ...weak, sourceId: "c", canonicalUrl: "https://a.test/job" };
  const candidate = findDuplicateCandidate({ sourceId: "a", externalId: "x", canonicalUrl: "https://a.test/job?utm_campaign=x", sourceUrl: "https://a.test/job", normalizedCompanyName: "acme", normalizedTitle: "designer", locationText: "Jakarta" }, [weak, exact], "a");
  assert.equal(candidate, exact);
  assert.equal(shouldCloseAfterMissing(false, 99), false);
  assert.equal(shouldCloseAfterMissing(true, 2), false);
  assert.equal(shouldCloseAfterMissing(true, 3), true);
});

test("URL normalization strips trackers and role classification filters non-design engineering roles", () => {
  assert.equal(normalizeJobUrl("https://EXAMPLE.id/jobs/1/?utm_campaign=x#apply"), "https://example.id/jobs/1");
  assert.deepEqual(classifyDesignRole("Software Engineer, Design Systems", "").categories, []);
  assert.ok(classifyDesignRole("Art Director", "Set visual direction").categories.includes("Art Direction"));
});
