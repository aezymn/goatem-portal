import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getMemberByDiscordId } from "@/lib/members";
import {
  hasAction,
  isCreatorDiscordId,
  isFullAdmin,
  type AccessContext,
  type RankAction,
} from "@/lib/permissions";

type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

const UNAUTHORIZED: AuthResult = {
  ok: false,
  response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
};
const FORBIDDEN: AuthResult = {
  ok: false,
  response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
};

function baseSession(session: Session | null): session is Session {
  return Boolean(session && !session.stale && session.user?.discordId);
}

/**
 * The authoritative access context for a request.
 *
 * CREATOR is deliberately RE-DERIVED here from PORTAL_CREATOR_DISCORD_ID
 * rather than read off the session, so it is never something a session
 * token can merely *claim*. The token's own isCreator flag is a
 * convenience for rendering (badges, nav links) — this is what actually
 * decides anything. Practically: even a forged or stale token can't
 * assert CREATOR, because the only thing that grants it is a Discord ID
 * matching an environment variable that lives outside the app.
 *
 * isPortalAdmin still comes from the session, refreshed against the
 * database on the 15-minute recheck in src/lib/auth.ts.
 */
function accessContext(session: Session): AccessContext {
  return {
    isCreator: isCreatorDiscordId(session.user.discordId),
    isPortalAdmin: session.user.isPortalAdmin,
    actions: session.user.actions ?? [],
  };
}

/**
 * The baseline every logged-in-and-on-the-roster route needs: viewing the
 * roster, filing/viewing/commenting on bug reports. Doesn't require any
 * rank action — that's the whole point of "baseline." A signed-in Discord
 * member who isn't yet on the roster still fails this (most routes then
 * surface a clear "ask an admin to add you" message).
 */
export async function requireRosterMember(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!baseSession(session)) return UNAUTHORIZED;

  const member = await getMemberByDiscordId(session.user.discordId);
  if (!member && !isFullAdmin(accessContext(session))) return FORBIDDEN;

  return { ok: true, session };
}

/**
 * The one place every mutating (and most reading) API route should call
 * to find out whether the caller can perform `action`. This re-derives
 * identity and access from the server-side session on every call — it
 * never trusts anything the client claims about itself. A page hiding a
 * button is a UX nicety; this is the actual enforcement. CREATOR and
 * portal-admin sessions always pass, regardless of their own rank — see
 * src/lib/permissions.ts.
 */
export async function requireAction(action: RankAction): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!baseSession(session)) return UNAUTHORIZED;
  if (!hasAction(accessContext(session), action)) return FORBIDDEN;
  return { ok: true, session };
}

/** CREATOR or a designated portal admin — for the Ranks page, the audit
 * log, and anything else that needs full access but isn't specific to one
 * rank action. */
export async function requireAdmin(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!baseSession(session)) return UNAUTHORIZED;
  if (!isFullAdmin(accessContext(session))) return FORBIDDEN;
  return { ok: true, session };
}

/** CREATOR only — designating or removing a portal admin is the one
 * capability that deliberately isn't shared with portal admins
 * themselves. See src/lib/permissions.ts for why. */
export async function requireCreator(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!baseSession(session)) return UNAUTHORIZED;
  if (!accessContext(session).isCreator) return FORBIDDEN;
  return { ok: true, session };
}
