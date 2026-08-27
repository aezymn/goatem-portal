import { NextResponse } from "next/server";
import { db } from "@/db";
import { rankPermissions } from "@/db/schema";
import { requireTier } from "@/lib/requireSession";
import { setRankEligibilitySchema } from "@/lib/validation";
import { getMemberByDiscordId } from "@/lib/members";
import { listRankEligibility } from "@/lib/rankPermissions";
import { logAudit } from "@/lib/audit";

// Configuring which ranks are even eligible to be granted access is the
// ceiling half of the permission model (see src/lib/permissions.ts) — the
// other half, actually granting a specific person, lives on
// PATCH /api/roster/[id]. Both are ADMIN-only and audit-logged.

export async function GET() {
  const auth = await requireTier("ADMIN");
  if (!auth.ok) return auth.response;

  const ranks = await listRankEligibility();
  return NextResponse.json({ ranks });
}

export async function PATCH(request: Request) {
  const auth = await requireTier("ADMIN");
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const parsed = setRankEligibilitySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { rank, eligibleTier } = parsed.data;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(rankPermissions)
      .values({ rank, eligibleTier })
      .onConflictDoUpdate({
        target: rankPermissions.rank,
        set: { eligibleTier, updatedAt: new Date() },
      })
      .returning();

    // Deliberately no cleanup step for members whose grant now exceeds
    // this: resolveTier() caps at read time, so lowering (or clearing) a
    // rank's eligibility takes effect for everyone holding that rank the
    // moment this commits, without touching their stored grantedTier.
    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: actor?.robloxUsername ?? discordId,
      action: "rankPermission.update",
      targetType: "rank",
      targetId: rank,
      metadata: { eligibleTier },
    });

    return row;
  });

  return NextResponse.json({ rankPermission: updated });
}
