import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugReports, members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { isFullAdmin } from "@/lib/permissions";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { joinReport, leaveReport } from "@/lib/reports";
import { addParticipantSchema } from "@/lib/validation";

/**
 * Joining and leaving a bug report.
 *
 * The default is always yourself — people opt into a bug rather than
 * having it handed to them, which is the whole reason the assignee field
 * went away. A full admin may additionally name someone else, for the
 * case where a dev needs pulling onto a bug they haven't seen; that is
 * the ONLY path by which one person can add or remove another, and it's
 * checked against the environment-derived admin context, never a claim
 * in the request.
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

/** Resolves who the request is acting on: the caller, unless an admin
 * named somebody else and that person is a real, live roster member. */
async function targetMemberId(
  request: Request,
  selfId: string,
  canActOnOthers: boolean
): Promise<{ id: string } | { error: NextResponse }> {
  let requested: string | undefined;
  try {
    const body = await request.json();
    const parsed = addParticipantSchema.safeParse(body);
    if (parsed.success) requested = parsed.data.memberId;
  } catch {
    // No body at all is the ordinary "join me" case.
  }

  if (!requested || requested === selfId) return { id: selfId };

  if (!canActOnOthers) {
    return {
      error: NextResponse.json(
        { error: "Only an admin can add or remove someone else." },
        { status: 403 }
      ),
    };
  }

  const [target] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, requested), isNull(members.deletedAt)))
    .limit(1);

  if (!target) {
    return {
      error: NextResponse.json(
        { error: "That person isn't on the roster." },
        { status: 404 }
      ),
    };
  }
  return { id: target.id };
}

export async function POST(
  request: Request,
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

  const target = await targetMemberId(
    request,
    member.id,
    isFullAdmin(auth.session.user)
  );
  if ("error" in target) return target.error;

  await joinReport(id, target.id);
  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: displayNameFor(member),
    action: target.id === member.id ? "report.join" : "report.add_member",
    targetType: "bug_report",
    targetId: id,
    ...(target.id === member.id ? {} : { metadata: { memberId: target.id } }),
  });

  return NextResponse.json({ ok: true, joined: true });
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/reports/[id]/participants">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  const { member, response } = await actorFor(discordId);
  if (!member) return response;

  const target = await targetMemberId(
    request,
    member.id,
    isFullAdmin(auth.session.user)
  );
  if ("error" in target) return target.error;

  await leaveReport(id, target.id);
  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: displayNameFor(member),
    action: target.id === member.id ? "report.leave" : "report.remove_member",
    targetType: "bug_report",
    targetId: id,
    ...(target.id === member.id ? {} : { metadata: { memberId: target.id } }),
  });

  return NextResponse.json({ ok: true, joined: false });
}
