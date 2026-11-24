# WERKS career page aggregation

## Architecture

All source collection runs on the server. Source connectors normalize into `NormalizedJob`, apply design and Indonesia filters, and persist through one shared upsert/deduplication path. Source records retain their own source and application URLs, so the same vacancy can be represented by multiple sources without losing attribution.

Supported methods:

1. ATS public APIs (Greenhouse, Lever, Ashby) when the board endpoint is verified and use/redistribution terms are reviewed.
2. RSS or Atom feeds.
3. XML sitemaps that point to job detail pages containing Schema.org `JobPosting` JSON-LD.
4. Direct JSON-LD parsing on a registered careers/job page.
5. HTML card parsing only as an explicitly configured fallback. Selectors must be configured for the specific source; the system does not crawl arbitrary pages looking for jobs.

Each source must be registered with an official careers URL, actual endpoint, company domain, allowed domains, ATS/method metadata, compliance status/evidence, polling interval, request budget, and any parser configuration. ATS board identifiers are optional for sources that do not use an ATS board. A source is eligible for automatic collection only when `is_active=true` and `compliance_status='approved'`. No new career page sources are activated by this phase.

Robots rules are checked before feeds, sitemap and job detail requests. Requests use a WERKS user agent, bounded retries/timeouts, conditional ETag/Last-Modified requests, request budgets, and per-source delays. Redirects are followed only when the destination stays in the source's registered domain allowlist. Robots rules are a crawler protocol, not proof of permission to republish. HTML fallback does not bypass authentication, CAPTCHA, consent walls, or other access controls.

## Database changes

The migration is additive. It adds career source types and source configuration fields to `job_sources`: company domain, ATS and aggregation method, domain allowlist, parser settings, HTTP validators, request budget, minimum request interval, and last sync status. It adds canonical URL, department, expiry/verification timestamps, and consecutive missing-snapshot count to `jobs`, plus a canonical URL index. Existing jobs, sources, and UI-facing demo data are preserved.

Missing jobs are marked closed only after three consecutive misses from a complete snapshot. Partial runs, failed runs, incomplete sitemaps, and HTTP 304 responses never count as missing snapshots. This is opt-in per source via `parser_config.completeSnapshot=true`; it should only be enabled when that feed is a full authoritative listing.

## Configuration and commands

Only `DATABASE_URL` is needed for current server-side aggregation. Keep it in local `.env.local` and in deployment/CI secret settings; never add it to client-prefixed variables. Use Neon pooled URL for application connections; migrations may use the direct URL if required by the provider. There are no Supabase dependencies.

```sh
npm install
npm run db:migrate
npm run db:seed
npm run typecheck
npm run test:aggregation
npm run sync:career-pages
```

`db:seed` registers candidates and their initial compliance assessment. Before activating a source, record its official careers URL, observed ATS and public endpoint, applicable API/website terms, robots evidence, attribution requirements, allowed domains, review date and reviewer. Do not infer redistribution rights from public accessibility or robots.txt alone.

GitHub Actions runs approved-source syncs on the existing six-hour schedule. The per-source `polling_interval_hours` remains the effective lower bound; set it according to that source's stated limits. Failures are logged per source and do not remove existing jobs. For operational status, inspect `sync_runs`, `job_sources.last_sync_status`, `last_successful_sync_at`, and `last_error`.

## Cost and feasibility estimate

The pipeline needs no paid aggregation service. A small initial workload can run through the current Neon database and GitHub Actions setup with no incremental hosting cost while it stays within plan limits. Neon currently describes the Free plan as including up to 100 CU-hours and 1 GB of PostgreSQL storage per project ([Neon plan update](https://neon.com/blog/10x-projects-on-free-plan)). GitHub Free currently includes 2,000 Actions minutes monthly for private repositories, while standard runners are free for public repositories ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). Measure actual monthly runtime and database use before adding sources.

Vercel is only serving the web app here; scheduled aggregation remains in GitHub Actions. Vercel's Hobby plan is restricted to personal, non-commercial use, so confirm the account is eligible before relying on it for WERKS ([Vercel plans](https://vercel.com/pricing)). If the workload exceeds Neon or Actions allowances, the expected additional cost depends on actual database compute/storage and runner minutes; there is no fixed paid-service requirement in this design.

| Collection method | Feasibility | Recommendation |
| --- | --- | --- |
| Official ATS API | High for discovery; usage/redistribution terms vary | Prefer where the board endpoint is confirmed and compliance status is approved. |
| RSS / Atom | High and light on requests | Preferred when the company publishes an official feed and its terms permit use. |
| Sitemap + JSON-LD | Medium-high when pages publish `JobPosting` structured data | Use with robots checks, low request rate, and explicit domain allowlists. |
| Direct JSON-LD page | Medium; depends on each page's markup | Good fallback if a known career page has structured postings. |
| HTML selectors | Low-medium; page markup can change | Last resort; configure narrowly per site and re-verify after layout changes. |

ATS APIs and public pages simplify discovery; none of them automatically grants permission to republish. Verify source-specific terms/attribution with each company or provider before turning a source on. Greenhouse's [Job Board API](https://docs.greenhouse.io/job-board) is documented for employer job boards; Lever's [Postings API](https://github.com/Lever/postings-api) exposes published posting data; Ashby's [Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api) exposes company-board jobs. Those technical capabilities should not be interpreted as an external redistribution license.

## Current limitations

- ATS coverage is not broadened automatically; Lever and Ashby connectors still need their separately reviewed implementation and verified boards.
- Sitemap discovery finds likely job pages by a configurable path pattern, then accepts only valid JSON-LD `JobPosting` pages. It does not treat every sitemap URL as a job.
- Generic HTML parsing requires source-specific CSS selectors and is deliberately a last resort.
- Salary and experience remain null unless a source supplies them in a supported structured field.
- This software gate is not a legal determination. Public visibility, robots permission, and an API endpoint do not by themselves establish permission to republish a listing or its full description.
