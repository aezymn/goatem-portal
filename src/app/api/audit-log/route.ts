import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireTier } from "@/lib/requireSession";

// Deliberately the ONLY route in this app that touches audit_log. There is
// no PATCH/DELETE here or anywhere else — see src/db/schema.ts and
// src/lib/audit.ts for why that's on purpose, not an oversight.
export async function GET(request: Request) {
  const auth = await requireTier("ADMIN");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 100), 1),
    500
  );

  const rows = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return NextResponse.json({ entries: rows });
}
