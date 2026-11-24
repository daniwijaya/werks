CREATE TYPE "public"."job_eligibility_decision" AS ENUM('eligible', 'manual_review', 'excluded');--> statement-breakpoint
CREATE TABLE "job_eligibility_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_job_id" text NOT NULL,
	"decision" "job_eligibility_decision" NOT NULL,
	"reason" text NOT NULL,
	"location_fingerprint" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_eligibility_decisions" ADD CONSTRAINT "job_eligibility_decisions_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_eligibility_decisions_source_external_uidx" ON "job_eligibility_decisions" USING btree ("source_id","external_job_id");--> statement-breakpoint
CREATE INDEX "job_eligibility_decisions_decision_idx" ON "job_eligibility_decisions" USING btree ("decision");
--> statement-breakpoint
INSERT INTO "job_eligibility_decisions" (
	"source_id", "external_job_id", "decision", "reason", "location_fingerprint", "reviewed_by"
)
SELECT
	"id",
	'1137927',
	'manual_review',
	'Conflicting geographic eligibility signals: the Remote OK feed labels the role Worldwide while the employer application indicates a U.S. work-authorization requirement. Confirm Indonesia-based applicant eligibility before publication.',
	'7aca9b2c4a361291b651be6400620a2dddb3443e339d4af38f5c8550ba2c61fb',
	'WERKS technical review'
FROM "job_sources"
WHERE "source_type" = 'remoteok' AND "board_identifier" = 'public-api'
ON CONFLICT ("source_id", "external_job_id") DO NOTHING;
