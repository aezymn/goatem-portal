/**
 * Regions are read off Discord roles, the same way ranks are — hold the
 * EU role and you're EU on the roster. Unlike ranks they aren't editable
 * in the UI, because there are only three of them and they don't change:
 * the role IDs live here, with an env override per region so one can be
 * repointed on Vercel without a code change.
 */

export const REGIONS = ["EU", "NA", "APAC"] as const;
export type Region = (typeof REGIONS)[number];

const DEFAULT_ROLE_IDS: Record<Region, string> = {
  EU: "849734363146223617",
  NA: "849734318763016252",
  APAC: "1100156522778083358",
};

const ENV_KEYS: Record<Region, string> = {
  EU: "PORTAL_REGION_ROLE_EU",
  NA: "PORTAL_REGION_ROLE_NA",
  APAC: "PORTAL_REGION_ROLE_APAC",
};

/** Same quote-stripping as PORTAL_CREATOR_DISCORD_ID: pasting a value
 * with the quotes still around it into Vercel stores them literally, and
 * a role ID that never matches anything is a miserable thing to debug. */
function envRoleId(region: Region): string | null {
  const raw = process.env[ENV_KEYS[region]]?.trim();
  if (!raw) return null;
  const unquoted = raw.replace(/^['"]+|['"]+$/g, "").trim();
  return unquoted || null;
}

export function regionRoleId(region: Region): string {
  return envRoleId(region) ?? DEFAULT_ROLE_IDS[region];
}

/**
 * Which region a set of Discord role IDs confers, or null for none.
 *
 * Holding two region roles shouldn't happen, but if it does the order of
 * REGIONS decides rather than whichever Discord happened to list first —
 * so the answer is at least stable between syncs instead of flickering.
 */
export function regionForRoleIds(roleIds: string[]): Region | null {
  const held = new Set(roleIds);
  for (const region of REGIONS) {
    if (held.has(regionRoleId(region))) return region;
  }
  return null;
}

/** Narrows the free-text column back to a known region for display.
 * Anything unrecognised (a hand-edited row, a region since removed) is
 * treated as "no region" rather than rendered as a broken tag. */
export function asRegion(value: string | null | undefined): Region | null {
  return REGIONS.includes(value as Region) ? (value as Region) : null;
}
