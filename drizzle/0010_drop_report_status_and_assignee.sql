ALTER TABLE "bug_reports" DROP CONSTRAINT "bug_reports_assignee_id_members_id_fk";
--> statement-breakpoint
DROP INDEX "bug_reports_status_idx";--> statement-breakpoint
ALTER TABLE "bug_reports" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "bug_reports" DROP COLUMN "assignee_id";--> statement-breakpoint
DROP TYPE "public"."report_status";