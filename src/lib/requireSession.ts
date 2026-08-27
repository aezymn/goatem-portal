import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { tierAtLeast, type PermissionTier } from "@/lib/permissions";

type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

/**
 * The one place every mutating (and most reading) API route should call to
 * find out who's asking and whether they're allowed. This re-derives
 * identity and permission tier from the server-side session on every call
 * — it never trusts anything the client claims about itself. A page
 * hiding a button is a UX nicety; this is the actual enforcement.
 */
export async function requireTier(
  minTier: PermissionTier
): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session || session.stale || !session.user?.discordId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  if (!tierAtLeast(session.user.permissionTier, minTier)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, session };
}
