import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { asc, eq, isNull, or } from "drizzle-orm";
import { requireRosterMember, requireAction } from "@/lib/requireSession";
import { createMemberSchema } from "@/lib/validation";
import { getMemberByDiscordId } from "@/lib/members";
import { ensureRank } from "@/lib/ranks";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;

  const rows = await db
    .select()
    .from(members)
    .where(isNull(members.deletedAt))
    .orderBy(asc(members.rank), asc(members.robloxUsername));

  return NextResponse.json({ members: rows });
}

// Adding people to the roster needs the roster.manage action (full admins
// always have it too) — manual, not a live Roblox group sync in phase 1,
// see SETUP.md for why.
export async function POST(request: Request) {
  const auth = await requireAction("roster.manage");
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;

  const actor = await getMemberByDiscordId(discordId);

  const parsed = createMemberSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      // Make sure this rank has a row on the Ranks admin page even if
      // it's never been seen before, so it's immediately configurable
      // instead of only showing up via a defensive merge.
      await ensureRank(data.rank, tx);

      // roblox_username and discord_id are UNIQUE across the whole table,
      // including soft-deleted rows — so someone who was removed still
      // "owns" those values even though they're invisible on the roster.
      // Without this lookup, re-adding them fails with a baffling
      // "already on the roster" for a roster they can't see them on.
      // Instead: find the old row and bring it back.
      const identityMatches = [eq(members.robloxUsername, data.robloxUsername)];
      if (data.discordId) {
        identityMatches.push(eq(members.discordId, data.discordId));
      }
      const existing = await tx
        .select()
        .from(members)
        .where(or(...identityMatches));

      const live = existing.filter((m) => m.deletedAt === null);
      if (live.length > 0) {
        return { status: "conflict" as const };
      }

      // More than one removed person shares these details — reviving
      // would mean guessing which. Rare enough to just say so plainly.
      if (existing.length > 1) {
        return { status: "ambiguous" as const };
      }

      if (existing.length === 1) {
        const [revived] = await tx
          .update(members)
          .set({
            robloxUsername: data.robloxUsername,
            discordId: data.discordId ?? null,
            rank: data.rank,
            status: data.status ?? null,
            notes: data.notes ?? null,
            // Deliberately NOT restoring any previous isPortalAdmin — a
            // removed admin coming back has to be re-designated by the
            // CREATOR, not silently re-elevated by a roster edit.
            isPortalAdmin: false,
            deletedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(members.id, existing[0].id))
          .returning();

        await logAudit(tx, {
          actorDiscordId: discordId,
          actorName: actor?.robloxUsername ?? discordId,
          action: "member.restore",
          targetType: "member",
          targetId: revived.id,
          metadata: {
            robloxUsername: revived.robloxUsername,
            rank: revived.rank,
            note: "re-added someone previously removed; prior row restored",
          },
        });

        return { status: "revived" as const, member: revived };
      }

      const [member] = await tx
        .insert(members)
        .values({
          robloxUsername: data.robloxUsername,
          discordId: data.discordId ?? null,
          rank: data.rank,
          status: data.status ?? null,
          notes: data.notes ?? null,
        })
        .returning();

      await logAudit(tx, {
        actorDiscordId: discordId,
        actorName: actor?.robloxUsername ?? discordId,
        action: "member.create",
        targetType: "member",
        targetId: member.id,
        metadata: { robloxUsername: member.robloxUsername, rank: member.rank },
      });

      return { status: "created" as const, member };
    });

    if (result.status === "conflict") {
      return NextResponse.json(
        {
          error: "That Roblox username or Discord ID is already on the roster.",
        },
        { status: 409 }
      );
    }
    if (result.status === "ambiguous") {
      return NextResponse.json(
        {
          error:
            "More than one previously-removed person matches that Roblox username or Discord ID. Sort it out in the database before re-adding.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { member: result.member, restored: result.status === "revived" },
      { status: 201 }
    );
  } catch (err) {
    // Log the real error server-side only; never echo raw DB/driver error
    // text back to the client.
    console.error("member.create failed:", err);
    return NextResponse.json(
      { error: "Couldn't add that person to the roster." },
      { status: 500 }
    );
  }
}
