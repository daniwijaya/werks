import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: [".env.local", ".env"] });
const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl ?? "postgres://placeholder:placeholder@localhost:5432/werks" },
  strict: true,
  verbose: true,
});
