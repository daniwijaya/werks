import dotenv from "dotenv";
import { getDatabase } from "../db/client.ts";
import { syncApprovedGreenhouseSources } from "../lib/aggregation/sync-greenhouse.ts";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const { client } = getDatabase();
  try {
    const results = await syncApprovedGreenhouseSources();
    if (!results.length) {
      console.log("No active, compliance-approved Greenhouse sources. No jobs were changed.");
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
