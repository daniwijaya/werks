import dotenv from "dotenv";
import { getDatabase } from "../db/client.ts";
import { syncApprovedJobicySources } from "../lib/aggregation/sync-jobicy.ts";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const { client } = getDatabase();
  try {
    const results = await syncApprovedJobicySources({ dryRun: process.argv.includes("--dry-run") });
    if (!results.length) {
      console.log("No eligible, compliance-approved Jobicy sources. No jobs were changed.");
      return;
    }
    for (const result of results) {
      console.log(JSON.stringify(result));
      if (result.error) process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
