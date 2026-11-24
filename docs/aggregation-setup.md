# Aggregation database setup

## Neon

1. Create a Neon PostgreSQL project on the Free plan.
2. Copy the pooled connection string from Neon and set it as `DATABASE_URL` in local `.env.local` and GitHub Actions repository secrets. Keep `sslmode=require` in the connection string.
3. If you use a pooled URL for the application/worker, also copy Neon’s direct connection string to `DIRECT_URL` for schema migrations.
4. Never prefix either variable with `NEXT_PUBLIC_`; the DB client is server-only. `.env*` is ignored by git; `.env.example` contains placeholders only.
5. Run `npm run db:generate`, then `npm run db:migrate`, and `npm run db:seed`.

## Commands

- `npm run db:generate` creates a migration from `db/schema.ts`.
- `npm run db:migrate` applies checked-in migrations.
- `npm run db:seed` adds the reviewed candidate registry and fills the initial source-level compliance evidence. Company ATS candidates stay inactive with `review_required`; Jobicy is active because its official API policy expressly permits use in job-discovery products with attribution.
- `npm run smoke:greenhouse` makes one read-only request to the Xendit public Greenhouse board, classifies in memory, and prints `stored: false`.
- `npm run smoke:jobicy` checks Jobicy listings in memory and prints `stored: false`; only listings explicitly eligible in Indonesia are accepted.
- `npm run sync:greenhouse` syncs only sources with both `is_active=true` and `compliance_status='approved'`.
- `npm run sync:jobicy` syncs the approved Jobicy public API, honors its one-request-per-second rate limit, and checks stored listings through the batch status endpoint.
- `npm run test:aggregation` runs connector and normalization tests.

## GitHub Actions

Add the Neon pooled connection string as repository secret `DATABASE_URL`. The workflow can then run against the same PostgreSQL database. Do not put the value in workflow YAML or commit a populated `.env.local`.

## Source enablement

## Source compliance and activation

Evaluate each source independently and record its assessment in `job_sources`: `compliance_status`, primary `evidence_url` plus supplementary `compliance_evidence_urls`, `review_notes`, `reviewed_at`, `reviewed_by`, `redistribution_allowed`, `attribution_required`, `allowed_fields`, `usage_restrictions`, and the source's `attribution_text`.

- `approved`: an official API/feed license or applicable terms permit the intended WERKS access and display/use, and attribution/rate-limit requirements are recorded.
- `review_required`: the source is accessible but the terms or republication scope are unclear. Keep inactive until the ambiguity is reviewed.
- `blocked`: the source explicitly prohibits the intended automated collection or republication without required authorization. Do not synchronize it unless authorization changes the assessment.

Public access and robots.txt are evidence about access/crawler rules; neither alone grants permission to republish. Written permission is not required when applicable source terms or an API/feed license already permit WERKS's intended use. Activation requires `approved`, explicit redistribution permission, reviewed evidence, attribution assessment, and the required core fields (`title`, `companyName`, `sourceUrl`) in `allowed_fields`. The sync and persistence layers both enforce eligibility, and persistence clears any normalized job fields absent from the source's allowlist. This records source attribution requirements and text; frontend changes are outside this implementation.

A failed sync never deletes jobs; unseen jobs remain stored until a separate, successful status-validation process establishes that they have closed.
