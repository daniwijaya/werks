import assert from "node:assert/strict";
import test from "node:test";
import { getJobSourcePresentation } from "../../lib/job-attribution.ts";

test("Jobicy cards show required attribution and link to the original listing", () => {
  const presentation = getJobSourcePresentation({
    sourceName: "Jobicy",
    sourceUrl: "https://jobicy.com/jobs/design-role",
    applicationUrl: "https://jobicy.com/jobs/design-role",
    attributionRequired: true,
    attributionText: "Source: Jobicy",
  });

  assert.equal(presentation.attributionText, "Source: Jobicy");
  assert.deepEqual(presentation.listingLink, {
    href: "https://jobicy.com/jobs/design-role",
    label: "View listing and apply on Jobicy",
  });
  assert.equal(presentation.applicationLink, null, "same listing/application URL is shown once");
});

test("separate employer application URLs are offered without losing the original source URL", () => {
  const presentation = getJobSourcePresentation({
    sourceName: "Example Jobs",
    sourceUrl: "https://jobs.example/listing/42",
    applicationUrl: "https://company.example/apply/42",
  });

  assert.equal(presentation.attributionText, null);
  assert.equal(presentation.listingLink.href, "https://jobs.example/listing/42");
  assert.deepEqual(presentation.applicationLink, {
    href: "https://company.example/apply/42",
    label: "Apply for this job",
  });
});

test("sources without an attribution requirement do not render an attribution notice", () => {
  const presentation = getJobSourcePresentation({
    sourceName: "Example Jobs",
    sourceUrl: "https://jobs.example/listing/42",
    attributionRequired: false,
    attributionText: "Source: Example Jobs",
  });

  assert.equal(presentation.attributionText, null);
});

test("required attribution has a clear source-name fallback when custom text is absent", () => {
  const presentation = getJobSourcePresentation({
    sourceName: "Jobicy",
    sourceUrl: "https://jobicy.com/jobs/design-role",
    attributionRequired: true,
  });

  assert.equal(presentation.attributionText, "Source: Jobicy");
});

 test("missing application URL does not imply an application link", () => {
  const result = getJobSourcePresentation({ sourceName: "Jobicy", sourceUrl: "https://jobicy.com/jobs/1" });
  assert.equal(result.applicationLink, null);
  assert.equal(result.listingLink.label, "View original listing on Jobicy");
});
