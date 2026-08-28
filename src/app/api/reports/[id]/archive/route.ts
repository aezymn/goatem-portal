import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugReports } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAction } from "@/lib/requireSession";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { setArchived } from "@/lib/reports";

/** Archiving by hand, for reports that are done before the 30-day timer
 * gets to them. POST archives, DELETE brings it back. */
async function run(id: string, archived: boolean) {
  const auth = await requireAction("reports.triage");
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;

  const [report] = await db
    .select({ id: bugReports.id })
    .from(bugReports)
    .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
    .limit(1);
  if (!report) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await setArchived(id, archived);

  const actor = await getMemberByDiscordId(discordId);
  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor ? displayNameFor(actor) : discordId,
    action: archived ? "report.archive" : "report.unarchive",
    targetType: "bug_report",
    targetId: id,
  });

  return NextResponse.json({ ok: true, archived });
}

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/reports/[id]/archive">
) {
  return run((await ctx.params).id, true);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/reports/[id]/archive">
) {
  return run((await ctx.params).id, false);
}
