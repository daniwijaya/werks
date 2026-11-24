export type Job = {
  id: string; title: string; companyName: string; location: string; workMode?: string;
  employmentType?: string; designDisciplines: string[]; sourceName: string; sourceUrl: string;
  applicationUrl?: string | null; attributionRequired?: boolean; attributionText?: string | null;
  publishedAt?: string; lastCheckedAt?: string; description?: string; status: "demo" | "active";
};
