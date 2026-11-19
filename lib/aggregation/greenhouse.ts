import { classifyDesignCategories, isIndonesiaOpportunity, normalizeText, normalizeWorkArrangement, parseDate, validJobUrl } from "./normalize.ts";
import type { NormalizedJob } from "./types.ts";

export type GreenhouseJob = {
  id: number | string;
  title?: string;
  updated_at?: string | null;
  first_published?: string | null;
  absolute_url?: string;
  location?: { name?: string | null } | null;
  departments?: Array<{ name?: string | null }>;
  content?: string | null;
};

export type GreenhouseBoardResponse = { jobs?: GreenhouseJob[] };

export type GreenhouseSourceConfig = {
  boardIdentifier: string;
  companyName: string;
};

export function greenhouseJobsEndpoint(boardIdentifier: string): string {
  if (!/^[a-z0-9-]+$/i.test(boardIdentifier)) throw new Error("Invalid Greenhouse board identifier.");
  return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardIdentifier)}/jobs`;
}

export function mapGreenhouseJob(job: GreenhouseJob, config: GreenhouseSourceConfig): NormalizedJob | null {
  const title = job.title?.trim();
  const sourceUrl = job.absolute_url?.trim();
  if (!title || !sourceUrl || !validJobUrl(sourceUrl)) return null;

  const categories = classifyDesignCategories([title, ...(job.departments ?? []).map((department) => department.name ?? "")].join(" "));
  if (categories.length === 0) return null;

  const locationText = job.location?.name?.trim() || null;
  if (!isIndonesiaOpportunity(locationText)) return null;

  return {
    externalId: String(job.id),
    title,
    normalizedTitle: normalizeText(title),
    companyName: config.companyName,
    normalizedCompanyName: normalizeText(config.companyName),
    sourceUrl,
    applicationUrl: null,
    // Greenhouse only provides the full post body when `content=true`; we avoid copying it unless usage is approved.
    description: null,
    locationText,
    countryCode: "ID",
    employmentType: null,
    workArrangement: normalizeWorkArrangement(locationText),
    salaryMinimum: null,
    salaryMaximum: null,
    salaryCurrency: null,
    salaryInterval: null,
    experienceLevel: null,
    originalPostedAt: parseDate(job.first_published),
    sourceUpdatedAt: parseDate(job.updated_at),
    categories,
  };
}

export async function fetchGreenhouseJobs(
  config: GreenhouseSourceConfig,
  options: { fetchImpl?: typeof fetch; retries?: number; delay?: (milliseconds: number) => Promise<void> } = {},
): Promise<{ endpointUrl: string; fetchedCount: number; jobs: NormalizedJob[] }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retries = options.retries ?? 2;
  const delay = options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const endpointUrl = greenhouseJobsEndpoint(config.boardIdentifier);
  let response: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      response = await fetchImpl(endpointUrl, {
        headers: { accept: "application/json", "user-agent": "WERKS-Job-Aggregator/0.1" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`Greenhouse returned HTTP ${response.status} for board ${config.boardIdentifier}.`);
      }
      lastError = new Error(`Greenhouse returned HTTP ${response.status} for board ${config.boardIdentifier}.`);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /HTTP 4\d\d/.test(error.message) && !/HTTP 429/.test(error.message)) throw error;
    }

    if (attempt < retries) {
      const retryAfter = response?.headers.get("retry-after");
      const retryMilliseconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1_000 : 500 * 2 ** attempt;
      await delay(Math.min(retryMilliseconds, 10_000));
    }
  }

  if (!response?.ok) throw lastError instanceof Error ? lastError : new Error("Greenhouse request failed after retries.");

  const payload = (await response.json()) as GreenhouseBoardResponse;
  if (!Array.isArray(payload.jobs)) throw new Error(`Greenhouse returned an invalid jobs response for board ${config.boardIdentifier}.`);
  const jobs = payload.jobs.map((job) => mapGreenhouseJob(job, config)).filter((job): job is NormalizedJob => job !== null);
  return { endpointUrl, fetchedCount: payload.jobs.length, jobs };
}
