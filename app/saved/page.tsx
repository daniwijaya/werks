import { loadPublicJobs } from "@/lib/jobs/public-jobs";
import { SavedJobFeed } from "@/components/saved-job-feed";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const result = await loadPublicJobs();
  if (result.status === "error") {
    return (
      <section className="listing-page wrap">
        <div className="page-heading">
          <p className="eyebrow">YOUR PERSONAL SHORTLIST</p>
          <h1>Saved jobs<span className="accent-dot">.</span></h1>
        </div>
        <div className="empty-state job-feed-error" role="alert">
          <h2>Saved jobs are temporarily unavailable.</h2>
          <p>We couldn’t retrieve current listings. Please try again shortly.</p>
        </div>
      </section>
    );
  }

  return <SavedJobFeed jobs={result.jobs} />;
}
