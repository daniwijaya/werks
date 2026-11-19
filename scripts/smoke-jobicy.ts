import { fetchJobicyJobs } from "../lib/aggregation/jobicy.ts";

try {
  const result = await fetchJobicyJobs();
  console.log(JSON.stringify({
    endpoint: result.endpointUrl,
    fetched: result.fetchedCount,
    indonesiaDesignMatches: result.jobs.length,
    matches: result.jobs.map(({ title, companyName, locationText, sourceUrl }) => ({ title, companyName, locationText, sourceUrl })),
    stored: false,
    attribution: "Source: Jobicy",
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
