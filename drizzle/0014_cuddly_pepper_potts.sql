CREATE TABLE "test_log_attendees" (
	"test_log_id" text NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_log_attendees_test_log_id_member_id_pk" PRIMARY KEY("test_log_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "test_log_bugs" (
	"test_log_id" text NOT NULL,
	"bug_report_id" text NOT NULL,
	"worked_on_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_log_bugs_test_log_id_bug_report_id_pk" PRIMARY KEY("test_log_id","bug_report_id")
);
--> statement-breakpoint
ALTER TABLE "test_log_attendees" ADD CONSTRAINT "test_log_attendees_test_log_id_test_logs_id_fk" FOREIGN KEY ("test_log_id") REFERENCES "public"."test_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_log_attendees" ADD CONSTRAINT "test_log_attendees_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_log_bugs" ADD CONSTRAINT "test_log_bugs_test_log_id_test_logs_id_fk" FOREIGN KEY ("test_log_id") REFERENCES "public"."test_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_log_bugs" ADD CONSTRAINT "test_log_bugs_bug_report_id_bug_reports_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_log_bugs" ADD CONSTRAINT "test_log_bugs_worked_on_by_id_members_id_fk" FOREIGN KEY ("worked_on_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_log_attendees_member_id_idx" ON "test_log_attendees" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "test_log_bugs_bug_report_id_idx" ON "test_log_bugs" USING btree ("bug_report_id");