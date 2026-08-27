import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberByDiscordId } from "@/lib/members";
import { linkRobloxSchema } from "@/lib/validation";
import { lookupRobloxAccount } from "@/lib/roblox";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";

// Linking your OWN Roblox account. Deliberately not gated behind any rank
// action or roster membership: this is the first thing a new person does,
// before they have either. It only ever writes to the caller's own row.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.stale || !session.user?.discordId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { discordId } = session.user;

  // Each attempt costs a Roblox API call, so cap how fast someone can
  // burn through guesses.
  if (!checkRateLimit(`roblox-link:${discordId}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many attempts just now. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const parsed = linkRobloxSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid username" },
      { status: 400 }
    );
  }

  const member = await getMemberByDiscordId(discordId);
  if (!member) {
    return NextResponse.json(
      {
        error:
          "You're not on the roster yet — an admin needs to sync the roster from Discord, or add you by hand, before you can link an account.",
      },
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

  // Someone else already claimed it. Checked explicitly so the answer is
  // a clear message rather than a unique-constraint error.
  const [taken] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.robloxUsername, account.user.name),
        ne(members.id, member.id),
        isNull(members.deletedAt)
      )
    )
    .limit(1);
  if (taken) {
    return NextResponse.json(
      { error: "That Roblox account is already linked to someone else." },
      { status: 409 }
    );
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(members)
      .set({
        // Roblox's canonical spelling, not whatever casing was typed.
        robloxUsername: account.user.name,
        robloxUserId: String(account.user.id),
        hasGameAccess: account.hasGameAccess,
        gameAccessCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(members.id, member.id))
      .returning();

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: row.discordUsername ?? discordId,
      action: "member.linkRoblox",
      targetType: "member",
      targetId: row.id,
      metadata: {
        robloxUsername: row.robloxUsername,
        hasGameAccess: row.hasGameAccess,
      },
    });

    return row;
  });

  return NextResponse.json({ member: updated });
}
