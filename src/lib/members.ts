import { db } from "@/db";
import { members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * What to call someone in the UI and in the audit trail.
 *
 * Since people now land on the roster from Discord before they've ever
 * signed in, a roster row can exist with no Roblox username at all — so
 * every display path needs an ordered fallback rather than assuming one
 * is present. Roblox username first (it's the identity that matters for
 * the game), then their Discord name, then the raw ID as a last resort.
 */
export function displayNameFor(member: {
  robloxUsername?: string | null;
  discordUsername?: string | null;
  discordId?: string | null;
}): string {
  return (
    member.robloxUsername ??
    member.discordUsername ??
    member.discordId ??
    "Unknown member"
  );
}

/** Looks up the roster row for a logged-in person by their Discord ID.
 * Returns undefined if they haven't been added to the roster yet (or their
 * row was soft-deleted) — callers should surface a clear "ask an admin to
 * add you to the roster" message rather than a generic error. */
export async function getMemberByDiscordId(discordId: string) {
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.discordId, discordId), isNull(members.deletedAt)))
    .limit(1);
  return member;
}

/**
 * Records that this person has actually logged into the portal — what the
 * roster's SIGNED IN column reports. Being on the roster no longer implies
 * having ever signed in (people are placed there from Discord), so this is
 * tracked separately.
 *
 * Best-effort by design: it runs during sign-in, and nobody should be
 * blocked from logging in because a bookkeeping write failed.
 */
export async function markSignedIn(discordId: string): Promise<void> {
  try {
    await db
      .update(members)
      .set({ hasSignedIn: true, lastSignInAt: new Date() })
      .where(and(eq(members.discordId, discordId), isNull(members.deletedAt)));
  } catch (err) {
    console.error("[auth] couldn't record sign-in:", err);
  }
}
