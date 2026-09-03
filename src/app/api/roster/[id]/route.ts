import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAction } from "@/lib/requireSession";
import { updateMemberSchema } from "@/lib/validation";
import { getMemberByDiscordId } from "@/lib/members";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAction } from "@/lib/permissions";
import { ensureRank } from "@/lib/ranks";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/roster/[id]">
) {
  const auth = await requireAction("roster.manage");
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

      if (parsed.data.rank && parsed.data.rank !== existing.rank) {
        await ensureRank(parsed.data.rank, tx);
      }

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

// Alts are completely purged from storage so usernames are immediately freed.
// Regular members are soft-deleted to keep audit and author relations intact,
// but their robloxUsername is set to null so the username is freed from storage.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/roster/[id]">
) {
  const session = await getServerSession(authOptions);
  if (!session || session.stale || !session.user?.discordId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const { discordId } = session.user;
  const actor = await getMemberByDiscordId(discordId);
  const canManage = hasAction(session.user, "roster.manage");

  const [existing] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, id), isNull(members.deletedAt)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const isOwnerOfAlt =
    existing.source === "alt" &&
    Boolean(actor && existing.parentMemberId === actor.id);

  if (!canManage && !isOwnerOfAlt) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await db.transaction(async (tx) => {
    if (existing.source === "alt") {
      // Hard delete: alts have no bug reports, comments or session dependencies
      await tx.delete(members).where(eq(members.id, id));

      await logAudit(tx, {
        actorDiscordId: discordId,
        actorName: actor?.robloxUsername ?? discordId,
        action: "member.deleteAlt",
        targetType: "member",
        targetId: id,
        metadata: {
          robloxUsername: existing.robloxUsername,
          ownerId: existing.parentMemberId,
        },
      });
    } else {
      // Soft delete member, but release the roblox username from storage
      await tx
        .update(members)
        .set({
          deletedAt: new Date(),
          robloxUsername: null,
          robloxUserId: null,
          hasGameAccess: null,
          updatedAt: new Date(),
        })
        .where(eq(members.id, id));

      await logAudit(tx, {
        actorDiscordId: discordId,
        actorName: actor?.robloxUsername ?? discordId,
        action: "member.delete",
        targetType: "member",
        targetId: id,
        metadata: { robloxUsername: existing.robloxUsername },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
