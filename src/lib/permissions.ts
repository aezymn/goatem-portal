// The access model, top to bottom:
//
//   1. CREATOR — one specific Discord account, named by the
//      PORTAL_CREATOR_DISCORD_ID environment variable. Deliberately NOT
//      stored in the database and NOT derived from Discord server
//      ownership: it lives outside the app entirely, so no amount of
//      access inside the portal — or inside Discord — can grant, revoke,
//      or transfer it. Changing it means changing an environment
//      variable in the hosting dashboard. Always has full access to
//      everything, and is the ONLY one who can promote or demote a
//      portal ADMIN (below).
//   2. Portal ADMIN — members.isPortalAdmin. A specific, named person the
//      CREATOR has explicitly designated on the Admin Access panel. Full
//      access to everything except designating other admins.
//   3. Rank-granted actions — everyone else's access comes entirely from
//      whatever actions their current rank has been configured with (the
//      Ranks admin page), from the fixed catalog below. A rank granting
//      nothing means holding it grants nothing beyond the baseline.
//   4. Baseline — anyone with an active roster row (regardless of rank)
//      can view the roster and file/view/comment on bug reports. This
//      isn't gated by an "action" at all; see requireRosterMember() in
//      src/lib/requireSession.ts.
//
// The deliberate split between #2 and #3 is the whole point: whoever
// manages ranks or Discord roles might not be trusted with full access,
// so a rank — however it's configured — can never reach portal-admin.
// Only the CREATOR, a single fixed identity defined outside the app, can
// hand that out. See src/lib/auth.ts and src/lib/ranks.ts for how each
// piece gets resolved.

/**
 * True only for the one Discord account named by
 * PORTAL_CREATOR_DISCORD_ID. Returns false when that variable is unset
 * or blank — failing closed, so a misconfigured deploy grants nobody
 * CREATOR rather than everybody.
 */
export function isCreatorDiscordId(discordId: string | undefined): boolean {
  const configured = process.env.PORTAL_CREATOR_DISCORD_ID?.trim();
  if (!configured || !discordId) return false;
  return discordId === configured;
}

export const RANK_ACTIONS = [
  "reports.triage",
  "reports.delete",
  "roster.manage",
] as const;

export type RankAction = (typeof RANK_ACTIONS)[number];

export function isRankAction(value: string): value is RankAction {
  return (RANK_ACTIONS as readonly string[]).includes(value);
}

/** What a request's session resolves to — everything requireSession.ts
 * and the pages need to decide what someone can see or do. */
export interface AccessContext {
  isCreator: boolean;
  isPortalAdmin: boolean;
  actions: RankAction[];
}

/** True if `ctx` has full access — CREATOR or a designated portal ADMIN.
 * Both bypass the rank-action list entirely; an admin isn't limited to
 * whatever their own rank happens to grant. */
export function isFullAdmin(ctx: AccessContext): boolean {
  return ctx.isCreator || ctx.isPortalAdmin;
}

/** True if `ctx` can perform `action` — full admins always can; everyone
 * else needs their rank to have been explicitly granted it. */
export function hasAction(ctx: AccessContext, action: RankAction): boolean {
  return isFullAdmin(ctx) || ctx.actions.includes(action);
}
