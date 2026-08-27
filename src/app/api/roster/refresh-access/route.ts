import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { requireAction } from "@/lib/requireSession";
import { getMemberByDiscordId, displayNameFor } from "@/lib/members";
import { isRobloxGroupConfigured, refreshGameAccess } from "@/lib/roblox";
import { logAudit } from "@/lib/audit";

// Re-checks Roblox group membership for everyone with a linked account.
// Linking already checks once, but a row can carry a username that was
// never checked — anyone added by hand, or linked before ROBLOX_GROUP_ID
// was set — and would otherwise read "unknown" forever.
export async function POST() {
  const auth = await requireAction("roster.manage");
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;

  if (!isRobloxGroupConfigured()) {
    return NextResponse.json(
      {
        error:
          "No Roblox group is configured (ROBLOX_GROUP_ID), so there's nothing to check against.",
      },
      { status: 400 }
    );
  }

  const rows = await db
    .select({
      id: members.id,
      robloxUsername: members.robloxUsername,
      robloxUserId: members.robloxUserId,
    })
    .from(members)
    .where(isNull(members.deletedAt));

  const linked = rows.filter((r) => r.robloxUsername);
  if (linked.length === 0) {
    return NextResponse.json({
      checked: 0,
      failed: 0,
      unlinked: rows.length,
      message: "Nobody has linked a Roblox account yet.",
    });
  }

  const result = await refreshGameAccess(linked, async (id, userId, access) => {
    await db
      .update(members)
      .set({
        robloxUserId: userId,
        hasGameAccess: access,
        gameAccessCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(members.id, id));
  });

  const actor = await getMemberByDiscordId(discordId);
  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor ? displayNameFor(actor) : discordId,
    action: "roster.refreshGameAccess",
    targetType: "roster",
    metadata: { checked: result.checked, failed: result.failed },
  });

  return NextResponse.json({
    ...result,
    unlinked: rows.length - linked.length,
  });
}
