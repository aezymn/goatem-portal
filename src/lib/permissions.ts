// Permission tiers, resolved from a person's Discord roles in the studio's
// guild — never something the app itself assigns or remembers. Someone's
// tier is recomputed from their live Discord roles on every login/session
// refresh (see src/lib/auth.ts), so a demotion or kick in Discord takes
// effect the next time that happens, not whenever someone remembers to
// update a spreadsheet cell.

export type PermissionTier = "ADMIN" | "STAFF" | "MEMBER";

const TIER_RANK: Record<PermissionTier, number> = {
  MEMBER: 0,
  STAFF: 1,
  ADMIN: 2,
};

function parseRoleIds(envValue: string | undefined): Set<string> {
  return new Set(
    (envValue ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

/**
 * Resolves a person's permission tier from the set of Discord role IDs
 * they hold in the studio's guild. Highest matching tier wins. Anyone who
 * is a guild member but matches neither configured role list still gets
 * the base MEMBER tier — they can view the roster, file bug reports, and
 * comment, but nothing more.
 */
export function resolveTier(discordRoleIds: string[]): PermissionTier {
  const adminRoles = parseRoleIds(process.env.DISCORD_ADMIN_ROLE_IDS);
  const staffRoles = parseRoleIds(process.env.DISCORD_STAFF_ROLE_IDS);

  if (discordRoleIds.some((id) => adminRoles.has(id))) return "ADMIN";
  if (discordRoleIds.some((id) => staffRoles.has(id))) return "STAFF";
  return "MEMBER";
}

/** True if `actual` meets or exceeds `required` in the tier hierarchy. */
export function tierAtLeast(
  actual: PermissionTier,
  required: PermissionTier
): boolean {
  return TIER_RANK[actual] >= TIER_RANK[required];
}
