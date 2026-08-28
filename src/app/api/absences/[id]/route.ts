import { NextResponse } from "next/server";
import { db } from "@/db";
import { absences } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { isFullAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// Withdrawing an absence notice. You can remove your own; full admins can
// remove anyone's (a bogus one shouldn't be permanent). Soft delete, like
// everything else here.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/absences/[id]">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  const member = await getMemberByDiscordId(discordId);
  const [existing] = await db
    .select()
    .from(absences)
    .where(and(eq(absences.id, id), isNull(absences.deletedAt)))
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
      .update(absences)
      .set({ deletedAt: new Date() })
      .where(eq(absences.id, id));

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: member ? displayNameFor(member) : discordId,
      action: "absence.delete",
      targetType: "absence",
      targetId: id,
      metadata: { ownAbsence: Boolean(isOwn) },
    });
  });

  return NextResponse.json({ ok: true });
}
