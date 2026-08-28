import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugReports, members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember, requireAction } from "@/lib/requireSession";
import { updateReportSchema } from "@/lib/validation";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import {
  categoryExists,
  setReportTags,
  tagsForReports,
} from "@/lib/bugTaxonomy";
import { getReportParticipants, getReportTimeline } from "@/lib/reports";

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
      categoryId: bugReports.categoryId,
      attachments: bugReports.attachments,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      reporterId: bugReports.reporterId,
      reporterUsername: members.robloxUsername,
    })
    .from(bugReports)
    .innerJoin(members, eq(bugReports.reporterId, members.id))
    .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [tags, timeline, participants] = await Promise.all([
    tagsForReports([id]),
    getReportTimeline(id),
    getReportParticipants(id, report.reporterId),
  ]);

  return NextResponse.json({
    report: { ...report, tags: tags.get(id) ?? [] },
    timeline,
    participants,
  });
}

// Retitling, recategorising and retagging all need reports.triage.
// Filing, commenting and joining are open to any roster member; deciding
// what a bug IS isn't.
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

  const { title, categoryId, tagIds } = parsed.data;

  // null clears the category; an unknown id is treated as clearing it too
  // rather than 400ing, so a stale dropdown can't block a legitimate edit.
  let nextCategoryId: string | null | undefined;
  if (categoryId !== undefined) {
    nextCategoryId =
      categoryId && (await categoryExists(categoryId)) ? categoryId : null;
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
        ...(title !== undefined ? { title } : {}),
        ...(nextCategoryId !== undefined
          ? { categoryId: nextCategoryId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(bugReports.id, id))
      .returning();

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: displayNameFor(actor),
      action: "report.update",
      targetType: "bug_report",
      targetId: id,
      metadata: {
        before: { title: existing.title, categoryId: existing.categoryId },
        after: { title, categoryId: nextCategoryId, tagIds },
      },
    });

    return row;
  });

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (tagIds !== undefined) await setReportTags(id, tagIds);

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
      actorName: displayNameFor(actor),
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
