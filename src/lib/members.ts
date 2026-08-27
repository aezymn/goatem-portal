import { db } from "@/db";
import { members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

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
