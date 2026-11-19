"use client";

import Image from "next/image";
import Link from "next/link";
import { useSavedJobs } from "@/components/save-job-button";
import { jobs } from "@/data/jobs";
import { JobCard } from "@/components/job-card";

export default function SavedPage() {
  const { saved } = useSavedJobs();
  const list = jobs.filter(job => saved.includes(job.id));

  return (
    <section className="listing-page wrap">
      <div className="page-heading">
        <p className="eyebrow">YOUR PERSONAL SHORTLIST</p>
        <h1>Saved jobs<span className="accent-dot">.</span></h1>
        <p className="section-sub">Keep the possibilities you want to come back to.</p>
      </div>
      {list.length ? (
        <div className="job-grid">{list.map(job => <JobCard key={job.id} job={job} />)}</div>
      ) : (
        <div className="empty-state">
          <Image
            src="/images/werk-empty-saved-jobs.png"
            alt=""
            width={1317}
            height={1317}
            sizes="(max-width: 700px) 70vw, 240px"
          />
          <h2>Your shortlist starts here.</h2>
          <p>Save jobs that catch your eye and they’ll show up here.</p>
          <Link className="button-secondary" href="/jobs">Explore jobs</Link>
        </div>
      )}
    </section>
  );
}
