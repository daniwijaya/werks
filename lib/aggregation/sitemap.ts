import { XMLParser } from "fast-xml-parser";
import { requestWithRetry } from "./http.ts";
import { isAllowedByRobots, parseRobotsTxt } from "./robots.ts";
import { normalizeJobUrl } from "./normalize.ts";

const xmlParser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false, trimValues: true });
type XmlObject = Record<string, unknown>;
const asArray = <T>(value: T | T[] | undefined): T[] => value == null ? [] : Array.isArray(value) ? value : [value];

export function isAllowedCompanyUrl(value: string, allowedDomains: string[]): boolean {
  const normalized = normalizeJobUrl(value);
  if (!normalized) return false;
  const host = new URL(normalized).hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false;
  return allowedDomains.some((domain) => host === domain.toLowerCase() || host.endsWith("." + domain.toLowerCase()));
}

export function parseSitemapXml(xml: string): { sitemapUrls: string[]; pageUrls: string[] } {
  const root = xmlParser.parse(xml) as XmlObject;
  const index = (root.sitemapindex ?? {}) as XmlObject;
  const urlSet = (root.urlset ?? {}) as XmlObject;
  const sitemapUrls = asArray(index.sitemap as XmlObject | XmlObject[] | undefined)
    .map((item) => typeof item.loc === "string" ? item.loc.trim() : "")
    .filter(Boolean);
  const pageUrls = asArray(urlSet.url as XmlObject | XmlObject[] | undefined)
    .map((item) => typeof item.loc === "string" ? item.loc.trim() : "")
    .filter(Boolean);
  return { sitemapUrls, pageUrls };
}

export async function fetchRobotsRules(
  url: string,
  options: { fetchImpl?: typeof fetch; allowedDomains: string[] },
): Promise<ReturnType<typeof parseRobotsTxt>> {
  if (!isAllowedCompanyUrl(url, options.allowedDomains)) throw new Error("robots.txt origin is outside registered allowed domains.");
  const origin = new URL(url);
  const robotsUrl = new URL("/robots.txt", origin).toString();
  const response = await requestWithRetry(robotsUrl, {
    fetchImpl: options.fetchImpl,
    retries: 1,
    timeoutMs: 10_000,
    headers: { accept: "text/plain" },
    redirectValidator: (target) => isAllowedCompanyUrl(target, options.allowedDomains),
  });
  if (response.status >= 500 || response.status === 429) throw new Error("robots.txt returned HTTP " + response.status + ".");
  if (!response.ok && response.status !== 404) throw new Error("robots.txt returned HTTP " + response.status + "; refusing to crawl.");
  return parseRobotsTxt(response.status === 404 ? "" : await response.text());
}

export type SitemapOptions = {
  fetchImpl?: typeof fetch;
  allowedDomains: string[];
  sitemapUrls?: string[];
  maxSitemaps?: number;
  maxPages?: number;
  candidatePathPattern?: string;
  maxRequests?: number;
  minimumIntervalMs?: number;
  delay?: (milliseconds: number) => Promise<void>;
};

