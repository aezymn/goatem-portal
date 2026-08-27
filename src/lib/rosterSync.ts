import { db } from "@/db";
import { members, ranks } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { listGuildMembers, type GuildMemberSummary } from "@/lib/discordBot";

export interface SyncResult {
  ok: boolean;
  /** Set when ok is false — a human-readable reason, safe to show. */
  error?: string;
  added: number;
  updated: number;
  removed: number;
  /** Ranks with no Discord role bound. Nobody can land on these by sync,
   * which is worth saying out loud rather than leaving as a mystery. */
  unboundRanks: string[];
}

/**
 * Rebuilds the Discord-sourced part of the roster from live guild
 * membership.
 *
 * The rule: holding a Discord role that's bound to a rank puts you on the
 * roster at that rank. Hold several bound roles and the highest-authority
 * rank wins (lowest `position` — the top of the Ranks page). Hold none
 * and you aren't on the roster.
 *
 * Scope is deliberately narrow. This only ever creates, updates, or
 * removes rows with source='discord'. Manually-added people and alt
 * accounts are never touched, so a sync can't quietly delete someone an
 * admin put there on purpose.
 *
 * Removal is a soft delete, like everywhere else in this app: losing the
 * role takes you off the roster, it doesn't destroy your history, and
 * re-gaining the role restores the same row rather than making a new one.
 */
export async function syncRosterFromDiscord(): Promise<SyncResult> {
  const empty = { added: 0, updated: 0, removed: 0, unboundRanks: [] };

  const rankRows = await db.select().from(ranks);
  const bound = rankRows.filter((r) => r.discordRoleId);
  const unboundRanks = rankRows
    .filter((r) => !r.discordRoleId)
    .map((r) => r.name);

  if (bound.length === 0) {
    return {
      ok: false,
      error:
        "No rank is bound to a Discord role yet. Bind at least one on the Ranks page, then sync.",
      ...empty,
      unboundRanks,
    };
  }

  const guildMembers = await listGuildMembers();
  if (guildMembers === null) {
    return {
      ok: false,
      error:
        "Couldn't read the member list from Discord. This usually means the bot's \"Server Members Intent\" isn't enabled (Developer Portal → your app → Bot → Privileged Gateway Intents), or DISCORD_BOT_TOKEN isn't set.",
      ...empty,
      unboundRanks,
    };
  }

  // Highest authority = lowest position. Resolve each Discord role to the
  // best rank it confers, so someone holding several bound roles lands at
  // the top one rather than whichever happened to be checked first.
  const rankByRoleId = new Map<string, { name: string; position: number }>();
  for (const r of bound) {
    rankByRoleId.set(r.discordRoleId!, { name: r.name, position: r.position });
  }

  const intended = new Map<
    string,
    { rank: string; username: string; avatarUrl: string }
  >();
  for (const gm of guildMembers) {
    const best = bestRankFor(gm, rankByRoleId);
    if (best) {
      intended.set(gm.discordId, {
        rank: best,
        username: gm.username,
        avatarUrl: gm.avatarUrl,
      });
    }
  }

  const existing = await db
    .select()
    .from(members)
    .where(eq(members.source, "discord"));
  const existingByDiscordId = new Map(
    existing.filter((m) => m.discordId).map((m) => [m.discordId!, m])
  );

  let added = 0;
  let updated = 0;
  let removed = 0;

  await db.transaction(async (tx) => {
    for (const [discordId, want] of intended) {
      const current = existingByDiscordId.get(discordId);

      if (!current) {
        // Someone might already be on the roster from a manual add or an
        // earlier link — adopt that row rather than colliding with its
        // unique discord_id.
        const [manual] = await tx
          .select()
          .from(members)
          .where(eq(members.discordId, discordId))
          .limit(1);

        if (manual) {
          await tx
            .update(members)
            .set({
              rank: want.rank,
              discordUsername: want.username,
              discordAvatarUrl: want.avatarUrl,
              deletedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(members.id, manual.id));
          updated++;
        } else {
          await tx.insert(members).values({
            discordId,
            discordUsername: want.username,
            discordAvatarUrl: want.avatarUrl,
            rank: want.rank,
            source: "discord",
          });
          added++;
        }
        continue;
      }

      const changed =
        current.rank !== want.rank ||
        current.discordUsername !== want.username ||
        current.discordAvatarUrl !== want.avatarUrl ||
        current.deletedAt !== null;

      if (changed) {
        await tx
          .update(members)
          .set({
            rank: want.rank,
            discordUsername: want.username,
            discordAvatarUrl: want.avatarUrl,
            deletedAt: null, // rejoining/regaining the role restores them
            updatedAt: new Date(),
          })
          .where(eq(members.id, current.id));
        updated++;
      }
    }

    // Anyone we previously synced who no longer holds a bound role.
    const staleIds = existing
      .filter(
        (m) =>
          m.deletedAt === null &&
          (!m.discordId || !intended.has(m.discordId))
      )
      .map((m) => m.id);

    if (staleIds.length > 0) {
      await tx
        .update(members)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(inArray(members.id, staleIds), isNull(members.deletedAt)));
      removed = staleIds.length;
    }
  });

  return { ok: true, added, updated, removed, unboundRanks };
}

function bestRankFor(
  gm: GuildMemberSummary,
  rankByRoleId: Map<string, { name: string; position: number }>
): string | null {
  let best: { name: string; position: number } | null = null;
  for (const roleId of gm.roleIds) {
    const candidate = rankByRoleId.get(roleId);
    if (!candidate) continue;
    if (!best || candidate.position < best.position) best = candidate;
  }
  return best?.name ?? null;
}
