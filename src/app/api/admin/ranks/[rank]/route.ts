import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireSession";
import { updateRankSchema } from "@/lib/validation";
import { deleteRank, renameRank, setRankDiscordRole } from "@/lib/ranks";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { db } from "@/db";

// Editing a rank: renaming it, and/or binding it to a Discord role.
// The role binding is what puts people on the roster at this rank (see
// src/lib/rosterSync.ts); it still plays no part in what the rank can DO.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/ranks/[rank]">
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { rank } = await ctx.params;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);
  const actorName = actor ? displayNameFor(actor) : discordId;

  const parsed = updateRankSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Rename first: everything below refers to the rank by name, so doing
  // it in the other order would target a name that no longer exists.
  let currentName = rank;
  if (parsed.data.name !== undefined && parsed.data.name !== rank) {
    const result = await renameRank(rank, parsed.data.name);

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.reason === "name-taken"
              ? `There's already a rank called "${parsed.data.name}".`
              : "No such rank.",
        },
        { status: result.reason === "name-taken" ? 409 : 404 }
      );
    }

    currentName = parsed.data.name;
    await logAudit(db, {
      actorDiscordId: discordId,
      actorName,
      action: "rank.rename",
      targetType: "rank",
      targetId: currentName,
      metadata: {
        from: rank,
        to: currentName,
        membersMoved: result.movedMembers,
      },
    });
  }

  if (parsed.data.discordRoleId !== undefined) {
    try {
      await setRankDiscordRole(currentName, parsed.data.discordRoleId);
    } catch (err) {
      console.error("rank.bindDiscordRole failed:", err);
      return NextResponse.json(
        { error: "That Discord role is already bound to a different rank." },
        { status: 409 }
      );
    }

    await logAudit(db, {
      actorDiscordId: discordId,
      actorName,
      action: "rank.bindDiscordRole",
      targetType: "rank",
      targetId: currentName,
      metadata: { discordRoleId: parsed.data.discordRoleId },
    });
  }

  return NextResponse.json({ ok: true, name: currentName });
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
