import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugReports, comments, members } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireRosterMember, requireAction } from "@/lib/requireSession";
import { updateReportSchema } from "@/lib/validation";
import { getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";

const assignee = alias(members, "assignee");

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/reports/[id]">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const [report] = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      description: bugReports.description,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      reporterUsername: members.robloxUsername,
      assigneeId: bugReports.assigneeId,
      assigneeUsername: assignee.robloxUsername,
    })
    .from(bugReports)
    .innerJoin(members, eq(bugReports.reporterId, members.id))
    .leftJoin(assignee, eq(bugReports.assigneeId, assignee.id))
    .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const reportComments = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorUsername: members.robloxUsername,
    })
    .from(comments)
    .innerJoin(members, eq(comments.authorId, members.id))
    .where(and(eq(comments.bugReportId, id), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt));

  return NextResponse.json({ report, comments: reportComments });
}

// Status/assignee changes need the reports.triage action — filing and
// commenting are open to any roster member, but triaging isn't.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/reports/[id]">
) {
  const auth = await requireAction("reports.triage");
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

  const parsed = updateReportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (
    parsed.data.status === undefined &&
    parsed.data.assigneeId === undefined
  ) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    );
  }

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(bugReports)
      .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
      .limit(1);
    if (!existing) return null;

    const [row] = await tx
      .update(bugReports)
      .set({
        ...(parsed.data.status !== undefined
          ? { status: parsed.data.status }
          : {}),
        ...(parsed.data.assigneeId !== undefined
          ? { assigneeId: parsed.data.assigneeId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(bugReports.id, id))
      .returning();

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: actor.robloxUsername,
      action: "report.update",
      targetType: "bug_report",
      targetId: id,
      metadata: {
        before: { status: existing.status, assigneeId: existing.assigneeId },
        after: parsed.data,
      },
    });

    return row;
  });

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ report: updated });
}

// Soft delete only, needs reports.delete — see schema notes on why
// nothing is ever actually removed from the database through this app.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/reports/[id]">
) {
  const auth = await requireAction("reports.delete");
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

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(bugReports)
      .set({ deletedAt: new Date() })
      .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
      .returning();
    if (!row) return null;

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: actor.robloxUsername,
      action: "report.delete",
      targetType: "bug_report",
      targetId: id,
    });
    return row;
  });

  if (!result) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
