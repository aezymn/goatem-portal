import { db } from "@/db";
import { members, rankPermissions } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import type { GrantableTier, PermissionTier } from "@/lib/permissions";
import { resolveTier } from "@/lib/permissions";

/** What a specific rank is currently allowed to be granted — the ceiling,
 * not a grant itself. Null if the rank has no row (never configured, or
 * explicitly set to "not eligible"). */
export async function getRankEligibility(
  rank: string
): Promise<GrantableTier | null> {
  const [row] = await db
    .select()
    .from(rankPermissions)
    .where(eq(rankPermissions.rank, rank))
    .limit(1);
  return row?.eligibleTier ?? null;
}

/** The actual, effective permission tier for a roster member: their
 * explicit grant, capped by what their current rank is eligible for. */
export async function getEffectiveTier(member: {
  rank: string;
  grantedTier: GrantableTier | null;
}): Promise<PermissionTier> {
  const eligibleTier = await getRankEligibility(member.rank);
  return resolveTier(member.grantedTier, eligibleTier);
}

/** Every rank the Permissions admin panel should show: every rank
 * currently in use on the roster, plus any rank that was configured in
 * the past even if nobody currently holds it (so a config never silently
 * disappears out from under an admin). Sorted alphabetically. */
export async function listRankEligibility(): Promise<
  { rank: string; eligibleTier: GrantableTier | null }[]
> {
  const [rosterRanks, configured] = await Promise.all([
    db
      .selectDistinct({ rank: members.rank })
      .from(members)
      .where(isNull(members.deletedAt)),
    db.select().from(rankPermissions),
  ]);

  const byRank = new Map<string, GrantableTier | null>();
  for (const { rank } of rosterRanks) byRank.set(rank, null);
  for (const row of configured) byRank.set(row.rank, row.eligibleTier);

  return [...byRank.entries()]
    .map(([rank, eligibleTier]) => ({ rank, eligibleTier }))
    .sort((a, b) => a.rank.localeCompare(b.rank));
}
