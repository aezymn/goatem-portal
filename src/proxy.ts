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

  if (pathname.startsWith("/admin")) {
    const isFullAdmin = Boolean(token?.isCreator || token?.isPortalAdmin);
    if (!isFullAdmin) {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
    // /admin/admins is further restricted to the CREATOR alone — a portal
    // admin can see everything else under /admin but not this page. The
    // real enforcement is still server-side (requireCreator() on its
    // API routes); this just avoids showing them a page full of
    // buttons that would all 403.
    if (pathname.startsWith("/admin/admins") && !token?.isCreator) {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/reports/:path*", "/roster/:path*", "/admin/:path*"],
};
