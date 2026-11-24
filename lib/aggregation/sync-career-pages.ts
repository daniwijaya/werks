import { and, eq } from "drizzle-orm";
import { getDatabase } from "../../db/client.ts";
import { jobSources, syncRuns } from "../../db/schema.ts";
import { parseHtmlJobCards } from "./html.ts";
import { parseJsonLdJobs } from "./jsonld.ts";
import { persistSourceJobs } from "./persist.ts";
import { isSourceEligibleForSync } from "./compliance.ts";
import { parseRssAtomJobs } from "./rss.ts";
import { discoverJobPageUrls, fetchRobotsRules, isAllowedCompanyUrl } from "./sitemap.ts";
import { requestWithRetry, responseValidators, validatorHeaders } from "./http.ts";
import { isAllowedByRobots } from "./robots.ts";
import type { NormalizedJob, SourceParserConfig } from "./types.ts";

type SourceKind = "rss" | "sitemap" | "json_ld" | "html";
type CachedValidators = Record<string, { etag?: string; lastModified?: string }>;

export type CareerSourceSyncResult = {
  sourceId: string;
  sourceName: string;
  status: "succeeded" | "partial" | "failed" | "skipped";
  fetchedCount: number;
  acceptedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  closedCount: number;
  error?: string;
};

function sourceDomains(source: { companyDomain: string | null; careersUrl: string; allowedDomains: string[] }): string[] {
  const domains = source.allowedDomains.length ? source.allowedDomains : [source.companyDomain ?? new URL(source.careersUrl).hostname];
  return [...new Set(domains.map((domain) => domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")))];
}

function parserConfig(value: unknown): SourceParserConfig {
  return value && typeof value === "object" ? value as SourceParserConfig : {};
}

function isDue(lastSuccessfulSyncAt: Date | null, intervalHours: number, now = Date.now()): boolean {
  return !lastSuccessfulSyncAt || now - lastSuccessfulSyncAt.getTime() >= Math.max(1, intervalHours) * 3_600_000;
}

async function throttle(milliseconds: number, delay: (milliseconds: number) => Promise<void>): Promise<void> {
  if (milliseconds > 0) await delay(milliseconds + Math.floor(Math.random() * Math.min(500, milliseconds * 0.2)));
}

async function fetchRegisteredText(
  url: string,
  allowedDomains: string[],
  validators: CachedValidators,
  options: { fetchImpl?: typeof fetch; delayMs: number; delay?: (milliseconds: number) => Promise<void>; checkRobots?: boolean; maxRequests: number },
  robotsCache: Map<string, ReturnType<typeof fetchRobotsRules>>,
): Promise<{ text: string | null; unchanged: boolean; requestCount: number; validator: { etag: string | null; lastModified: string | null } | null }> {
  if (!isAllowedCompanyUrl(url, allowedDomains)) throw new Error("Request URL is outside registered allowed domains.");
  const host = new URL(url).hostname.toLowerCase();
  const checkRobots = options.checkRobots !== false;
  const hadRobots = robotsCache.has(host);
  if (options.maxRequests < 1 + (checkRobots && !hadRobots ? 1 : 0)) throw new Error("Source request budget is too small for robots.txt and content retrieval.");
  if (checkRobots) {
    let robotsPromise = robotsCache.get(host);
    if (!robotsPromise) {
      robotsPromise = fetchRobotsRules(url, { fetchImpl: options.fetchImpl, allowedDomains });
      robotsCache.set(host, robotsPromise);
    }
    const robots = await robotsPromise;
    if (!isAllowedByRobots(url, robots)) throw new Error("Request URL is disallowed by robots.txt.");
  }
  await throttle(options.delayMs, options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))));
  const cached = validators[url] ?? {};
  const response = await requestWithRetry(url, {
    fetchImpl: options.fetchImpl,
    retries: 2,
    timeoutMs: 12_000,
    headers: validatorHeaders(cached.etag ?? null, cached.lastModified ?? null),
    delay: options.delay,
    redirectValidator: (target) => isAllowedCompanyUrl(target, allowedDomains),
  });
  if (response.url && !isAllowedCompanyUrl(response.url, allowedDomains)) throw new Error("Redirect target is outside registered allowed domains.");
  const requestCount = 1 + (checkRobots && !hadRobots ? 1 : 0);
  if (response.status === 304) return { text: null, unchanged: true, requestCount, validator: null };
  const responseValidator = responseValidators(response);
  return { text: await response.text(), unchanged: false, requestCount, validator: responseValidator };
}

