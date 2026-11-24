import dotenv from "dotenv";
import { getDatabase } from "../db/client.ts";
import { syncApprovedRemoteOkSources } from "../lib/aggregation/sync-remoteok.ts";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const { client } = getDatabase();
  try {
    const results = await syncApprovedRemoteOkSources();
    if (!results.length) {
      console.log("No active, compliant Remote OK source is registered. No jobs were changed.");
      return;
    }
    for (const result of results) {
      console.log(JSON.stringify(result));
      if (result.outcome === "failed") process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
