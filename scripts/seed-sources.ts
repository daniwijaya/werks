import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { getDatabase } from "../db/client.ts";
import { jobSources } from "../db/schema.ts";
import { sourceSeed } from "../lib/aggregation/source-seed.ts";
import { sourceSeedConflictMode } from "../lib/aggregation/source-seed-plan.ts";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const { db, client } = getDatabase();
  try {
    for (const source of sourceSeed) {
      const insert = db.insert(jobSources).values(source);
      if (sourceSeedConflictMode(source.sourceType) === "insert_only") {
        // Existing source rows are intentionally insert-only. Seeding may add
        // missing candidates, but it must never overwrite their review or
        // activation decisions.
        await insert.onConflictDoNothing({ target: [jobSources.sourceType, jobSources.boardIdentifier] });
        continue;
      }

      // Refresh only the source this phase is registering. The seed definition
      // keeps Remote OK approved but inactive; no other source is touched.
      await insert.onConflictDoUpdate({
        target: [jobSources.sourceType, jobSources.boardIdentifier],
        set: {
          sourceName: source.sourceName,
          companyName: source.companyName,
          careersUrl: source.careersUrl,
          endpointUrl: source.endpointUrl,
          companyDomain: source.companyDomain,
          atsProvider: source.atsProvider,
          aggregationMethod: source.aggregationMethod,
          allowedDomains: source.allowedDomains,
          requestLimitPerRun: source.requestLimitPerRun,
          minRequestIntervalSeconds: source.minRequestIntervalSeconds,
          isActive: false,
          complianceStatus: source.complianceStatus,
          endpointVerifiedAt: source.endpointVerifiedAt,
          termsUrl: source.termsUrl,
          evidenceUrl: source.evidenceUrl,
          reviewNotes: source.reviewNotes,
          complianceEvidenceUrls: source.complianceEvidenceUrls,
          reviewedAt: source.reviewedAt,
          reviewedBy: source.reviewedBy,
          redistributionAllowed: source.redistributionAllowed,
          attributionRequired: source.attributionRequired,
          allowedFields: source.allowedFields,
          usageRestrictions: source.usageRestrictions,
          attributionText: source.attributionText,
          pollingIntervalHours: source.pollingIntervalHours,
          updatedAt: new Date(),
        },
      });
    }
    const rows = await db.select({ sourceName: jobSources.sourceName, isActive: jobSources.isActive }).from(jobSources).where(eq(jobSources.complianceStatus, "review_required"));
    console.log(`Ensured ${sourceSeed.length} source candidates. Existing non-Remote OK assessments and activation statuses were left unchanged.`);
    console.log(`Current review queue: ${rows.map(({ sourceName }) => sourceName).join(", ")}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
