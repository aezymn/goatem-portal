import { NextResponse } from "next/server";
import { archiveStaleCompleted, ARCHIVE_AFTER_DAYS } from "@/lib/reports";

/**
 * Archives reports that have sat completed for 30 days.
 *
 * Meant for Vercel Cron (see vercel.json), which sends the project's
 * CRON_SECRET as a bearer token. The check is mandatory rather than
 * best-effort: this route is on the public internet like any other, and
 * without a secret set it refuses to run at all rather than leaving an
 * unauthenticated mutation exposed.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured, so this route is disabled." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const archived = await archiveStaleCompleted();
  return NextResponse.json({ ok: true, archived, afterDays: ARCHIVE_AFTER_DAYS });
}
