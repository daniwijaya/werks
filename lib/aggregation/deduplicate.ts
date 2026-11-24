import { normalizeJobUrl, normalizeText } from "./normalize.ts";

export type DuplicateCandidate = {
  sourceId?: string | null;
  externalId?: string | null;
  canonicalUrl?: string | null;
  sourceUrl?: string | null;
  normalizedCompanyName?: string | null;
  normalizedTitle?: string | null;
  locationText?: string | null;
};

/** Returns the highest-confidence matching candidate, independent of DB row order. */
export function findDuplicateCandidate<T extends DuplicateCandidate>(
  incoming: DuplicateCandidate,
  candidates: T[],
  sourceId?: string,
): T | undefined {
  const incomingCanonical = normalizeJobUrl(incoming.canonicalUrl ?? incoming.sourceUrl ?? "");
  const incomingSource = normalizeJobUrl(incoming.sourceUrl ?? "");
  const incomingCompany = incoming.normalizedCompanyName ?? "";
  const incomingTitle = incoming.normalizedTitle ?? "";
  const incomingLocation = incoming.locationText ? normalizeText(incoming.locationText) : "";
  const scored = candidates.flatMap((candidate, index) => {
    if (sourceId && candidate.sourceId === sourceId) return [];
    let priority = Number.MAX_SAFE_INTEGER;
    if (incomingCanonical && normalizeJobUrl(candidate.canonicalUrl ?? "") === incomingCanonical) priority = 1;
    else if (incomingSource && normalizeJobUrl(candidate.sourceUrl ?? "") === incomingSource) priority = 2;
    else if (incoming.externalId && candidate.externalId === incoming.externalId
      && incomingCompany && candidate.normalizedCompanyName === incomingCompany) priority = 3;
    else if (incomingCompany && candidate.normalizedCompanyName === incomingCompany
      && incomingTitle && candidate.normalizedTitle === incomingTitle
      && incomingLocation && candidate.locationText
      && normalizeText(candidate.locationText) === incomingLocation) priority = 4;
    return priority < Number.MAX_SAFE_INTEGER ? [{ candidate, priority, index }] : [];
  });
  scored.sort((left, right) => left.priority - right.priority || left.index - right.index);
  return scored[0]?.candidate;
}

export function shouldCloseAfterMissing(completeSnapshot: boolean, consecutiveMisses: number): boolean {
  return completeSnapshot && consecutiveMisses >= 3;
}
