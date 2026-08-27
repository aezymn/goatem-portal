import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberByDiscordId } from "@/lib/members";
import { addAltSchema } from "@/lib/validation";
import { lookupRobloxAccount } from "@/lib/roblox";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";

const MAX_ALTS_PER_PERSON = 10;

// Registering an alt / testing account against yourself. Each one becomes
// its own roster row (source='alt') carrying its own GAME ACCESS result,
// pointed back at the owner — so the roster shows whether each individual
// account can actually get into the game, which is the point of tracking
// them at all.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.stale || !session.user?.discordId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { discordId } = session.user;

  if (!checkRateLimit(`roblox-alt:${discordId}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many attempts just now. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const parsed = addAltSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid username" },
      { status: 400 }
    );
  }

  const owner = await getMemberByDiscordId(discordId);
  if (!owner) {
    return NextResponse.json(
      { error: "You need to be on the roster before adding alt accounts." },
      { status: 409 }
    );
  }

  const existingAlts = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(eq(members.parentMemberId, owner.id), isNull(members.deletedAt))
    );
  if (existingAlts.length >= MAX_ALTS_PER_PERSON) {
    return NextResponse.json(
      { error: `That's the limit of ${MAX_ALTS_PER_PERSON} alt accounts.` },
      { status: 409 }
    );
  }

  const account = await lookupRobloxAccount(parsed.data.robloxUsername);
  if (!account) {
    return NextResponse.json(
      { error: "No Roblox account with that username. Check the spelling?" },
      { status: 404 }
    );
  }

  const [taken] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.robloxUsername, account.user.name),
        isNull(members.deletedAt)
      )
    )
    .limit(1);
  if (taken) {
    return NextResponse.json(
      { error: "That Roblox account is already on the roster." },
      { status: 409 }
    );
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(members)
      .values({
        robloxUsername: account.user.name,
        robloxUserId: String(account.user.id),
        // Alts inherit the owner's rank for display, but carry no Discord
        // identity of their own — nobody signs in as an alt, so they can
        // never be a route to portal access.
        rank: owner.rank,
        source: "alt",
        parentMemberId: owner.id,
        hasGameAccess: account.hasGameAccess,
        gameAccessCheckedAt: new Date(),
      })
      .returning();

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: owner.robloxUsername ?? owner.discordUsername ?? discordId,
      action: "member.addAlt",
      targetType: "member",
      targetId: row.id,
      metadata: {
        robloxUsername: row.robloxUsername,
        ownerId: owner.id,
        hasGameAccess: row.hasGameAccess,
      },
    });

    return row;
  });

  return NextResponse.json({ member: created }, { status: 201 });
}
