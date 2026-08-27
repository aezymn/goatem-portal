import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireTier } from "@/lib/requireSession";
import { updateMemberSchema } from "@/lib/validation";
import { getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/roster/[id]">
) {
  const auth = await requireTier("ADMIN");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const parsed = updateMemberSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(members)
        .where(and(eq(members.id, id), isNull(members.deletedAt)))
        .limit(1);
      if (!existing) return null;

      const [row] = await tx
        .update(members)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(members.id, id))
        .returning();

      await logAudit(tx, {
        actorDiscordId: discordId,
        actorName: actor?.robloxUsername ?? discordId,
        action: "member.update",
        targetType: "member",
        targetId: id,
        metadata: { before: existing, after: parsed.data },
      });

      return row;
    });

    if (!updated) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ member: updated });
  } catch (err) {
    console.error("member.update failed:", err);
    return NextResponse.json(
      { error: "That Roblox username or Discord ID is already on the roster." },
      { status: 409 }
    );
  }
}

// Soft delete only, ADMIN+.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/roster/[id]">
) {
  const auth = await requireTier("ADMIN");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(members)
      .set({ deletedAt: new Date() })
      .where(and(eq(members.id, id), isNull(members.deletedAt)))
      .returning();
    if (!row) return null;

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: actor?.robloxUsername ?? discordId,
      action: "member.delete",
      targetType: "member",
      targetId: id,
      metadata: { robloxUsername: row.robloxUsername },
    });
    return row;
  });

  if (!result) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
