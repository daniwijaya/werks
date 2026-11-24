# WERKS — Teamtailor & SmartRecruiters Partnership Requirements

Status: discovery checklist only. No partner connector is implemented or authorized by this document.

## Information required from each partner

1. **Access route**: named partner program or employer-authorized API/feed, account owner, credentials or token flow, sandbox availability, and technical contact.
2. **Permission scope**: written partner terms covering automated collection, caching, public display by WERKS, geographic scope, and whether WERKS may operate a searchable multi-employer job board.
3. **Field-level rights**: job title, employer name, location, description, department, employment type, work mode, salary, publication/update dates, logo, original job URL, and application URL. Explicitly identify fields that must not be copied or displayed.
4. **Attribution and links**: required source/employer text, logo rules, followed-link requirements, application redirect rules, tracking parameters, and how to display closed or expired listings.
5. **Data lifecycle**: retention duration, refresh cadence, deletion/closure webhooks or endpoints, correction and takedown SLA, caching requirements, and termination cleanup obligations.
6. **Operational limits**: rate limits, pagination, quotas, retry behavior, API versioning/deprecation policy, uptime/SLA, and incident contact.
7. **Security and privacy**: credential handling, data minimization, audit requirements, incident reporting, and confirmation that no applicant data is in scope.
8. **Commercial terms**: fees, revenue share, listing restrictions, attribution placement, minimum traffic commitments, and termination costs.

## Provider-specific confirmation

### Teamtailor

- Confirm whether access is through a documented public job-board feed/API, the employer's authorized tenant API, or a formal partner integration.
- Obtain employer-level authorization for each tenant/board if the feed is not explicitly licensed for third-party aggregation.
- Verify public job listing and application URL stability, board identifier format, pagination, field visibility, branding/logo rights, and localization.
- Ask whether a central integration can cover multiple employer tenants and how employer revocation is reflected.

### SmartRecruiters

- Confirm whether the intended route is the public Posting API or an authorized partner API program.
- Obtain the current API terms and a clear grant for third-party job aggregation and republication; public endpoint access alone is insufficient.
- Confirm API key requirements, per-company board identifiers, query limits, pagination, attribution, visible fields, and application-link behavior.
- Confirm how removed/closed postings are represented and whether webhook or status validation endpoints are available.

## Go/no-go gate before connector work

For each source, store the official documentation/terms URLs, review date and reviewer, permission decision, allowed fields, attribution text, rate limits, retention rules, and written contact confirmation where needed. Set `approved` only when evidence covers the actual planned display use. Otherwise keep `review_required`; set `blocked` only when the intended use is expressly disallowed. Activate only after approval and separate explicit activation.
