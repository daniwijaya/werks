import dotenv from "dotenv";
import { getDatabase } from "../db/client.ts";
import { syncApprovedCareerPageSources } from "../lib/aggregation/sync-career-pages.ts";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const { client } = getDatabase();
  try {
    const results = await syncApprovedCareerPageSources();
    if (!results.length) {
      console.log("No active, compliance-approved career-page sources are due. No jobs were changed.");
      return;
    }
    for (const result of results) {
      console.log(JSON.stringify(result));
      if (result.status === "failed" || result.status === "partial") process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
