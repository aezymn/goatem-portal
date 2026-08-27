import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireSession";
import { bindRankDiscordRoleSchema } from "@/lib/validation";
import { deleteRank, setRankDiscordRole } from "@/lib/ranks";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { db } from "@/db";

// Binding (or clearing) which Discord role a rank corresponds to. Purely
// informational for now — see src/db/schema.ts — it plays no part in
// permission resolution, only in labeling.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/ranks/[rank]">
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { rank } = await ctx.params;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const parsed = bindRankDiscordRoleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await setRankDiscordRole(rank, parsed.data.discordRoleId);
  } catch (err) {
    console.error("rank.bindDiscordRole failed:", err);
    return NextResponse.json(
      { error: "That Discord role is already bound to a different rank." },
      { status: 409 }
    );
  }

  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor?.robloxUsername ?? discordId,
    action: "rank.bindDiscordRole",
    targetType: "rank",
    targetId: rank,
    metadata: { discordRoleId: parsed.data.discordRoleId },
  });

  return NextResponse.json({ ok: true });
}

// Deleting a rank. Refused while anyone still holds it — see deleteRank
// in src/lib/ranks.ts for why that guard exists rather than cascading.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/ranks/[rank]">
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { rank } = await ctx.params;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const result = await deleteRank(rank);

  if (!result.ok && result.reason === "in-use") {
    return NextResponse.json(
      {
        error: `${result.memberCount} ${
          result.memberCount === 1 ? "person still holds" : "people still hold"
        } this rank. Move them to another rank first.`,
      },
      { status: 409 }
    );
  }
  if (!result.ok) {
    return NextResponse.json({ error: "No such rank." }, { status: 404 });
  }

  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor ? displayNameFor(actor) : discordId,
    action: "rank.delete",
    targetType: "rank",
    targetId: rank,
  });

  return NextResponse.json({ ok: true });
}
