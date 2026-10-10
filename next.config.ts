import type { NextConfig } from "next";

// Security headers applied to every response. These are a baseline, not a
// silver bullet — see SETUP.md for the full security write-up — but they
// close off a handful of common browser-side attack classes for free:
// clickjacking (X-Frame-Options/frame-ancestors), MIME-sniffing attacks
// (X-Content-Type-Options), and a real (if not maximally strict) CSP.
const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://cdn.discordapp.com https://*.rbxcdn.com https://images.rbxcdn.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://discord.com https://*.roblox.com",
  "frame-src 'self' https://www.youtube.com https://medal.tv https://streamable.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
