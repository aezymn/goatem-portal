// Bot-token-backed Discord lookups: avatars and role colors for ANY guild
// member, not just whoever's currently logged in. This works from
// anywhere in this app precisely because it's Vercel making the call, not
// Apps Script — the whole reason this was hard before (Discord's
// Cloudflare edge blocking Apps Script's shared, flagged IP pool) simply
// doesn't apply here.
//
// This never touches the gateway/websocket and the bot never needs to be
// "online" — it's pure REST, using only endpoints that don't require the
// privileged Server Members intent (that's only needed for bulk member
// listing, not single-member lookups by ID).
//
// Fails soft everywhere: if the bot isn't configured yet, isn't in the
// guild, or Discord's API hiccups, every function here returns null
// rather than throwing — nothing in the UI should ever break because an
// avatar couldn't be fetched.

interface DiscordRole {
  id: string;
  color: number; // decimal RGB, 0 means "no color / use default"
  position: number;
}

interface GuildMemberInfo {
  avatarUrl: string;
  /** Hex, e.g. "#5865f2" — the color of the highest-position role that
   * actually has a color set, exactly how Discord itself computes a
   * member's display name color. Null if they have no colored role. */
  roleColorHex: string | null;
}

const ROLES_CACHE_TTL_MS = 10 * 60 * 1000; // guild roles rarely change
const MEMBER_CACHE_TTL_MS = 5 * 60 * 1000;

let rolesCache: { roles: DiscordRole[]; fetchedAt: number } | null = null;
const memberCache = new Map<
  string,
  { info: GuildMemberInfo | null; fetchedAt: number }
>();

function botHeaders(): Record<string, string> | null {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;
  return { Authorization: `Bot ${token}` };
}

async function fetchGuildRoles(): Promise<DiscordRole[] | null> {
  if (rolesCache && Date.now() - rolesCache.fetchedAt < ROLES_CACHE_TTL_MS) {
    return rolesCache.roles;
  }

  const headers = botHeaders();
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!headers || !guildId) return null;

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
      { headers }
    );
    if (!res.ok) return null;
    const roles = (await res.json()) as DiscordRole[];
    rolesCache = { roles, fetchedAt: Date.now() };
    return roles;
  } catch {
    return null;
  }
}

function avatarUrlFor(
  discordId: string,
  guildId: string,
  member: { avatar?: string | null; user: { avatar?: string | null } }
): string {
  // Prefer the per-server avatar (what Discord actually shows in this
  // guild) over the account-wide one, falling back to the default avatar
  // if they have neither.
  if (member.avatar) {
    const ext = member.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${discordId}/avatars/${member.avatar}.${ext}?size=128`;
  }
  if (member.user.avatar) {
    const ext = member.user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${discordId}/${member.user.avatar}.${ext}?size=128`;
  }
  const defaultIndex = Number(
    (BigInt(discordId) >> BigInt(22)) % BigInt(6)
  );
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

/**
 * Looks up a guild member's avatar and Discord role color by their
 * Discord ID. Returns null if the bot isn't configured, they're not
 * currently in the guild, or the lookup fails for any reason — callers
 * should treat null as "no extra info available," not an error.
 */
export async function getGuildMemberInfo(
  discordId: string
): Promise<GuildMemberInfo | null> {
  const cached = memberCache.get(discordId);
  if (cached && Date.now() - cached.fetchedAt < MEMBER_CACHE_TTL_MS) {
    return cached.info;
  }

  const headers = botHeaders();
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!headers || !guildId) return null;

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      { headers }
    );
    if (!res.ok) {
      memberCache.set(discordId, { info: null, fetchedAt: Date.now() });
      return null;
    }

    const member = (await res.json()) as {
      avatar?: string | null;
      roles: string[];
      user: { avatar?: string | null };
    };

    const roles = await fetchGuildRoles();
    let roleColorHex: string | null = null;
    if (roles) {
      const coloredRoles = roles
        .filter((r) => member.roles.includes(r.id) && r.color !== 0)
        .sort((a, b) => b.position - a.position);
      if (coloredRoles.length > 0) {
        roleColorHex = `#${coloredRoles[0].color.toString(16).padStart(6, "0")}`;
      }
    }

    const info: GuildMemberInfo = {
      avatarUrl: avatarUrlFor(discordId, guildId, member),
      roleColorHex,
    };
    memberCache.set(discordId, { info, fetchedAt: Date.now() });
    return info;
  } catch {
    memberCache.set(discordId, { info: null, fetchedAt: Date.now() });
    return null;
  }
}
