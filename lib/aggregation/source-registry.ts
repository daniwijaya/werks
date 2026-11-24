import { eq } from "drizzle-orm";
import { getDatabase } from "../../db/client.ts";
import { jobSources } from "../../db/schema.ts";
import type { JobSource } from "../../db/schema.ts";

export type SourceComplianceAssessment = Pick<JobSource,
  | "complianceStatus"
  | "evidenceUrl"
  | "reviewNotes"
  | "complianceEvidenceUrls"
  | "reviewedAt"
  | "reviewedBy"
  | "redistributionAllowed"
  | "attributionRequired"
  | "attributionText"
  | "allowedFields"
  | "usageRestrictions"
>;

export function sourceAssessmentPatch(assessment: SourceComplianceAssessment) {
  return { ...assessment, isActive: false, updatedAt: new Date() };
}

export async function reassessSources(
  sources: Array<{ sourceId: string; assessment: SourceComplianceAssessment }>,
): Promise<void> {
  const { db, client } = getDatabase();
  try {
    await db.transaction(async (tx) => {
      for (const { sourceId, assessment } of sources) {
        const [updated] = await tx.update(jobSources)
          .set(sourceAssessmentPatch(assessment))
          .where(eq(jobSources.id, sourceId))
          .returning({ id: jobSources.id });
        if (!updated) throw new Error(`Source ${sourceId} was not found in the Source Registry.`);
      }
    });
  } finally {
    await client.end();
  }
}

export async function reassessSource(sourceId: string, assessment: SourceComplianceAssessment): Promise<void> {
  return reassessSources([{ sourceId, assessment }]);
}
