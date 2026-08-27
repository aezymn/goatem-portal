import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireCreator } from "@/lib/requireSession";
import { getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";

// Revokes portal-admin status. CREATOR-only, same as everything else
// under /api/admin/admins — see that route's file for why.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/admins/[id]">
) {
  const auth = await requireCreator();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(members)
      .set({ isPortalAdmin: false, updatedAt: new Date() })
      .where(and(eq(members.id, id), isNull(members.deletedAt)))
      .returning();
    if (!row) return null;

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: actor?.robloxUsername ?? discordId,
      action: "admin.revoke",
      targetType: "member",
      targetId: row.id,
      metadata: { robloxUsername: row.robloxUsername },
    });
    return row;
  });

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
