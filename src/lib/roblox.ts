import { createHash } from "crypto";

// Roblox lookups: turning a username someone typed into a real account,
// and answering "are they in the studio's group" (which is what the
// roster's GAME ACCESS column reports).
//
// Both endpoints used here are public and unauthenticated — no API key,
// no cookie, nothing to configure beyond ROBLOX_GROUP_ID. They're called
// from Vercel, which (unlike Apps Script) isn't IP-blocked by Roblox.
//
// Everything fails soft: a network problem, a rate limit, or a shape
// change returns null rather than throwing, and callers treat null as
// "unknown" — deliberately distinct from a confirmed "no". A roster that
// says "unknown" during a Roblox outage is honest; one that says "no
// access" would be actively misleading.

export function generateVerificationCode(discordId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
  return "QA-" + createHash("sha256").update(discordId + secret).digest("hex").slice(0, 6).toUpperCase();
}

interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
}

/**
 * Resolves an exact Roblox username to an account. Case-insensitive, as
 * Roblox's own lookup is, and returns the canonical spelling Roblox has
 * on file — so what ends up on the roster is Roblox's capitalisation, not
 * whatever the person happened to type.
 *
 * Returns null when the username doesn't exist, or the lookup failed.
 */
export async function resolveRobloxUser(
  username: string
): Promise<RobloxUser | null> {
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [username],
        excludeBannedUsers: false,
      }),
    });
    if (!res.ok) {
      console.error("roblox username lookup failed:", res.status);
      return null;
    }

    const body = (await res.json()) as { data?: RobloxUser[] };
    const match = body.data?.[0];
    if (!match || typeof match.id !== "number") return null;

    return {
      id: match.id,
      name: match.name,
      displayName: match.displayName ?? match.name,
    };
  } catch (err) {
    console.error("roblox username lookup threw:", err);
    return null;
  }
}

/**
 * Fetches the user's profile description (About me) by their Roblox User ID.
 * Returns null if the lookup fails.
 */
export async function getRobloxDescription(userId: number | string): Promise<string | null> {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
      // No caching so we get the fresh description right after they save it
      cache: "no-store", 
    });
    if (!res.ok) {
      console.error("roblox description lookup failed:", res.status);
      return null;
    }
    const body = (await res.json()) as { description?: string };
    return body.description ?? "";
  } catch (err) {
    console.error("roblox description lookup threw:", err);
    return null;
  }
}


/**
 * Whether a Roblox user is a member of the configured group.
 *
 * Returns null (not false) when ROBLOX_GROUP_ID isn't configured or the
 * lookup fails — see the note at the top of this file about why "unknown"
 * and "no" must not collapse into each other.
 */
export async function isInStudioGroup(
  robloxUserId: string | number
): Promise<boolean | null> {
  const groupId = process.env.ROBLOX_GROUP_ID?.trim().replace(/^['"]+|['"]+$/g, "");
  if (!groupId) return null;

  try {
    const res = await fetch(
      `https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`
    );
    if (!res.ok) {
      console.error("roblox group lookup failed:", res.status);
      return null;
    }

    const body = (await res.json()) as {
      data?: { group?: { id?: number } }[];
    };
    if (!Array.isArray(body.data)) return null;

    return body.data.some((entry) => String(entry.group?.id) === groupId);
  } catch (err) {
    console.error("roblox group lookup threw:", err);
    return null;
  }
}

/** True when a Roblox group has been configured at all — lets the UI say
 * "not configured" rather than silently showing every row as unknown. */
export function isRobloxGroupConfigured(): boolean {
  const groupId = process.env.ROBLOX_GROUP_ID?.trim().replace(/^['"]+|['"]+$/g, "");
  return Boolean(groupId);
}

/** Resolves a username and checks group membership in one go — the
 * combination every caller actually wants. */
export async function lookupRobloxAccount(username: string): Promise<{
  user: RobloxUser;
  hasGameAccess: boolean | null;
} | null> {
  const user = await resolveRobloxUser(username);
  if (!user) return null;
  return { user, hasGameAccess: await isInStudioGroup(user.id) };
}

/**
 * Re-checks group membership for roster rows that have a linked Roblox
 * account, refreshing hasGameAccess.
 *
 * Needed because a row can carry a username without ever having been
 * checked — anyone added manually, or linked before a group was
 * configured, sits at "unknown" forever otherwise.
 *
 * Runs a few lookups at a time rather than all at once: sequential would
 * be slow enough to risk a serverless timeout on a large roster, and
 * unbounded parallelism is a good way to get rate limited by Roblox.
 */
export async function refreshGameAccess(
  rows: { id: string; robloxUsername: string | null; robloxUserId: string | null }[],
  onResult: (id: string, userId: string, hasGameAccess: boolean | null) => Promise<void>
): Promise<{ checked: number; failed: number }> {
  const targets = rows.filter((r) => r.robloxUsername);
  let checked = 0;
  let failed = 0;
  const CONCURRENCY = 4;

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        // Prefer the stored numeric ID: usernames can change, and it
        // saves a lookup for anyone already resolved.
        let userId = row.robloxUserId;
        if (!userId) {
          const user = await resolveRobloxUser(row.robloxUsername!);
          if (!user) {
            failed++;
            return;
          }
          userId = String(user.id);
        }

        const access = await isInStudioGroup(userId);
        await onResult(row.id, userId, access);
        if (access === null) failed++;
        else checked++;
      })
    );
  }

  return { checked, failed };
}
