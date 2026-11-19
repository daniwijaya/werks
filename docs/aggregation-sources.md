# WERKS source review

Initial company target: ten candidate sources. Company/ATS candidates are seeded with `is_active=false` and `permission_status=review_required`. Greenhouse, Lever, and Ashby describe public job APIs, but the material reviewed does not explicitly grant WERKS a third-party right to republish employer job content. No company source is enabled until its applicable terms or written permission and attribution requirements are confirmed.

Jobicy is a licensed job-feed provider rather than a company source. Its official API terms explicitly allow job boards and aggregators, including commercial use and storage/redistribution. It is seeded active and approved with visible Jobicy attribution and Jobicy listing links as application links. The connector obeys the one-request-per-second limit and only accepts listings whose eligible location explicitly names Indonesia; APAC-wide and non-Indonesia country-specific jobs are excluded. The feed only contains listings published in the previous seven days, so stored jobs are status-checked through Jobicy's batch endpoint rather than marked closed merely because they disappear from the feed.

The career boards below are employer-branded public ATS pages. Their board identifiers are taken from those published URLs, and API endpoint patterns follow the ATS vendors' official documentation. All ten API URLs were live-checked with read-only HTTP GETs on 2026-11-19 at 14:51 WIB (HTTP 200). Counts confirm a JSON posting array only; the records were not saved. The endpoint verification timestamp is separate from permission approval.

| Company | ATS | Official career / board page | API endpoint | Indonesia relevance | Permission / attribution review |
|---|---|---|---|---|---|
| Xendit | Greenhouse | https://www.xendit.co/en/careers/ → https://job-boards.greenhouse.io/xendit | https://boards-api.greenhouse.io/v1/boards/xendit/jobs | Official career page states local presence; current board includes UX Designer in Jakarta (21 postings in API check) | Review required; Greenhouse documents API use for employer career pages, not external republication. |
| aCommerce | Greenhouse | https://job-boards.greenhouse.io/acommerce | https://boards-api.greenhouse.io/v1/boards/acommerce/jobs | Current board includes Graphic Designer in Jakarta (76 postings) | Review required; no third-party republication grant found. |
| DKatalis | Greenhouse | https://job-boards.greenhouse.io/dkatalislabs | https://boards-api.greenhouse.io/v1/boards/dkatalislabs/jobs | Board has a Product Designer talent-pool posting for Jakarta (14 postings) | Review required; talent-pool listing is not represented as an active vacancy. |
| OKX | Greenhouse | https://job-boards.greenhouse.io/okx | https://boards-api.greenhouse.io/v1/boards/okx/jobs | Official board states all official vacancies are listed there and has Indonesia openings (391 postings) | Review required; no third-party republication grant found. |
| BJAK | Ashby | https://jobs.ashbyhq.com/bjakcareer | https://api.ashbyhq.com/posting-api/job-board/bjakcareer | Public postings include product, UI, graphic, and motion design roles for Indonesia (1,610 postings) | Review required; Ashby documents a public posting API for career pages, not external republication. |
| Coins.ph | Lever | https://jobs.lever.co/coins | https://api.lever.co/v0/postings/coins?mode=json | Current listings include roles whose listed work locations include Indonesia (89 postings) | Review required; Lever says published postings are publicly viewable and may be scraped, but no republication grant or specific attribution requirement was found. |
| Lalamove | Lever | https://jobs.lever.co/lalamove | https://api.lever.co/v0/postings/lalamove?mode=json | Current official board includes openings in Indonesian cities (149 postings) | Review required; same Lever terms limitation. |
| Spotify | Lever | https://jobs.lever.co/spotify | https://api.lever.co/v0/postings/spotify?mode=json | Current official board includes a Jakarta-based Indonesia role (91 postings) | Review required; same Lever terms limitation. |
| ShopBack | Lever | https://jobs.lever.co/shopback-2 | https://api.lever.co/v0/postings/shopback-2?mode=json | Current official board includes Jakarta roles (72 postings) | Review required; same Lever terms limitation. |
| Aleph | Lever | https://jobs.lever.co/aleph | https://api.lever.co/v0/postings/aleph?mode=json | Current official board includes a Jakarta-based role; company operates in Indonesia (174 postings) | Review required; same Lever terms limitation. |
| Jobicy public feed | Jobicy API | https://jobicy.com/jobs | https://jobicy.com/api/jobs | Public API supports APAC and Anywhere feeds; current APAC design search had no explicitly Indonesia-eligible listing | Approved by Jobicy API terms for commercial aggregators; visible source attribution required and public API apply links must remain on Jobicy. |

Vendor documentation reviewed:

- Greenhouse Job Board API: https://docs.greenhouse.io/job-board
- Lever Postings API: https://github.com/Lever/postings-api
- Ashby Job Postings API: https://developers.ashbyhq.com/docs/public-job-posting-api
- Jobicy Jobs API and fair-use terms: https://jobicy.com/jobs-rss-feed

This list is a source-research queue, not an assertion that all ten sources may be republished. The source registry deliberately prevents any of them from syncing until permission is approved.
