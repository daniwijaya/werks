# WERKS Community Feed — Implementation Plan

**Status:** architecture audit plus Phase C2 UI implementation authorized; backend/auth/moderation integrations remain out of scope  
**Audit baseline:** `feature/community-feed`, based on `origin/main` at `092e5a1`  
**Working tree at start:** clean  
**Database, production settings, job sources, and existing aggregation code:** unchanged

## Product direction

WERKS would move from an automated job discovery aggregator to a community timeline where people share opportunities. The home page remains the main destination. A post is user-submitted information, not a verified listing; following its link takes the visitor to the original opportunity or an authorized application destination. WERKS will not scrape the destination or host an internal application flow.

## 1. Existing codebase inventory

- **Homepage:** `app/page.tsx` renders the existing hero illustration and copy, job-search form, and `LiveHomeJobFeed`.
- **Live job feed:** `components/live-home-job-feed.tsx` loads jobs on the server; `components/home-job-feed.tsx` renders the timeline-like listing area. Job search and filtering live in separate routes/components.
- **Navigation:** `components/site-shell.tsx` contains the responsive header, footer, Support Us link, and mobile bottom navigation. It currently links to Saved Jobs, About, and Data Sources.
- **Styling:** `app/globals.css` contains the existing dark palette, purple accent, typography, spacing, page gutters, and responsive rules. Reuse these tokens and components; avoid a global redesign.
- **Database:** `db/schema.ts` has job-specific `job_sources`, `jobs`, `job_categories`, `job_eligibility_decisions`, and `sync_runs`. `db/client.ts` creates a server-only Neon/Drizzle connection. No community identity or post tables exist.
- **Aggregation:** `lib/aggregation/` holds source compliance, HTTP, RSS, parsing, and job synchronization. The current six-hour workflow is `.github/workflows/aggregation-sync.yml`. Keep it and all job tables/connectors independent and unchanged.
- **Saved items:** `components/save-job-button.tsx` and `components/saved-job-feed.tsx` use browser `localStorage`; they do not provide authenticated, cross-device saved items.
- **Authentication, uploads, moderation:** no application-level Google OAuth, session/auth library, user upload storage, content moderation, post reporting, or user rate-limit service was found in the app dependencies/code. Neon dashboard capabilities do not constitute an integrated app authentication implementation.
- **Existing informational copy:** About describes WERKS as an independent job discovery platform; Privacy describes external aggregated jobs and local saved jobs; Data Sources copy describes preview/demo listings. Those descriptions need targeted edits before a community feed is publicly launched.

## 2. Proposed homepage changes

Keep the current header/hero art, layout, spacing, typography, dark theme, purple accent, footer, Support Us feature, and responsive behavior.

1. Change hero headline to **“Good opportunities are meant to be shared.”**
2. Change hero description to **“Discover and share job opportunities with Indonesia's creative community.”**
3. Replace the home search/filter form with a one-screen Post Composer.
4. Replace the Latest Design Jobs heading/cards with a single-column Community Feed using the existing homepage content width.
5. Preserve job search routes and aggregation code for possible future use; this proposal only removes the old search form from the homepage.
6. Replace Saved Jobs with Saved Posts in header/mobile navigation and make the existing Saved page render the signed-in user's bookmarks. Keep the page shell and visual hierarchy.

### Reusable components and additions

Reuse `Header`, `Footer`, `BottomNavigation`, `.wrap`, current buttons, cards, typography, and color tokens. The current job card itself should not be repurposed as a social post because it requires job-specific fields and source semantics.

Proposed isolated components:

- `CommunityPostComposer`: client-side text/link/category/image draft state, character counter near 2,000 characters, one-image preview/removal, submit state, validation messages.
- `CommunityFeed`: server-rendered first page of eligible published posts; client pagination/Load More without exposing private fields.
- `CommunityPostCard`: contributor avatar/display name, timestamp, text, optional authorized image/link/category, Appreciate, Bookmark, Share, and More actions.
- `PostActionsMenu`: report for signed-in users; edit/delete only for owner. Server checks remain authoritative.
- Dedicated loading, empty, and error states that visually match current feed states.
- Server-only post read/write modules and route handlers/actions; client components never receive database credentials or moderation secrets.

## 3. Post Composer and feed behavior

