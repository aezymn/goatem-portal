CREATE TABLE "bug_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bug_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bug_participants" (
	"bug_report_id" text NOT NULL,
	"member_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bug_participants_bug_report_id_member_id_pk" PRIMARY KEY("bug_report_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "bug_report_tags" (
	"bug_report_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "bug_report_tags_bug_report_id_tag_id_pk" PRIMARY KEY("bug_report_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "bug_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tone" text DEFAULT 'zinc' NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bug_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD COLUMN "category_id" text;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "bug_participants" ADD CONSTRAINT "bug_participants_bug_report_id_bug_reports_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_participants" ADD CONSTRAINT "bug_participants_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_tags" ADD CONSTRAINT "bug_report_tags_bug_report_id_bug_reports_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_tags" ADD CONSTRAINT "bug_report_tags_tag_id_bug_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."bug_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_participants_member_id_idx" ON "bug_participants" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "bug_report_tags_tag_id_idx" ON "bug_report_tags" USING btree ("tag_id");--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_category_id_bug_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."bug_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_reports_category_id_idx" ON "bug_reports" USING btree ("category_id");
--> statement-breakpoint
-- Seed the tags that replace the old status enum, plus a priority set.
-- Fixed IDs so the status migration below can reference them directly.
INSERT INTO "bug_tags" ("id", "name", "tone", "position") VALUES
	('tagopen000000000000000000', 'Open', 'sky', 0),
	('taginprogress00000000000', 'In progress', 'amber', 1),
	('tagcomplete00000000000000', 'Complete', 'emerald', 2),
	('taghighpriority000000000', 'High priority', 'red', 3),
	('taglowpriority0000000000', 'Low priority', 'zinc', 4)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint

-- Carry every existing report's status across as the matching tag, so
-- nothing loses its state in the swap.
INSERT INTO "bug_report_tags" ("bug_report_id", "tag_id")
SELECT "id",
	CASE "status"
		WHEN 'OPEN' THEN 'tagopen000000000000000000'
		WHEN 'IN_PROGRESS' THEN 'taginprogress00000000000'
		WHEN 'RESOLVED' THEN 'tagcomplete00000000000000'
	END
FROM "bug_reports"
WHERE "status" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Anyone who filed or commented on a report was already part of its
-- conversation, so seed them as participants rather than starting every
-- existing report with an empty member list.
INSERT INTO "bug_participants" ("bug_report_id", "member_id", "joined_at")
SELECT "id", "reporter_id", "created_at" FROM "bug_reports"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "bug_participants" ("bug_report_id", "member_id", "joined_at")
SELECT DISTINCT ON ("bug_report_id", "author_id") "bug_report_id", "author_id", "created_at"
FROM "comments" WHERE "deleted_at" IS NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "bug_participants" ("bug_report_id", "member_id", "joined_at")
SELECT "id", "assignee_id", "created_at" FROM "bug_reports"
WHERE "assignee_id" IS NOT NULL
ON CONFLICT DO NOTHING;
