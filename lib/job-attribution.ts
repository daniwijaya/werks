export type JobAttributionInput = {
  sourceName: string;
  sourceUrl: string;
  applicationUrl?: string | null;
  attributionRequired?: boolean;
  attributionText?: string | null;
};

export type JobSourcePresentation = {
  attributionText: string | null;
  listingLink: { href: string; label: string };
  applicationLink: { href: string; label: string } | null;
};

/** Build the source and outbound-link content shown by a job card. */
export function getJobSourcePresentation(job: JobAttributionInput): JobSourcePresentation {
  const hasSeparateApplicationUrl = Boolean(job.applicationUrl && job.applicationUrl !== job.sourceUrl);

  return {
    attributionText: job.attributionRequired
      ? job.attributionText?.trim() || `Source: ${job.sourceName}`
      : null,
    listingLink: {
      href: job.sourceUrl,
      label: hasSeparateApplicationUrl || !job.applicationUrl
        ? `View original listing on ${job.sourceName}`
        : `View listing and apply on ${job.sourceName}`,
    },
    applicationLink: hasSeparateApplicationUrl
      ? { href: job.applicationUrl!, label: "Apply for this job" }
      : null,
  };
}
