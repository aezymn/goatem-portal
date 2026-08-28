import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberByDiscordId } from "@/lib/members";
import { LinkRobloxGate, AlreadyLinked } from "@/components/LinkRobloxGate";

export const dynamic = "force-dynamic";

/**
 * The one thing the portal insists on before anything else.
 *
 * Note what this does NOT do when the database says they're already
 * linked: redirect. The proxy routes people here off a claim carried on
 * their token, and a server redirect back would just bounce off that
 * stale claim and land here again — an infinite loop, which is exactly
 * what happened the first time this was written. Instead it renders a
 * component that refreshes the token first and then navigates, so the
 * thing that sent them here stops sending them here.
 */
export default async function LinkRobloxPage() {
  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;
  if (!live?.user?.discordId) redirect("/sign-in");

  const member = await getMemberByDiscordId(live.user.discordId);
  if (member?.robloxUsername) return <AlreadyLinked />;

  return <LinkRobloxGate onRoster={Boolean(member)} />;
}
