CREATE TABLE "bug_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"bug_report_id" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"created_by_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bug_tag_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"exclusive" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bug_tag_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "bug_tags" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "stage_id" text;--> statement-breakpoint
ALTER TABLE "bug_stages" ADD CONSTRAINT "bug_stages_bug_report_id_bug_reports_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_stages" ADD CONSTRAINT "bug_stages_created_by_id_members_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_stages_bug_report_id_idx" ON "bug_stages" USING btree ("bug_report_id");--> statement-breakpoint
ALTER TABLE "bug_tags" ADD CONSTRAINT "bug_tags_group_id_bug_tag_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."bug_tag_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_stage_id_bug_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."bug_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- The two groups the existing tags obviously belong to, both exclusive:
-- a bug is In progress OR Complete, and one priority or another.
INSERT INTO "bug_tag_groups" ("id", "name", "exclusive", "position") VALUES
	('grpprogress00000000000000', 'Progress', true, 0),
	('grppriority00000000000000', 'Priority', true, 1)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint

UPDATE "bug_tags" SET "group_id" = 'grpprogress00000000000000'
WHERE "name" IN ('Open', 'In progress', 'Complete');--> statement-breakpoint
UPDATE "bug_tags" SET "group_id" = 'grppriority00000000000000'
WHERE "name" IN ('High priority', 'Low priority');--> statement-breakpoint

-- Existing reports carry both "Open" and whatever else got applied before
-- the groups existed. Now that Progress is exclusive, keep only the
-- furthest-along tag on each report so nothing starts out contradicting
-- itself: Complete beats In progress beats Open.
DELETE FROM "bug_report_tags" brt
USING "bug_tags" t
WHERE brt."tag_id" = t."id"
  AND t."group_id" = 'grpprogress00000000000000'
  AND EXISTS (
    SELECT 1 FROM "bug_report_tags" brt2
    JOIN "bug_tags" t2 ON t2."id" = brt2."tag_id"
    WHERE brt2."bug_report_id" = brt."bug_report_id"
      AND t2."group_id" = 'grpprogress00000000000000'
      AND t2."position" > t."position"
  );
