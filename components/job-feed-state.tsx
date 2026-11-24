import Image from "next/image";
import { jobListingEmptyCopy } from "@/lib/job-listing-copy";

export function JobFeedState({ state }: { state: "loading" | "error" | "empty" }) {
  if (state === "loading") {
    return (
      <section className="jobs-section homepage-listings wrap" aria-live="polite" aria-busy="true">
        <div className="section-head"><div><h2>Latest Design Jobs</h2><p className="section-sub">Loading current opportunities…</p></div></div>
        <div className="job-feed-loading" aria-hidden="true"><span /><span /><span /></div>
      </section>
    );
  }

  return (
    <section className="jobs-section homepage-listings wrap">
      <div className="section-head"><div><h2>Latest Design Jobs</h2></div></div>
      <div className={`empty-state ${state === "error" ? "job-feed-error" : ""}`} role={state === "error" ? "alert" : undefined}>
        {state === "empty" && <Image src="/images/werk-empty-jobs.png" alt="" width={1317} height={1317} sizes="(max-width: 700px) 70vw, 240px" />}
        <h2>{state === "error" ? "Job listings are temporarily unavailable." : jobListingEmptyCopy.title}</h2>
        <p>{state === "error" ? "We couldn’t retrieve current listings. Please try again shortly." : jobListingEmptyCopy.description}</p>
      </div>
    </section>
  );
}
