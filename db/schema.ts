import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const sourceTypeEnum = pgEnum("source_type", ["greenhouse", "lever", "ashby", "rss", "jobicy", "sitemap", "json_ld", "html", "remoteok"]);
export const sourceComplianceEnum = pgEnum("source_compliance", ["approved", "review_required", "blocked"]);
export const workArrangementEnum = pgEnum("work_arrangement", ["remote", "hybrid", "on_site"]);
export const jobStatusEnum = pgEnum("job_status", ["active", "expired", "closed"]);
export const jobEligibilityDecisionEnum = pgEnum("job_eligibility_decision", ["eligible", "manual_review", "excluded"]);
export const syncStatusEnum = pgEnum("sync_status", ["running", "succeeded", "partial", "failed"]);

export const jobSources = pgTable(
  "job_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceName: text("source_name").notNull(),
    companyName: text("company_name").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    careersUrl: text("careers_url").notNull(),
    endpointUrl: text("endpoint_url").notNull(),
    boardIdentifier: text("board_identifier"),
    companyDomain: text("company_domain"),
    atsProvider: text("ats_provider"),
    aggregationMethod: text("aggregation_method"),
    allowedDomains: jsonb("allowed_domains").$type<string[]>().notNull().default([]),
    parserConfig: jsonb("parser_config").$type<Record<string, unknown>>().notNull().default({}),
    httpValidators: jsonb("http_validators").$type<Record<string, { etag?: string; lastModified?: string }>>().notNull().default({}),
    requestLimitPerRun: integer("request_limit_per_run").notNull().default(25),
    minRequestIntervalSeconds: integer("min_request_interval_seconds").notNull().default(10),
    isActive: boolean("is_active").notNull().default(false),
    complianceStatus: sourceComplianceEnum("compliance_status").notNull().default("review_required"),
    endpointVerifiedAt: timestamp("endpoint_verified_at", { withTimezone: true }),
    termsUrl: text("terms_url"),
    evidenceUrl: text("evidence_url"),
    reviewNotes: text("review_notes"),
    complianceEvidenceUrls: jsonb("compliance_evidence_urls").$type<string[]>().notNull().default([]),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    redistributionAllowed: boolean("redistribution_allowed"),
    attributionRequired: boolean("attribution_required"),
    allowedFields: jsonb("allowed_fields").$type<string[]>().notNull().default([]),
    usageRestrictions: jsonb("usage_restrictions").$type<string[]>().notNull().default([]),
    attributionText: text("attribution_text"),
    pollingIntervalHours: integer("polling_interval_hours").notNull().default(6),
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
    lastSyncStatus: syncStatusEnum("last_sync_status"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "job_sources_active_requires_compliance",
      sql`NOT ${table.isActive} OR (
        ${table.complianceStatus} = 'approved'
        AND ${table.redistributionAllowed} = true
        AND ${table.evidenceUrl} IS NOT NULL
        AND ${table.reviewNotes} IS NOT NULL
        AND ${table.reviewedAt} IS NOT NULL
        AND ${table.reviewedBy} IS NOT NULL
        AND ${table.attributionRequired} IS NOT NULL
        AND ${table.allowedFields} @> '["title", "companyName", "sourceUrl"]'::jsonb
        AND (${table.attributionRequired} IS NOT TRUE OR ${table.attributionText} IS NOT NULL)
      )`,
    ),
    uniqueIndex("job_sources_type_board_uidx").on(table.sourceType, table.boardIdentifier),
    index("job_sources_active_idx").on(table.isActive, table.complianceStatus),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id").notNull().references(() => jobSources.id, { onDelete: "restrict" }),
    externalId: text("external_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    canonicalUrl: text("canonical_url"),
    applicationUrl: text("application_url"),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    companyName: text("company_name").notNull(),
    normalizedCompanyName: text("normalized_company_name").notNull(),
    companyLogoUrl: text("company_logo_url"),
    description: text("description"),
    department: text("department"),
    locationText: text("location_text"),
    countryCode: char("country_code", { length: 2 }),
    employmentType: text("employment_type"),
    workArrangement: workArrangementEnum("work_arrangement"),
    salaryMinimum: numeric("salary_minimum", { precision: 14, scale: 2 }),
    salaryMaximum: numeric("salary_maximum", { precision: 14, scale: 2 }),
    salaryCurrency: char("salary_currency", { length: 3 }),
    salaryInterval: text("salary_interval"),
    experienceLevel: text("experience_level"),
    originalPostedAt: timestamp("original_posted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    aggregatedAt: timestamp("aggregated_at", { withTimezone: true }).notNull().defaultNow(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    missingFromSyncCount: integer("missing_from_sync_count").notNull().default(0),
    status: jobStatusEnum("status").notNull().default("active"),
    duplicateGroupId: uuid("duplicate_group_id"),
  },
  (table) => [
    uniqueIndex("jobs_source_external_uidx").on(table.sourceId, table.externalId),
    index("jobs_status_posted_idx").on(table.status, table.originalPostedAt),
    index("jobs_canonical_url_idx").on(table.canonicalUrl),
    index("jobs_duplicate_group_idx").on(table.duplicateGroupId),
    index("jobs_company_title_idx").on(table.normalizedCompanyName, table.normalizedTitle),
  ],
);

export const jobCategories = pgTable(
  "job_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
  },
  (table) => [
    uniqueIndex("job_categories_job_category_uidx").on(table.jobId, table.category),
    index("job_categories_category_idx").on(table.category),
  ],
);

/** Durable per-source-job publication decisions, independent of the source compliance status. */
export const jobEligibilityDecisions = pgTable(
  "job_eligibility_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id").notNull().references(() => jobSources.id, { onDelete: "restrict" }),
    externalJobId: text("external_job_id").notNull(),
    decision: jobEligibilityDecisionEnum("decision").notNull(),
    reason: text("reason").notNull(),
    locationFingerprint: text("location_fingerprint").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: text("reviewed_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("job_eligibility_decisions_source_external_uidx").on(table.sourceId, table.externalJobId),
    index("job_eligibility_decisions_decision_idx").on(table.decision),
  ],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id").notNull().references(() => jobSources.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: syncStatusEnum("status").notNull().default("running"),
    fetchedCount: integer("fetched_count").notNull().default(0),
    acceptedCount: integer("accepted_count").notNull().default(0),
    insertedCount: integer("inserted_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  },
  (table) => [index("sync_runs_source_started_idx").on(table.sourceId, table.startedAt)],
);

export type JobSource = typeof jobSources.$inferSelect;
export type NewJobSource = typeof jobSources.$inferInsert;
export type JobRecord = typeof jobs.$inferSelect;
export type NewJobRecord = typeof jobs.$inferInsert;
