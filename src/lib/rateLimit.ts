// Basic in-memory rate limiting for write endpoints (report/comment
// creation) — a floor, not the final word. Honest limitation: this state
// lives in a single serverless function instance's memory, so it resets on
// cold starts and isn't shared across concurrent instances. For a small
// internal tool that's a reasonable starting point; if this ever needs to
// hold up against a determined distributed attempt, swap this module for
// Upstash Redis (a few lines' change, same call sites) — noted in
// SETUP.md as the recommended next step, not treated as done here.

const buckets = new Map<string, { count: number; resetAt: number }>();

// Cheap periodic cleanup so this map can't grow unbounded over a long-lived
// process — triggered opportunistically rather than on a timer.
let opsSinceSweep = 0;
function maybeSweep() {
  opsSinceSweep++;
  if (opsSinceSweep < 200) return;
  opsSinceSweep = 0;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Returns true if the action identified by `key` is allowed right now,
 * and records the attempt. `key` should include both the identity (IP, or
 * better, the authenticated Discord ID) and the action name, e.g.
 * `report-create:123456789012345678`.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  maybeSweep();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