export async function discoverJobPageUrls(
  originUrl: string,
  options: SitemapOptions,
): Promise<{ urls: string[]; sitemapCount: number; requestCount: number; complete: boolean; errors: string[] }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const allowedDomains = [...new Set(options.allowedDomains.map((domain) => domain.toLowerCase()).filter(Boolean))];
  if (!isAllowedCompanyUrl(originUrl, allowedDomains)) throw new Error("Sitemap origin is outside registered allowed domains.");
  const maxSitemaps = Math.max(1, Math.min(options.maxSitemaps ?? 5, 20));
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 100, 500));
  const maxRequests = Math.max(1, Math.min(options.maxRequests ?? 100, 500));
  const minimumIntervalMs = Math.max(0, options.minimumIntervalMs ?? 1_000);
  const delay = options.delay ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let lastRequestAt = 0;
  async function waitForRequest(): Promise<void> {
    if (!lastRequestAt || !minimumIntervalMs) return;
    const remaining = minimumIntervalMs - (Date.now() - lastRequestAt);
    if (remaining > 0) await delay(remaining);
  }
  const robotsByHost = new Map<string, ReturnType<typeof parseRobotsTxt>>();
  let requestCount = 0;
  async function robotsFor(url: string): Promise<ReturnType<typeof parseRobotsTxt>> {
    const origin = new URL(url);
    const host = origin.hostname.toLowerCase();
    const cached = robotsByHost.get(host);
    if (cached) return cached;
    if (requestCount >= maxRequests) throw new Error("Sitemap discovery reached its request limit.");
    await waitForRequest();
    const parsed = await fetchRobotsRules(url, { fetchImpl, allowedDomains });
    requestCount += 1;
    lastRequestAt = Date.now();
    robotsByHost.set(host, parsed);
    return parsed;
  }
  const rootRobots = await robotsFor(originUrl);
  const configured = options.sitemapUrls ?? [];
  const sitemapQueue = [...new Set([...rootRobots.sitemaps, ...configured])].filter((url) => isAllowedCompanyUrl(url, allowedDomains));
  const origin = new URL(originUrl);
  if (!sitemapQueue.length && /sitemap(?:[-_][^/]*)?\.xml$/i.test(origin.pathname)) sitemapQueue.push(originUrl);

  const sitemapSeen = new Set<string>();
  const pages = new Set<string>();
  let complete = true;
  const errors: string[] = [];
  while (sitemapQueue.length && sitemapSeen.size < maxSitemaps && pages.size < maxPages) {
    const sitemapUrl = sitemapQueue.shift()!;
    const normalizedSitemapUrl = normalizeJobUrl(sitemapUrl);
    if (!normalizedSitemapUrl || sitemapSeen.has(normalizedSitemapUrl)) continue;
    sitemapSeen.add(normalizedSitemapUrl);
    if (!isAllowedCompanyUrl(normalizedSitemapUrl, allowedDomains)) continue;
    let sitemapRobots: ReturnType<typeof parseRobotsTxt>;
    try { sitemapRobots = await robotsFor(normalizedSitemapUrl); }
    catch (error) { complete = false; errors.push(normalizedSitemapUrl + ": " + (error instanceof Error ? error.message : "robots request failed")); continue; }
    if (!isAllowedByRobots(normalizedSitemapUrl, sitemapRobots)) continue;
    let response: Response;
    try {
      if (requestCount >= maxRequests) { complete = false; break; }
      await waitForRequest();
      response = await requestWithRetry(normalizedSitemapUrl, { fetchImpl, retries: 1, timeoutMs: 10_000, redirectValidator: (target) => isAllowedCompanyUrl(target, allowedDomains) });
    } catch (error) {
      complete = false;
      errors.push(normalizedSitemapUrl + ": " + (error instanceof Error ? error.message : "request failed"));
      continue;
    }
    requestCount += 1;
    lastRequestAt = Date.now();
    if (!response.ok) continue;
    if (response.url && !isAllowedCompanyUrl(response.url, allowedDomains)) {
      complete = false;
      errors.push(normalizedSitemapUrl + ": redirect outside registered allowed domains");
      continue;
    }
    const contentType = response.headers.get("content-type") ?? "";
    const xml = await response.text();
    if (!xml.trim().startsWith("<") && !contentType.includes("xml")) continue;
    const parsed = parseSitemapXml(xml);
    for (const nested of parsed.sitemapUrls) {
      if (sitemapQueue.length + sitemapSeen.size < maxSitemaps && isAllowedCompanyUrl(nested, allowedDomains)) sitemapQueue.push(nested);
      else if (isAllowedCompanyUrl(nested, allowedDomains)) complete = false;
    }
    for (const pageUrl of parsed.pageUrls) {
      const normalized = normalizeJobUrl(pageUrl);
      if (!normalized || !isAllowedCompanyUrl(normalized, allowedDomains)) continue;
      let pageRobots: ReturnType<typeof parseRobotsTxt>;
      try { pageRobots = await robotsFor(normalized); }
      catch (error) { complete = false; errors.push(normalized + ": " + (error instanceof Error ? error.message : "robots request failed")); continue; }
      if (!isAllowedByRobots(normalized, pageRobots)) continue;
      const path = new URL(normalized).pathname;
      const candidatePattern = options.candidatePathPattern ?? "(?:job|career|vacan|opening|position|role|join-us|work-with-us)";
      let candidate = false;
      try { candidate = new RegExp(candidatePattern, "i").test(path); } catch { candidate = /(?:job|career|vacan|opening|position|role)/i.test(path); }
      if (!candidate) continue;
      pages.add(normalized);
      if (pages.size >= maxPages) {
        complete = false;
        break;
      }
    }
  }
  if (sitemapQueue.length) complete = false;
  return { urls: [...pages], sitemapCount: sitemapSeen.size, requestCount, complete, errors };
}
