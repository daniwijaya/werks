CREATE TYPE "public"."job_status" AS ENUM('active', 'expired', 'closed');--> statement-breakpoint
CREATE TYPE "public"."source_permission" AS ENUM('review_required', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('greenhouse', 'lever', 'ashby', 'rss');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'succeeded', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."work_arrangement" AS ENUM('remote', 'hybrid', 'on_site');--> statement-breakpoint
CREATE TABLE "job_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" text NOT NULL,
	"company_name" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"careers_url" text NOT NULL,
	"endpoint_url" text NOT NULL,
	"board_identifier" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"permission_status" "source_permission" DEFAULT 'review_required' NOT NULL,
	"endpoint_verified_at" timestamp with time zone,
	"terms_url" text,
	"permission_notes" text,
	"attribution_text" text,
	"polling_interval_hours" integer DEFAULT 6 NOT NULL,
	"last_successful_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text NOT NULL,
	"application_url" text,
	"title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"company_name" text NOT NULL,
	"normalized_company_name" text NOT NULL,
	"company_logo_url" text,
	"description" text,
	"location_text" text,
	"country_code" char(2),
	"employment_type" text,
	"work_arrangement" "work_arrangement",
	"salary_minimum" numeric(14, 2),
	"salary_maximum" numeric(14, 2),
	"salary_currency" char(3),
	"salary_interval" text,
	"experience_level" text,
	"original_posted_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"aggregated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "job_status" DEFAULT 'active' NOT NULL,
	"duplicate_group_id" uuid
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "job_categories" ADD CONSTRAINT "job_categories_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_categories_job_category_uidx" ON "job_categories" USING btree ("job_id","category");--> statement-breakpoint
CREATE INDEX "job_categories_category_idx" ON "job_categories" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_type_board_uidx" ON "job_sources" USING btree ("source_type","board_identifier");--> statement-breakpoint
CREATE INDEX "job_sources_active_idx" ON "job_sources" USING btree ("is_active","permission_status");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_external_uidx" ON "jobs" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "jobs_status_posted_idx" ON "jobs" USING btree ("status","original_posted_at");--> statement-breakpoint
CREATE INDEX "jobs_duplicate_group_idx" ON "jobs" USING btree ("duplicate_group_id");--> statement-breakpoint
CREATE INDEX "jobs_company_title_idx" ON "jobs" USING btree ("normalized_company_name","normalized_title");--> statement-breakpoint
CREATE INDEX "sync_runs_source_started_idx" ON "sync_runs" USING btree ("source_id","started_at");