import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../../db/schema.ts";
import { jobEligibilityDecisions } from "../../db/schema.ts";

type Database = PostgresJsDatabase<typeof schema>;
export type JobEligibilityDecision = "eligible" | "manual_review" | "excluded";
export type StoredJobEligibilityDecision = {
  externalJobId: string;
  decision: JobEligibilityDecision;
  reason: string;
  locationFingerprint: string;
  reviewedAt: Date;
  reviewedBy: string;
};

export function locationFingerprint(location: string | null | undefined): string {
  const normalized = (location ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

export function resolveJobEligibilityDecision(
  current: StoredJobEligibilityDecision | undefined,
  location: string | null | undefined,
): { decision: JobEligibilityDecision | null; stale: boolean } {
  if (!current) return { decision: null, stale: false };
  const stale = current.locationFingerprint !== locationFingerprint(location);
  return { decision: stale ? "manual_review" : current.decision, stale };
}

export async function getSourceJobEligibilityDecisions(db: Database, sourceId: string) {
  return db.select({
    externalJobId: jobEligibilityDecisions.externalJobId,
    decision: jobEligibilityDecisions.decision,
    reason: jobEligibilityDecisions.reason,
    locationFingerprint: jobEligibilityDecisions.locationFingerprint,
    reviewedAt: jobEligibilityDecisions.reviewedAt,
    reviewedBy: jobEligibilityDecisions.reviewedBy,
  }).from(jobEligibilityDecisions).where(eq(jobEligibilityDecisions.sourceId, sourceId));
}

export async function upsertJobEligibilityDecision(db: Database, input: {
  sourceId: string;
  externalJobId: string;
  decision: JobEligibilityDecision;
  reason: string;
  location: string | null | undefined;
  reviewedBy: string;
  reviewedAt?: Date;
}) {
  const reviewedAt = input.reviewedAt ?? new Date();
  await db.insert(jobEligibilityDecisions).values({
    sourceId: input.sourceId,
    externalJobId: input.externalJobId,
    decision: input.decision,
    reason: input.reason,
    locationFingerprint: locationFingerprint(input.location),
    reviewedBy: input.reviewedBy,
    reviewedAt,
    updatedAt: reviewedAt,
  }).onConflictDoUpdate({
    target: [jobEligibilityDecisions.sourceId, jobEligibilityDecisions.externalJobId],
    set: {
      decision: input.decision,
      reason: input.reason,
      locationFingerprint: locationFingerprint(input.location),
      reviewedBy: input.reviewedBy,
      reviewedAt,
      updatedAt: reviewedAt,
    },
  });
}

export async function reconcileRemoteOkJobDecisions(db: Database, sourceId: string, candidates: Array<{
  externalId: string;
  location: string | null;
  geographicStatus: "eligible" | "manual_review" | "ineligible";
  reason: string;
}>, now = new Date()) {
  const existing = await getSourceJobEligibilityDecisions(db, sourceId);
  const byExternalId = new Map(existing.map((decision) => [decision.externalJobId, decision]));
  let newlyFlaggedManualReview = 0;
  let newlyExcluded = 0;
  let staleDecisions = 0;

  for (const candidate of candidates) {
    const previous = byExternalId.get(candidate.externalId);
    if (previous) {
      const resolved = resolveJobEligibilityDecision(previous, candidate.location);
      if (resolved.stale) {
        staleDecisions += 1;
        await upsertJobEligibilityDecision(db, {
          sourceId,
          externalJobId: candidate.externalId,
          decision: "manual_review",
          reason: "Geographic information changed since the previous decision; reassessment is required.",
          location: candidate.location,
          reviewedBy: "WERKS automated geographic reassessment",
          reviewedAt: now,
        });
      }
      continue;
    }
    if (candidate.geographicStatus === "manual_review") {
      await upsertJobEligibilityDecision(db, {
        sourceId, externalJobId: candidate.externalId, decision: "manual_review",
        reason: candidate.reason, location: candidate.location,
        reviewedBy: "WERKS automated geographic assessment", reviewedAt: now,
      });
      newlyFlaggedManualReview += 1;
    } else if (candidate.geographicStatus === "ineligible") {
      await upsertJobEligibilityDecision(db, {
        sourceId, externalJobId: candidate.externalId, decision: "excluded",
        reason: candidate.reason, location: candidate.location,
        reviewedBy: "WERKS automated geographic assessment", reviewedAt: now,
      });
      newlyExcluded += 1;
    }
  }

  const decisions = await getSourceJobEligibilityDecisions(db, sourceId);
  const decisionById = new Map(decisions.map((decision) => [decision.externalJobId, decision]));
  const eligibleExternalIds = new Set<string>();
  const suppressedExternalIds = new Set<string>();
  for (const candidate of candidates) {
    const decision = decisionById.get(candidate.externalId);
    const resolved = resolveJobEligibilityDecision(decision, candidate.location);
    if (resolved.decision === "eligible") eligibleExternalIds.add(candidate.externalId);
    else if (resolved.decision === "manual_review" || resolved.decision === "excluded") suppressedExternalIds.add(candidate.externalId);
    else if (candidate.geographicStatus === "eligible") eligibleExternalIds.add(candidate.externalId);
  }
  return { eligibleExternalIds, suppressedExternalIds, newlyFlaggedManualReview, newlyExcluded, staleDecisions };
}

export async function getJobEligibilityDecision(db: Database, sourceId: string, externalJobId: string) {
  const [decision] = await db.select().from(jobEligibilityDecisions).where(and(
    eq(jobEligibilityDecisions.sourceId, sourceId),
    eq(jobEligibilityDecisions.externalJobId, externalJobId),
  )).limit(1);
  return decision ?? null;
}
