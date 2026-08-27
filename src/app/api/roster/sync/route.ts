import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireAction } from "@/lib/requireSession";
import { getMemberByDiscordId } from "@/lib/members";
import { syncRosterFromDiscord } from "@/lib/rosterSync";
import { logAudit } from "@/lib/audit";

// Pulls the roster from Discord: anyone holding a role bound to a rank
// appears, at that rank. See src/lib/rosterSync.ts for the exact rules
// (and for why it only ever touches rows it created itself).
export async function POST() {
  const auth = await requireAction("roster.manage");
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const result = await syncRosterFromDiscord();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Only log when something actually changed — a sync that finds nothing
  // to do isn't worth a permanent audit entry every time someone clicks.
  if (result.added || result.updated || result.removed) {
    await logAudit(db, {
      actorDiscordId: discordId,
      actorName: actor?.robloxUsername ?? actor?.discordUsername ?? discordId,
      action: "roster.sync",
      targetType: "roster",
      metadata: {
        added: result.added,
        updated: result.updated,
        removed: result.removed,
      },
    });
  }

  return NextResponse.json(result);
}
