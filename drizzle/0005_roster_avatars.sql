-- Cached at sync time so rendering the roster costs no Discord calls.
ALTER TABLE "members" ADD COLUMN "discord_avatar_url" text;
