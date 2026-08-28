import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireAdmin } from "@/lib/requireSession";
import { createRankSchema } from "@/lib/validation";
import { createRank, listRanksWithActions } from "@/lib/ranks";
import { listGuildRoles } from "@/lib/discordBot";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";

// The Ranks admin page: the full ladder (authority order, Discord role
// binding, granted actions) plus the live list of Discord roles available
// to bind to. Everything an admin needs to render that page in one call.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const [ranks, discordRoles] = await Promise.all([
    listRanksWithActions(),
    listGuildRoles(),
  ]);

  return NextResponse.json({ ranks, discordRoles });
}

// Creating a rank. New ranks land at the bottom of the ladder with no
// Discord role bound and no actions granted — holding one confers exactly
// the baseline until an admin says otherwise.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const parsed = createRankSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid name" },
      { status: 400 }
    );
  }

  const created = await createRank(parsed.data.name);
  if (!created) {
    return NextResponse.json(
      { error: `There's already a rank called "${parsed.data.name}".` },
      { status: 409 }
    );
  }

  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor ? displayNameFor(actor) : discordId,
    action: "rank.create",
    targetType: "rank",
    targetId: parsed.data.name,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
