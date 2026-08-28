import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Page-level gate. This is a UX convenience (redirect people to the right
// place before they even see a page) — it is NOT the security boundary.
// The real enforcement lives in requireAction()/requireAdmin()/
// requireCreator() inside every API route, which re-check on the server
// on every request regardless of what this does. Someone bypassing this
// proxy entirely (calling an API endpoint directly) still hits that.
export async function proxy(request: Request) {
  const { pathname } = new URL(request.url);

  const token = await getToken({
    // @ts-expect-error next-auth's getToken types expect a NextRequest;
    // a standard Request has every field it actually reads (cookies/url).
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthed = Boolean(token && !token.invalid && token.discordId);

  if (!isAuthed) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // First sign-in insists on a Roblox username. Everything in the portal
  // is keyed to who someone is in-game — group membership, alt accounts,
  // testing logs — so an unlinked account is sent to link before it can
  // go anywhere else. The claim rides on the JWT to keep this a
  // no-database-hit check; /link-roblox re-checks against the database
  // itself, so a stale claim can only ever cost one extra redirect.
  if (token?.linked === false && !pathname.startsWith("/link-roblox")) {
    return NextResponse.redirect(new URL("/link-roblox", request.url));
  }

  if (pathname.startsWith("/admin")) {
    // The environment is the authority on who is CREATOR, so it's read
    // here rather than trusting the token's own claim. It's checked BOTH
    // ways round: a token claiming isCreator can't wave itself past the
    // /admin/admins gate below, and — the case that bit — somebody added
    // to PORTAL_CREATOR_DISCORD_ID while already signed in gets in
    // straight away instead of being bounced for up to a recheck
    // interval by a token that still says false.
    //
    // Typed explicitly: `match(...) ?? []` widens the empty branch to
    // never[], and .includes(string) on that is a type error.
    const creatorIds: string[] =
      process.env.PORTAL_CREATOR_DISCORD_ID?.match(/\d{15,25}/g) ?? [];
    const isCreator = Boolean(
      token?.discordId && creatorIds.includes(token.discordId)
    );

    const isFullAdmin = Boolean(isCreator || token?.isPortalAdmin);
    // Bug setup is a rank-grantable action, so it can't sit behind the
    // blanket admin gate the rest of /admin uses. The page re-checks the
    // action server-side; this only decides whether to let them through.
    const canBugSetup =
      isFullAdmin ||
      (Array.isArray(token?.actions) &&
        token.actions.includes("bugsetup.manage"));
    if (pathname.startsWith("/admin/bug-setup")) {
      if (!canBugSetup) {
        return NextResponse.redirect(new URL("/access-denied", request.url));
      }
      return NextResponse.next();
    }
    if (!isFullAdmin) {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
    // /admin/admins is further restricted to CREATORs alone — a portal
    // admin can see everything else under /admin but not this page. Real
    // enforcement is still server-side (requireCreator() on its API
    // routes, plus the page's own check); this only avoids showing
    // someone a page that would refuse them.
    if (pathname.startsWith("/admin/admins") && !isCreator) {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/reports/:path*",
    "/roster/:path*",
    "/admin/:path*",
    "/absence/:path*",
    "/testing/:path*",
    "/members/:path*",
    "/changelog/:path*",
    "/link-roblox",
  ],
};
