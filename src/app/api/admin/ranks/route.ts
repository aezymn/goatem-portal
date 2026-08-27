import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireSession";
import { listRanksWithActions } from "@/lib/ranks";
import { listGuildRoles } from "@/lib/discordBot";

// The Ranks admin page: the full ladder (authority order, Discord role
// binding, granted actions) plus the live list of Discord roles available
// to bind to. Everything an admin needs to render that page in one call.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const [ranks, discordRoles] = await Promise.all([
    listRanksWithActions(),
    listGuildRoles(),
  ]);

  return NextResponse.json({ ranks, discordRoles });
}
