ALTER TYPE "public"."source_permission" RENAME TO "source_compliance";--> statement-breakpoint
ALTER TYPE "public"."source_compliance" RENAME VALUE 'denied' TO 'blocked';--> statement-breakpoint
ALTER TABLE "job_sources" RENAME COLUMN "permission_status" TO "compliance_status";--> statement-breakpoint
ALTER TABLE "job_sources" RENAME COLUMN "permission_notes" TO "compliance_notes";--> statement-breakpoint
DROP INDEX "job_sources_active_idx";--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "compliance_evidence_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "compliance_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "compliance_reviewer" text;--> statement-breakpoint
CREATE INDEX "job_sources_active_idx" ON "job_sources" USING btree ("is_active","compliance_status");--> statement-breakpoint
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_active_requires_approval" CHECK (NOT "job_sources"."is_active" OR "job_sources"."compliance_status" = 'approved');
