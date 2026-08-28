import { NextResponse } from "next/server";
import { db } from "@/db";
import { testLogs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { isFullAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// Removing a test log: your own, or anyone's if you're a full admin.
// Soft delete, so a removed log is still recoverable.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/test-logs/[id]">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  const member = await getMemberByDiscordId(discordId);
  const [existing] = await db
    .select()
    .from(testLogs)
    .where(and(eq(testLogs.id, id), isNull(testLogs.deletedAt)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const isOwn = member && existing.memberId === member.id;
  if (!isOwn && !isFullAdmin(auth.session.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(testLogs)
      .set({ deletedAt: new Date() })
      .where(eq(testLogs.id, id));

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: member ? displayNameFor(member) : discordId,
      action: "testLog.delete",
      targetType: "test_log",
      targetId: id,
      metadata: { ownLog: Boolean(isOwn) },
    });
  });

  return NextResponse.json({ ok: true });
}
