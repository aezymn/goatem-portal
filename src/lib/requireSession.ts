import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getMemberByDiscordId } from "@/lib/members";
import { hasAction, isFullAdmin, type RankAction } from "@/lib/permissions";

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
  if (!member && !isFullAdmin(session.user)) return FORBIDDEN;

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
  if (!hasAction(session.user, action)) return FORBIDDEN;
  return { ok: true, session };
}

/** CREATOR or a designated portal admin — for the Ranks page, the audit
 * log, and anything else that needs full access but isn't specific to one
 * rank action. */
export async function requireAdmin(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!baseSession(session)) return UNAUTHORIZED;
  if (!isFullAdmin(session.user)) return FORBIDDEN;
  return { ok: true, session };
}

/** CREATOR only — designating or removing a portal admin is the one
 * capability that deliberately isn't shared with portal admins
 * themselves. See src/lib/permissions.ts for why. */
export async function requireCreator(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!baseSession(session)) return UNAUTHORIZED;
  if (!session.user.isCreator) return FORBIDDEN;
  return { ok: true, session };
}
