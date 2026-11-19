"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { JobCard } from "@/components/job-card";
import type { Job } from "@/types/job";

const categories = ["All", "Product Design", "UI/UX Design", "UX Research", "Graphic Design", "Motion Design", "Illustration", "Others"];
export function HomeJobFeed({ jobs }: { jobs: Job[] }) {
  const [active, setActive] = useState("All");
  const [visibleCount, setVisibleCount] = useState(6);
  const section = useRef<HTMLElement>(null);
  const filtered = useMemo(() => active === "All" ? jobs : jobs.filter(job => job.designDisciplines.includes(active)), [active, jobs]);
  function selectCategory(category: string) {
    setActive(category);
    setVisibleCount(6);
    requestAnimationFrame(() => section.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  return <>
    <nav className="quick-categories wrap" aria-label="Filter jobs by design discipline">
      {categories.map(category => <button key={category} type="button" aria-pressed={active === category} className={`quick-chip ${active === category ? "selected" : ""}`} onClick={() => selectCategory(category)}>{category}</button>)}
    </nav>
    <section className="jobs-section homepage-listings wrap" ref={section} id="latest-jobs">
      <div className="section-head"><div><h2>{active === "All" ? "Latest Design Jobs" : `${active} Jobs`}</h2><p className="section-sub">{active === "All" ? "Explore opportunities across the design industry." : `Open opportunities in ${active}.`}</p></div></div>
      {filtered.length ? <><div className="job-grid">{filtered.slice(0, visibleCount).map(job => <JobCard key={job.id} job={job}/>)}</div>{visibleCount < filtered.length && <div className="load-more-wrap"><p>Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} demo listings</p><button type="button" className="load-more-button" onClick={() => setVisibleCount(count => count + 6)}>Load more jobs <ChevronDown size={16}/></button></div></> : <div className="empty-state"><Image src="/images/werk-empty-jobs.png" alt="" width={1317} height={1317} sizes="(max-width: 700px) 70vw, 240px"/><h2>No {active} examples yet.</h2><p>There are no demo listings in this discipline right now.</p><button type="button" className="button-secondary" onClick={() => selectCategory("All")}>Show all jobs</button></div>}
    </section>
  </>;
}
