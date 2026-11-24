import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { getJobSourcePresentation } from "../../lib/job-attribution.ts";
import type { Job } from "../../types/job.ts";

// Compile the actual TSX card for the Node test runner; isolate only the save-button hook.
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("../../components/job-card.tsx", import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports: { JobCard?: (props: { job: Job }) => React.ReactNode } = {};
new Function("require", "exports", compiled)((name: string) => {
  if (name === "@/components/save-job-button") return { SaveJobButton: () => null };
  if (name === "@/lib/job-attribution") return { getJobSourcePresentation };
  return require(name);
}, moduleExports);
const JobCard = moduleExports.JobCard!;
const job: Job = {
  id: "fixture-only", title: "Product Designer", companyName: "Test Company", location: "",
  designDisciplines: [], sourceName: "Jobicy", sourceUrl: "https://jobicy.com/jobs/fixture",
  status: "active", attributionRequired: true, attributionText: "Source: Jobicy",
};

test("actual job card renders required attribution and original and application links", () => {
  const html = renderToStaticMarkup(createElement(JobCard, { job: { ...job, applicationUrl: "https://example.com/apply" } }));
  assert.match(html, /class="job-attribution">Source: Jobicy/);
  assert.ok(html.includes('href="https://jobicy.com/jobs/fixture"'));
  assert.ok(html.includes('href="https://example.com/apply"'));
  assert.ok(html.includes("Apply for this job"));
});

test("actual job card renders Remote OK credit with the original Remote OK listing and apply URL", () => {
  const remoteOkJob = {
    ...job,
    sourceName: "Remote OK public jobs API",
    sourceUrl: "https://remoteok.com/remote-jobs/98123-product-designer",
    applicationUrl: "https://jobs.example.com/apply/98123",
    attributionText: "Source: Remote OK",
  };
  const html = renderToStaticMarkup(createElement(JobCard, { job: remoteOkJob }));
  assert.match(html, /class="job-attribution">Source: Remote OK/);
  assert.ok(html.includes('href="https://remoteok.com/remote-jobs/98123-product-designer"'));
  assert.ok(html.includes('href="https://jobs.example.com/apply/98123"'));
  assert.match(html, /href="https:\/\/remoteok\.com\/remote-jobs\/98123-product-designer" target="_blank" rel="noopener noreferrer"/);
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("remoteok.com/logo"));
});

test("actual card omits optional attribution and missing application information", () => {
  const html = renderToStaticMarkup(createElement(JobCard, { job: { ...job, attributionRequired: false } }));
  assert.ok(!html.includes('class="job-attribution"'));
  assert.ok(!html.includes("source-application-cta"));
  assert.ok(html.includes("View original listing on Jobicy"));
});
