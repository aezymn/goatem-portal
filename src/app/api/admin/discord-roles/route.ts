import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireSession";
import { listGuildRoles } from "@/lib/discordBot";

// Backs the "bind to a Discord role" picker on the Ranks page. Empty list
// (not an error) if the bot isn't configured — binding is optional.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const roles = await listGuildRoles();
  return NextResponse.json({ roles });
}
