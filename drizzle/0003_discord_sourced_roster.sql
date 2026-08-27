-- The roster is now populated from Discord (holding a role bound to a
-- rank puts you on it), so a row can exist long before its owner has ever
-- signed in or told us their Roblox username.
CREATE TYPE "public"."member_source" AS ENUM('discord', 'manual', 'alt');
--> statement-breakpoint
-- Roblox username is supplied by the person on first sign-in, so it can
-- no longer be required up front. Still unique: Postgres permits many
-- NULLs under a unique constraint, so any number of unlinked people
-- coexist while no two can claim the same account.
ALTER TABLE "members" ALTER COLUMN "roblox_username" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "roblox_user_id" text;
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "discord_username" text;
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "source" "member_source" DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "parent_member_id" text;
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "has_signed_in" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "last_sign_in_at" timestamp with time zone;
--> statement-breakpoint
-- Nullable on purpose: NULL means "not checked yet", which is a different
-- claim from false ("checked, and they don't have access"). The roster
-- renders those differently rather than implying a negative we can't
-- support. See src/lib/roblox.ts.
ALTER TABLE "members" ADD COLUMN "has_game_access" boolean;
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "game_access_checked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_parent_member_id_members_id_fk" FOREIGN KEY ("parent_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "members_parent_member_id_idx" ON "members" USING btree ("parent_member_id");
--> statement-breakpoint
-- Anyone already on the roster got there by hand, before this existed.
UPDATE "members" SET "source" = 'manual' WHERE "source" IS NULL;
--> statement-breakpoint
-- Status was only ever a free-text note nobody filled in consistently;
-- the roster now reports the two facts that actually matter (game access
-- and whether they've signed in) as their own columns.
ALTER TABLE "members" DROP COLUMN "status";
