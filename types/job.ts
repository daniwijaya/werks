export type Job = {
  id: string; title: string; companyName: string; location: string; workMode?: string;
  employmentType?: string; designDisciplines: string[]; sourceName: string; sourceUrl: string;
  publishedAt?: string; lastCheckedAt?: string; description?: string; status: "demo" | "active";
};
