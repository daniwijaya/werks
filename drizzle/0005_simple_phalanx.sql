ALTER TABLE "job_sources" RENAME COLUMN "compliance_notes" TO "review_notes";--> statement-breakpoint
ALTER TABLE "job_sources" RENAME COLUMN "compliance_reviewed_at" TO "reviewed_at";--> statement-breakpoint
ALTER TABLE "job_sources" RENAME COLUMN "compliance_reviewer" TO "reviewed_by";--> statement-breakpoint
ALTER TABLE "job_sources" DROP CONSTRAINT "job_sources_active_requires_approval";--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "evidence_url" text;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "redistribution_allowed" boolean;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "attribution_required" boolean;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "allowed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "usage_restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "job_sources" SET
	"evidence_url" = COALESCE("terms_url", "compliance_evidence_urls" ->> 0, "endpoint_url"),
	"is_active" = CASE WHEN "source_type" = 'jobicy' AND "compliance_status" = 'approved' THEN "is_active" ELSE false END;--> statement-breakpoint
UPDATE "job_sources" SET
	"evidence_url" = 'https://jobicy.com/jobs-rss-feed',
	"redistribution_allowed" = true,
	"attribution_required" = true,
	"allowed_fields" = '["title", "companyName", "sourceUrl", "applicationUrl", "locationText", "employmentType", "originalPostedAt"]'::jsonb,
	"usage_restrictions" = '["Attribute Jobicy clearly.", "Retain the original Jobicy listing URL and do not present listings as WERKS originals.", "Limit requests to one per second per IP.", "Mark closed or expired listings unavailable."]'::jsonb,
	"review_notes" = COALESCE("review_notes", 'Jobicy API terms allow job discovery products with attribution.'),
	"reviewed_at" = COALESCE("reviewed_at", now()),
	"reviewed_by" = COALESCE("reviewed_by", 'WERKS technical audit (AI-assisted)'),
	"attribution_text" = COALESCE("attribution_text", 'Source: Jobicy')
WHERE "source_type" = 'jobicy' AND "compliance_status" = 'approved';--> statement-breakpoint
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_active_requires_compliance" CHECK (NOT "job_sources"."is_active" OR (
        "job_sources"."compliance_status" = 'approved'
        AND "job_sources"."redistribution_allowed" = true
        AND "job_sources"."evidence_url" IS NOT NULL
        AND "job_sources"."review_notes" IS NOT NULL
        AND "job_sources"."reviewed_at" IS NOT NULL
        AND "job_sources"."reviewed_by" IS NOT NULL
        AND "job_sources"."attribution_required" IS NOT NULL
        AND "job_sources"."allowed_fields" @> '["title", "companyName", "sourceUrl"]'::jsonb
        AND ("job_sources"."attribution_required" IS NOT TRUE OR "job_sources"."attribution_text" IS NOT NULL)
      ));
