"use server";

import { db } from "@/db";
import { bugReports, comments } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCommentSchema } from "@/lib/validation";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rateLimit";
import { currentStageId, getReportLockState, joinReport } from "@/lib/reports";
import { revalidatePath } from "next/cache";
import { isCreatorDiscordId, isFullAdmin, type AccessContext } from "@/lib/permissions";

export async function createCommentAction(reportId: string, data: { body: string; attachments: string[]; replyToId: string | null }) {
  const session = await getServerSession(authOptions);
  
  if (!session || session.stale || !session.user?.discordId) {
    return { error: "unauthorized" };
  }

  const { discordId } = session.user;
  const ctx: AccessContext = {
    isCreator: isCreatorDiscordId(discordId),
    isPortalAdmin: session.user.isPortalAdmin,
    actions: session.user.actions ?? [],
  };

  const author = await getMemberByDiscordId(discordId);
  if (!author && !isFullAdmin(ctx)) {
    return { error: "forbidden" };
  }

  if (!checkRateLimit(`comment-create:${discordId}`, 20, 10 * 60 * 1000)) {
    return { error: "Too many comments recently. Try again shortly." };
  }

  if (!author) {
    return { error: "You're not on the roster — ask an admin to add you first." };
  }

  const parsed = createCommentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const lock = await getReportLockState(reportId);
  if (lock.locked) {
    return { error: "This report is complete and locked." };
  }

  const result = await db.transaction(async (tx) => {
    const [report] = await tx
      .select({ id: bugReports.id })
      .from(bugReports)
      .where(and(eq(bugReports.id, reportId), isNull(bugReports.deletedAt)))
      .limit(1);
    if (!report) return null;

    const stageId = await currentStageId(reportId);

    let replyToId: string | null = null;
    if (parsed.data.replyToId) {
      const [parent] = await tx
        .select({ id: comments.id })
        .from(comments)
        .where(
          and(
            eq(comments.id, parsed.data.replyToId),
            eq(comments.bugReportId, reportId),
            isNull(comments.deletedAt)
          )
        )
        .limit(1);
      replyToId = parent?.id ?? null;
    }

    const [comment] = await tx
      .insert(comments)
      .values({
        body: parsed.data.body,
        bugReportId: reportId,
        authorId: author.id,
        attachments: parsed.data.attachments ?? [],
        stageId,
        replyToId,
      })
      .returning();

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: displayNameFor(author),
      action: "report.comment",
      targetType: "bug_report",
      targetId: reportId,
      metadata: { commentId: comment.id },
    });

    return comment;
  });

  if (!result) {
    return { error: "report not found" };
  }

  await joinReport(reportId, author.id);

  revalidatePath(`/reports/${reportId}`);
  return { success: true };
}
