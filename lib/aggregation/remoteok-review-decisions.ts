/** Reviewed job-level hold that must accompany the additive Phase 9 migration. */
export const preparedRemoteOkReviewDecisions = [
  {
    externalJobId: "1137927",
    decision: "manual_review" as const,
    reason: "Conflicting geographic eligibility signals: the Remote OK feed labels the role Worldwide while the employer application indicates a U.S. work-authorization requirement. Confirm Indonesia-based applicant eligibility before publication.",
    locationFingerprint: "7aca9b2c4a361291b651be6400620a2dddb3443e339d4af38f5c8550ba2c61fb",
    reviewedBy: "WERKS technical review",
  },
];
