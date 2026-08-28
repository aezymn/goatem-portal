import { NextResponse } from "next/server";
import { db } from "@/db";
import { absences } from "@/db/schema";
import { requireRosterMember } from "@/lib/requireSession";
import { createAbsenceSchema } from "@/lib/validation";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rateLimit";

// Posting an absence notice. Open to any roster member and needs no
// permission: it's an announcement about yourself, not a request anyone
// grants. You can only ever post one against your own row.
export async function POST(request: Request) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;

  if (!checkRateLimit(`absence-create:${discordId}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many notices posted just now. Try again shortly." },
      { status: 429 }
    );
  }

  const member = await getMemberByDiscordId(discordId);
  if (!member) {
    return NextResponse.json(
      { error: "You need to be on the roster to post an absence." },
      { status: 409 }
    );
  }

  const parsed = createAbsenceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(absences)
      .values({
        // Always the caller's own row — never a member id from the
        // request body, so nobody can file an absence as someone else.
        memberId: member.id,
        leaveDate: parsed.data.leaveDate,
        returnDate: parsed.data.returnDate,
        reason: parsed.data.reason?.trim() || null,
      })
      .returning();

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: displayNameFor(member),
      action: "absence.create",
      targetType: "absence",
      targetId: row.id,
      metadata: { leaveDate: row.leaveDate, returnDate: row.returnDate },
    });
    return row;
  });

  return NextResponse.json({ absence: created }, { status: 201 });
}
