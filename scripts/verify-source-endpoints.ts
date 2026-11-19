import { sourceSeed } from "../lib/aggregation/source-seed.ts";

type EndpointResult = { company: string; ats: string; status: number | "error"; postings: number | null; endpoint: string; error?: string };

async function verifySource(source: (typeof sourceSeed)[number]): Promise<EndpointResult> {
  try {
    const response = await fetch(source.endpointUrl, {
      headers: { accept: "application/json", "user-agent": "WERKS-Job-Aggregator/0.1" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) return { company: source.companyName, ats: source.sourceType, status: response.status, postings: null, endpoint: source.endpointUrl };
    const payload: unknown = await response.json();
    const postings = Array.isArray(payload)
      ? payload.length
      : payload && typeof payload === "object" && "jobs" in payload && Array.isArray(payload.jobs)
        ? payload.jobs.length
        : null;
    return { company: source.companyName, ats: source.sourceType, status: response.status, postings, endpoint: source.endpointUrl };
  } catch (error) {
    return { company: source.companyName, ats: source.sourceType, status: "error", postings: null, endpoint: source.endpointUrl, error: error instanceof Error ? error.message : "Unknown request error" };
  }
}

const results: EndpointResult[] = [];
for (const source of sourceSeed) results.push(await verifySource(source));
console.log(JSON.stringify({ verifiedAt: new Date().toISOString(), results }, null, 2));
if (results.some((result) => result.status !== 200 || result.postings === null)) process.exitCode = 1;
