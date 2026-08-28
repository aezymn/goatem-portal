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
 * The Discord IDs configured as CREATOR.
 *
 * More than one is allowed: separate them with commas (or spaces, or
 * newlines — anything that isn't a digit is a separator). Every CREATOR
 * is equal; there is no primary. Since the list lives only in the
 * environment, a CREATOR can't add, remove or demote another one from
 * inside the portal — changing who they are still means changing an
 * environment variable in the hosting dashboard, which is the whole
 * point of keeping this outside the app.
 *
 * Tolerates surrounding quotes and whitespace: a .env file strips quotes
 * when it loads, but a hosting dashboard (Vercel's env var UI, say)
 * stores whatever is typed verbatim — so pasting `"123..."` there, in the
 * same format .env.example shows, silently stored the quote characters
 * and never matched anyone. Failing closed on a misconfiguration is
 * right; failing closed on a *plausible transcription* of the right
 * answer is just a trap.
 */
export function configuredCreatorIds(): string[] {
  const raw = process.env.PORTAL_CREATOR_DISCORD_ID?.trim();
  if (!raw) return [];
  // Discord IDs are digits, so anything else between them is a
  // separator — commas, spaces, quotes and stray brackets all work
  // without the config having to be typed in one exact shape.
  return raw.match(/\d{15,25}/g) ?? [];
}

/** Whether any CREATOR is configured at all — booleans only, no value.
 * Used by the /api/whoami diagnostic to tell "nobody is configured"
 * apart from "someone is, but it isn't you." */
export function isCreatorConfigured(): boolean {
  return configuredCreatorIds().length > 0;
}

/**
 * True only for a Discord account named by PORTAL_CREATOR_DISCORD_ID.
 * Returns false when that variable is unset, blank, or holds nothing that
 * looks like an ID — failing closed, so a misconfigured deploy grants
 * nobody CREATOR rather than everybody.
 */
export function isCreatorDiscordId(discordId: string | undefined): boolean {
  if (!discordId) return false;
  return configuredCreatorIds().includes(discordId);
}

export const RANK_ACTIONS = [
  "reports.triage",
  "reports.delete",
  "roster.manage",
  "bugsetup.manage",
  "changelog.view",
  "changelog.write",
  "changelog.approve",
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

/**
 * These two accept a PARTIAL context on purpose.
 *
 * When a session goes stale (guild re-check failed, token revoked),
 * next-auth's session callback returns early — leaving session.user
 * populated with the provider defaults but WITHOUT discordId, actions or
 * the access flags. Pages that reasonably wrote `session?.user &&
 * hasAction(...)` then crashed on `undefined.includes`, turning an
 * expired login into a 500. Treating a missing field as "no access" is
 * both safer and truthful: a context that can't state its permissions
 * doesn't have any.
 */
export function isFullAdmin(ctx: Partial<AccessContext>): boolean {
  return Boolean(ctx?.isCreator || ctx?.isPortalAdmin);
}

/** True if `ctx` can perform `action` — full admins always can; everyone
 * else needs their rank to have been explicitly granted it. */
export function hasAction(
  ctx: Partial<AccessContext>,
  action: RankAction
): boolean {
  return isFullAdmin(ctx) || (ctx?.actions ?? []).includes(action);
}
