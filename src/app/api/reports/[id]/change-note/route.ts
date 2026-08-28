import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugReports } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { getMemberByDiscordId } from "@/lib/members";
import { saveChangeNote } from "@/lib/changelog";
import { changeNoteSchema } from "@/lib/validation";

/**
 * "What did you change because of this bug?"
 *
 * Asked of whoever worked the report once it's closed, while they still
 * remember. Deliberately allowed on a LOCKED report — locking stops the
 * conversation, but this is the one thing we still want out of people
 * afterwards, and it's what the change log gets written from.
 *
 * Always the caller's own note: one answer per person per report, edited
 * in place rather than piling up.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/reports/[id]/change-note">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  const member = await getMemberByDiscordId(discordId);
  if (!member) {
    return NextResponse.json(
      { error: "You're not on the roster." },
      { status: 409 }
    );
  }

  const [report] = await db
    .select({ id: bugReports.id })
    .from(bugReports)
    .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
    .limit(1);
  if (!report) {
    return NextResponse.json({ error: "report not found" }, { status: 404 });
  }

  const parsed = changeNoteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await saveChangeNote(id, member.id, parsed.data.body);
  return NextResponse.json({ ok: true });
}
