import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { indonesiaDesignJobFixture as fixture } from "../fixtures/indonesia-design-job.ts";
import { filterJobs, matchesDiscipline } from "../../lib/filter-jobs.ts";
import { getJobSourcePresentation } from "../../lib/job-attribution.ts";
import { jobListingEmptyCopy } from "../../lib/job-listing-copy.ts";
import type { Job } from "../../types/job.ts";

const nativeRequire = createRequire(import.meta.url);

function loadTsx<T>(relativePath: string, mocks: Record<string, unknown> = {}): T {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", output)((name: string) => {
    if (name in mocks) return mocks[name];
    return nativeRequire(name);
  }, exports);
  return exports as T;
}

const Link = ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
  createElement("a", { href, ...props }, children);
const Image = ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt });
const Icon = () => null;
const iconStubs = { ArrowUpRight: Icon, MapPin: Icon, Search: Icon, LayoutGrid: Icon, BriefcaseBusiness: Icon, Clock3: Icon, ChevronDown: Icon };
const JobCard = loadTsx<{ JobCard: (props: { job: Job }) => React.ReactNode }>("../../components/job-card.tsx", {
  "@/components/save-job-button": { SaveJobButton: () => null },
  "@/lib/job-attribution": { getJobSourcePresentation },
}).JobCard;

const sharedMocks = {
  "next/link": { default: Link },
  "next/image": { default: Image },
  "lucide-react": iconStubs,
  "@/components/job-card": { JobCard },
  "@/lib/job-attribution": { getJobSourcePresentation },
  "@/lib/job-listing-copy": { jobListingEmptyCopy },
  "@/lib/filter-jobs": { filterJobs, matchesDiscipline },
  "@/data/indonesia-cities": { indonesiaCities: ["Jakarta"] },
  "@/components/dropdown-select": { DropdownSelect: () => createElement("select") },
};

const { HomeJobFeed } = loadTsx<{ HomeJobFeed: (props: { jobs: Job[] }) => React.ReactNode }>(
  "../../components/home-job-feed.tsx", sharedMocks,
);
const { SavedJobFeed } = loadTsx<{ SavedJobFeed: (props: { jobs: Job[] }) => React.ReactNode }>(
  "../../components/saved-job-feed.tsx", {
    ...sharedMocks,
    "@/components/save-job-button": { useSavedJobs: () => ({ saved: [fixture.id] }) },
  },
);

test("homepage renders the clearly labelled fixture and source attribution", () => {
  const html = renderToStaticMarkup(createElement(HomeJobFeed, { jobs: [fixture] }));
  assert.match(html, /Product Designer \(Fixture\)/);
  assert.match(html, /Jobicy fixture \(TEST DATA\)/);
  assert.match(html, /Test fixture only — no real vacancy/);
  assert.ok(html.includes('href="https://example.test/jobs/fixture-product-designer"'));
  assert.ok(html.includes('href="https://example.test/jobs/fixture-product-designer/apply"'));
});

test("saved jobs renders only the locally saved fixture", () => {
  const html = renderToStaticMarkup(createElement(SavedJobFeed, { jobs: [fixture] }));
  assert.match(html, /Product Designer \(Fixture\)/);
  assert.match(html, /Test fixture only — no real vacancy/);
});

test("search page renders matching fixture jobs, respects filters, and shows empty state", async () => {
  const { default: JobsPage } = loadTsx<{ default: (props: { searchParams: Promise<Record<string, string>> }) => Promise<React.ReactNode> }>(
    "../../app/jobs/page.tsx", {
      ...sharedMocks,
      "@/lib/jobs/public-jobs": { loadPublicJobs: async () => ({ status: "success", jobs: [fixture] }) },
    },
  );

  const match = await JobsPage({ searchParams: Promise.resolve({ q: "Product Designer", location: "Jakarta", discipline: "Product Design", mode: "Hybrid", type: "Full-time" }) });
  const matchedHtml = renderToStaticMarkup(match as React.ReactElement);
  assert.match(matchedHtml, /Product Designer \(Fixture\)/);
  assert.match(matchedHtml, /<strong>1<\/strong> opportunity/);
  assert.match(matchedHtml, /Test fixture only — no real vacancy/);

  const noMatch = await JobsPage({ searchParams: Promise.resolve({ q: "Nonexistent role" }) });
  const emptyHtml = renderToStaticMarkup(noMatch as React.ReactElement);
  assert.match(emptyHtml, /<strong>0<\/strong> opportunities/);
  assert.match(emptyHtml, /No jobs found\./);
  assert.ok(!emptyHtml.includes("Product Designer (Fixture)"));
});
