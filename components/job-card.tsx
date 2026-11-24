import { ArrowUpRight, MapPin } from "lucide-react";
import type { Job } from "@/types/job";
import { SaveJobButton } from "@/components/save-job-button";
import { getJobSourcePresentation } from "@/lib/job-attribution";

export function JobCard({ job }: { job: Job }) {
  const published = job.publishedAt
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        -Math.max(0, Math.floor((Date.now() - new Date(job.publishedAt).getTime()) / 3_600_000)),
        "hour",
      )
    : null;
  const city = job.location.replace(/,\s*Indonesia$/i, "");
  const sourcePresentation = getJobSourcePresentation(job);

  return (
    <article className="job-card">
      <div className="job-topline">
        <span className="company-mark">{job.companyName.slice(0, 1)}</span>
        <span className="source-label">{job.sourceName}</span>
        <SaveJobButton id={job.id} />
      </div>
      <p className="company-name">{job.companyName}</p>
      <h3>{job.title}</h3>
      <div className="job-meta">
        {city && <span><MapPin size={14} />{city}</span>}
        {job.workMode && <span>{job.workMode}</span>}
        {job.employmentType && <span>{job.employmentType}</span>}
      </div>
      <div className="job-bottom">
        <div className="tag-row">
          {job.designDisciplines.slice(0, 1).map(tag => <span className="tag" key={tag}>{tag}</span>)}
        </div>
        {published && <time className="published-time" dateTime={job.publishedAt} suppressHydrationWarning>{published}</time>}
      </div>
      {sourcePresentation.attributionText && (
        <p className="job-attribution">{sourcePresentation.attributionText}</p>
      )}
      <a className="source-cta" href={sourcePresentation.listingLink.href} target="_blank" rel="noopener noreferrer">
        {sourcePresentation.listingLink.label} <ArrowUpRight size={15} />
      </a>
      {sourcePresentation.applicationLink && (
        <a className="source-cta source-application-cta" href={sourcePresentation.applicationLink.href} target="_blank" rel="noopener noreferrer">
          {sourcePresentation.applicationLink.label} <ArrowUpRight size={15} />
        </a>
      )}
    </article>
  );
}
