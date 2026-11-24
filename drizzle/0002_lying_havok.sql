ALTER TYPE "public"."source_type" ADD VALUE 'sitemap';--> statement-breakpoint
ALTER TYPE "public"."source_type" ADD VALUE 'json_ld';--> statement-breakpoint
ALTER TYPE "public"."source_type" ADD VALUE 'html';--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "company_domain" text;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "ats_provider" text;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "aggregation_method" text;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "allowed_domains" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "parser_config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "http_validators" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "request_limit_per_run" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "min_request_interval_seconds" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "last_sync_status" "sync_status";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "canonical_url" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "missing_from_sync_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "jobs_canonical_url_idx" ON "jobs" USING btree ("canonical_url");