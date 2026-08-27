import { db } from "@/db";
import { members, ranks, rankActionPermissions } from "@/db/schema";
import { and, asc, count, eq, isNull, max } from "drizzle-orm";
import type { RankAction } from "@/lib/permissions";
import { isRankAction } from "@/lib/permissions";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RankWithActions {
  name: string;
  position: number;
  discordRoleId: string | null;
  actions: RankAction[];
  /** How many people currently hold this rank. Shown on the Ranks page,
   * and what makes a rank undeletable while it's still in use. */
  memberCount: number;
}

/** The actions a specific rank currently grants. Empty array (never null)
 * if the rank has no row yet, or has no actions configured. */
export async function getRankActions(rank: string): Promise<RankAction[]> {
  const rows = await db
    .select({ action: rankActionPermissions.action })
    .from(rankActionPermissions)
    .where(eq(rankActionPermissions.rank, rank));
  return rows.map((r) => r.action).filter(isRankAction);
}

/** Every rank the Ranks admin page shows, in authority order, each with
 * its bound Discord role (if any) and its full action set. Also picks up
 * any rank that exists on the roster but hasn't been formally created yet
 * (see ensureRank) — defensive merge so a straggler never just vanishes
 * from the list. */
export async function listRanksWithActions(): Promise<RankWithActions[]> {
  const [rankRows, actionRows, rosterCounts] = await Promise.all([
    db.select().from(ranks).orderBy(asc(ranks.position)),
    db.select().from(rankActionPermissions),
    db
      .select({ rank: members.rank, n: count() })
      .from(members)
      .where(isNull(members.deletedAt))
      .groupBy(members.rank),
  ]);

  const countByRank = new Map(rosterCounts.map((r) => [r.rank, Number(r.n)]));

  const actionsByRank = new Map<string, RankAction[]>();
  for (const row of actionRows) {
    if (!isRankAction(row.action)) continue;
    const list = actionsByRank.get(row.rank) ?? [];
    list.push(row.action);
    actionsByRank.set(row.rank, list);
  }

  const known = new Map<string, RankWithActions>();
  for (const r of rankRows) {
    known.set(r.name, {
      name: r.name,
      position: r.position,
      discordRoleId: r.discordRoleId,
      actions: actionsByRank.get(r.name) ?? [],
      memberCount: countByRank.get(r.name) ?? 0,
    });
  }

  // Ranks that exist on the roster but were never formally created (e.g.
  // added by hand directly in the database) still show up, at the bottom,
  // with no actions and no binding — same fallback the old model used.
  let nextPosition =
    rankRows.length > 0 ? Math.max(...rankRows.map((r) => r.position)) + 1 : 0;
  for (const rank of countByRank.keys()) {
    if (known.has(rank)) continue;
    known.set(rank, {
      name: rank,
      position: nextPosition++,
      discordRoleId: null,
      actions: [],
      memberCount: countByRank.get(rank) ?? 0,
    });
  }

  return [...known.values()].sort((a, b) => a.position - b.position);
}

/** Makes sure a rank row exists (e.g. when a member is added to the
 * roster with a brand-new rank name) so it immediately shows up on the
 * Ranks admin page instead of only appearing via the defensive merge
 * above. New ranks land at the bottom of the authority order. No-op if
 * the rank already has a row. Pass `tx` when calling this inside another
 * transaction (e.g. member creation) so the two can never drift apart. */
export async function ensureRank(
  name: string,
  dbOrTx: DbOrTx = db
): Promise<void> {
  const [{ value } = { value: null }] = await dbOrTx
    .select({ value: max(ranks.position) })
    .from(ranks);
  await dbOrTx
    .insert(ranks)
    .values({ name, position: (value ?? -1) + 1 })
    .onConflictDoNothing({ target: ranks.name });
}

/** Reorders the full rank ladder to match `orderedNames` top to bottom
 * (position 0 first). Silently ignores any name not already a known
 * rank — the caller (the admin API route) is expected to pass back
 * exactly the set it was given. */
export async function reorderRanks(orderedNames: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedNames.length; i++) {
      await tx
        .update(ranks)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(ranks.name, orderedNames[i]));
    }
  });
}

/** Sets (or clears, with null) which Discord role a rank is bound to. */
export async function setRankDiscordRole(
  rank: string,
  discordRoleId: string | null
): Promise<void> {
  await db
    .update(ranks)
    .set({ discordRoleId, updatedAt: new Date() })
    .where(eq(ranks.name, rank));
}

/** Turns one action on or off for a rank. */
export async function setRankAction(
  rank: string,
  action: RankAction,
  granted: boolean
): Promise<void> {
  if (granted) {
    await db
      .insert(rankActionPermissions)
      .values({ rank, action })
      .onConflictDoNothing();
  } else {
    await db
      .delete(rankActionPermissions)
      .where(
        and(
          eq(rankActionPermissions.rank, rank),
          eq(rankActionPermissions.action, action)
        )
      );
  }
}

/** Creates a new, empty rank at the bottom of the ladder. Returns false
 * if that name already exists — rank names are the identity members
 * reference, so duplicates aren't possible. */
export async function createRank(name: string): Promise<boolean> {
  const [{ value } = { value: null }] = await db
    .select({ value: max(ranks.position) })
    .from(ranks);
  const inserted = await db
    .insert(ranks)
    .values({ name, position: (value ?? -1) + 1 })
    .onConflictDoNothing({ target: ranks.name })
    .returning();
  return inserted.length > 0;
}

export type DeleteRankResult =
  | { ok: true }
  | { ok: false; reason: "in-use"; memberCount: number }
  | { ok: false; reason: "not-found" };

/**
 * Removes a rank outright.
 *
 * Refused while anyone still holds it: members.rank is a plain text
 * column, so deleting a rank in use would leave those people pointing at
 * something that no longer exists — invisible on this page, and silently
 * granting nothing. Move them first, and the deletion becomes safe.
 *
 * This is a genuine delete rather than the soft-delete used for people
 * and reports, because a rank nobody holds is configuration, not history
 * — and the audit log still records that it happened. Its action rows go
 * with it via ON DELETE CASCADE.
 */
export async function deleteRank(name: string): Promise<DeleteRankResult> {
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(members)
    .where(and(eq(members.rank, name), isNull(members.deletedAt)));

  const memberCount = Number(n);
  if (memberCount > 0) return { ok: false, reason: "in-use", memberCount };

  const deleted = await db.delete(ranks).where(eq(ranks.name, name)).returning();
  if (deleted.length === 0) return { ok: false, reason: "not-found" };
  return { ok: true };
}
