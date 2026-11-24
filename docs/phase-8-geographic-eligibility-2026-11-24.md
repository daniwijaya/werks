# WERKS Phase 8 — Geographic Eligibility and Remote OK Preparation

Review date: 2026-11-24<br>
Reviewer: WERKS technical review (AI-assisted)

## Geographic classification

The Remote OK connector uses only its approved feed fields. It preserves `locationText` exactly as supplied and classifies geography as follows:

- Explicit Indonesia location: eligible; `countryCode` is set to `ID` before the source allowlist is applied.
- `Worldwide` / `Global` without a conflicting restriction in the feed location: eligible as `inferred_worldwide`, not confirmed by the employer.
- `Southeast Asia` / `ASEAN` without a conflicting restriction: eligible as `inferred_southeast_asia`, not confirmed by the employer.
- Generic `Remote`, APAC/Asia, missing location, and ambiguous or conflicting scope: manual review.
- Explicit Indonesia exclusions or clearly limited non-Indonesia country/region labels: ineligible.

The original location label remains unchanged. Inferred geographic eligibility does not claim that an employer confirmed Indonesia eligibility. Full descriptions, tags, logos, and other fields outside the Remote OK allowlist are not fetched or used for classification.

## Neon migration and source registry

- Target verified: database `neondb`, Neon project endpoint `ep-jolly-fog-bixnl2o7` in AWS Asia Pacific 1 (Singapore), matching the WERKS project previously selected.
- Before migration, migrations `0000`–`0005` were present with hashes matching local files. Only `0006_remoteok_source_type` was pending.
- Migration `0006` is additive and idempotent: `ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'remoteok'`. `npm run db:migrate` succeeded; the Neon migration ledger now contains seven migrations and the `remoteok` enum value.
- The revised seed inserts other source candidates only when missing. It refreshes only Remote OK, setting it approved and inactive; it does not overwrite existing Jobicy or ATS assessments/activation states.
- Registry after seed: 12 sources; Jobicy remains approved/active; Remote OK is approved/inactive with attribution required, six-hour polling, and the existing field allowlist; 10 ATS sources remain review-required/inactive. No source was activated.
- Neon currently contains zero job rows. The dry-run made no job writes.

## Latest Remote OK dry-run

Endpoint: `https://remoteok.com/api`<br>
Mode: read-only; `databaseWritePerformed: false`; source inactive.

- Fetched: 100 listings.
- Design-title matches: 4.
- Explicit Indonesia eligible: 0.
- Inferred Worldwide eligible: 1.
- Inferred Southeast Asia eligible: 0.
- Eligible after feed-only classification: 1.
- Manual-review design jobs: 0.
- Feed duplicates / database duplicates: 0 / 0.
- Eligible insert / update candidates: 1 / 0.
- Original Remote OK listing URLs: 100 syntactically valid and on the expected host/path. No original listing pages were fetched by the dry-run.
- Application URLs: 100 syntactically valid. For the candidate below, Remote OK's feed application URL resolves to the Remote OK listing itself, so the employer application destination is not established by the feed.
- Remaining listings were rejected by existing title and geographic rules; rejection reason counts overlap: 96 non-design titles, 90 outside Indonesia scope, 3 ambiguous geography.

## Carrot — Manager, Product Design

Remote OK's latest feed still contains **Manager, Product Design — Carrot**, labelled `Worldwide`, at <https://remoteok.com/remote-jobs/remote-manager-product-design-carrot-1137927>. The feed-only classification is `inferred_worldwide`, so it is an algorithmic candidate, not a confirmed Indonesia-eligible role.

The Remote OK listing page returned HTTP 403 when opened directly; this is recorded as unverified accessibility, not as an invalid or expired listing. The feed URL is well-formed and the job remains present in the latest API response.

An accessible official Carrot Greenhouse application page exists at <https://job-boards.greenhouse.io/carrotfertility/jobs/6265128004>. It shows the matching role as `Remote` and includes a question asking whether the applicant is authorized to work in the United States. The page does not say in the reviewed content that US authorization is mandatory, so this is an unresolved geographic signal rather than proof that Indonesian applicants are excluded. Because the Remote OK feed itself does not provide the employer's eligibility conditions, keep this specific listing for manual review before any synchronization or public display. Do not substitute the Greenhouse URL as the Remote OK feed's application URL without a separately reviewed source and field policy.

Remote OK's aggregator terms remain documented at <https://remoteok.com/faq> and <https://remoteok.com/api>; attribution remains `Source: Remote OK`, with a followed source backlink and a link to the original Remote OK job.

## Tests and checks

- `npm run test:aggregation`: 56 passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npx drizzle-kit check`: passed (`Everything's fine`).
- `npm run build`: passed.
- `npm run db:migrate`: passed.
- `npm run db:seed`: passed; existing unrelated statuses preserved.
- `npm run dry-run:remoteok`: passed in read-only mode.

Node emits a non-blocking `MODULE_TYPELESS_PACKAGE_JSON` warning for the repository's TypeScript scripts/tests. It did not affect checks or build.

## Readiness decision

The migration, registry entry, connector rules, and dry-run are ready for review. Remote OK must remain inactive. The Carrot role needs employer clarification about whether Indonesian residents may apply; it should not be synchronized based solely on `Worldwide`. A future activation still requires a separate explicit decision after candidate-level review.
