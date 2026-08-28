import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugReports } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { joinReport, leaveReport } from "@/lib/reports";

/**
 * Joining and leaving a bug report — always yourself, never anyone else.
 *
 * There's deliberately no way to add another person: the whole point of
 * replacing the assignee field was that people opt into a bug rather than
 * having it handed to them. So neither route reads a member id from the
 * body; both act on the caller.
 */

async function actorFor(discordId: string) {
  const member = await getMemberByDiscordId(discordId);
  if (!member) {
    return {
      member: null,
      response: NextResponse.json(
        { error: "You're not on the roster — ask an admin to add you first." },
        { status: 409 }
      ),
    };
  }
  return { member, response: null };
}

async function liveReport(id: string) {
  const [row] = await db
    .select({ id: bugReports.id })
    .from(bugReports)
    .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/reports/[id]/participants">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  const { member, response } = await actorFor(discordId);
  if (!member) return response;

  if (!(await liveReport(id))) {
    return NextResponse.json({ error: "report not found" }, { status: 404 });
  }

  await joinReport(id, member.id);
  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: displayNameFor(member),
    action: "report.join",
    targetType: "bug_report",
    targetId: id,
  });

  return NextResponse.json({ ok: true, joined: true });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/reports/[id]/participants">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  const { member, response } = await actorFor(discordId);
  if (!member) return response;

  await leaveReport(id, member.id);
  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: displayNameFor(member),
    action: "report.leave",
    targetType: "bug_report",
    targetId: id,
  });

  return NextResponse.json({ ok: true, joined: false });
}
