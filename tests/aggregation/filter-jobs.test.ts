import assert from "node:assert/strict";
import test from "node:test";
import { filterJobs, matchesDiscipline } from "../../lib/filter-jobs.ts";
import type { Job } from "../../types/job.ts";

const jobs: Job[] = [
  {
    id: "job-product", title: "Product Designer", companyName: "Studio A", location: "Jakarta, Indonesia",
    workMode: "Hybrid", employmentType: "Full-time", designDisciplines: ["Product Design"],
    sourceName: "Jobicy", sourceUrl: "https://jobicy.com/jobs/1", status: "active",
  },
  {
    id: "job-research", title: "UX Researcher", companyName: "Studio B", location: "Remote — Indonesia",
    workMode: "Remote", employmentType: "Contract", designDisciplines: ["UX Research"],
    sourceName: "Jobicy", sourceUrl: "https://jobicy.com/jobs/2", status: "active",
  },
];

test("search, location, discipline, work mode, and employment type filters operate on live-job DTOs", () => {
  assert.deepEqual(filterJobs(jobs, { q: "Studio A" }).map((job) => job.id), ["job-product"]);
  assert.deepEqual(filterJobs(jobs, { location: "Jakarta" }).map((job) => job.id), ["job-product"]);
  assert.deepEqual(filterJobs(jobs, { discipline: "UX Research" }).map((job) => job.id), ["job-research"]);
  assert.deepEqual(filterJobs(jobs, { mode: "Remote" }).map((job) => job.id), ["job-research"]);
  assert.deepEqual(filterJobs(jobs, { type: "Contract" }).map((job) => job.id), ["job-research"]);
  assert.deepEqual(filterJobs(jobs, { q: "designer", mode: "Hybrid", type: "Full-time" }).map((job) => job.id), ["job-product"]);
});

 test("source employment type capitalization and separators do not break filtering", () => {
  assert.equal(filterJobs([{ ...jobs[0], employmentType: "Full-Time" }], { type: "Full-time" }).length, 1);
  assert.equal(filterJobs([{ ...jobs[0], employmentType: "full_time" }], { type: "Full-time" }).length, 1);
  assert.equal(filterJobs([{ ...jobs[0], employmentType: undefined }], { type: "Full-time" }).length, 0);
});

test("Others includes design disciplines outside the visible category choices", () => {
  const visual = { ...jobs[0], designDisciplines: ["Visual Design"] };
  assert.equal(matchesDiscipline(visual, "Others"), true);
  assert.equal(matchesDiscipline(jobs[0], "Others"), false);
  assert.deepEqual(filterJobs([visual, jobs[1]], { discipline: "Others" }), [visual]);
});
