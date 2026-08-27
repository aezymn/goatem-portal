// Permission tiers. Deliberately NOT derived from Discord roles — see
// resolveGrantedTier below for why. Discord OAuth (src/lib/auth.ts) only
// ever answers "is this person currently a member of the guild" (the
// login gate); it has no say in what they can DO once they're in.

export type PermissionTier = "ADMIN" | "STAFF" | "MEMBER";
export type GrantableTier = "STAFF" | "ADMIN";

const TIER_RANK: Record<PermissionTier, number> = {
  MEMBER: 0,
  STAFF: 1,
  ADMIN: 2,
};

/** True if `actual` meets or exceeds `required` in the tier hierarchy. */
export function tierAtLeast(
  actual: PermissionTier,
  required: PermissionTier
): boolean {
  return TIER_RANK[actual] >= TIER_RANK[required];
}

/**
 * A person's actual permission tier is a deliberate two-part gate:
 *
 *   1. Their RANK's eligibleTier (rank_permissions table, managed on the
 *      Permissions admin page) — a ceiling on what someone of that rank
 *      is even allowed to be granted. This is config, not a grant.
 *   2. Their own grantedTier (members.granted_tier) — an explicit,
 *      per-person decision an admin made about THIS specific person,
 *      capped by #1 at grant time.
 *
 * Both must line up for elevated access to actually apply. The point:
 * someone getting handed a rank — by whoever manages Discord roles, which
 * might not even be a portal admin — never silently hands them portal
 * access along with it. A named admin has to have actually looked at this
 * specific person and decided yes. If their rank's eligibility is later
 * lowered below their existing grant, the grant stops applying
 * immediately — no separate cleanup step needed.
 */
export function resolveTier(
  grantedTier: GrantableTier | null,
  rankEligibleTier: GrantableTier | null
): PermissionTier {
  if (!grantedTier || !rankEligibleTier) return "MEMBER";
  // The LOWER of the two wins — a grant can never exceed what the
  // person's current rank is eligible for, even if it was set before
  // their rank's eligibility was later turned down.
  const effective = Math.min(TIER_RANK[grantedTier], TIER_RANK[rankEligibleTier]);
  if (effective >= TIER_RANK.ADMIN) return "ADMIN";
  if (effective >= TIER_RANK.STAFF) return "STAFF";
  return "MEMBER";
}

/** Server-side guard for the API route that actually sets a grant: is
 * `candidate` permitted under a rank's `ceiling` (its eligibleTier)? Used
 * so a request can never grant more than the rank is currently configured
 * for, even if someone crafts the request by hand rather than using the
 * roster toggle. */
export function isGrantAllowed(
  candidate: GrantableTier,
  ceiling: GrantableTier | null
): boolean {
  if (!ceiling) return false;
  return TIER_RANK[candidate] <= TIER_RANK[ceiling];
}
