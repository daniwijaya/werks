import Image from "next/image";
import { BriefcaseBusiness, Clock3, LayoutGrid, MapPin, Search } from "lucide-react";
import { jobs } from "@/data/jobs";
import { indonesiaCities } from "@/data/indonesia-cities";
import { filterJobs } from "@/lib/filter-jobs";
import { JobCard } from "@/components/job-card";
import { DropdownSelect } from "@/components/dropdown-select";

const disciplines = ["Product Design", "UI/UX Design", "UX Research", "UX Writing", "Graphic Design", "Brand Design", "Motion Design", "Illustration", "Industrial Design", "Others"];
const workModes = ["Remote", "Hybrid", "On-site"];
const employmentTypes = ["Full-time", "Part-time", "Contract", "Freelance"];

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const filters = {
    q: value("q"),
    location: value("location"),
    discipline: value("discipline"),
    mode: value("mode"),
    type: value("type"),
  };
  const found = filterJobs(jobs, filters);

  return (
    <section className="listing-page wrap">
      <div className="page-heading">
        <p className="eyebrow">THE GOOD STUFF, IN ONE PLACE</p>
        <h1>Don&apos;t Stop<br /><span>Designing.</span></h1>
        <p className="section-sub">Discover design opportunities that keep your creativity moving.</p>
      </div>
      <form key={JSON.stringify(filters)} action="/jobs" className="search-panel jobs-search-panel">
        <label className="keyword-field">
          <Search size={20} />
          <input aria-label="Job title, company, or keyword" name="q" defaultValue={filters.q} placeholder="Search for job title, company, or keyword..." />
        </label>
        <div className="select-field">
          <LayoutGrid size={19} />
          <DropdownSelect name="discipline" label="Job Function" value={filters.discipline} options={[{ label: "Job Function", value: "" }, ...disciplines.map(discipline => ({ label: discipline, value: discipline }))]} />
        </div>
        <div className="select-field">
          <MapPin size={20} />
          <DropdownSelect searchable name="location" label="Location" value={filters.location} options={[{ label: "Location", value: "" }, ...indonesiaCities.map(city => ({ label: city, value: city }))]} />
        </div>
        <div className="select-field">
          <BriefcaseBusiness size={19} />
          <DropdownSelect name="mode" label="Work Setting" value={filters.mode} options={[{ label: "Work Setting", value: "" }, ...workModes.map(mode => ({ label: mode, value: mode }))]} />
        </div>
        <div className="select-field">
          <Clock3 size={19} />
          <DropdownSelect name="type" label="Job Type" value={filters.type} options={[{ label: "Job Type", value: "" }, ...employmentTypes.map(type => ({ label: type, value: type }))]} />
        </div>
        <button className="button-primary" type="submit">Search</button>
      </form>
      <div className="results-head">
        <span><strong>{found.length}</strong> {found.length === 1 ? "opportunity" : "opportunities"}</span>
        <a href="/jobs">Clear filters <span aria-hidden>↗</span></a>
      </div>
      {found.length ? (
        <div className="job-grid">{found.map(job => <JobCard key={job.id} job={job} />)}</div>
      ) : (
        <div className="empty-state">
          <Image
            src="/images/werk-empty-jobs.png"
            alt=""
            width={1317}
            height={1317}
            sizes="(max-width: 700px) 70vw, 240px"
          />
          <h2>No jobs found.</h2>
          <p>Try adjusting your search or filters to find the right opportunity.</p>
          <a href="/jobs" className="load-more-button">Clear all filters</a>
        </div>
      )}
    </section>
  );
}