- Placeholder: **“Know who's hiring? Share it here...”**
- Allow text-only, text+URL, image with a useful caption/application instructions, or combinations. No required job title, employer, salary, location, seniority, or employment-type fields; no multi-step submission.
- Suggested cap: 2,000 characters and one image of at most 5 MB. Validate byte size, actual file signature, decodability, and dimensions on the server, not only the browser's declared MIME type.
- Show a counter as the user approaches the limit; make empty submissions and malformed URLs clear to correct.
- External link attachments are plain HTTPS/HTTP links with host shown to the user. Do not fetch pages to build previews or enrich the post. Use `rel="noopener noreferrer"` for new tabs.
- The public feed sorts by publication time descending, paginates with a stable `(created_at, id)` cursor, and only returns posts that are published, unexpired, and have successful mandatory moderation.
- “Appreciate” is an authenticated reaction with one row per user/post. Bookmarks are private to their owner. Share uses the canonical public post URL; there is no comments, following, recommendation ranking, or direct messaging.
- Guest browsing needs no login. Auth is required for create/edit/delete/appreciate/bookmark/report. A draft can be composed before login and retained through OAuth: preserve text, URL, and category in short-lived browser state; if image drafts must survive a full-page OAuth redirect, use a short-lived IndexedDB draft and clear it after submit or cancellation. Never upload a draft image publicly before authentication.

## 4. Authentication and identity

No auth provider is currently installed in the application. Add Google Sign-in only after choosing and integrating one server-side session framework with Drizzle/Postgres support (for example, evaluate Better Auth against Auth.js before implementation). This needs a Google OAuth client ID/secret, callback URLs for local and production, secure HTTP-only session cookies, CSRF/state validation, session revocation, and account deletion handling. Store only provider subject ID, display name, avatar URL, and the minimum auth tokens/claims needed; never return an email address in public post queries or cards.

Set `display_name` to a safe default derived from Google profile data, then allow a short optional edit if desired. Do not require a profile wizard. Do not publicly show the email address. Secrets must stay in server environment settings and must not use `NEXT_PUBLIC_` names.

## 5. Automated moderation and publication policy

All create and edit submissions pass server checks before publication. The pipeline runs synchronously for a small payload, with a strict timeout; the post is never public while checks are incomplete.

