import { load } from "cheerio";
import { classifyDesignRole, isIndonesiaOpportunity, normalizeCompanyName, normalizeJobUrl, normalizeText, normalizeWorkArrangement, parseDate } from "./normalize.ts";
import { isAllowedCompanyUrl } from "./sitemap.ts";
import type { NormalizedJob, SourceParserConfig } from "./types.ts";

function plainText(value: string | null | undefined): string | null {
  return value?.replace(/\s+/g, " ").trim() || null;
}

export function parseHtmlJobCards(
  html: string,
  pageUrl: string,
  config: { companyName: string; allowedDomains: string[]; parserConfig: SourceParserConfig },
): { fetchedCount: number; jobs: NormalizedJob[] } {
  const { parserConfig } = config;
  if (!parserConfig.jobCardSelector || !parserConfig.titleSelector || !parserConfig.linkSelector) {
    throw new Error("HTML source requires jobCardSelector, titleSelector, and linkSelector configuration.");
  }
  if (!isAllowedCompanyUrl(pageUrl, config.allowedDomains)) throw new Error("HTML page URL is outside registered allowed domains.");
  const $ = load(html);
  const cards = $(parserConfig.jobCardSelector).toArray();
  const jobs: NormalizedJob[] = [];

  for (const card of cards) {
    const element = $(card);
    const title = plainText(element.find(parserConfig.titleSelector).first().text()) ?? plainText(element.filter(parserConfig.titleSelector).first().text());
    const linkNode = element.find(parserConfig.linkSelector).first().length ? element.find(parserConfig.linkSelector).first() : element.filter(parserConfig.linkSelector).first();
    const href = linkNode.attr("href");
    if (!title || !href) continue;
    const sourceUrl = normalizeJobUrl(href, pageUrl);
    if (!sourceUrl || !isAllowedCompanyUrl(sourceUrl, config.allowedDomains)) continue;
    const description = plainText(element.find(parserConfig.descriptionSelector ?? "").first().text());
    const classification = classifyDesignRole(title, description);
    if (!classification.categories.length || classification.confidence === "low") continue;
    const locationText = plainText(element.find(parserConfig.locationSelector ?? "").first().text());
    if (!isIndonesiaOpportunity(locationText)) continue;
    const department = plainText(element.find(parserConfig.departmentSelector ?? "").first().text());
    const employmentType = plainText(element.find(parserConfig.employmentTypeSelector ?? "").first().text());
    const publishedDate = plainText(element.find(parserConfig.datePostedSelector ?? "").first().attr("datetime"))
      ?? plainText(element.find(parserConfig.datePostedSelector ?? "").first().text());

    jobs.push({
      externalId: sourceUrl,
      title,
      normalizedTitle: normalizeText(title),
      companyName: config.companyName,
      normalizedCompanyName: normalizeCompanyName(config.companyName),
      sourceUrl,
      canonicalUrl: normalizeJobUrl(sourceUrl),
      applicationUrl: sourceUrl,
      description,
      department,
      locationText,
      countryCode: "ID",
      employmentType,
      workArrangement: normalizeWorkArrangement(locationText),
      salaryMinimum: null,
      salaryMaximum: null,
      salaryCurrency: null,
      salaryInterval: null,
      experienceLevel: null,
      originalPostedAt: parseDate(publishedDate),
      expiresAt: null,
      sourceUpdatedAt: null,
      categories: classification.categories,
    });
  }

  return { fetchedCount: cards.length, jobs };
}