async function collectSourceJobs(
  source: {
    sourceType: string;
    companyName: string;
    careersUrl: string;
    endpointUrl: string;
    companyDomain: string | null;
    allowedDomains: string[];
    parserConfig: unknown;
    httpValidators: CachedValidators;
    requestLimitPerRun: number;
    minRequestIntervalSeconds: number;
  },
  options: { fetchImpl?: typeof fetch; delay?: (milliseconds: number) => Promise<void> } = {},
): Promise<{ jobs: NormalizedJob[]; fetchedCount: number; complete: boolean; snapshotComplete: boolean; validators: CachedValidators; requestCount: number; errors: string[] }> {
  const kind = source.sourceType as SourceKind;
  const domains = sourceDomains(source);
  const config = parserConfig(source.parserConfig);
  const validators: CachedValidators = { ...source.httpValidators };
  const robotsCache = new Map<string, ReturnType<typeof fetchRobotsRules>>();
  const delayMs = Math.max(0, Math.min(source.minRequestIntervalSeconds, 3_600)) * 1_000;
  const requestLimit = Math.max(1, Math.min(source.requestLimitPerRun, 500));
  const jobs: NormalizedJob[] = [];
  const errors: string[] = [];
  let fetchedCount = 0;
  let requestCount = 0;
  let complete = true;
  let snapshotComplete = config.completeSnapshot === true;
  const feedUrl = source.endpointUrl || source.careersUrl;

  if (kind === "rss") {
    const result = await fetchRegisteredText(feedUrl, domains, validators, { fetchImpl: options.fetchImpl, delayMs, delay: options.delay, maxRequests: requestLimit }, robotsCache);
    requestCount += result.requestCount;
    if (!result.unchanged && result.text !== null) {
      const batch = parseRssAtomJobs(result.text, { companyName: source.companyName, sourceUrl: feedUrl });
      jobs.push(...batch.jobs);
      fetchedCount = batch.fetchedCount;
      if (result.validator) validators[feedUrl] = { etag: result.validator.etag ?? undefined, lastModified: result.validator.lastModified ?? undefined };
    } else snapshotComplete = false;
  } else if (kind === "json_ld") {
    const result = await fetchRegisteredText(feedUrl, domains, validators, { fetchImpl: options.fetchImpl, delayMs, delay: options.delay, maxRequests: requestLimit }, robotsCache);
    requestCount += result.requestCount;
    if (!result.unchanged && result.text !== null) {
      const batch = parseJsonLdJobs(result.text, { companyName: source.companyName, sourceUrl: feedUrl, allowedDomains: domains });
      jobs.push(...batch.jobs);
      fetchedCount = batch.fetchedCount;
      if (result.validator) validators[feedUrl] = { etag: result.validator.etag ?? undefined, lastModified: result.validator.lastModified ?? undefined };
    } else snapshotComplete = false;
  } else if (kind === "html") {
    const result = await fetchRegisteredText(feedUrl, domains, validators, { fetchImpl: options.fetchImpl, delayMs, delay: options.delay, maxRequests: requestLimit }, robotsCache);
    requestCount += result.requestCount;
    if (!result.unchanged && result.text !== null) {
      const batch = parseHtmlJobCards(result.text, feedUrl, { companyName: source.companyName, allowedDomains: domains, parserConfig: config });
      jobs.push(...batch.jobs);
      fetchedCount = batch.fetchedCount;
      if (result.validator) validators[feedUrl] = { etag: result.validator.etag ?? undefined, lastModified: result.validator.lastModified ?? undefined };
    } else snapshotComplete = false;
  } else if (kind === "sitemap") {
    const companyHost = source.companyDomain?.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const discovery = await discoverJobPageUrls(companyHost ? "https://" + companyHost : source.careersUrl, {
      fetchImpl: options.fetchImpl,
      allowedDomains: domains,
      sitemapUrls: [...(config.sitemapUrls ?? []), ...(source.endpointUrl !== source.careersUrl ? [source.endpointUrl] : [])],
      maxSitemaps: Math.max(1, Math.min(config.maxSitemaps ?? 4, requestLimit - 1)),
      maxPages: Math.max(1, Math.min(config.maxPages ?? 100, requestLimit - 2)),
      candidatePathPattern: config.candidatePathPattern,
      maxRequests: requestLimit,
      minimumIntervalMs: delayMs,
      delay: options.delay,
    });
    requestCount += discovery.requestCount;
    complete = discovery.complete;
    snapshotComplete = snapshotComplete && discovery.complete;
    errors.push(...discovery.errors);
    const remaining = Math.max(0, requestLimit - requestCount);
    const selected = discovery.urls.slice(0, remaining);
    if (selected.length < discovery.urls.length) complete = false;
    for (const pageUrl of selected) {
      try {
        const result = await fetchRegisteredText(pageUrl, domains, validators, { fetchImpl: options.fetchImpl, delayMs, delay: options.delay, checkRobots: false, maxRequests: requestLimit - requestCount }, robotsCache);
        requestCount += result.requestCount;
        if (result.unchanged) {
          snapshotComplete = false;
          continue;
        }
        if (result.validator) validators[pageUrl] = { etag: result.validator.etag ?? undefined, lastModified: result.validator.lastModified ?? undefined };
        const batch = parseJsonLdJobs(result.text ?? "", { companyName: source.companyName, sourceUrl: pageUrl, allowedDomains: domains });
        fetchedCount += batch.fetchedCount;
        jobs.push(...batch.jobs);
      } catch (error) {
        complete = false;
        errors.push(pageUrl + ": " + (error instanceof Error ? error.message : "request failed"));
      }
    }
  } else {
    throw new Error("Unsupported company career source type: " + source.sourceType);
  }
  if (requestCount > requestLimit) complete = false;
  if (errors.length) {
    complete = false;
    snapshotComplete = false;
  }
  return { jobs, fetchedCount, complete, snapshotComplete, validators, requestCount, errors };
}

