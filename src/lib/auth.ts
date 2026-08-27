import type { AuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { resolveTier } from "@/lib/permissions";

// How often (ms) a live session re-verifies guild membership + roles
// against Discord, using the stored OAuth access token. Bounds how stale
// someone's access can get after they're kicked or demoted in Discord —
// worst case is this window, not "until they happen to log out."
const ROLE_RECHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

interface DiscordGuildMember {
  roles: string[];
  user?: { id: string };
}

/**
 * Looks up the caller's membership + roles in the studio's Discord guild,
 * using their own OAuth access token (scope: guilds.members.read) — no bot
 * token or special intents required. Returns null if they're not a member
 * of the guild, or if the lookup fails for any reason (expired token,
 * Discord API error, etc.) — callers must treat null as "not authorized",
 * never assume stale cached roles are still valid.
 */
async function fetchGuildMember(
  accessToken: string
): Promise<DiscordGuildMember | null> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    throw new Error("DISCORD_GUILD_ID is not configured");
  }

  const res = await fetch(
    `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return null; // not a member, revoked token, rate limited, etc.
  return (await res.json()) as DiscordGuildMember;
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
    // role-recheck above — a hard ceiling on session lifetime.
    maxAge: 12 * 60 * 60, // 12 hours
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (!account?.access_token || !profile) return false;
      const member = await fetchGuildMember(account.access_token);
      // Reject sign-in outright for anyone who isn't currently in the
      // studio's Discord guild — this is the front door, not just a
      // display filter.
      return member !== null;
    },
    async jwt({ token, account, profile }) {
      const isInitialSignIn = Boolean(account && profile);

      if (isInitialSignIn && account?.access_token) {
        // We already know `signIn` succeeded, so this member fetch
        // should succeed too. If it somehow doesn't (race, Discord
        // hiccup), fail closed rather than issue a token with no roles.
        const member = await fetchGuildMember(account.access_token);
        if (!member) {
          token.invalid = true;
          return token;
        }
        token.discordId = member.user?.id ?? (profile as { id: string }).id;
        token.roles = member.roles;
        token.permissionTier = resolveTier(member.roles);
        token.accessToken = account.access_token;
        token.rolesCheckedAt = Date.now();
        token.invalid = false;
        return token;
      }

      // Periodic re-verification on an existing session.
      const dueForRecheck =
        !token.rolesCheckedAt ||
        Date.now() - token.rolesCheckedAt > ROLE_RECHECK_INTERVAL_MS;

      if (dueForRecheck && token.accessToken) {
        const member = await fetchGuildMember(token.accessToken);
        if (!member) {
          // No longer a guild member, or the access token has expired/been
          // revoked. Either way: don't keep trusting the old roles.
          token.invalid = true;
          token.roles = [];
          token.permissionTier = "MEMBER";
          return token;
        }
        token.roles = member.roles;
        token.permissionTier = resolveTier(member.roles);
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
      session.user.roles = token.roles ?? [];
      session.user.permissionTier = token.permissionTier ?? "MEMBER";
      return session;
    },
  },
};
