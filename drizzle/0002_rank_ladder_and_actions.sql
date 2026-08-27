-- Replaces the STAFF/ADMIN rank-eligibility model with a rank ladder
-- (authority order + optional Discord role binding) and granular
-- per-rank action grants, plus a person-specific isPortalAdmin flag that
-- only the guild's CREATOR can set (see src/lib/permissions.ts).
CREATE TABLE "ranks" (
	"name" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"discord_role_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ranks_discord_role_id_unique" UNIQUE("discord_role_id")
);
--> statement-breakpoint
-- Seed the ladder from whatever ranks already exist on the roster, so
-- nothing is missing from the Ranks admin page after this migration —
-- order is arbitrary (alphabetical) and can be dragged into place.
INSERT INTO "ranks" ("name", "position")
SELECT DISTINCT "rank", (row_number() OVER (ORDER BY "rank")) - 1
FROM "members"
WHERE "deleted_at" IS NULL
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
CREATE TABLE "rank_action_permissions" (
	"rank" text NOT NULL,
	"action" text NOT NULL,
	CONSTRAINT "rank_action_permissions_rank_action_pk" PRIMARY KEY("rank","action"),
	CONSTRAINT "rank_action_permissions_rank_ranks_name_fk" FOREIGN KEY ("rank") REFERENCES "public"."ranks"("name") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "rank_action_permissions_rank_idx" ON "rank_action_permissions" USING btree ("rank");
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "is_portal_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "members" DROP COLUMN "granted_tier";
--> statement-breakpoint
DROP TABLE "rank_permissions";
--> statement-breakpoint
DROP TYPE "public"."tier";
