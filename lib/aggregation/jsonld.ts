import { load } from "cheerio";
import { classifyDesignRole, isIndonesiaOpportunity, normalizeCompanyName, normalizeJobUrl, normalizeText, normalizeWorkArrangement, parseDate } from "./normalize.ts";
import type { NormalizedJob } from "./types.ts";

type JsonObject = Record<string, unknown>;
const asArray = (value: unknown): unknown[] => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string | null => typeof value === "string" || typeof value === "number" ? String(value).trim() || null : null;

function plainText(value: string | null): string | null {
  if (!value) return null;
  return load("<div>" + value + "</div>").text().replace(/\s+/g, " ").trim() || null;
}

function collectJobPostings(value: unknown, output: JsonObject[], seen: Set<object>): void {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectJobPostings(item, output, seen);
    return;
  }
  const object = value as JsonObject;
  const types = asArray(object["@type"]).map((item) => String(item).toLowerCase());
  if (types.includes("jobposting")) output.push(object);
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "hasPart"]) {
    if (object[key]) collectJobPostings(object[key], output, seen);
  }
}

export function extractJsonLdJobPostings(html: string): JsonObject[] {
  const $ = load(html);
  const result: JsonObject[] = [];
  const seen = new Set<object>();
  $("script[type]").each((_index, element) => {
    const type = ($(element).attr("type") ?? "").split(";")[0].trim().toLowerCase();
    if (type !== "application/ld+json") return;
    const raw = $(element).contents().text().trim();
    if (!raw) return;
    try {
      collectJobPostings(JSON.parse(raw), result, seen);
    } catch {
      // A malformed JSON-LD block is isolated; other blocks on the same page remain usable.
    }
  });
  return result;
}

function organizationName(value: unknown): string | null {
  const item = asArray(value)[0];
  return item && typeof item === "object" ? text((item as JsonObject).name) : text(item);
}

function locationRecord(value: unknown): string | null {
  const locations = asArray(value).map((item) => {
    if (!item || typeof item !== "object") return text(item);
    const object = item as JsonObject;
    const addressItem = asArray(object.address)[0];
    const address = addressItem && typeof addressItem === "object" ? addressItem as JsonObject : {};
    const parts = [text(object.name), text(address.addressLocality), text(address.addressRegion), text(address.addressCountry)].filter(Boolean);
    return [...new Set(parts)].join(", ") || null;
  }).filter((location): location is string => Boolean(location));
  return [...new Set(locations)].join("; ") || null;
}

export type JsonLdSourceConfig = {
  companyName: string;
  sourceUrl: string;
  allowedDomains: string[];
};

function allowedPageUrl(value: string | null, fallback: string, domains: string[]): string | null {
  const url = normalizeJobUrl(value ?? fallback, fallback);
  if (!url) return null;
  const host = new URL(url).hostname.toLowerCase();
  return domains.some((domain) => host === domain || host.endsWith("." + domain)) ? url : null;
}

export function mapJsonLdJobPosting(job: JsonObject, config: JsonLdSourceConfig): NormalizedJob | null {
  const title = text(job.title);
  const description = plainText(text(job.description));
  if (!title) return null;
  const role = classifyDesignRole(title, description);
  if (!role.categories.length || role.confidence === "low") return null;
  const sourceUrl = allowedPageUrl(text(job.url), config.sourceUrl, config.allowedDomains);
  if (!sourceUrl) return null;

  const locationText = locationRecord(job.jobLocation)
    ?? locationRecord(job.applicantLocationRequirements)
    ?? (String(job.jobLocationType ?? "").toUpperCase() === "TELECOMMUTE" ? "Remote — Indonesia" : null);
  if (!isIndonesiaOpportunity(locationText)) return null;

  const identifierValue = job.identifier && typeof job.identifier === "object"
    ? text((job.identifier as JsonObject).value) ?? text((job.identifier as JsonObject).name)
    : text(job.identifier);
  const employmentType = asArray(job.employmentType).map(text).filter(Boolean).join(", ") || null;
  const department = text(job.department)
    ?? text(job.employmentUnit && typeof job.employmentUnit === "object" ? (job.employmentUnit as JsonObject).name : null)
    ?? text(job.occupationalCategory);
  const companyName = organizationName(job.hiringOrganization) ?? config.companyName;
  const canonicalUrl = normalizeJobUrl(sourceUrl);

  return {
    externalId: identifierValue ?? canonicalUrl ?? sourceUrl,
    title,
    normalizedTitle: normalizeText(title),
    companyName,
    normalizedCompanyName: normalizeCompanyName(companyName),
    sourceUrl,
    canonicalUrl,
    applicationUrl: sourceUrl,
    description,
    department,
    locationText,
    countryCode: "ID",
    employmentType,
    workArrangement: String(job.jobLocationType ?? "").toUpperCase() === "TELECOMMUTE" ? "remote" : normalizeWorkArrangement(locationText),
    salaryMinimum: null,
    salaryMaximum: null,
    salaryCurrency: null,
    salaryInterval: null,
    experienceLevel: null,
    originalPostedAt: parseDate(text(job.datePosted)),
    expiresAt: parseDate(text(job.validThrough)),
    sourceUpdatedAt: null,
    categories: role.categories,
  };
}

export function parseJsonLdJobs(html: string, config: JsonLdSourceConfig): { fetchedCount: number; jobs: NormalizedJob[] } {
  const postings = extractJsonLdJobPostings(html);
  return {
    fetchedCount: postings.length,
    jobs: postings.map((posting) => mapJsonLdJobPosting(posting, config)).filter((job): job is NormalizedJob => Boolean(job)),
  };
}
