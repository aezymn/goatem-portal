import type { NextConfig } from "next";

// Security headers applied to every response. These are a baseline, not a
// silver bullet — see SETUP.md for the full security write-up — but they
// close off a handful of common browser-side attack classes for free:
// clickjacking (X-Frame-Options/frame-ancestors), MIME-sniffing attacks
// (X-Content-Type-Options), and a real (if not maximally strict) CSP.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js needs 'unsafe-inline' for a handful of framework-injected
      // styles/scripts even in production; tightening this further to a
      // nonce-based policy is a reasonable follow-up once the app is live
      // and there's a real deployment to test it against.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // Attachments are arbitrary links people paste (a screenshot on
      // imgur, a clip host), so images and media can't be host-limited
      // the way the Discord CDN was — https: only is the meaningful
      // restriction left, and it still blocks data:/blob: injection.
      "img-src 'self' data: https:",
      "media-src 'self' https:",
      // Only the players src/lib/attachments.ts actually produces embed
      // URLs for. Keep this list and EMBED_FRAME_HOSTS in step: if they
      // disagree the CSP wins and the embed silently renders nothing.
      "frame-src https://medal.tv https://www.youtube-nocookie.com https://streamable.com",
      "connect-src 'self' https://discord.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
