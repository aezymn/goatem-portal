ALTER TABLE "bug_reports" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bug_tags" ADD COLUMN "locks_report" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "reply_to_id" text;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_reply_to_id_comments_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_reports_completed_at_idx" ON "bug_reports" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "bug_reports_archived_at_idx" ON "bug_reports" USING btree ("archived_at");--> statement-breakpoint

-- "Complete" is the tag that closes a report, out of the box.
UPDATE "bug_tags" SET "locks_report" = true WHERE "name" = 'Complete';--> statement-breakpoint

-- Reports already carrying it are already closed; date them from their
-- last update so the archive clock has something sensible to run off
-- rather than treating every old finished bug as freshly completed.
UPDATE "bug_reports" r SET "completed_at" = r."updated_at"
WHERE EXISTS (
  SELECT 1 FROM "bug_report_tags" rt
  JOIN "bug_tags" t ON t."id" = rt."tag_id"
  WHERE rt."bug_report_id" = r."id" AND t."locks_report" = true
);
