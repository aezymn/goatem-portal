import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugReports } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { isFullAdmin } from "@/lib/permissions";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { addStage, getReportLockState, isParticipant } from "@/lib/reports";
import { createStageSchema } from "@/lib/validation";

/**
 * Adding a stage to a bug.
 *
 * Who's allowed: anyone who has joined the report (the people actually
 * working it), the person who filed it, or a full admin. Deliberately not
 * "any roster member" — a stage is a claim about where the work has got
 * to, and that should come from someone involved in the work.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/reports/[id]/stages">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  const actor = await getMemberByDiscordId(discordId);
  if (!actor) {
    return NextResponse.json(
      { error: "You're not on the roster — ask an admin to add you first." },
      { status: 409 }
    );
  }

  const [report] = await db
    .select({ id: bugReports.id, reporterId: bugReports.reporterId })
    .from(bugReports)
    .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
    .limit(1);
  if (!report) {
    return NextResponse.json({ error: "report not found" }, { status: 404 });
  }

  if ((await getReportLockState(id)).locked) {
    return NextResponse.json(
      { error: "This report is complete and locked." },
      { status: 409 }
    );
  }

  const allowed =
    isFullAdmin(auth.session.user) ||
    report.reporterId === actor.id ||
    (await isParticipant(id, actor.id));

  if (!allowed) {
    return NextResponse.json(
      { error: "Join this bug before adding a stage to it." },
      { status: 403 }
    );
  }

  const parsed = createStageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const stage = await addStage(
    id,
    actor.id,
    parsed.data.title,
    parsed.data.note ?? null
  );

  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: displayNameFor(actor),
    action: "report.stage.add",
    targetType: "bug_report",
    targetId: id,
    metadata: { stageId: stage?.id, title: parsed.data.title },
  });

  return NextResponse.json({ stage }, { status: 201 });
}
