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
      "img-src 'self' data: https://cdn.discordapp.com",
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
