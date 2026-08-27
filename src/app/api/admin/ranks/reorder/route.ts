import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireSession";
import { reorderRanksSchema } from "@/lib/validation";
import { reorderRanks } from "@/lib/ranks";
import { getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { db } from "@/db";

// Bulk reorder — the client sends the full ladder back in its new order
// after a drag, one request per drop rather than one per pairwise swap.
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const parsed = reorderRanksSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await reorderRanks(parsed.data.order);
  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor?.robloxUsername ?? discordId,
    action: "rank.reorder",
    targetType: "rank",
    metadata: { order: parsed.data.order },
  });

  return NextResponse.json({ ok: true });
}
