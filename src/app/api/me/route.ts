import { NextResponse } from "next/server";
import { requireTier } from "@/lib/requireSession";
import { getMemberByDiscordId } from "@/lib/members";
import { getGuildMemberInfo } from "@/lib/discordBot";

// Backs the navbar's identity chip: organization rank (from the roster,
// never the raw MEMBER/STAFF/ADMIN permission tier) plus a Discord-bot-
// sourced avatar and role color, when the bot's configured. Everything
// here fails soft — a person who's logged in but not yet on the roster,
// or a bot that isn't set up yet, still gets a sensible response instead
// of a broken navbar.
export async function GET() {
  const auth = await requireTier("MEMBER");
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;

  const member = await getMemberByDiscordId(discordId);
  const discordInfo = await getGuildMemberInfo(discordId);

  return NextResponse.json({
    robloxUsername: member?.robloxUsername ?? null,
    rank: member?.rank ?? null,
    avatarUrl: discordInfo?.avatarUrl ?? null,
    roleColorHex: discordInfo?.roleColorHex ?? null,
  });
}
