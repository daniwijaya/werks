import {
  boolean,
  char,
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

export const sourceTypeEnum = pgEnum("source_type", ["greenhouse", "lever", "ashby", "rss", "jobicy"]);
export const sourcePermissionEnum = pgEnum("source_permission", ["review_required", "approved", "denied"]);
export const workArrangementEnum = pgEnum("work_arrangement", ["remote", "hybrid", "on_site"]);
export const jobStatusEnum = pgEnum("job_status", ["active", "expired", "closed"]);
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
    boardIdentifier: text("board_identifier").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    permissionStatus: sourcePermissionEnum("permission_status").notNull().default("review_required"),
    endpointVerifiedAt: timestamp("endpoint_verified_at", { withTimezone: true }),
    termsUrl: text("terms_url"),
    permissionNotes: text("permission_notes"),
    attributionText: text("attribution_text"),
    pollingIntervalHours: integer("polling_interval_hours").notNull().default(6),
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("job_sources_type_board_uidx").on(table.sourceType, table.boardIdentifier),
    index("job_sources_active_idx").on(table.isActive, table.permissionStatus),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id").notNull().references(() => jobSources.id, { onDelete: "restrict" }),
    externalId: text("external_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    applicationUrl: text("application_url"),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    companyName: text("company_name").notNull(),
    normalizedCompanyName: text("normalized_company_name").notNull(),
    companyLogoUrl: text("company_logo_url"),
    description: text("description"),
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
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    aggregatedAt: timestamp("aggregated_at", { withTimezone: true }).notNull().defaultNow(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    status: jobStatusEnum("status").notNull().default("active"),
    duplicateGroupId: uuid("duplicate_group_id"),
  },
  (table) => [
    uniqueIndex("jobs_source_external_uidx").on(table.sourceId, table.externalId),
    index("jobs_status_posted_idx").on(table.status, table.originalPostedAt),
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
