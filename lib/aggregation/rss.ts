import { XMLParser } from "fast-xml-parser";
import { load } from "cheerio";
import { classifyDesignRole, isIndonesiaOpportunity, normalizeCompanyName, normalizeJobUrl, normalizeText, normalizeWorkArrangement, parseDate } from "./normalize.ts";
import type { NormalizedJob } from "./types.ts";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
});

type XmlObject = Record<string, unknown>;
function asArray<T>(value: T | T[] | undefined): T[] { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function field(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const object = value as XmlObject;
    if ("#text" in object) return field(object["#text"]);
    if ("@_term" in object) return field(object["@_term"]);
  }
  return null;
}
function stripMarkup(value: string | null): string | null {
  if (!value) return null;
  return load("<div>" + value + "</div>").text().replace(/\s+/g, " ").trim() || null;
}
function atomLink(value: unknown): string | null {
  for (const link of asArray(value as XmlObject | XmlObject[] | undefined)) {
    if (!link || typeof link !== "object") continue;
    const rel = String(link["@_rel"] ?? "alternate").toLowerCase();
    const href = field(link["@_href"]);
    if (href && (rel === "alternate" || rel === "")) return href;
  }
  return null;
}

export function parseRssAtom(xml: string): XmlObject[] {
  const parsed = xmlParser.parse(xml) as XmlObject;
  const root = (parsed.rss ?? parsed.feed ?? parsed) as XmlObject;
  const channel = (root.channel ?? root) as XmlObject;
  const entries = channel.item ?? channel.entry;
  return asArray(entries as XmlObject | XmlObject[] | undefined);
}

export type RssSourceConfig = { companyName: string; sourceUrl: string };
export function mapRssEntry(entry: XmlObject, config: RssSourceConfig): NormalizedJob | null {
  const title = field(entry.title);
  const rawLink = field(entry.link) ?? atomLink(entry.link) ?? field(entry.guid) ?? field(entry.id);
  if (!title || !rawLink) return null;
  const sourceUrl = normalizeJobUrl(rawLink, config.sourceUrl);
  if (!sourceUrl) return null;
  const description = stripMarkup(field(entry.description) ?? field(entry.summary) ?? field(entry.encoded) ?? field(entry.content));
  const role = classifyDesignRole(title, description);
  if (!role.categories.length || role.confidence === "low") return null;

  const categories = asArray(entry.category as string | string[] | undefined).map((category) => field(category)).filter((item): item is string => Boolean(item));
  const locationText = field(entry.location) ?? categories.find((category) => /indonesia|jakarta|bandung|surabaya|remote|hybrid/i.test(category)) ?? null;
  if (!isIndonesiaOpportunity(locationText)) return null;
  const externalId = field(entry.guid) ?? field(entry.id) ?? sourceUrl;

  return {
    externalId,
    title,
    normalizedTitle: normalizeText(title),
    companyName: config.companyName,
    normalizedCompanyName: normalizeCompanyName(config.companyName),
    sourceUrl,
    canonicalUrl: normalizeJobUrl(field(entry.link) ?? sourceUrl, config.sourceUrl),
    applicationUrl: sourceUrl,
    description,
    department: field(entry.department),
    locationText,
    countryCode: "ID",
    employmentType: field(entry.employmentType),
    workArrangement: normalizeWorkArrangement(locationText),
    salaryMinimum: null,
    salaryMaximum: null,
    salaryCurrency: null,
    salaryInterval: null,
    experienceLevel: null,
    originalPostedAt: parseDate(field(entry.pubDate) ?? field(entry.published) ?? field(entry.updated)),
    expiresAt: parseDate(field(entry.validThrough) ?? field(entry.expirationDate)),
    sourceUpdatedAt: parseDate(field(entry.updated)),
    categories: role.categories,
  };
}

export function parseRssAtomJobs(xml: string, config: RssSourceConfig): { fetchedCount: number; jobs: NormalizedJob[] } {
  const entries = parseRssAtom(xml);
  return { fetchedCount: entries.length, jobs: entries.map((entry) => mapRssEntry(entry, config)).filter((job): job is NormalizedJob => Boolean(job)) };
}
