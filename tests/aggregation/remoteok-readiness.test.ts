import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sourceSeed } from "../../lib/aggregation/source-seed.ts";
import { sourceSeedConflictMode } from "../../lib/aggregation/source-seed-plan.ts";
import { preparedRemoteOkReviewDecisions } from "../../lib/aggregation/remoteok-review-decisions.ts";

test("Remote OK is seeded approved but inactive while unrelated sources are insert-only", () => {
  const remoteOk = sourceSeed.find(({ sourceType }) => sourceType === "remoteok");
  assert.ok(remoteOk);
  assert.equal(remoteOk.complianceStatus, "approved");
  assert.equal(remoteOk.isActive, false);
  assert.equal(sourceSeedConflictMode("remoteok"), "refresh_remoteok");
  for (const sourceType of ["jobicy", "greenhouse", "lever", "ashby"]) {
    assert.equal(sourceSeedConflictMode(sourceType), "insert_only");
  }
});

test("Remote OK migration is additive and the migration journal includes it once", () => {
  const migration = readFileSync("drizzle/0006_remoteok_source_type.sql", "utf8").trim();
  assert.match(migration, /^ALTER TYPE "source_type" ADD VALUE IF NOT EXISTS 'remoteok';$/);
  assert.doesNotMatch(migration, /\b(?:DROP|DELETE|TRUNCATE|UPDATE|CREATE TABLE|ALTER TABLE)\b/i);
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: Array<{ tag: string }> };
  assert.equal(journal.entries.filter(({ tag }) => tag === "0006_remoteok_source_type").length, 1);
});

test("Phase 9 decision migration creates a non-destructive per-job registry and holds Carrot for review", () => {
  const migration = readFileSync("drizzle/0007_lively_hulk.sql", "utf8");
  assert.match(migration, /CREATE TABLE "job_eligibility_decisions"/);
  assert.match(migration, /UNIQUE INDEX "job_eligibility_decisions_source_external_uidx"/);
  assert.match(migration, /'1137927'[\s\S]*'manual_review'/);
  assert.match(migration, /ON CONFLICT \("source_id", "external_job_id"\) DO NOTHING/);
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
  assert.equal(preparedRemoteOkReviewDecisions[0]?.externalJobId, "1137927");
  assert.equal(preparedRemoteOkReviewDecisions[0]?.decision, "manual_review");
});