1. **Input checks:** trim/normalize text, enforce length and attachment count/size, reject invalid Unicode/control payloads, validate category enum, and parse URLs with an allowlisted `http:`/`https:` protocol. Do not render user HTML; React text rendering and output encoding prevent ordinary HTML injection.
2. **Duplicate/spam checks:** canonicalize the submitted URL, compare recent same-user submissions and normalized content hashes, enforce configurable per-account and IP limits, and add a five-post-per-user-per-day initial cap. Use atomic database operations so parallel requests cannot evade limits.
3. **Recruitment safety/relevance rules:** deterministic rules flag requests for applicant payments, deposits, training fees, personal banking/crypto details, impersonation, deceptive “guaranteed job” language, unrelated promotions, and repeated mass posts. Heuristics should produce revision/review outcomes for ambiguous content, not claim a job is fraudulent from keywords alone. A relevance check can identify obviously unrelated content but cannot verify an employer or vacancy.
4. **OpenAI Moderation API:** send only the submitted text and, if the image policy requires it, the user-uploaded image to `omni-moderation-latest`. The official API supports text and image safety checks and currently describes the moderation endpoint as free to use ([OpenAI Moderation guide](https://developers.openai.com/api/docs/guides/moderation)). It is a safety classifier, **not** a recruitment-scam detector, job verifier, or relevance classifier. Do not treat the post text/image as instructions to a model; send it as untrusted moderation input with a fixed policy.
5. **URL reputation:** do not server-fetch arbitrary URLs. This avoids SSRF and protects users from link-preview fetches to private/internal addresses. Protocol checks and a reputation feed can reduce risk but cannot guarantee a link is safe. A real-time URL reputation service is an optional later decision with separate cost/privacy review.
6. **Outcome:** `approved` publishes automatically; `revision_required` returns actionable, non-sensitive guidance and lets the author edit/resubmit; `rejected` blocks content violating a clear policy; `pending` holds content private if a mandatory service times out or is unavailable. Never publish on failed mandatory checks. Do not call approved posts “verified jobs.”
7. **Image handling:** after authentication, upload to a private/quarantine bucket, verify magic bytes and decode, re-encode accepted images and strip EXIF/location metadata, then serve only a safe derivative through a controlled public object URL once approved. Delete quarantined/replaced files on failure, edit, or removal. Never store image bytes in Neon.

OpenAI moderation may be free to call, but it still needs a server-side API account/key, availability handling, privacy/data-flow review, and an integration. Its categories do not solve fraud or relevance. Automated checks should be calibrated against Indonesian and English examples before launch; minimal protected admin override is still needed for urgent takedowns and false decisions.

## 6. Abuse prevention, reports, and lifecycle

- Five posts per user per rolling/calendar day initially; configurable account and IP limits; tighter limits for new accounts. Trust only host-provided client-IP headers that the deployment platform documents and strips/sets securely.
- Check ownership on every edit/delete at the server and in the database mutation predicate. Clients cannot set author ID, moderation status, report count, timestamps, or expiry.
- Validate and normalize URLs; never place arbitrary post text into HTML; no server-side URL fetching. Use same-origin routes and authorization for mutation endpoints.
- Limit images to one/5 MB, decode/re-encode, strip metadata, randomize object keys, enforce private write permissions and public read only for approved image objects.
- One report per authenticated reporter/post (with controlled update of their reason), rate-limit reports, and prevent report totals alone from deleting or hiding a post. Reports trigger a fresh automated assessment and may put high-risk content in `pending` pending exceptional review.
- Report reasons: spam, suspected scam, expired opportunity, inappropriate content, misleading information, unauthorized content, broken link, other.
- Default post expiry: 30 days after publish. Expired posts leave the public query; author can choose to resubmit/update with new moderation. Edits reset publication eligibility until moderation passes.
- Minimal protected administrative controls: role/allowlist-protected actions to hide/restore a post, inspect moderation reasons, remove an unsafe attachment, handle legal/serious safety requests, and record an audit trail. No daily moderation dashboard or broad admin search is needed for MVP.

## 7. Minimum additional database entities

Keep all additions separate from `job_sources` and `jobs`. Additive Drizzle migrations should be reviewed and tested locally, then explicitly approved before production application.

| Entity | Minimum fields and purpose |
|---|---|
| `community_users` | Internal UUID, auth provider + provider subject unique key, display name, avatar URL, role/status, created/updated/deleted timestamps. Auth secrets/tokens remain in the auth adapter's protected tables if required. Public loaders select only display name/avatar. |
| `community_posts` | UUID, author ID, text, optional category, status (`pending`, `published`, `revision_required`, `rejected`, `removed`), created/updated/published/expiry timestamps, content hash, moderation policy version. |
| `community_post_attachments` | UUID, post ID, kind (`image`, `external_link`), safe object key or canonical URL, validated content type/size/dimensions, optional user caption/alt text, created timestamp. Do not store third-party page contents or scraped previews. |
| `community_post_appreciations` | User ID + post ID unique key and created timestamp. |
| `community_post_bookmarks` | User ID + post ID unique key and created timestamp; never included in public post API. |
| `community_post_reports` | Report ID, post ID, reporter ID, reason enum, optional short explanation, status, created/updated timestamps; unique active report per reporter/post and audit trail for disposition. |
| `community_moderation_results` | Post/version ID, provider/model, policy version, outcome, category/rule flags, safe user-facing revision code, timestamps, error class. Avoid storing unnecessary raw moderation payloads or duplicating the full post. |
| Auth adapter tables | Use the chosen provider's user/session/account/verification schema, or map it to `community_users`; avoid duplicate identity tables. |

Suggested indexes: published timeline `(status, published_at DESC, id DESC)`, expiry `(expires_at)`, author history `(author_id, created_at DESC)`, category/status, attachment post key, unique appreciation/bookmark keys, report post/status, and unique auth provider subject. Use foreign keys and deletion policies deliberately. Prefer soft-delete/anonymization for author deletion if posts remain useful and lawful; purge sessions and private profile data. Keep moderation and admin audit retention bounded and documented.

## 8. Image storage and operational services

Neon is for relational metadata, not image binaries. Proposed low-cost option: Cloudflare R2 with a private bucket and a controlled public-serving domain/origin for approved images. Current official pricing lists a monthly free allowance (10 GB-month storage, 1M Class A, 10M Class B requests, free egress) and published overage prices; the service still requires account/billing setup, and cost depends on usage ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)). Do not activate or subscribe without approval. Keep image uploads out of the first launch if no storage provider is approved; the composer can initially support text, link, and category posts.

