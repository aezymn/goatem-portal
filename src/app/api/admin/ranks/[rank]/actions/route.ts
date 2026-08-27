import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireSession";
import { setRankActionSchema } from "@/lib/validation";
import { isRankAction } from "@/lib/permissions";
import { setRankAction } from "@/lib/ranks";
import { getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { db } from "@/db";

// Turns one specific action on or off for a rank — the granular
// replacement for the old blanket STAFF/ADMIN eligibility toggle. See
// RANK_ACTIONS in src/lib/permissions.ts for the fixed catalog.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/ranks/[rank]/actions">
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { rank } = await ctx.params;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const parsed = setRankActionSchema.safeParse(await request.json());
  if (!parsed.success || !isRankAction(parsed.data.action)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await setRankAction(rank, parsed.data.action, parsed.data.granted);

  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor?.robloxUsername ?? discordId,
    action: "rank.setAction",
    targetType: "rank",
    targetId: rank,
    metadata: { action: parsed.data.action, granted: parsed.data.granted },
  });

  return NextResponse.json({ ok: true });
}
