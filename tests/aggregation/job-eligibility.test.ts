import assert from "node:assert/strict";
import test from "node:test";
import { locationFingerprint, resolveJobEligibilityDecision } from "../../lib/aggregation/job-eligibility.ts";

const stored = {
  externalJobId: "1137927",
  decision: "excluded" as const,
  reason: "Explicit manual exclusion",
  locationFingerprint: locationFingerprint("Worldwide"),
  reviewedAt: new Date("2026-11-24T00:00:00.000Z"),
  reviewedBy: "WERKS reviewer",
};

test("job-level decisions persist when the permitted location is unchanged", () => {
  assert.deepEqual(resolveJobEligibilityDecision(stored, " worldwide "), { decision: "excluded", stale: false });
  assert.deepEqual(resolveJobEligibilityDecision({ ...stored, decision: "manual_review" }, "Worldwide"), { decision: "manual_review", stale: false });
});

test("material location changes invalidate a prior decision into manual review", () => {
  assert.deepEqual(resolveJobEligibilityDecision(stored, "Worldwide except Indonesia"), { decision: "manual_review", stale: true });
  assert.deepEqual(resolveJobEligibilityDecision({ ...stored, decision: "eligible" }, "Indonesia"), { decision: "manual_review", stale: true });
});

test("location fingerprint is stable to harmless case and spacing changes", () => {
  assert.equal(locationFingerprint("Remote   — Worldwide"), locationFingerprint("remote — worldwide"));
});
