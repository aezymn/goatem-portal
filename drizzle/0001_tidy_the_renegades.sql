CREATE TYPE "public"."tier" AS ENUM('STAFF', 'ADMIN');--> statement-breakpoint
CREATE TABLE "rank_permissions" (
	"rank" text PRIMARY KEY NOT NULL,
	"eligible_tier" "tier",
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "granted_tier" "tier";