import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { getDatabase } from "../db/client.ts";
import { jobEligibilityDecisions, jobSources, jobs, type JobSource } from "../db/schema.ts";
import { assessRemoteOkGeography, fetchRemoteOkJobs } from "../lib/aggregation/remoteok.ts";
import { findDuplicateCandidate } from "../lib/aggregation/deduplicate.ts";
import { sourceSeed } from "../lib/aggregation/source-seed.ts";
import { preparedRemoteOkReviewDecisions } from "../lib/aggregation/remoteok-review-decisions.ts";
import { resolveJobEligibilityDecision, type StoredJobEligibilityDecision } from "../lib/aggregation/job-eligibility.ts";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const source = sourceSeed.find((candidate) => candidate.sourceType === "remoteok");
  if (!source || source.complianceStatus !== "approved" || source.redistributionAllowed !== true
    || source.attributionRequired !== true || !source.evidenceUrl || !source.reviewNotes || !source.reviewedAt
    || !source.reviewedBy || !source.attributionText || !["title", "companyName", "sourceUrl"].every((field) => (source.allowedFields ?? []).includes(field))) {
    throw new Error("Remote OK preview stopped: reviewed Source Registry assessment is missing or incomplete.");
  }

  const { db, client } = getDatabase();
  let registeredSources: JobSource[] = [];
  let existingJobs: Array<{
    id: string; sourceId: string; externalId: string; canonicalUrl: string | null; sourceUrl: string;
    normalizedCompanyName: string; normalizedTitle: string; locationText: string | null;
  }> = [];
  let storedDecisions: StoredJobEligibilityDecision[] = [];
  let databaseState: "available" | "unavailable" = "unavailable";
  let decisionsTableState: "available" | "migration_pending_or_unavailable" = "migration_pending_or_unavailable";
  try {
    try {
      [registeredSources, existingJobs] = await Promise.all([
        db.select().from(jobSources),
        db.select({ id: jobs.id, sourceId: jobs.sourceId, externalId: jobs.externalId, canonicalUrl: jobs.canonicalUrl,
          sourceUrl: jobs.sourceUrl, normalizedCompanyName: jobs.normalizedCompanyName, normalizedTitle: jobs.normalizedTitle,
          locationText: jobs.locationText }).from(jobs).limit(20_000),
      ]);
      databaseState = "available";
    } catch {
      // Feed dry-runs remain useful and read-only when Neon is unreachable.
    }
    const remoteSource = registeredSources.find((row) => row.sourceType === "remoteok" && row.boardIdentifier === "public-api");
    const assessment = remoteSource ?? source;
    if (assessment.complianceStatus !== "approved" || assessment.redistributionAllowed !== true
      || assessment.attributionRequired !== true || !assessment.evidenceUrl || !assessment.reviewNotes
      || !assessment.reviewedAt || !assessment.reviewedBy || !assessment.attributionText
      || !["title", "companyName", "sourceUrl"].every((field) => (assessment.allowedFields ?? []).includes(field))) {
      throw new Error("Remote OK preview stopped: the registered Source Registry assessment is not approved for this scope.");
    }

    const batch = await fetchRemoteOkJobs({
      requestLimitPerRun: source.requestLimitPerRun,
      minRequestIntervalSeconds: source.minRequestIntervalSeconds,
    });

    if (databaseState === "available" && remoteSource) {
      try {
        storedDecisions = await db.select({
          externalJobId: jobEligibilityDecisions.externalJobId,
          decision: jobEligibilityDecisions.decision,
          reason: jobEligibilityDecisions.reason,
          locationFingerprint: jobEligibilityDecisions.locationFingerprint,
          reviewedAt: jobEligibilityDecisions.reviewedAt,
          reviewedBy: jobEligibilityDecisions.reviewedBy,
        }).from(jobEligibilityDecisions).where(eq(jobEligibilityDecisions.sourceId, remoteSource.id));
        decisionsTableState = "available";
      } catch {
        // Phase 9 migration is intentionally prepared but not applied without approval.
      }
    }

    const decisionsById = new Map(storedDecisions.map((decision) => [decision.externalJobId, decision]));
    const carrotDecisionWasStored = decisionsById.has("1137927");
    for (const prepared of preparedRemoteOkReviewDecisions) {
      if (!decisionsById.has(prepared.externalJobId)) {
        decisionsById.set(prepared.externalJobId, {
          ...prepared,
          reviewedAt: new Date("2026-11-24T00:00:00.000Z"),
        });
      }
    }
    let manualReviewJobCount = 0;
    let excludedJobCount = 0;
    let decisionSuppressedCount = 0;
    const eligibleExternalIds = new Set<string>();
    const feedCandidates = new Map(batch.jobEligibilityCandidates.map((candidate) => [candidate.externalId, candidate]));
    for (const candidate of batch.jobEligibilityCandidates) {
      const existingDecision = decisionsById.get(candidate.externalId);
      const resolved = resolveJobEligibilityDecision(existingDecision, candidate.location);
      if (resolved.decision === "manual_review" || candidate.geographicStatus === "manual_review") {
        manualReviewJobCount += 1;
      } else if (resolved.decision === "excluded" || candidate.geographicStatus === "ineligible") {
        excludedJobCount += 1;
      } else if (resolved.decision === "eligible" || candidate.geographicStatus === "eligible") {
        eligibleExternalIds.add(candidate.externalId);
      }
    }

    const manualReviewListings = [...batch.manualReviewListings];
    for (const prepared of preparedRemoteOkReviewDecisions) {
      if (manualReviewListings.some((listing) => "externalId" in listing && listing.externalId === prepared.externalJobId)) continue;
      const candidate = feedCandidates.get(prepared.externalJobId);
      if (candidate) {
        manualReviewListings.push({
          externalId: candidate.externalId,
          title: candidate.title,
          companyName: candidate.companyName,
          location: candidate.location ?? "(location not provided)",
          sourceUrl: candidate.sourceUrl ?? "",
          applicationUrl: candidate.applicationUrl,
          reason: prepared.reason,
        });
      }
    }

    const publishableJobs = batch.jobs.filter((job) => eligibleExternalIds.has(job.externalId));
    const existingIds = new Set(existingJobs.filter((job) => job.sourceId === remoteSource?.id).map((job) => job.externalId));
    const otherSources = existingJobs.filter((job) => job.sourceId !== remoteSource?.id);
    let insertEligibleCount = 0;
    let updateEligibleCount = 0;
    let databaseDuplicateCount = 0;
    for (const job of publishableJobs) {
      if (existingIds.has(job.externalId)) updateEligibleCount += 1;
      else if (findDuplicateCandidate(job, otherSources)) databaseDuplicateCount += 1;
      else insertEligibleCount += 1;
    }
    decisionSuppressedCount = batch.jobs.length - publishableJobs.length;

    console.log(JSON.stringify({
      mode: "dry_run",
      databaseWritePerformed: false,
      sourceName: source.sourceName,
      registeredSourceFound: Boolean(remoteSource),
      complianceStatus: assessment.complianceStatus,
      redistributionAllowed: assessment.redistributionAllowed,
      attributionRequired: assessment.attributionRequired,
      sourceActive: remoteSource?.isActive ?? false,
      databaseState,
      decisionsTableState,
      endpointUrl: batch.endpointUrl,
      totalFetchedJobs: batch.fetchedCount,
      designRelatedJobs: batch.designRelatedCount,
      explicitIndonesiaEligibleDesignJobs: batch.explicitIndonesiaEligibleCount,
      inferredWorldwideDesignJobs: batch.inferredWorldwideEligibleCount,
      inferredSoutheastAsiaDesignJobs: batch.inferredSoutheastAsiaEligibleCount,
      totalGeographicallyEligibleDesignJobs: batch.eligibleGeographyCount,
      manualReviewJobs: manualReviewJobCount,
      excludedJobs: excludedJobCount,
      eligiblePublicationCandidates: publishableJobs.length,
      decisionSuppressedJobs: decisionSuppressedCount,
      rejectedJobs: batch.rejectedCount,
      duplicateJobsInFeed: batch.duplicateCount,
      duplicatesAgainstDatabase: databaseDuplicateCount,
      insertEligibleRecords: insertEligibleCount,
      updateEligibleRecords: updateEligibleCount,
      ambiguousGeographyJobs: batch.ambiguousGeographyCount,
      worldwideManualReviewJobs: batch.worldwideManualReviewCount,
      manualReviewListings,
      urlValidation: {
        uniqueOriginalListingUrlsChecked: batch.originalUrlValidCount + batch.originalUrlInvalidCount,
        originalListingUrlsWellFormedAndRemoteOkHosted: batch.originalUrlValidCount,
        invalidOriginalListingUrls: batch.originalUrlInvalidCount,
        externalListingPagesFetched: false,
        applicationUrlsPresent: batch.applicationUrlPresentCount,
        applicationUrlsSyntacticallyValid: batch.applicationUrlValidCount,
        applicationUrlsInvalidOrUnsupported: batch.applicationUrlInvalidCount,
        applicationUrlsCheckedForReachability: false,
        note: "This preview checks URL syntax and the original-listing host/path without fetching external pages. A prior browser request returned HTTP 403 for the candidate Remote OK page; this is unverified, not confirmed invalid.",
      },
      eligibleListingSummaries: publishableJobs.map((job) => ({
        title: job.title,
        companyName: job.companyName,
        location: job.locationText,
        geographicEligibility: assessRemoteOkGeography(job.locationText).basis,
        applicationUrl: job.applicationUrl,
        sourceUrl: job.sourceUrl,
      })),
      rejectionReasons: batch.rejectionReasons,
      note: decisionsTableState === "available" && carrotDecisionWasStored
        ? "The Carrot manual-review decision was read from Neon; no database writes were performed."
        : decisionsTableState === "available"
          ? "The prepared Carrot manual-review hold is applied in-memory because no persisted decision was found; no database writes were performed."
        : "The Phase 9 decisions table is not yet available; persistent decisions require applying the prepared migration after approval. This dry-run overlays the prepared Carrot manual-review hold and performs no writes.",
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
