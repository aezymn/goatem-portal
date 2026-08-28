import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugReports, comments } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { createCommentSchema } from "@/lib/validation";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rateLimit";
import { currentStageId, joinReport } from "@/lib/reports";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/reports/[id]/comments">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  if (!checkRateLimit(`comment-create:${discordId}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many comments recently. Try again shortly." },
      { status: 429 }
    );
  }

  const author = await getMemberByDiscordId(discordId);
  if (!author) {
    return NextResponse.json(
      { error: "You're not on the roster — ask an admin to add you first." },
      { status: 409 }
    );
  }

  const parsed = createCommentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await db.transaction(async (tx) => {
    const [report] = await tx
      .select({ id: bugReports.id })
      .from(bugReports)
      .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
      .limit(1);
    if (!report) return null;

    // A reply belongs to whatever stage the bug is at right now, so the
    // thread records what was said during each step rather than one flat
    // list. Null when no stage exists yet — it then sits under the report.
    const stageId = await currentStageId(id);

    const [comment] = await tx
      .insert(comments)
      .values({
        body: parsed.data.body,
        bugReportId: id,
        authorId: author.id,
        attachments: parsed.data.attachments ?? [],
        stageId,
      })
      .returning();

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: displayNameFor(author),
      action: "report.comment",
      targetType: "bug_report",
      targetId: id,
      metadata: { commentId: comment.id },
    });

    return comment;
  });

  if (!result) {
    return NextResponse.json({ error: "report not found" }, { status: 404 });
  }

  // Saying something about a bug puts you on it. Idempotent, so this is
  // just "make sure they're listed" rather than a second join.
  await joinReport(id, author.id);

  return NextResponse.json({ comment: result }, { status: 201 });
}
