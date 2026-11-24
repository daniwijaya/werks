import {
  classifyDesignCategories,
  isIndonesiaOpportunity,
  normalizeCompanyName,
  normalizeJobUrl,
  normalizeText,
  normalizeWorkArrangement,
  parseDate,
} from "./normalize.ts";
import type { NormalizedJob } from "./types.ts";

export const REMOTE_OK_API = "https://remoteok.com/api";
const REQUEST_TIMEOUT_MS = 15_000;
const MIN_REQUEST_INTERVAL_MS = 1_000;

export type RemoteOkListing = {
  id?: string | number;
  slug?: string;
  url?: string;
  apply_url?: string | null;
  position?: string;
  company?: string;
  location?: string | null;
  tags?: string[];
  date?: string;
  epoch?: number | string;
  /** Metadata object at index zero in the official API response. */
  legal?: string;
};

export type RemoteOkDiagnostics = {
  endpointUrl: string;
  fetchedCount: number;
  originalUrlValidCount: number;
  originalUrlInvalidCount: number;
  applicationUrlPresentCount: number;
  applicationUrlValidCount: number;
  applicationUrlInvalidCount: number;
  designRelatedCount: number;
  indonesiaEligibleCount: number;
  explicitIndonesiaEligibleCount: number;
  inferredWorldwideEligibleCount: number;
  inferredSoutheastAsiaEligibleCount: number;
  eligibleGeographyCount: number;
  manualReviewCount: number;
  worldwideManualReviewCount: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  ambiguousGeographyCount: number;
  manualReviewListings: Array<{ externalId: string; title: string; companyName: string; location: string; sourceUrl: string; applicationUrl: string | null; reason: string }>;
  jobEligibilityCandidates: Array<{ externalId: string; title: string; companyName: string; sourceUrl: string | null; applicationUrl: string | null; location: string | null; geographicStatus: GeographyAssessment["status"]; reason: string }>;
  rejectionReasons: Record<string, number>;
  jobs: NormalizedJob[];
};

function normalizeListingUrl(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeJobUrl(value, "https://remoteok.com");
  if (!normalized) return null;
  const url = new URL(normalized);
  if (url.hostname !== "remoteok.com" || !url.pathname.startsWith("/remote-jobs/")) return null;
  return normalized;
}

function safeApplicationUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.toString();
    if (url.protocol === "mailto:" && /^[^/?#\s@]+@[^/?#\s@]+\.[^/?#\s@]+$/.test(url.pathname)) {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export type GeographyAssessment = {
  status: "eligible" | "ineligible" | "manual_review";
  basis: "explicit_indonesia" | "inferred_worldwide" | "inferred_southeast_asia" | "manual_review" | "outside_indonesia";
  reason: string;
};

const worldwidePattern = /\b(worldwide|anywhere(?: in the world)?|global(?:ly)? remote)\b/i;
const southeastAsiaPattern = /\b(southeast asia|south[- ]east asia|asean)\b/i;
const restrictedOnlyPattern = /\b(?:only|must\s+(?:be\s+)?(?:based|located|resident)|must\s+reside|residency\s+in|residents?\s+of|eligible\s+only\s+in)\b/i;
const geographicRegionPattern = /\b(?:united states|u\.?s\.?a?\.?|canada|mexico|europe|emea|united kingdom|uk|australia|new zealand|singapore|malaysia|philippines|thailand|vietnam|india|china|japan|south korea|north america|south america|latam|apac|asia)\b/i;
const outsideCountryPattern = /\b(?:united states|u\.?s\.?a?\.?|canada|mexico|united kingdom|uk|australia|new zealand|singapore|malaysia|philippines|thailand|vietnam|india|china|japan|south korea)\b/i;
const outsideRegionPattern = /\b(?:europe|emea|north america|south america|latam)\b/i;
const indonesiaExclusionPattern = /\b(?:except|excluding|exclude|not\s+(?:open\s+)?(?:to|in)|unavailable\s+in|not\s+(?:available|eligible|supported)\s+in|no\s+(?:applicants?|candidates?|residents?)\s+(?:from|in))\b[^.;,]{0,70}\b(?:indonesia|jakarta|bandung|surabaya|yogyakarta|denpasar|bali|medan|semarang|makassar)\b|\b(?:indonesia|jakarta|bandung|surabaya|yogyakarta|denpasar|bali|medan|semarang|makassar)\b[^.;,]{0,70}\b(?:excluded|not\s+(?:available|eligible|supported)|unavailable|not\s+accepted)\b/i;

export function assessRemoteOkGeography(locationValue: string | null | undefined): GeographyAssessment {
  const location = locationValue?.trim() ?? "";
  if (indonesiaExclusionPattern.test(location)) {
    return { status: "ineligible", basis: "outside_indonesia", reason: "The permitted location label explicitly excludes Indonesia." };
  }

  const mentionsIndonesia = isIndonesiaOpportunity(location);
  const worldwide = worldwidePattern.test(location);
  const southeastAsia = southeastAsiaPattern.test(location);
  const hasRegionalLimit = restrictedOnlyPattern.test(location) && geographicRegionPattern.test(location);

  if (mentionsIndonesia && hasRegionalLimit) {
    return { status: "manual_review", basis: "manual_review", reason: "The location contains Indonesia and a conflicting geographic restriction." };
  }
  if (hasRegionalLimit && !mentionsIndonesia && (outsideCountryPattern.test(location) || outsideRegionPattern.test(location))) {
    return { status: "ineligible", basis: "outside_indonesia", reason: "The location restricts eligibility to other countries or regions." };
  }
  if (worldwide && (outsideCountryPattern.test(location) || outsideRegionPattern.test(location)) && !/\b(?:except|excluding)\b/i.test(location)) {
    return { status: "manual_review", basis: "manual_review", reason: "The Worldwide label is paired with another location, and the candidate scope is unclear." };
  }
  if (worldwide && hasRegionalLimit) {
    return { status: "manual_review", basis: "manual_review", reason: "The Worldwide label conflicts with a narrower geographic restriction." };
  }
  if (southeastAsia && hasRegionalLimit && /\b(?:singapore|malaysia|philippines|thailand|vietnam)\b/i.test(location)) {
    return { status: "manual_review", basis: "manual_review", reason: "The Southeast Asia label is narrowed to only some countries; Indonesia coverage is unclear." };
  }
  if (mentionsIndonesia) {
    return { status: "eligible", basis: "explicit_indonesia", reason: "The permitted location label explicitly includes Indonesia." };
  }
  if (southeastAsia) {
    return { status: "eligible", basis: "inferred_southeast_asia", reason: "Southeast Asia coverage implies Indonesia, but employer confirmation is not recorded." };
  }
  if (worldwide) {
    return { status: "eligible", basis: "inferred_worldwide", reason: "The permitted location label says Worldwide with no known conflicting restriction; employer-specific confirmation is not recorded." };
  }
  if (outsideRegionPattern.test(location)) {
    return { status: "ineligible", basis: "outside_indonesia", reason: "The permitted location label is a region outside Indonesia." };
  }
  if (!location || /\b(remote|apac|asia|emea|americas|europe|latam|north america|south america)\b/i.test(location)) {
    return { status: "manual_review", basis: "manual_review", reason: "Remote or regional location does not identify eligible countries clearly." };
  }
  return { status: "ineligible", basis: "outside_indonesia", reason: "The permitted location label does not include Indonesia or a qualifying remote region." };
}

export function remoteOkRejectionReasons(listing: RemoteOkListing): string[] {
  const reasons: string[] = [];
  if (listing.id == null || !String(listing.id).trim() || !listing.position?.trim() || !listing.company?.trim()) {
    reasons.push("missing_identity");
  }
  if (!normalizeListingUrl(listing.url)) reasons.push("invalid_original_url");
  if (!classifyDesignCategories(listing.position ?? "").length) reasons.push("title_not_design_role");
  const geography = assessRemoteOkGeography(listing.location);
  if (geography.status === "ineligible") reasons.push("outside_indonesia_eligibility");
  if (geography.status === "manual_review") reasons.push("ambiguous_geography");
  return reasons;
}

export function mapRemoteOkListing(listing: RemoteOkListing): NormalizedJob | null {
  if (remoteOkRejectionReasons(listing).length) return null;
  const title = listing.position!.trim();
  const companyName = listing.company!.trim();
  const sourceUrl = normalizeListingUrl(listing.url)!;
  const locationText = listing.location?.trim() || null;
  const epochSeconds = Number(listing.epoch);
  const epochDate = Number.isFinite(epochSeconds) && epochSeconds > 0 ? new Date(epochSeconds * 1_000) : null;
  const publishedAt = parseDate(listing.date) ?? (epochDate && !Number.isNaN(epochDate.getTime()) ? epochDate : null);

  return {
    externalId: String(listing.id),
    title,
    normalizedTitle: normalizeText(title),
    companyName,
    normalizedCompanyName: normalizeCompanyName(companyName),
    sourceUrl,
    canonicalUrl: sourceUrl,
    applicationUrl: safeApplicationUrl(listing.apply_url) ?? sourceUrl,
    description: null,
    department: null,
    locationText,
    countryCode: assessRemoteOkGeography(locationText).basis === "explicit_indonesia" ? "ID" : null,
    employmentType: null,
    workArrangement: normalizeWorkArrangement(locationText),
    salaryMinimum: null,
    salaryMaximum: null,
    salaryCurrency: null,
    salaryInterval: null,
    experienceLevel: null,
    originalPostedAt: publishedAt,
    expiresAt: null,
    sourceUpdatedAt: null,
    categories: classifyDesignCategories(title),
  };
}

export async function fetchRemoteOkJobs(options: {
  fetchImpl?: typeof fetch;
  delay?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  requestLimitPerRun?: number;
  minRequestIntervalSeconds?: number;
} = {}): Promise<RemoteOkDiagnostics> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.delay ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = options.now ?? Date.now;
  const maxAttempts = Math.max(1, Math.min(3, Math.floor(options.requestLimitPerRun ?? 3)));
  const minRequestIntervalMs = Math.max(MIN_REQUEST_INTERVAL_MS, (options.minRequestIntervalSeconds ?? 1) * 1_000);
  let lastRequestAt = 0;
  let hasRequested = false;
  let response: Response | undefined;
  let lastError: unknown;

  // Remote OK asks crawlers to wait one second. Retries are bounded and use the
  // same delay, so a failing endpoint cannot trigger a request burst.
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (hasRequested) {
      const wait = minRequestIntervalMs - (now() - lastRequestAt);
      if (wait > 0) await delay(wait);
    }
    lastRequestAt = now();
    hasRequested = true;
    try {
      response = await fetchImpl(REMOTE_OK_API, {
        headers: { accept: "application/json", "user-agent": "WERKS-Job-Aggregator/0.2 (+https://werks.id)" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
      lastRequestAt = now();
      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) throw new Error(`Remote OK API returned HTTP ${response.status}.`);
      lastError = new Error(`Remote OK API returned HTTP ${response.status}.`);
      if (attempt === maxAttempts - 1) throw lastError;
      const retryAfter = Number(response.headers.get("retry-after")) * 1_000;
      if (Number.isFinite(retryAfter) && retryAfter > MIN_REQUEST_INTERVAL_MS) await delay(Math.min(retryAfter, 30_000));
    } catch (error) {
      lastError = error;
      if (response && response.status !== 429 && response.status < 500) throw error;
      if (attempt === maxAttempts - 1) throw error;
    }
  }
  if (!response?.ok) throw lastError instanceof Error ? lastError : new Error("Remote OK API request failed.");

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Remote OK API returned an invalid jobs payload.");
  const rows = payload as RemoteOkListing[];
  const listingRows = rows.filter((row) => row && typeof row === "object" && row.legal == null && row.id != null);
  const unique = new Map<string, RemoteOkListing>();
  const seenListings = new Set<string>();
  let duplicateCount = 0;
  for (const row of listingRows) {
    const url = normalizeListingUrl(row.url);
    const identity = [normalizeText(row.company ?? ""), normalizeText(row.position ?? ""), normalizeText(row.location ?? "")].join("|");
    const keys = [`id:${String(row.id)}`, ...(url ? [`url:${url}`] : []), ...(identity !== "||" ? [`job:${identity}`] : [])];
    if (keys.some((key) => seenListings.has(key))) {
      duplicateCount += 1;
      continue;
    }
    keys.forEach((key) => seenListings.add(key));
    unique.set(String(row.id), row);
  }

  const rejectionReasons: Record<string, number> = {};
  const jobs: NormalizedJob[] = [];
  let designRelatedCount = 0;
  let indonesiaEligibleCount = 0;
  let inferredWorldwideEligibleCount = 0;
  let inferredSoutheastAsiaEligibleCount = 0;
  let ambiguousGeographyCount = 0;
  let worldwideManualReviewCount = 0;
  const manualReviewListings: RemoteOkDiagnostics["manualReviewListings"] = [];
  const jobEligibilityCandidates: RemoteOkDiagnostics["jobEligibilityCandidates"] = [];
  let originalUrlValidCount = 0;
  let originalUrlInvalidCount = 0;
  let applicationUrlPresentCount = 0;
  let applicationUrlValidCount = 0;
  let applicationUrlInvalidCount = 0;
  for (const row of unique.values()) {
    if (normalizeListingUrl(row.url)) originalUrlValidCount += 1;
    else originalUrlInvalidCount += 1;
    if (row.apply_url) {
      applicationUrlPresentCount += 1;
      if (safeApplicationUrl(row.apply_url)) applicationUrlValidCount += 1;
      else applicationUrlInvalidCount += 1;
    }
    const design = classifyDesignCategories(row.position ?? "").length > 0;
    if (design) designRelatedCount += 1;
    const geo = assessRemoteOkGeography(row.location);
    if (design && row.id != null) {
      jobEligibilityCandidates.push({
        externalId: String(row.id),
        title: row.position?.trim() ?? "",
        companyName: row.company?.trim() ?? "",
        sourceUrl: normalizeListingUrl(row.url),
        applicationUrl: safeApplicationUrl(row.apply_url),
        location: row.location?.trim() || null,
        geographicStatus: geo.status,
        reason: geo.reason,
      });
    }
    if (design && geo.status === "eligible" && geo.basis === "explicit_indonesia") indonesiaEligibleCount += 1;
    if (design && geo.status === "eligible" && geo.basis === "inferred_worldwide") inferredWorldwideEligibleCount += 1;
    if (design && geo.status === "eligible" && geo.basis === "inferred_southeast_asia") inferredSoutheastAsiaEligibleCount += 1;
    if (design && geo.status === "manual_review") {
      ambiguousGeographyCount += 1;
      if (worldwidePattern.test(row.location ?? "")) worldwideManualReviewCount += 1;
      const sourceUrl = normalizeListingUrl(row.url);
      if (design && sourceUrl) manualReviewListings.push({
        externalId: String(row.id),
        title: row.position?.trim() ?? "",
        companyName: row.company?.trim() ?? "",
        location: row.location?.trim() || "(location not provided)",
        sourceUrl,
        applicationUrl: safeApplicationUrl(row.apply_url),
        reason: geo.reason,
      });
    }
    const reasons = remoteOkRejectionReasons(row);
    for (const reason of reasons) rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
    const mapped = reasons.length ? null : mapRemoteOkListing(row);
    if (mapped) jobs.push(mapped);
  }

  return {
    endpointUrl: REMOTE_OK_API,
    fetchedCount: listingRows.length,
    originalUrlValidCount,
    originalUrlInvalidCount,
    applicationUrlPresentCount,
    applicationUrlValidCount,
    applicationUrlInvalidCount,
    designRelatedCount,
    indonesiaEligibleCount,
    explicitIndonesiaEligibleCount: indonesiaEligibleCount,
    inferredWorldwideEligibleCount,
    inferredSoutheastAsiaEligibleCount,
    eligibleGeographyCount: indonesiaEligibleCount + inferredWorldwideEligibleCount + inferredSoutheastAsiaEligibleCount,
    manualReviewCount: ambiguousGeographyCount,
    worldwideManualReviewCount,
    acceptedCount: jobs.length,
    rejectedCount: unique.size - jobs.length,
    duplicateCount,
    ambiguousGeographyCount,
    manualReviewListings,
    jobEligibilityCandidates,
    rejectionReasons,
    jobs,
  };
}
