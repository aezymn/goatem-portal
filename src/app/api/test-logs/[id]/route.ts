import { NextResponse } from "next/server";
import { db } from "@/db";
import { testLogs, testLogAttendees, testLogBugs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { updateTestLogSchema } from "@/lib/validation";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { isFullAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// Updating a test log: only the author or a full admin can edit.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/test-logs/[id]">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  const member = await getMemberByDiscordId(discordId);
  const [existing] = await db
    .select()
    .from(testLogs)
    .where(and(eq(testLogs.id, id), isNull(testLogs.deletedAt)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const isOwn = member && existing.memberId === member.id;
  if (!isOwn && !isFullAdmin(auth.session.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = updateTestLogSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const updated = await db.transaction(async (tx) => {
    const updateValues: Partial<typeof testLogs.$inferInsert> = {};
    if (parsed.data.area !== undefined) updateValues.area = parsed.data.area;
    if (parsed.data.findings !== undefined) updateValues.findings = parsed.data.findings;
    if (parsed.data.minutesSpent !== undefined) updateValues.minutesSpent = parsed.data.minutesSpent;
    if (parsed.data.testedAt !== undefined) updateValues.testedAt = parsed.data.testedAt;

    let row = existing;
    if (Object.keys(updateValues).length > 0) {
      const [u] = await tx
        .update(testLogs)
        .set(updateValues)
        .where(eq(testLogs.id, id))
        .returning();
      row = u;
    }

    // Sync attendees if array was supplied
    if (parsed.data.attendeeIds !== undefined) {
      await tx
        .delete(testLogAttendees)
        .where(eq(testLogAttendees.testLogId, id));

      const uniqueAttendees = Array.from(
        new Set([existing.memberId, ...parsed.data.attendeeIds])
      );
      for (const attId of uniqueAttendees) {
        await tx
          .insert(testLogAttendees)
          .values({
            testLogId: id,
            memberId: attId,
          })
          .onConflictDoNothing();
      }
    }

    // Sync attached bugs if array was supplied
    if (parsed.data.bugs !== undefined) {
      await tx.delete(testLogBugs).where(eq(testLogBugs.testLogId, id));

      for (const b of parsed.data.bugs) {
        await tx
          .insert(testLogBugs)
          .values({
            testLogId: id,
            bugReportId: b.bugReportId,
            workedOnById: b.workedOnById || null,
          })
          .onConflictDoNothing();
      }
    }

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: member ? displayNameFor(member) : discordId,
      action: "testLog.update",
      targetType: "test_log",
      targetId: id,
      metadata: {
        area: row.area,
        testedAt: row.testedAt,
      },
    });

    return row;
  });

  return NextResponse.json({ testLog: updated });
}

// Removing a test log: your own, or anyone's if you're a full admin.
// Soft delete, so a removed log is still recoverable.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/test-logs/[id]">
) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  const member = await getMemberByDiscordId(discordId);
  const [existing] = await db
    .select()
    .from(testLogs)
    .where(and(eq(testLogs.id, id), isNull(testLogs.deletedAt)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const isOwn = member && existing.memberId === member.id;
  if (!isOwn && !isFullAdmin(auth.session.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(testLogs)
      .set({ deletedAt: new Date() })
      .where(eq(testLogs.id, id));

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: member ? displayNameFor(member) : discordId,
      action: "testLog.delete",
      targetType: "test_log",
      targetId: id,
      metadata: { ownLog: Boolean(isOwn) },
    });
  });

  return NextResponse.json({ ok: true });
}
