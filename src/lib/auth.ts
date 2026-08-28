import type { AuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { getMemberByDiscordId, hasRobloxLink, markSignedIn } from "@/lib/members";
import { getRankActions } from "@/lib/ranks";
import { isCreatorDiscordId } from "@/lib/permissions";
import type { RankAction } from "@/lib/permissions";

// How often (ms) a live session re-verifies guild membership and
// recomputes access (portal-admin flag, rank actions). Bounds how stale
// someone's access can get after they're kicked from the guild, or after
// an admin changes a grant or a rank's actions — worst case is this
// window, not "until they happen to log out."
const RECHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * The outcome of a guild-membership check. Deliberately four states, not
 * a boolean: "we asked Discord and they are not in the server" and "we
 * couldn't ask Discord" are completely different facts, and collapsing
 * them means a rate limit or an outage tells someone they've been kicked
 * out of the studio. That is exactly the bug this type exists to prevent.
 */
type MembershipStatus =
  | "member"
  | "not-member" // Discord answered: they really aren't in the guild
  | "unauthorized" // token rejected, or missing the guilds.members.read scope
  | "unavailable"; // rate limited, Discord 5xx, network failure — unknown

/**
 * Checks whether the caller is currently a member of the studio's Discord
 * guild, using their own OAuth access token (scope: guilds.members.read)
 * — no bot token or special intents required. This is ONLY a login gate;
 * it says nothing about what they can do once they're in. CREATOR status,
 * portal-admin, and rank actions are all resolved separately — see
 * src/lib/permissions.ts.
 */
async function checkGuildMembership(
  accessToken: string
): Promise<MembershipStatus> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error("DISCORD_GUILD_ID is not configured");

  let res: Response;
  try {
    res = await fetch(
      `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (err) {
    console.error("[auth] guild membership check threw:", err);
    return "unavailable";
  }

  if (res.ok) return "member";

  // Logged with the status so the real cause is visible in the hosting
  // logs rather than having to be inferred from a generic rejection.
  console.error(
    `[auth] guild membership check failed: HTTP ${res.status}`,
    res.status === 429
      ? "(rate limited by Discord)"
      : res.status === 401 || res.status === 403
        ? "(token rejected or missing the guilds.members.read scope)"
        : ""
  );

  if (res.status === 404) return "not-member";
  if (res.status === 401 || res.status === 403) return "unauthorized";
  return "unavailable";
}

/** Looks up this person's roster row and resolves the actions their
 * current rank grants. Empty array if they're not on the roster, or
 * their rank has none configured — CREATOR/portal-admin status is
 * layered on top of this separately (see src/lib/permissions.ts). */
async function computeRankActions(discordId: string): Promise<RankAction[]> {
  const member = await getMemberByDiscordId(discordId);
  if (!member) return [];
  return getRankActions(member.rank);
}

async function computeIsPortalAdmin(discordId: string): Promise<boolean> {
  const member = await getMemberByDiscordId(discordId);
  return member?.isPortalAdmin ?? false;
}

export const authOptions: AuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify guilds.members.read" } },
    }),
  ],
  session: {
    strategy: "jwt",
    // Forces a fresh sign-in at least this often, independent of the
    // recheck above — a hard ceiling on session lifetime.
    maxAge: 12 * 60 * 60, // 12 hours
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (!account?.access_token || !profile) return false;

      // Reject sign-in for anyone who isn't currently in the studio's
      // Discord guild — this is the front door, not just a display
      // filter. But say WHICH failure it was: returning a URL here sends
      // a specific code to the sign-in page, so a rate limit or a scope
      // problem doesn't get reported to someone as "you're not in the
      // server", which is both wrong and impossible to act on.
      const status = await checkGuildMembership(account.access_token);
      switch (status) {
        case "member":
          return true;
        case "not-member":
          return "/sign-in?error=NotInGuild";
        case "unauthorized":
          return "/sign-in?error=ScopeRejected";
        case "unavailable":
          return "/sign-in?error=DiscordUnavailable";
      }
    },
    async jwt({ token, account, profile, trigger }) {
      // Linking a Roblox username calls useSession().update(), which lands
      // here — refresh the claim straight away rather than leaving the
      // person gated until the next periodic recheck.
      if (trigger === "update" && token.discordId) {
        token.linked = await hasRobloxLink(token.discordId);
      }
      const isInitialSignIn = Boolean(account && profile);

      if (isInitialSignIn && account?.access_token) {
        // `signIn` already established membership moments ago; re-asking
        // here would only add a second call (and a second chance to trip
        // a rate limit) to prove the same thing. next-auth will not reach
        // this callback at all unless signIn returned true.
        const discordId = (profile as { id: string }).id;
        // Being on the roster no longer implies having signed in, so
        // record the fact here — this is the only moment we know it.
        await markSignedIn(discordId);
        token.discordId = discordId;
        token.linked = await hasRobloxLink(discordId);
        token.isCreator = isCreatorDiscordId(discordId);
        token.isPortalAdmin = await computeIsPortalAdmin(discordId);
        token.actions = await computeRankActions(discordId);
        token.accessToken = account.access_token;
        token.rolesCheckedAt = Date.now();
        token.invalid = false;
        return token;
      }

      // Periodic re-verification on an existing session.
      const dueForRecheck =
        !token.rolesCheckedAt ||
        Date.now() - token.rolesCheckedAt > RECHECK_INTERVAL_MS;

      if (dueForRecheck && token.accessToken && token.discordId) {
        const status = await checkGuildMembership(token.accessToken);

        // Only a definitive answer ends a live session. If Discord is
        // rate limiting us or having a bad day, keep the session as-is
        // and leave rolesCheckedAt untouched so the next request retries
        // promptly — rather than logging out the whole studio over a
        // transient 429.
        if (status === "unavailable") {
          return token;
        }

        if (status === "not-member" || status === "unauthorized") {
          token.invalid = true;
          token.isCreator = false;
          token.isPortalAdmin = false;
          token.actions = [];
          return token;
        }
        // Recomputed every time rather than trusted from the existing
        // token, so changing PORTAL_CREATOR_DISCORD_ID takes effect
        // within one recheck window instead of requiring a re-login.
        // Also marked here, not only at sign-in: someone can be placed on
        // the roster by a sync AFTER they last signed in, and their row
        // would then claim they never had. Re-marking on each recheck
        // means it corrects itself within one interval.
        await markSignedIn(token.discordId);
        token.linked = await hasRobloxLink(token.discordId);
        token.isCreator = isCreatorDiscordId(token.discordId);
        token.isPortalAdmin = await computeIsPortalAdmin(token.discordId);
        token.actions = await computeRankActions(token.discordId);
        token.rolesCheckedAt = Date.now();
        token.invalid = false;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.invalid || !token.discordId) {
        session.stale = true;
        return session;
      }
      session.user.discordId = token.discordId;
      session.user.isCreator = token.isCreator ?? false;
      session.user.isPortalAdmin = token.isPortalAdmin ?? false;
      session.user.actions = token.actions ?? [];
      return session;
    },
  },
};
