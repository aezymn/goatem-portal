import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * The presence heartbeat. An open tab calls this about once a minute and
 * says whether the person has actually touched anything recently.
 *
 * It only ever writes to the caller's own row, and only two timestamps —
 * there is nothing here worth spoofing beyond making yourself look busy,
 * which the roster already can't be used to prove.
 */
export async function POST(request: Request) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;

  // A tab checks in once a minute; ten a minute is already a page doing
  // something odd. Silently accepted-but-ignored rather than a 429, since
  // a beacon has nothing useful to do with an error.
  if (!checkRateLimit(`heartbeat:${discordId}`, 10, 60_000)) {
    return new NextResponse(null, { status: 204 });
  }

  let idle = false;
  try {
    const body = (await request.json()) as { idle?: unknown };
    idle = body?.idle === true;
  } catch {
    // A beacon sent on page-hide can arrive without a parseable body.
    // Treat that as "present, no claim about activity".
  }

  const now = new Date();
  await db
    .update(members)
    .set(
      // Being idle still proves the tab is open, so lastSeenAt always
      // moves; lastActiveAt only moves on real interaction, which is what
      // separates "away" from "here".
      idle
        ? { lastSeenAt: now }
        : { lastSeenAt: now, lastActiveAt: now }
    )
    .where(and(eq(members.discordId, discordId), isNull(members.deletedAt)));

  return new NextResponse(null, { status: 204 });
}
