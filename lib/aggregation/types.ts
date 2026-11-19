export const designCategories = [
  "Product Design",
  "UI/UX Design",
  "UX Research",
  "Graphic Design",
  "Visual Design",
  "Brand Design",
  "Web Design",
  "Interaction Design",
  "Motion Design",
  "Art Direction",
  "Creative Direction",
  "Design Leadership",
] as const;

export type DesignCategory = (typeof designCategories)[number];
export type WorkArrangement = "remote" | "hybrid" | "on_site";

export type NormalizedJob = {
  externalId: string;
  title: string;
  normalizedTitle: string;
  companyName: string;
  normalizedCompanyName: string;
  sourceUrl: string;
  applicationUrl: string | null;
  description: string | null;
  locationText: string | null;
  countryCode: string | null;
  employmentType: string | null;
  workArrangement: WorkArrangement | null;
  salaryMinimum: string | null;
  salaryMaximum: string | null;
  salaryCurrency: string | null;
  salaryInterval: string | null;
  experienceLevel: string | null;
  originalPostedAt: Date | null;
  sourceUpdatedAt: Date | null;
  categories: DesignCategory[];
};

export type SourceAdapter = {
  fetchJobs(): Promise<NormalizedJob[]>;
};
