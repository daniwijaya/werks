import { HomeJobFeed } from "@/components/home-job-feed";
import { JobFeedState } from "@/components/job-feed-state";
import { loadPublicJobs } from "@/lib/jobs/public-jobs";

export async function LiveHomeJobFeed() {
  const result = await loadPublicJobs();
  if (result.status === "error") return <JobFeedState state="error" />;
  return <HomeJobFeed jobs={result.jobs} />;
}