Required production secrets/configuration after approval: Google OAuth client ID/secret, auth/session secret as required by the selected library, `OPENAI_API_KEY` for server-side moderation, object-storage credentials/bucket/public origin if images launch, allowed post origins, rate limits, and admin identity/role configuration. None are to be added during this planning phase.

## 9. Privacy and informational pages

Before launch, minimally revise:

- **About:** explain that WERKS is a community job-sharing platform, contributors submit posts, posts are not verified by default, and applications happen on external destinations.
- **Privacy:** disclose Google identity fields, public display name/avatar and post content, private bookmarks, image processing/metadata stripping, moderation provider data flows, abuse/report data, retention/30-day expiration, deletion/contact process, and storage/auth vendors. Never expose contributor emails.
- **Data Sources:** replace aggregator demo/source claims with community-submission and external-link policy. Make clear that user-submitted posts are not source-verified; takedown/report contact is available.

Keep current navigation layout, About, Support Us, and footer. Change Saved Jobs labels to Saved Posts; no new navigation architecture is needed.

## 10. Cost estimate and service tradeoffs

- **Neon/Next.js hosting:** reuse current services; incremental use depends on actual database queries, writes, and deployment plan limits. Timeline pagination and indexes keep reads bounded.
- **Google OAuth:** Google sign-in itself does not imply a per-user fee, but requires a Google Cloud OAuth client and operational configuration; review current Google terms/quotas and account setup at implementation time.
- **OpenAI Moderation:** official documentation currently says the moderation endpoint is free to use. No token billing is listed for moderation; availability/privacy integration work remains ([official guide](https://developers.openai.com/api/docs/guides/moderation)).
- **Image storage:** optional. R2 currently has the free monthly allowance cited above; exceeding it incurs usage charges. An account subscription/billing setup is needed. No provider should be enabled without owner approval.
- **URL threat reputation:** no paid vendor assumed in MVP. If WERKS requires live reputation checks, choose and budget a provider separately; do not claim static rules ensure safe links.
- **Operations:** automated moderation reduces manual review volume but does not eliminate exceptional safety/legal support. A single owner/admin will still need a protected takedown route and escalation email.

At low launch volume, a text/link-only pilot can likely fit existing service free allowances, but confirm the actual Neon, hosting, and repository plan and expected usage before launch. Image hosting and any external reputation service are the main optional new costs. No service is subscribed to in this plan.

## 11. Phased implementation roadmap

1. **Policy and product decisions:** approve post rules, public identity fields, retention/deletion behavior, report handling, OAuth provider, moderation failure policy, and whether image upload is in MVP.
2. **Local architecture and schema:** implement auth/session integration and additive community migrations locally; create users/posts/attachments/reactions/bookmarks/reports/moderation tables; preserve job schema and data.
3. **Server security foundation:** mutation endpoints, ownership checks, atomic rate limits, URL validation, moderation adapter and fail-closed pending behavior, audit logging, fixture-based tests. No live provider keys in the browser.
4. **Text/link composer and feed:** composer drafts through sign-in, publish and edit workflow, single-column feed, cursor pagination, empty/loading/error states, appreciate/bookmark/share/report actions, Saved Posts.
5. **Moderation readiness:** evaluate Indonesian/English safety and scam examples, calibrate rule outcomes, verify mandatory-service outage behavior, conduct security review, confirm admin takedown access.
6. **Optional image support:** select/approve object storage, quarantine upload, server image validation/re-encoding/metadata removal, private-to-public approval transition, deletion lifecycle.
7. **Launch readiness:** update About/Privacy/Data Sources, verify accessibility/responsive layout, rate and abuse limits, retention/deletion, backups and incident contact. Test staging before production migrations or environment changes.
8. **Controlled rollout:** start with authenticated text/link posts and modest rate limits; monitor false positives, spam, DB/storage usage, and user feedback. Add images only after storage and moderation are verified.

## 12. Out of scope

Comments, direct messages, following, recommendation algorithms, leaderboards, company profiles, internal recruiting/applications, articles, premium features, scraping, automatic third-party job enrichment, and changes to job-source activations or the job synchronization workflow.

## Decisions needed before implementation

1. Is image upload required for the first release, or can it follow text/link posts?
2. Which OAuth/session framework should be selected after a focused compatibility review?
3. Who handles urgent takedowns and moderation appeals, and what public contact should be shown?
4. What happens to a post and its image when an author deletes their account?
5. Is the current WERKS hosting plan eligible for this community product's use, and which object-storage account (if any) is approved?
