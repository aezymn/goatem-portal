-- Absence notices. Deliberately not requests: nothing here records an
-- approver, because nobody approves them. return_date is the first day
-- the person is AVAILABLE again, not their last day away.
CREATE TABLE "absences" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"leave_date" date NOT NULL,
	"return_date" date NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "absences_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "absences_member_id_idx" ON "absences" USING btree ("member_id");
--> statement-breakpoint
CREATE INDEX "absences_leave_date_idx" ON "absences" USING btree ("leave_date");
--> statement-breakpoint
-- Records of testing done. Bug reports capture individual defects; these
-- capture the effort, so thorough testing that finds nothing still leaves
-- a trace.
CREATE TABLE "test_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"area" text NOT NULL,
	"findings" text NOT NULL,
	"minutes_spent" integer,
	"tested_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "test_logs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "test_logs_member_id_idx" ON "test_logs" USING btree ("member_id");
--> statement-breakpoint
CREATE INDEX "test_logs_tested_at_idx" ON "test_logs" USING btree ("tested_at");
