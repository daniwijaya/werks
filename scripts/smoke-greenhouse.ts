import { fetchGreenhouseJobs } from "../lib/aggregation/greenhouse.ts";

const boardIdentifier = process.env.GREENHOUSE_TEST_BOARD ?? "xendit";
const companyName = process.env.GREENHOUSE_TEST_COMPANY ?? (boardIdentifier === "xendit" ? "Xendit" : boardIdentifier);

try {
  const result = await fetchGreenhouseJobs({ boardIdentifier, companyName });
  console.log(JSON.stringify({
    endpoint: result.endpointUrl,
    fetched: result.fetchedCount,
    designIndonesiaMatches: result.jobs.length,
    matches: result.jobs.map(({ title, locationText, sourceUrl }) => ({ title, locationText, sourceUrl })),
    stored: false,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
