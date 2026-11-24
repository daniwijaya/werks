import type { NewJobSource } from "../../db/schema.ts";

const greenhouseDocs = "https://docs.greenhouse.io/job-board";
const greenhouseApiRobots = "https://boards-api.greenhouse.io/robots.txt";
const greenhouseJobsRobots = "https://job-boards.greenhouse.io/robots.txt";
const leverDocs = "https://github.com/Lever/postings-api";
const leverApiSupport = "https://hire.lever.co/developer/support";
const leverCredentialsHelp = "https://help.lever.co/s/article/Generating-and-using-API-credentials";
const leverApiRobots = "https://api.lever.co/robots.txt";
const leverJobsRobots = "https://jobs.lever.co/robots.txt";
const ashbyDocs = "https://developers.ashbyhq.com/docs/public-job-posting-api";
const ashbyJobsRobots = "https://jobs.ashbyhq.com/robots.txt";
const ashbyApiRobots = "https://api.ashbyhq.com/robots.txt";
const ashbyCareerPageGuide = "https://docs.ashbyhq.com/routes-for-integrating-your-ashby-job-board-with-your-careers-page";
const jobicyPolicy = "https://jobicy.com/jobs-rss-feed";
const remoteOkApi = "https://remoteok.com/api";
const remoteOkFaq = "https://remoteok.com/faq";
const remoteOkTerms = "https://remoteok.com/legal";
const remoteOkRobots = "https://remoteok.com/robots.txt";
const reviewDate = new Date("2026-11-20T00:00:00.000Z");
const endpointVerifiedAt = new Date("2026-11-19T07:51:00.000Z");
const reviewer = "WERKS technical audit (AI-assisted)";

const unresolvedReuseRestriction = "Do not synchronize or republish until evidence explicitly establishes the permitted scope for WERKS; re-review provider/company terms before activation.";

function atsAssessment(params: {
  company: string;
  careersUrl: string;
  endpointUrl: string;
  docsUrl: string;
  robotsUrls: string[];
  termsUrl?: string;
  boardIdentifier: string;
  note: string;
}): NewJobSource {
  return {
    sourceName: `${params.company} — ${params.docsUrl === greenhouseDocs ? "Greenhouse" : params.docsUrl === leverDocs ? "Lever" : "Ashby"}`,
    companyName: params.company,
    sourceType: params.docsUrl === greenhouseDocs ? "greenhouse" : params.docsUrl === leverDocs ? "lever" : "ashby",
    careersUrl: params.careersUrl,
    endpointUrl: params.endpointUrl,
    boardIdentifier: params.boardIdentifier,
    companyDomain: new URL(params.careersUrl).hostname,
    atsProvider: params.docsUrl === greenhouseDocs ? "Greenhouse" : params.docsUrl === leverDocs ? "Lever" : "Ashby",
    aggregationMethod: "public_ats_api",
    allowedDomains: [...new Set([new URL(params.endpointUrl).hostname, new URL(params.careersUrl).hostname])],
    isActive: false,
    complianceStatus: "review_required",
    endpointVerifiedAt,
    termsUrl: params.termsUrl ?? params.docsUrl,
    evidenceUrl: params.termsUrl ?? params.docsUrl,
    reviewNotes: params.note,
    complianceEvidenceUrls: [...new Set([
      params.careersUrl,
      params.endpointUrl,
      params.docsUrl,
      ...(params.docsUrl === greenhouseDocs ? ["https://harvestdocs.greenhouse.io/docs/third-party-api-access-policy"] : []),
      ...(params.docsUrl === leverDocs ? [leverApiSupport, leverCredentialsHelp] : []),
      ...(params.docsUrl === ashbyDocs ? [ashbyCareerPageGuide] : []),
      ...params.robotsUrls,
      ...(params.termsUrl ? [params.termsUrl] : []),
    ])].filter((url) => url !== (params.termsUrl ?? params.docsUrl)),
    reviewedAt: reviewDate,
    reviewedBy: reviewer,
    redistributionAllowed: null,
    attributionRequired: null,
    allowedFields: [],
    usageRestrictions: [unresolvedReuseRestriction],
    attributionText: `Company: ${params.company}; source: ${params.careersUrl}`,
    pollingIntervalHours: 6,
  };
}

