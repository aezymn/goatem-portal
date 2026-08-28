CREATE TABLE "bug_changes" (
	"bug_report_id" text NOT NULL,
	"member_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bug_changes_bug_report_id_member_id_pk" PRIMARY KEY("bug_report_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "changelog_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"bug_report_id" text,
	"text" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changelog_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"version" text NOT NULL,
	"version_major" integer NOT NULL,
	"version_minor" integer NOT NULL,
	"version_patch" integer,
	"body" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" text NOT NULL,
	"approved_by_id" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bug_changes" ADD CONSTRAINT "bug_changes_bug_report_id_bug_reports_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_changes" ADD CONSTRAINT "bug_changes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD CONSTRAINT "changelog_entries_post_id_changelog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."changelog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD CONSTRAINT "changelog_entries_bug_report_id_bug_reports_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "public"."bug_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_posts" ADD CONSTRAINT "changelog_posts_created_by_id_members_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_posts" ADD CONSTRAINT "changelog_posts_approved_by_id_members_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_changes_bug_report_id_idx" ON "bug_changes" USING btree ("bug_report_id");--> statement-breakpoint
CREATE INDEX "changelog_entries_post_id_idx" ON "changelog_entries" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "changelog_posts_status_idx" ON "changelog_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "changelog_posts_version_idx" ON "changelog_posts" USING btree ("version_major","version_minor","version_patch");