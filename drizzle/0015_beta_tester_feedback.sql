CREATE TYPE "public"."feedback_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('new', 'reviewed', 'escalated', 'dismissed');--> statement-breakpoint
CREATE TABLE "feedback_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"submitter_discord_id" text NOT NULL,
	"submitter_discord_username" text NOT NULL,
	"submitter_avatar_url" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"steps_to_reproduce" text,
	"severity" "feedback_severity" DEFAULT 'medium' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"escalated_to_report_id" text,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_escalated_to_report_id_bug_reports_id_fk" FOREIGN KEY ("escalated_to_report_id") REFERENCES "public"."bug_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_reviewed_by_id_members_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_reports_submitter_discord_id_idx" ON "feedback_reports" USING btree ("submitter_discord_id");--> statement-breakpoint
CREATE INDEX "feedback_reports_status_idx" ON "feedback_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_reports_created_at_idx" ON "feedback_reports" USING btree ("created_at");