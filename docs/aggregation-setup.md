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
- `npm run db:seed` adds the reviewed candidate registry. Company ATS candidates stay inactive and permission-pending; Jobicy is active because its API terms explicitly permit aggregator use with attribution.
- `npm run smoke:greenhouse` makes one read-only request to the Xendit public Greenhouse board, classifies in memory, and prints `stored: false`.
- `npm run smoke:jobicy` checks Jobicy listings in memory and prints `stored: false`; only listings explicitly eligible in Indonesia are accepted.
- `npm run sync:greenhouse` syncs only sources with both `is_active=true` and `permission_status='approved'`.
- `npm run sync:jobicy` syncs the approved Jobicy public API, honors its one-request-per-second rate limit, and checks stored listings through the batch status endpoint.
- `npm run test:aggregation` runs connector and normalization tests.

## GitHub Actions

Add the Neon pooled connection string as repository secret `DATABASE_URL`. The workflow can then run against the same PostgreSQL database. Do not put the value in workflow YAML or commit a populated `.env.local`.

## Source enablement

Do not activate a source just because a request returns JSON. Confirm source-level reuse terms or written authorization, determine any attribution requirements, record that evidence in the registry, then set permission status to approved and activate the source. A failed sync never deletes jobs; unseen jobs remain stored until a separate, successful status-validation process establishes that they have closed.
