import type { Job } from "@/types/job";
export type JobFilters = { q?: string; location?: string; discipline?: string; mode?: string; type?: string; sort?: string };

export const primaryDisciplines = ["Product Design", "UI/UX Design", "UX Research", "Graphic Design", "Motion Design", "Illustration"];

export function matchesDiscipline(job: Job, discipline: string, namedDisciplines = primaryDisciplines) {
  return discipline === "Others"
    ? job.designDisciplines.some(category => !namedDisciplines.includes(category))
    : job.designDisciplines.includes(discipline);
}

const normalizeOption = (value?: string) => value?.trim().toLowerCase().replace(/[\s_-]+/g, "");

export function filterJobs(all: Job[], filters: JobFilters) {
  const q = filters.q?.trim().toLowerCase();
  const location = filters.location?.trim().toLowerCase();
  return all.filter(job =>
    (!q || `${job.title} ${job.companyName} ${job.designDisciplines.join(" ")}`.toLowerCase().includes(q))
    && (!location || job.location.toLowerCase().includes(location))
    && (!filters.discipline || matchesDiscipline(job, filters.discipline, [...primaryDisciplines, "UX Writing", "Brand Design", "Industrial Design"]))
    && (!filters.mode || normalizeOption(job.workMode) === normalizeOption(filters.mode))
    && (!filters.type || normalizeOption(job.employmentType) === normalizeOption(filters.type)));
}
