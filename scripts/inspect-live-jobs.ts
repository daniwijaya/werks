import dotenv from "dotenv";
import { count, desc, eq } from "drizzle-orm";
import { getDatabase } from "../db/client.ts";
import { jobSources, jobs } from "../db/schema.ts";
import { loadPublicJobs } from "../lib/jobs/public-jobs.ts";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const { db, client } = getDatabase();
  try {
    const stored = await db.select({
      sourceName: jobSources.sourceName,
      sourceStatus: jobSources.complianceStatus,
      sourceActive: jobSources.isActive,
      jobStatus: jobs.status,
      count: count(jobs.id),
    }).from(jobs)
      .innerJoin(jobSources, eq(jobs.sourceId, jobSources.id))
      .groupBy(jobSources.sourceName, jobSources.complianceStatus, jobSources.isActive, jobs.status)
      .orderBy(desc(count(jobs.id)));
    const sources = await db.select({
      sourceName: jobSources.sourceName,
      sourceType: jobSources.sourceType,
      complianceStatus: jobSources.complianceStatus,
      isActive: jobSources.isActive,
      redistributionAllowed: jobSources.redistributionAllowed,
      attributionRequired: jobSources.attributionRequired,
    }).from(jobSources).orderBy(jobSources.sourceName);

    const live = await loadPublicJobs();
    console.log(JSON.stringify({
      storedRecordCount: stored.reduce((sum, row) => sum + Number(row.count), 0),
      storedRecordsBySourceAndStatus: stored,
      sourceRegistry: sources,
      eligibleLiveRecordCount: live.status === "success" ? live.jobs.length : null,
      eligibleLiveRecordsBySource: live.status === "success"
        ? Object.fromEntries([...new Set(live.jobs.map((job) => job.sourceName))].map((sourceName) => [sourceName, live.jobs.filter((job) => job.sourceName === sourceName).length]))
        : null,
      queryStatus: live.status,
    }, null, 2));
    if (live.status === "error") process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
