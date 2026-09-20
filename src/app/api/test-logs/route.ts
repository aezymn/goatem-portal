import { NextResponse } from "next/server";
import { db } from "@/db";
import { testLogs, testLogAttendees, testLogBugs } from "@/db/schema";
import { requireRosterMember } from "@/lib/requireSession";
import { createTestLogSchema } from "@/lib/validation";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rateLimit";

// Logging a testing session. Open to any roster member — recording your
// own work isn't a privileged action, and gating it would just mean less
// gets recorded.
export async function POST(request: Request) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;

  if (!checkRateLimit(`testlog-create:${discordId}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many logs filed just now. Try again shortly." },
      { status: 429 }
    );
  }

  const member = await getMemberByDiscordId(discordId);
  if (!member) {
    return NextResponse.json(
      { error: "You need to be on the roster to log testing." },
      { status: 409 }
    );
  }

  const parsed = createTestLogSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(testLogs)
      .values({
        // The caller's own row, never an id from the request body.
        memberId: member.id,
        area: parsed.data.area,
        findings: parsed.data.findings,
        minutesSpent: parsed.data.minutesSpent ?? null,
        testedAt: parsed.data.testedAt,
      })
      .returning();

    // Ensure the creator is always credited as an attendee alongside any selected members
    const uniqueAttendees = Array.from(
      new Set([member.id, ...(parsed.data.attendeeIds ?? [])])
    );
    for (const attId of uniqueAttendees) {
      await tx
        .insert(testLogAttendees)
        .values({
          testLogId: row.id,
          memberId: attId,
        })
        .onConflictDoNothing();
    }

    // Attach bug reports if provided
    if (parsed.data.bugs && parsed.data.bugs.length > 0) {
      for (const b of parsed.data.bugs) {
        await tx
          .insert(testLogBugs)
          .values({
            testLogId: row.id,
            bugReportId: b.bugReportId,
            workedOnById: b.workedOnById || null,
          })
          .onConflictDoNothing();
      }
    }

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: displayNameFor(member),
      action: "testLog.create",
      targetType: "test_log",
      targetId: row.id,
      metadata: {
        area: row.area,
        testedAt: row.testedAt,
        attendeeCount: uniqueAttendees.length,
        bugCount: parsed.data.bugs?.length ?? 0,
      },
    });
    return row;
  });

  return NextResponse.json({ testLog: created }, { status: 201 });
}
