import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberByDiscordId } from "@/lib/members";
import { getRankActions } from "@/lib/ranks";
import { isCreatorConfigured, isCreatorDiscordId } from "@/lib/permissions";

/**
 * A read-only "what does the server actually think I am" endpoint, for
 * diagnosing access problems without guessing.
 *
 * Deliberately available to any signed-in guild member (it has to be:
 * when nobody is CREATOR, nobody is an admin either, so gating it behind
 * admin would make it useless in exactly the situation it exists for).
 * It leaks nothing: `creatorConfigured` is a boolean, never the
 * configured ID, and everything else is the caller's own access, which
 * they can already observe by using the app.
 *
 * `isCreator` here is re-derived the same way every real gate derives it
 * (see src/lib/requireSession.ts), NOT read off the session token — so if
 * this says false, that is genuinely why doors are closed, rather than a
 * display quirk.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.stale || !session.user?.discordId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { discordId } = session.user;
  const member = await getMemberByDiscordId(discordId);
  const isCreator = isCreatorDiscordId(discordId);

  return NextResponse.json({
    discordId,
    // The two together separate "no CREATOR is set on this deployment"
    // from "one is, but it isn't this account."
    creatorConfigured: isCreatorConfigured(),
    isCreator,
    // What the session token claims, for comparison. A mismatch against
    // isCreator above means the token predates the current config and a
    // sign-out/sign-in will refresh it.
    sessionClaimsCreator: session.user.isCreator ?? false,
    isPortalAdmin: member?.isPortalAdmin ?? false,
    onRoster: Boolean(member),
    rank: member?.rank ?? null,
    rankActions: member ? await getRankActions(member.rank) : [],
  });
}
