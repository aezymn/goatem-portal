import type { AuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { getMemberByDiscordId } from "@/lib/members";
import { getEffectiveTier } from "@/lib/rankPermissions";

// How often (ms) a live session re-verifies guild membership and
// recomputes permission tier. Bounds how stale someone's access can get
// after they're kicked from the guild, or after an admin changes their
// grant or their rank's eligibility — worst case is this window, not
// "until they happen to log out."
const RECHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Confirms the caller is currently a member of the studio's Discord
 * guild, using their own OAuth access token (scope: guilds.members.read)
 * — no bot token or special intents required. This is ONLY a login gate;
 * it says nothing about what they can do once they're in. Permission
 * tier is entirely separate — see src/lib/permissions.ts and
 * src/lib/rankPermissions.ts.
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

/** Looks up this person's roster row and computes their real permission
 * tier from it — MEMBER (no roster row, or no active grant) up to
 * whatever's actually been granted and their rank still permits. */
async function computeTier(discordId: string) {
  const member = await getMemberByDiscordId(discordId);
  if (!member) return "MEMBER" as const;
  return getEffectiveTier(member);
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
        token.permissionTier = await computeTier(discordId);
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
          token.permissionTier = "MEMBER";
          return token;
        }
        token.permissionTier = await computeTier(token.discordId);
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
      session.user.permissionTier = token.permissionTier ?? "MEMBER";
      return session;
    },
  },
};
