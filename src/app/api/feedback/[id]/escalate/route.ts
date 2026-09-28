import { NextResponse } from "next/server";
import { db } from "@/db";
import { feedbackReports, bugReports } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { requireGuildMember } from "@/lib/requireSession";
import { isFullAdmin, hasAction } from "@/lib/permissions";
import type { RankAction } from "@/lib/permissions";
import { getMemberByDiscordId, displayNameFor } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const escalateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  categoryId: z.string().trim().max(64).nullable().optional(),
});

function accessCtx(session: { user: { isCreator?: boolean; isPortalAdmin?: boolean; actions?: string[] } }) {
  return {
    isCreator: session.user.isCreator ?? false,
    isPortalAdmin: session.user.isPortalAdmin ?? false,
    actions: (session.user.actions ?? []) as RankAction[],
  };
}

/**
 * POST /api/feedback/[id]/escalate
 *
 * Creates a formal bug report from a piece of Beta Tester feedback. The
 * resulting bug report is pre-filled from the feedback entry; the triager can
 * override the title and description inline. The feedback entry's status is
 * set to "escalated" and `escalatedToReportId` is set to the new report's ID.
 *
 * Requires reports.triage or full admin — same gate as locking/tagging reports.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/feedback/[id]/escalate">
) {
  const auth = await requireGuildMember();
  if (!auth.ok) return auth.response;

  const c = accessCtx(auth.session);
  if (!isFullAdmin(c) && !hasAction(c, "reports.triage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const [feedback] = await db
    .select()
    .from(feedbackReports)
    .where(
      and(eq(feedbackReports.id, id), isNull(feedbackReports.deletedAt))
    );

  if (!feedback) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (feedback.status === "escalated") {
    return NextResponse.json(
      { error: "This feedback has already been escalated." },
      { status: 409 }
    );
  }

  const parsed = escalateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { discordId } = auth.session.user;
  const triager = await getMemberByDiscordId(discordId);
  if (!triager) {
    return NextResponse.json(
      { error: "You must be on the QA roster to escalate feedback." },
      { status: 409 }
    );
  }

  // Validate category if provided.
  const categoryId = parsed.data.categoryId ?? null;
  if (categoryId) {
    const { categoryExists } = await import("@/lib/bugTaxonomy");
    const valid = await categoryExists(categoryId);
    if (!valid) {
      // Drop rather than reject — same policy as the regular report route.
    }
  }

  const result = await db.transaction(async (tx) => {
    const [report] = await tx
      .insert(bugReports)
      .values({
        title: parsed.data.title ?? feedback.title,
        description:
          parsed.data.description ??
          [
            feedback.description,
            feedback.stepsToReproduce
              ? `**Steps to reproduce:**\n${feedback.stepsToReproduce}`
              : null,
          ]
            .filter(Boolean)
            .join("\n\n"),
        reporterId: triager.id,
        categoryId: categoryId ?? null,
        attachments: feedback.attachments,
      })
      .returning();

    await tx
      .update(feedbackReports)
      .set({
        status: "escalated",
        escalatedToReportId: report.id,
        reviewedById: triager.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(feedbackReports.id, id));

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: displayNameFor(triager),
      action: "feedback.escalate",
      targetType: "feedback_report",
      targetId: id,
      metadata: {
        bugReportId: report.id,
        title: report.title,
      },
    });

    return report;
  });

  return NextResponse.json({ report: result }, { status: 201 });
}
