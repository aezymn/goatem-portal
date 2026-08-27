import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { asc, isNull } from "drizzle-orm";
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

  try {
    const created = await db.transaction(async (tx) => {
      // Make sure this rank has a row on the Ranks admin page even if
      // it's never been seen before, so it's immediately configurable
      // instead of only showing up via a defensive merge.
      await ensureRank(parsed.data.rank, tx);

      const [member] = await tx
        .insert(members)
        .values({
          robloxUsername: parsed.data.robloxUsername,
          discordId: parsed.data.discordId ?? null,
          rank: parsed.data.rank,
          status: parsed.data.status ?? null,
          notes: parsed.data.notes ?? null,
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

      return member;
    });

    return NextResponse.json({ member: created }, { status: 201 });
  } catch (err) {
    // Unique constraint on robloxUsername / discordId — the two things
    // this table treats as identity. Log the real error server-side only;
    // never echo raw DB/driver error text back to the client.
    console.error("member.create failed:", err);
    return NextResponse.json(
      { error: "That Roblox username or Discord ID is already on the roster." },
      { status: 409 }
    );
  }
}
