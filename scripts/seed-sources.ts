import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { getDatabase } from "../db/client.ts";
import { jobSources } from "../db/schema.ts";
import { sourceSeed } from "../lib/aggregation/source-seed.ts";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const { db, client } = getDatabase();
  try {
    for (const source of sourceSeed) {
      await db.insert(jobSources).values(source).onConflictDoUpdate({
        target: [jobSources.sourceType, jobSources.boardIdentifier],
        set: {
          sourceName: source.sourceName,
          companyName: source.companyName,
          careersUrl: source.careersUrl,
          endpointUrl: source.endpointUrl,
          termsUrl: source.termsUrl,
          permissionNotes: source.permissionNotes,
          updatedAt: new Date(),
        },
      });
    }
    const rows = await db.select({ sourceName: jobSources.sourceName, isActive: jobSources.isActive }).from(jobSources).where(eq(jobSources.permissionStatus, "review_required"));
    console.log(`Seeded ${sourceSeed.length} verified source candidates. Review-required sources remain inactive.`);
    console.log(`Current review queue: ${rows.map(({ sourceName }) => sourceName).join(", ")}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
