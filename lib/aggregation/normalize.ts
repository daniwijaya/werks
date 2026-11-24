import { designCategories, type DesignCategory, type WorkArrangement } from "./types.ts";

const categoryMatchers: Array<[DesignCategory, RegExp]> = [
  ["Product Design", /product designer|product design/],
  ["UX Research", /ux researcher|user researcher|ux research|user research/],
  ["UI/UX Design", /ui.?ux|ux.?ui|user experience designer|ux designer|ui designer/],
  ["Graphic Design", /graphic designer|graphic design/],
  ["Visual Design", /visual designer|visual design|digital designer/],
  ["Brand Design", /brand designer|brand design/],
  ["Web Design", /web designer|web design/],
  ["Interaction Design", /interaction designer|interaction design/],
  ["Motion Design", /motion designer|motion design/],
  ["Art Direction", /art director|art direction/],
  ["Creative Direction", /creative director|creative direction/],
  ["Design Leadership", /design director|head of design|design lead|design leadership/],
];

const companySuffixes = /\b(incorporated|inc|corporation|corp|limited|ltd|llc|pte|pt|tbk|persero)\b/g;

export function normalizeText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeCompanyName(value: string): string {
  return normalizeText(value).replace(companySuffixes, " ").replace(/\s+/g, " ").trim();
}

export function normalizeJobUrl(value: string, baseUrl?: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|dclid|mc_cid|mc_eid|ref|source)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function classifyDesignCategories(value: string): DesignCategory[] {
  const text = normalizeText(value);
  return categoryMatchers.filter(([, matcher]) => matcher.test(text)).map(([category]) => category);
}

const titleMatchers: Array<[DesignCategory, RegExp]> = [
  ["Product Design", /\b(product designer|product design(?:er)?)\b/],
  ["UX Research", /\b(ux researcher|user researcher|ux research(?:er)?)\b/],
  ["UI/UX Design", /\b(ui\s*\/?\s*ux|ux\s*\/?\s*ui|ux designer|ui designer|user experience designer)\b/],
  ["Graphic Design", /\b(graphic designer|graphic design(?:er)?)\b/],
  ["Visual Design", /\b(visual designer|visual design(?:er)?)\b/],
  ["Brand Design", /\b(brand designer|brand design(?:er)?)\b/],
  ["Web Design", /\b(web designer|web design(?:er)?)\b/],
  ["Interaction Design", /\b(interaction designer|interaction design(?:er)?)\b/],
  ["Motion Design", /\b(motion designer|motion design(?:er)?)\b/],
  ["Art Direction", /\b(art director|art direction)\b/],
  ["Creative Direction", /\b(creative director|creative direction)\b/],
  ["Design Leadership", /\b(design lead|design manager|design director|head of design)\b/],
];

export type DesignClassification = {
  categories: DesignCategory[];
  confidence: "high" | "medium" | "low" | "none";
};

export function classifyDesignRole(title: string, description: string | null | undefined): DesignClassification {
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description ?? "");
  if (/\b(software|frontend|front end|backend|back end|full stack|engineer|developer|recruiter|talent acquisition)\b/.test(normalizedTitle)
    && !/\b(design engineer|creative technologist)\b/.test(normalizedTitle)) {
    return { categories: [], confidence: "none" };
  }
  const categories = titleMatchers.filter(([, matcher]) => matcher.test(normalizedTitle)).map(([category]) => category);
  if (categories.length) {
    const corroborated = /\b(design|designer|ux|ui|user experience|visual|creative)\b/.test(normalizedDescription);
    return { categories: [...new Set(categories)], confidence: corroborated || !description ? "high" : "medium" };
  }

  // Generic titles only pass when the description contains multiple specific design-role signals.
  const roleSignals = [
    /\b(ux|ui|user experience|interaction design|product design)\b/,
    /\b(wireframes?|prototyp(?:e|ing)|usability research|design systems?)\b/,
    /\b(visual design|brand identity|motion design|graphic design)\b/,
  ].filter((pattern) => pattern.test(normalizedDescription)).length;
  if (/\b(designer|design lead|design manager)\b/.test(normalizedTitle) && roleSignals >= 2) {
    const inferred = classifyDesignCategories(normalizedDescription);
    if (inferred.length) return { categories: inferred, confidence: "medium" };
  }
  if (/\b(design|creative)\b/.test(normalizedTitle) || roleSignals === 1) return { categories: [], confidence: "low" };
  return { categories: [], confidence: "none" };
}

export function isIndonesiaOpportunity(location: string | null | undefined): boolean {
  if (!location) return false;
  return /\b(indonesia|jakarta|bandung|surabaya|yogyakarta|denpasar|bali|medan|semarang|makassar|remote\s*(?:[-–—,]|from|in|within)\s*indonesia)\b/i.test(location);
}

export function normalizeWorkArrangement(location: string | null | undefined): WorkArrangement | null {
  if (!location) return null;
  if (/\bhybrid\b/i.test(location)) return "hybrid";
  if (/\bremote\b/i.test(location)) return "remote";
  if (/\bon[- ]?site\b/i.test(location)) return "on_site";
  return null;
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function validJobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function knownDesignCategories(): readonly DesignCategory[] {
  return designCategories;
}
