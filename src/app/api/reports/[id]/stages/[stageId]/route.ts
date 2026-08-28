import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugStages } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { isFullAdmin } from "@/lib/permissions";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { removeStage } from "@/lib/reports";

/** Removing a stage: whoever added it, or a full admin. The comments
 * written under it survive and fall back under the report. */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/reports/[id]/stages/[stageId]">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id, stageId } = await ctx.params;
  const { discordId } = auth.session.user;

  const actor = await getMemberByDiscordId(discordId);
  if (!actor) {
    return NextResponse.json(
      { error: "You're not on the roster." },
      { status: 409 }
    );
  }

  const [stage] = await db
    .select()
    .from(bugStages)
    .where(
      and(
        eq(bugStages.id, stageId),
        eq(bugStages.bugReportId, id),
        isNull(bugStages.deletedAt)
      )
    )
    .limit(1);
  if (!stage) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (stage.createdById !== actor.id && !isFullAdmin(auth.session.user)) {
    return NextResponse.json(
      { error: "Only whoever added this stage can remove it." },
      { status: 403 }
    );
  }

  await removeStage(stageId);
  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: displayNameFor(actor),
    action: "report.stage.remove",
    targetType: "bug_report",
    targetId: id,
    metadata: { stageId, title: stage.title },
  });

  return NextResponse.json({ ok: true });
}