const greenhouseNote = (company: string) => `WERKS audit dated 2026-11-20 (AI-assisted): checked ${company}'s official career board and the matching public Greenhouse Job Board API endpoint, Greenhouse's Job Board API documentation, and the applicable API/board/company robots.txt URLs listed in compliance evidence. The API documentation provides public job data and describes building the employer's career pages, but provides no clear third-party aggregation/republication license or attribution terms. Greenhouse's Third-Party API Access Policy applies to authenticated Harvest credentials supplied by customers; it does not establish permission or prohibition for this public Job Board API. No permitted republication fields can be confirmed from available evidence. Keep inactive; reassess if applicable terms or a license clarify scope. No explicit prohibition applicable to this public endpoint was found.`;
const leverNote = (company: string) => `WERKS audit dated 2026-11-20 (AI-assisted): checked ${company}'s official Lever-hosted careers board and matching public Postings API endpoint, Lever's official Postings API documentation and support guidance, and the API/jobs robots.txt URLs listed in compliance evidence. Lever describes the Postings API as powering an employer's custom job site and separately describes an XML feed for job boards/partners. The reviewed documentation does not establish that WERKS may reuse this company's public API response for independent aggregation/republication, and it does not establish required attribution or permitted fields. robots.txt is not treated as a redistribution license. No explicit prohibition applicable to this public endpoint was found. Keep inactive pending evidence that clarifies the intended scope.`;
const ashbyNote = `WERKS audit dated 2026-11-20 (AI-assisted): checked BJAK's official Ashby-hosted careers board, matching public job-board endpoint, Ashby's Public Job Posting API documentation, and the API/jobs robots.txt URLs listed in compliance evidence. Ashby documents its board API for publishing listed roles and supports linking to its application page; the documentation does not provide a clear third-party aggregator republication license, attribution requirement, or field-level reuse grant. The API robots.txt response could not be confirmed during endpoint review (HTTP 401); this is not treated as permission or prohibition. No permitted republication fields can be confirmed. Keep inactive pending applicable terms/licensing evidence; no explicit prohibition applicable to the public board endpoint was found.`;

