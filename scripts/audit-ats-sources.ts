import dotenv from "dotenv";
import { getDatabase } from "../db/client.ts";
import { jobSources } from "../db/schema.ts";
import { reassessSources } from "../lib/aggregation/source-registry.ts";
import { sourceSeed } from "../lib/aggregation/source-seed.ts";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const auditedSources = sourceSeed.filter((source) => source.sourceType === "greenhouse" || source.sourceType === "lever" || source.sourceType === "ashby");
  const { db, client } = getDatabase();
  let registered: Array<{ id: string; sourceType: string; boardIdentifier: string | null }>;
  try {
    registered = await db.select({
      id: jobSources.id,
      sourceType: jobSources.sourceType,
      boardIdentifier: jobSources.boardIdentifier,
    }).from(jobSources);
  } catch (error) {
    await client.end();
    throw error;
  }

  const updates = auditedSources.map((source) => {
    const existing = registered.find((row) => row.sourceType === source.sourceType && row.boardIdentifier === source.boardIdentifier);
    if (!existing) throw new Error(`Missing Source Registry record for ${source.sourceName} (${source.sourceType}/${source.boardIdentifier}).`);
    return {
      sourceId: existing.id,
      assessment: {
        complianceStatus: "review_required" as const,
        evidenceUrl: source.evidenceUrl ?? null,
        reviewNotes: source.reviewNotes ?? null,
        complianceEvidenceUrls: source.complianceEvidenceUrls ?? [],
        reviewedAt: source.reviewedAt ?? null,
        reviewedBy: source.reviewedBy ?? null,
        redistributionAllowed: source.redistributionAllowed ?? null,
        attributionRequired: source.attributionRequired ?? null,
        attributionText: source.attributionText ?? null,
        allowedFields: [],
        usageRestrictions: source.usageRestrictions ?? [],
      },
    };
  });

  await reassessSources(updates);
  console.log(`Reassessed ${updates.length} ATS sources. All remain review_required and inactive; no source was activated.`);
  for (const source of auditedSources) console.log(`${source.sourceName}: review_required, inactive`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
