import { NextResponse } from "next/server";
import { requireRosterMember } from "@/lib/requireSession";
import { getReportVersion } from "@/lib/reports";

/**
 * The token an open report page polls so everyone's view stays current
 * without a refresh. Deliberately tiny: one row, one string, no joins
 * worth speaking of — the page only re-renders when the token moves.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/reports/[id]/version">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  return NextResponse.json({ version: await getReportVersion(id) });
}
