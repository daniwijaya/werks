import { classifyDesignCategories, isIndonesiaOpportunity, normalizeText, parseDate, validJobUrl } from "./normalize.ts";
import type { NormalizedJob } from "./types.ts";

const JOBICY_API = "https://jobicy.com/api/jobs";
const FEED_FILTERS = [
  { geo: "apac", industry: "design-multimedia" },
  { geo: "apac", industry: "web-app-design" },
  { geo: "anywhere", industry: "design-multimedia" },
  { geo: "anywhere", industry: "web-app-design" },
] as const;

export type JobicyJob = {
  id: number | string;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  pubDate?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
};

export type JobicyJobStatus = "active" | "closed" | "unknown";

type JobicyResponse = {
  success?: boolean;
  error?: string;
  jobs?: JobicyJob[];
  nextCursor?: string | null;
};

export function isJobicyListingUrl(value: string): boolean {
  if (!validJobUrl(value)) return false;
  const url = new URL(value);
  return url.hostname === "jobicy.com" && url.pathname.startsWith("/jobs/");
}
export function mapJobicyJob(job: JobicyJob): NormalizedJob | null {
  const title = job.jobTitle?.trim();
  const companyName = job.companyName?.trim();
  const listingUrl = job.url?.trim();
  if (!title || !companyName || !listingUrl || !isJobicyListingUrl(listingUrl)) return null;

  if (!/\b(design|designer|creative|art direction)\b/i.test(title)) return null;
  const categories = classifyDesignCategories([title, ...(job.jobIndustry ?? [])].join(" "));
  const locationText = job.jobGeo?.trim() || null;
  if (categories.length === 0 || !isIndonesiaOpportunity(locationText)) return null;

  return {
    externalId: String(job.id),
    title,
    normalizedTitle: normalizeText(title),
    companyName,
    normalizedCompanyName: normalizeText(companyName),
    sourceUrl: listingUrl,
    // The public Jobicy API requires apply links to remain on the Jobicy listing.
    applicationUrl: listingUrl,
    description: null,
    locationText,
    countryCode: "ID",
    employmentType: job.jobType?.length ? job.jobType.join(", ") : null,
    workArrangement: "remote",
    salaryMinimum: job.salaryMin == null ? null : String(job.salaryMin),
    salaryMaximum: job.salaryMax == null ? null : String(job.salaryMax),
    salaryCurrency: job.salaryCurrency ?? null,
    salaryInterval: job.salaryPeriod ?? null,
    experienceLevel: job.jobLevel ?? null,
    originalPostedAt: parseDate(job.pubDate),
    sourceUpdatedAt: null,
    categories,
  };
}

export async function fetchJobicyJobs(
  options: {
    fetchImpl?: typeof fetch;
    delay?: (milliseconds: number) => Promise<void>;
    minimumIntervalMs?: number;
  } = {},
): Promise<{ endpointUrl: string; fetchedCount: number; jobs: NormalizedJob[] }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const minimumIntervalMs = options.minimumIntervalMs ?? 1_050;
  const collected = new Map<string, JobicyJob>();
  let lastRequestAt = 0;

  async function getPage(url: URL): Promise<JobicyResponse> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const remaining = minimumIntervalMs - (Date.now() - lastRequestAt);
      if (lastRequestAt > 0 && remaining > 0) await delay(remaining);

      const response = await fetchImpl(url, {
        headers: { accept: "application/json", "user-agent": "WERKS-Job-Aggregator/0.1" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      lastRequestAt = Date.now();

      if (response.status === 429 || response.status === 503) {
        if (attempt === 2) throw new Error(`Jobicy returned HTTP ${response.status} after retries.`);
        const retryAfter = Number(response.headers.get("retry-after")) || 1;
        await delay(Math.max(1, retryAfter) * 1_000);
        continue;
      }
      if (!response.ok) throw new Error(`Jobicy returned HTTP ${response.status}.`);

      const payload = (await response.json()) as JobicyResponse;
      if (payload.success === false || !Array.isArray(payload.jobs)) {
        throw new Error(payload.error || "Jobicy returned an invalid jobs response.");
      }
      return payload;
    }
    throw new Error("Jobicy request failed after retries.");
  }

  for (const filter of FEED_FILTERS) {
    let cursor: string | null = null;
    do {
      const url = new URL(JOBICY_API);
      url.searchParams.set("count", "100");
      url.searchParams.set("geo", filter.geo);
      url.searchParams.set("industry", filter.industry);
      if (cursor) url.searchParams.set("cursor", cursor);

      const payload = await getPage(url);
      for (const job of payload.jobs ?? []) collected.set(String(job.id), job);
      cursor = payload.nextCursor ?? null;
    } while (cursor);
  }

  const jobs = [...collected.values()].map(mapJobicyJob).filter((job): job is NormalizedJob => job !== null);
  return { endpointUrl: JOBICY_API, fetchedCount: collected.size, jobs };
}

export async function fetchJobicyStatuses(
  ids: string[],
  options: {
    fetchImpl?: typeof fetch;
    delay?: (milliseconds: number) => Promise<void>;
    minimumIntervalMs?: number;
  } = {},
): Promise<Map<string, JobicyJobStatus>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const minimumIntervalMs = options.minimumIntervalMs ?? 1_050;
  const validIds = [...new Set(ids)].filter((id) => /^[1-9]\d*$/.test(id));
  const statuses = new Map<string, JobicyJobStatus>();
  let lastRequestAt = 0;

  for (let offset = 0; offset < validIds.length; offset += 100) {
    const batch = validIds.slice(offset, offset + 100);
    if (lastRequestAt) {
      const remaining = minimumIntervalMs - (Date.now() - lastRequestAt);
      if (remaining > 0) await delay(remaining);
    }

    const url = new URL("https://jobicy.com/api/jobs/status");
    url.searchParams.set("ids", batch.join(","));
    const response = await fetchImpl(url, {
      headers: { accept: "application/json", "user-agent": "WERKS-Job-Aggregator/0.1" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    lastRequestAt = Date.now();
    if (!response.ok) throw new Error(`Jobicy status endpoint returned HTTP ${response.status}.`);

    const payload = (await response.json()) as { success?: boolean; jobs?: Array<{ id: number | string; status: JobicyJobStatus }> };
    if (payload.success === false || !Array.isArray(payload.jobs)) throw new Error("Jobicy returned an invalid status response.");
    for (const job of payload.jobs) {
      if (["active", "closed", "unknown"].includes(job.status)) statuses.set(String(job.id), job.status);
    }
  }

  return statuses;
}
