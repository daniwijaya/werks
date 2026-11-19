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

export function normalizeText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function classifyDesignCategories(value: string): DesignCategory[] {
  const text = normalizeText(value);
  return categoryMatchers.filter(([, matcher]) => matcher.test(text)).map(([category]) => category);
}

export function isIndonesiaOpportunity(location: string | null | undefined): boolean {
  if (!location) return false;
  return /\b(indonesia|jakarta|bandung|surabaya|yogyakarta|denpasar|bali|medan|semarang|makassar|remote\s*(?:[-,]|from|in|within)\s*indonesia)\b/i.test(location);
}

export function normalizeWorkArrangement(location: string | null | undefined): WorkArrangement | null {
  if (!location) return null;
  if (/\bremote\b/i.test(location)) return "remote";
  if (/\bhybrid\b/i.test(location)) return "hybrid";
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
