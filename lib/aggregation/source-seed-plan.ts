export type SeedConflictMode = "insert_only" | "refresh_remoteok";

/** Keep routine seed runs from replacing unrelated compliance reviews or activation decisions. */
export function sourceSeedConflictMode(sourceType: string): SeedConflictMode {
  return sourceType === "remoteok" ? "refresh_remoteok" : "insert_only";
}
