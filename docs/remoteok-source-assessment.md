# Remote OK Source Assessment

Review date: 2026-11-23<br>
Reviewer: WERKS technical review (AI-assisted)<br>
Registry status: `approved` for the scoped public JSON API use below<br>
Activation: `inactive` pending dry-run review and a separate activation decision

## Evidence and decision

- API and API-specific terms: <https://remoteok.com/api>. The first response item states to name Remote OK as a source, link back to Remote OK with a followed link, and not use its logo without written permission.
- Feed policy / aggregator guidance: <https://remoteok.com/faq>. The FAQ confirms free public JSON and RSS feeds and specifically asks public job aggregators to credit Remote OK and link each job to its original listing.
- General terms: <https://remoteok.com/legal> (page states it was updated October 26, 2026).
- Access guidance: <https://remoteok.com/robots.txt>. General paths are allowed with a one-second crawl delay, while specific query/AJAX paths are disallowed. robots.txt is not being used as a republication grant.

The FAQ directly addresses third-party job aggregators, and the API response includes feed-specific conditions. This supports a limited `approved` assessment, conditional on the stated attribution and link requirements. It does not grant use of Remote OK's logo. The connector therefore collects and displays only title, company name, location, work arrangement derived from the permitted location field, posting date, source listing URL, and application URL where present. Full descriptions, tags, salary, logos, and other fields are omitted or not used. If terms change or WERKS expands the displayed fields, reassess before use.

## Operational controls

- Endpoint: `https://remoteok.com/api`, one full feed request per sync, with at most two retries (three attempts total).
- Request spacing: at least one second between attempts, matching the robots crawl delay; API documentation does not publish a numeric rate limit.
- Attribution: `Source: Remote OK`, linked to Remote OK in the site source attribution, plus a link to each original Remote OK listing. The permitted HTTPS or valid `mailto:` application URL is retained separately when distinct from the listing URL.
- Geography: Only explicit Indonesia locations are eligible for automatic sync. “Worldwide” or “Anywhere” listings are held for manual review because the permitted feed fields may not reveal employer-specific country restrictions. Generic “Remote”, APAC/Asia, or missing/unclear geography is rejected as ambiguous. Explicit other-country-only listings are rejected.
- Classification: existing design category matchers are used on job titles. The classification rules are not broadened and descriptions are not retained for classification.
- Expiration: feed omissions never close records. This connector persists with an incomplete snapshot because the feed has no confirmed per-record close/status endpoint in the reviewed scope.
- Activation: connector sync requires an active source row and the existing compliance eligibility check. The seeded source remains inactive.

## Unresolved points

- The public documentation does not specify a numeric API quota beyond the crawl guidance; the connector uses conservative one-request-per-run behavior.
- Feed disappearance alone cannot safely distinguish a closed job from a transient omission; status validation would need a documented source endpoint or an additional review.
- Feed contents change; the count above is only a point-in-time result and must be recalculated on each preview.

## Controlled dry-run — 2026-11-23

The prior read-only preview fetched 100 job records. Four matched the existing design-title classifier; one was labelled “Worldwide”. Under Phase 7, that record no longer qualifies for automatic synchronization and instead requires a manual eligibility check. It is unverified whether the employer accepts applicants in Indonesia. The Remote OK source remains inactive, and no production database writes have been performed.

## Phase 7 readiness review — 2026-11-23

- Migration `0006_remoteok_source_type` is additive and idempotent: it adds one enum value with `IF NOT EXISTS`; it does not rewrite or delete existing source/job rows.
- Read-only Neon inspection found migrations `0000` through `0005` applied with hashes matching the local journal. `0006_remoteok_source_type` is pending, and Neon’s `source_type` enum does not yet contain `remoteok`. No migration was applied.
- `JobCard` renders source attribution as text plus ordinary HTML anchors to the original listing and, when distinct, application URL. The anchors have no `nofollow`; the card uses a company initial mark, not a Remote OK logo.
- The connector restricts Remote OK records through the registry allowlist; it does not map descriptions, salary, company logo, or raw feed tags. The `designDisciplines` value is a WERKS-derived classification from the permitted title and is explicitly included in the field allowlist. HTTPS application links and valid `mailto:` links are preserved; invalid/unsupported schemes fall back to the original listing.
- A standard browser request to the candidate listing returned HTTP 403. This is recorded as unavailable for independent verification, not as an invalid URL. Dry-run URL checks only validate HTTPS syntax and the official Remote OK listing host/path; they do not test destination reachability.
- Remote OK sync uses `completeSnapshot: false`; an empty feed or failed request cannot close jobs merely because they were omitted. Polling uses the source’s six-hour interval; retries are bounded and spaced by at least one second. Activation remains a separate registry change and was not performed.
- Automated checks pass after the conservative Worldwide change: 52 aggregation tests, typecheck, lint, Drizzle migration-chain check, and diff whitespace check. The updated dry-run details are in the Phase 7 completion report.

Latest dry-run snapshot: 100 fetched, 4 design-title matches, 0 automatically Indonesia-eligible, 0 accepted, 100 rejected, 0 feed duplicates, 0 database duplicates, and 0 insert/update candidates. The design-title “Manager, Product Design — Carrot — Worldwide” is held for manual eligibility review. There were 12 ambiguous-geography listings and 13 Worldwide-labelled listings across the fetched feed; rejection-reason counts overlap. All 100 unique original URLs were syntactically valid and on the Remote OK listing host; all 100 present application URLs had accepted HTTPS/mailto syntax. No destination was fetched for this check. The prior standard browser request to the candidate listing returned 403, so reachability remains unverified.
