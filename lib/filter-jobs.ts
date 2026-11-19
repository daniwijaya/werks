import type { Job } from "@/types/job";
export type JobFilters = { q?: string; location?: string; discipline?: string; mode?: string; type?: string; sort?: string };
export function filterJobs(all: Job[], filters: JobFilters) {
  const q = filters.q?.trim().toLowerCase(); const location = filters.location?.trim().toLowerCase();
  return all.filter(job => (!q || `${job.title} ${job.companyName} ${job.designDisciplines.join(" ")}`.toLowerCase().includes(q)) && (!location || job.location.toLowerCase().includes(location)) && (!filters.discipline || job.designDisciplines.includes(filters.discipline)) && (!filters.mode || job.workMode === filters.mode) && (!filters.type || job.employmentType === filters.type));
}
