import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Page-level gate and Content Security Policy (CSP) enforcement.
export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https: blob:;
    media-src 'self' https:;
    frame-src https://medal.tv https://www.youtube-nocookie.com https://streamable.com;
    connect-src 'self' https://discord.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const { pathname } = new URL(request.url);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthed = Boolean(token && !token.invalid && token.discordId);

  // Define paths that require authentication
  const authRequiredPaths = [
    "/reports",
    "/roster",
    "/admin",
    "/absence",
    "/testing",
    "/members",
    "/changelog",
    "/link-roblox",
  ];

  const requiresAuth = authRequiredPaths.some(p => pathname.startsWith(p));

  if (requiresAuth) {
    if (!isAuthed) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("from", pathname);
      response = NextResponse.redirect(signInUrl);
    } else if (token?.linked === false && !pathname.startsWith("/link-roblox")) {
      response = NextResponse.redirect(new URL("/link-roblox", request.url));
    } else if (pathname.startsWith("/admin")) {
      const creatorIds: string[] =
        process.env.PORTAL_CREATOR_DISCORD_ID?.match(/\d{15,25}/g) ?? [];
      const isCreator = Boolean(
        token?.discordId && creatorIds.includes(token.discordId)
      );

      const isFullAdmin = Boolean(isCreator || token?.isPortalAdmin);
      const canBugSetup =
        isFullAdmin ||
        (Array.isArray(token?.actions) &&
          token.actions.includes("bugsetup.manage"));

      if (pathname.startsWith("/admin/bug-setup")) {
        if (!canBugSetup) {
          response = NextResponse.redirect(new URL("/access-denied", request.url));
        }
      } else if (!isFullAdmin) {
        response = NextResponse.redirect(new URL("/access-denied", request.url));
      } else if (pathname.startsWith("/admin/admins") && !isCreator) {
        response = NextResponse.redirect(new URL("/access-denied", request.url));
      }
    }
  }

  // Set CSP on the response
  response.headers.set("Content-Security-Policy", cspHeader);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
