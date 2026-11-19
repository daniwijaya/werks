import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.ts";

type DatabaseClient = {
  client: Sql;
  db: PostgresJsDatabase<typeof schema>;
};

const globalForDatabase = globalThis as typeof globalThis & { werkDatabase?: DatabaseClient };

export function getDatabase(): DatabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("The WERKS database client is server-only and cannot run in a browser.");
  }

  if (globalForDatabase.werkDatabase) return globalForDatabase.werkDatabase;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to connect to Neon PostgreSQL.");

  const client = postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 5 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: "require",
  });
  const database = { client, db: drizzle(client, { schema }) };
  globalForDatabase.werkDatabase = database;
  return database;
}
