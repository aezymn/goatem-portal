import type { AuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { getMemberByDiscordId } from "@/lib/members";
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
 * Confirms the caller is currently a member of the studio's Discord
 * guild, using their own OAuth access token (scope: guilds.members.read)
 * — no bot token or special intents required. This is ONLY a login gate;
 * it says nothing about what they can do once they're in. CREATOR status,
 * portal-admin, and rank actions are all resolved separately — see
 * src/lib/permissions.ts.
 */
async function isGuildMember(accessToken: string): Promise<boolean> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error("DISCORD_GUILD_ID is not configured");

  const res = await fetch(
    `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.ok; // false = not a member, revoked token, rate limited, etc.
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
      // Reject sign-in outright for anyone who isn't currently in the
      // studio's Discord guild — this is the front door, not just a
      // display filter.
      return isGuildMember(account.access_token);
    },
    async jwt({ token, account, profile }) {
      const isInitialSignIn = Boolean(account && profile);

      if (isInitialSignIn && account?.access_token) {
        // We already know `signIn` succeeded, so this should too. If it
        // somehow doesn't (race, Discord hiccup), fail closed rather than
        // issue a token that looks valid but isn't.
        if (!(await isGuildMember(account.access_token))) {
          token.invalid = true;
          return token;
        }
        const discordId = (profile as { id: string }).id;
        token.discordId = discordId;
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
        if (!(await isGuildMember(token.accessToken))) {
          // No longer a guild member, or the access token has
          // expired/been revoked. Either way: stop trusting this session.
          token.invalid = true;
          token.isCreator = false;
          token.isPortalAdmin = false;
          token.actions = [];
          return token;
        }
        // Recomputed every time rather than trusted from the existing
        // token, so changing PORTAL_CREATOR_DISCORD_ID takes effect
        // within one recheck window instead of requiring a re-login.
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