export async function syncApprovedCareerPageSources(
  options: { fetchImpl?: typeof fetch; delay?: (milliseconds: number) => Promise<void>; now?: () => Date } = {},
): Promise<CareerSourceSyncResult[]> {
  const { db } = getDatabase();
  const sources = await db.select().from(jobSources).where(and(
    eq(jobSources.isActive, true),
    eq(jobSources.complianceStatus, "approved"),
  )).then((rows) => rows.filter(isSourceEligibleForSync));
  const results: CareerSourceSyncResult[] = [];
  for (const source of sources) {
    if (!(["rss", "sitemap", "json_ld", "html"] as string[]).includes(source.sourceType)) continue;
    const now = options.now?.() ?? new Date();
    if (!isDue(source.lastSuccessfulSyncAt, source.pollingIntervalHours, now.getTime())) {
      results.push({ sourceId: source.id, sourceName: source.sourceName, status: "skipped", fetchedCount: 0, acceptedCount: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0, closedCount: 0 });
      continue;
    }
    const [run] = await db.insert(syncRuns).values({ sourceId: source.id, startedAt: now }).returning({ id: syncRuns.id });
    try {
      const batch = await collectSourceJobs(source, options);
      const persisted = await persistSourceJobs(db, source, batch.jobs, { completeSnapshot: batch.complete && batch.snapshotComplete });
      const partial = batch.errors.length > 0 || !batch.complete;
      const status = partial ? "partial" as const : "succeeded" as const;
      const skippedCount = Math.max(0, batch.fetchedCount - batch.jobs.length) + persisted.skippedCount;
      await db.update(syncRuns).set({
        finishedAt: options.now?.() ?? new Date(),
        status,
        fetchedCount: batch.fetchedCount,
        acceptedCount: batch.jobs.length,
        insertedCount: persisted.insertedCount,
        updatedCount: persisted.updatedCount,
        skippedCount,
        errorMessage: batch.errors.length ? batch.errors.slice(0, 10).join("; ").slice(0, 2_000) : null,
        metadata: { requestCount: batch.requestCount, closedCount: persisted.closedCount },
      }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({
        ...(status === "succeeded" ? { lastSuccessfulSyncAt: options.now?.() ?? new Date() } : {}),
        lastSyncStatus: status,
        lastError: batch.errors.length ? batch.errors.slice(0, 5).join("; ").slice(0, 1_000) : null,
        httpValidators: batch.validators,
        updatedAt: options.now?.() ?? new Date(),
      }).where(eq(jobSources.id, source.id));
      results.push({
        sourceId: source.id,
        sourceName: source.sourceName,
        status,
        fetchedCount: batch.fetchedCount,
        acceptedCount: batch.jobs.length,
        insertedCount: persisted.insertedCount,
        updatedCount: persisted.updatedCount,
        skippedCount,
        closedCount: persisted.closedCount,
        ...(batch.errors.length ? { error: batch.errors.slice(0, 5).join("; ") } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown career-page synchronization error.";
      await db.update(syncRuns).set({ finishedAt: options.now?.() ?? new Date(), status: "failed", errorMessage: message }).where(eq(syncRuns.id, run.id));
      await db.update(jobSources).set({ lastSyncStatus: "failed", lastError: message, updatedAt: options.now?.() ?? new Date() }).where(eq(jobSources.id, source.id));
      results.push({ sourceId: source.id, sourceName: source.sourceName, status: "failed", fetchedCount: 0, acceptedCount: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0, closedCount: 0, error: message });
    }
  }
  return results;
}