export const sourceSeed: NewJobSource[] = [
  {
    sourceName: "Jobicy public jobs API",
    companyName: "Jobicy",
    sourceType: "jobicy",
    careersUrl: "https://jobicy.com/jobs",
    endpointUrl: "https://jobicy.com/api/jobs",
    boardIdentifier: "public-feed",
    companyDomain: "jobicy.com",
    atsProvider: null,
    aggregationMethod: "official_public_api",
    allowedDomains: ["jobicy.com"],
    isActive: true,
    complianceStatus: "approved",
    endpointVerifiedAt,
    termsUrl: jobicyPolicy,
    evidenceUrl: jobicyPolicy,
    reviewNotes: "Official Jobicy API policy expressly permits job discovery products, including job boards, to use listings without individual permission. It requires clear original-source credit, retaining Jobicy listing URLs, not presenting listings as original, a maximum of 1 request/second/IP, and marking closed/expired listings unavailable. WERKS-derived design disciplines are calculated only from the permitted job title; source-provided category/tags are not used. robots.txt was checked: the API paths used by this connector are not disallowed; its /feed rule does not match /api/jobs. This assessment covers only the permitted listing fields recorded below; do not request paid/direct ATS URLs unless separately configured and assessed.",
    complianceEvidenceUrls: ["https://jobicy.com/robots.txt", "https://jobicy.com/api/jobs"],
    reviewedAt: reviewDate,
    reviewedBy: reviewer,
    redistributionAllowed: true,
    attributionRequired: true,
    allowedFields: ["title", "companyName", "sourceUrl", "applicationUrl", "locationText", "employmentType", "originalPostedAt", "designDisciplines"],
    usageRestrictions: ["Attribute Jobicy clearly.", "Retain the original Jobicy listing URL and do not present listings as WERKS originals.", "Limit requests to one per second per IP.", "Mark closed or expired listings unavailable.", "Only display WERKS-derived design disciplines based on the permitted job title; do not use source category/tags."],
    attributionText: "Source: Jobicy",
    pollingIntervalHours: 6,
  },
  {
    sourceName: "Remote OK public jobs API",
    companyName: "Remote OK",
    sourceType: "remoteok",
    careersUrl: "https://remoteok.com/",
    endpointUrl: remoteOkApi,
    boardIdentifier: "public-api",
    companyDomain: "remoteok.com",
    atsProvider: null,
    aggregationMethod: "official_public_api",
    allowedDomains: ["remoteok.com"],
    requestLimitPerRun: 3,
    minRequestIntervalSeconds: 1,
    isActive: false,
    complianceStatus: "approved",
    endpointVerifiedAt: new Date("2026-11-24T00:00:00.000Z"),
    termsUrl: remoteOkTerms,
    evidenceUrl: remoteOkFaq,
    reviewNotes: "Reviewed 2026-11-24 (WERKS technical review, AI-assisted). Remote OK's official FAQ says its free public JSON/RSS feeds may be used by job aggregators; public aggregators must credit Remote OK and link each listing to its original Remote OK job URL. API response terms additionally require a followed backlink and naming Remote OK as source; no Remote OK logo without written permission. Scope is limited to title, company name, original listing URL, application URL where supplied, original location label, work arrangement derived only from the permitted location field, posting date, and WERKS-derived design discipline classified only from the permitted title. Full description, source tags, logo, salary, and other fields are intentionally not retained or used for classification. Explicit Indonesia locations are confirmed by the permitted location field; Worldwide/Global and Southeast Asia/ASEAN are eligible only when that field contains no known contradictory restriction, and are recorded as inferred rather than employer-confirmed. Generic Remote, APAC, conflicting locations, and unclear regional scope require manual review; explicit restrictions excluding Indonesia are ineligible. robots.txt has Crawl-delay: 1 and disallows certain query/AJAX paths; the unparameterized /api endpoint is not disallowed. Robots rules are treated as access guidance, not a republication license. The legal page contains general terms but no narrower feed field license; FAQ and API-specific terms supply the aggregator permission and conditions. Keep inactive pending separate activation approval.",
    complianceEvidenceUrls: [remoteOkApi, remoteOkFaq, remoteOkTerms, remoteOkRobots],
    reviewedAt: new Date("2026-11-24T00:00:00.000Z"),
    reviewedBy: reviewer,
    redistributionAllowed: true,
    attributionRequired: true,
    allowedFields: ["title", "companyName", "sourceUrl", "applicationUrl", "locationText", "workArrangement", "originalPostedAt", "designDisciplines"],
    usageRestrictions: [
      "Credit Remote OK and provide a followed backlink to Remote OK.",
      "Link each listing to its original Remote OK job URL so applicants can apply directly.",
      "Do not use the Remote OK logo without written permission; use the name Remote OK.",
      "Do not retain or display full descriptions, company logos, salary data, or unapproved fields.",
      "Any displayed design discipline must be classified by WERKS from the permitted job title only; do not use source tags.",
      "Treat explicit Indonesia location as confirmed by source text; mark Worldwide/Global and Southeast Asia/ASEAN eligibility as inferred, never employer-confirmed.",
      "Accept Worldwide/Global or Southeast Asia/ASEAN labels only when the permitted location field has no known conflicting restrictions; hold generic Remote, APAC, and conflicting or unclear scopes for manual review.",
      "Reject explicit geographic restrictions that exclude Indonesia; do not collect descriptions or other unapproved fields to resolve ambiguity.",
      "Make one feed request per sync run, with at most two retries (three attempts total); wait at least one second between attempts.",
      "Do not close or expire jobs solely because they disappear from a feed snapshot.",
      "Recheck current terms and robots.txt before materially changing the connector or displayed fields.",
    ],
    attributionText: "Source: Remote OK",
    pollingIntervalHours: 6,
  },
  atsAssessment({
    company: "Xendit",
    careersUrl: "https://www.xendit.co/en/careers/",
    endpointUrl: "https://boards-api.greenhouse.io/v1/boards/xendit/jobs",
    docsUrl: greenhouseDocs,
    robotsUrls: [greenhouseApiRobots, greenhouseJobsRobots, "https://www.xendit.co/robots.txt"],
    termsUrl: "https://www.xendit.co/en/terms-and-conditions/",
    boardIdentifier: "xendit",
    note: greenhouseNote("Xendit"),
  }),
  atsAssessment({
    company: "aCommerce",
    careersUrl: "https://job-boards.greenhouse.io/acommerce",
    endpointUrl: "https://boards-api.greenhouse.io/v1/boards/acommerce/jobs",
    docsUrl: greenhouseDocs,
    robotsUrls: [greenhouseApiRobots, greenhouseJobsRobots],
    termsUrl: "https://www.acommerce.asia/terms-conditions/",
    boardIdentifier: "acommerce",
    note: greenhouseNote("aCommerce"),
  }),
  atsAssessment({
    company: "DKatalis",
    careersUrl: "https://job-boards.greenhouse.io/dkatalislabs",
    endpointUrl: "https://boards-api.greenhouse.io/v1/boards/dkatalislabs/jobs",
    docsUrl: greenhouseDocs,
    robotsUrls: [greenhouseApiRobots, greenhouseJobsRobots],
    boardIdentifier: "dkatalislabs",
    note: greenhouseNote("DKatalis"),
  }),
  atsAssessment({
    company: "OKX",
    careersUrl: "https://job-boards.greenhouse.io/okx",
    endpointUrl: "https://boards-api.greenhouse.io/v1/boards/okx/jobs",
    docsUrl: greenhouseDocs,
    robotsUrls: [greenhouseApiRobots, greenhouseJobsRobots],
    boardIdentifier: "okx",
    note: greenhouseNote("OKX"),
  }),
  atsAssessment({
    company: "BJAK",
    careersUrl: "https://jobs.ashbyhq.com/bjakcareer",
    endpointUrl: "https://api.ashbyhq.com/posting-api/job-board/bjakcareer",
    docsUrl: ashbyDocs,
    robotsUrls: [ashbyApiRobots, ashbyJobsRobots],
    boardIdentifier: "bjakcareer",
    note: ashbyNote,
  }),
  atsAssessment({
    company: "Coins.ph",
    careersUrl: "https://jobs.lever.co/coins",
    endpointUrl: "https://api.lever.co/v0/postings/coins?mode=json",
    docsUrl: leverDocs,
    robotsUrls: [leverApiRobots, leverJobsRobots],
    boardIdentifier: "coins",
    note: leverNote("Coins.ph"),
  }),
  atsAssessment({
    company: "Lalamove",
    careersUrl: "https://jobs.lever.co/lalamove",
    endpointUrl: "https://api.lever.co/v0/postings/lalamove?mode=json",
    docsUrl: leverDocs,
    robotsUrls: [leverApiRobots, leverJobsRobots],
    boardIdentifier: "lalamove",
    note: leverNote("Lalamove"),
  }),
  atsAssessment({
    company: "Spotify",
    careersUrl: "https://jobs.lever.co/spotify",
    endpointUrl: "https://api.lever.co/v0/postings/spotify?mode=json",
    docsUrl: leverDocs,
    robotsUrls: [leverApiRobots, leverJobsRobots],
    boardIdentifier: "spotify",
    note: leverNote("Spotify"),
  }),
  atsAssessment({
    company: "ShopBack",
    careersUrl: "https://jobs.lever.co/shopback-2",
    endpointUrl: "https://api.lever.co/v0/postings/shopback-2?mode=json",
    docsUrl: leverDocs,
    robotsUrls: [leverApiRobots, leverJobsRobots],
    boardIdentifier: "shopback-2",
    note: leverNote("ShopBack"),
  }),
  atsAssessment({
    company: "Aleph",
    careersUrl: "https://jobs.lever.co/aleph",
    endpointUrl: "https://api.lever.co/v0/postings/aleph?mode=json",
    docsUrl: leverDocs,
    robotsUrls: [leverApiRobots, leverJobsRobots],
    boardIdentifier: "aleph",
    note: leverNote("Aleph"),
  }),
];
