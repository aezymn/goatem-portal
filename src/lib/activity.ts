import { db } from "@/db";
import { absences, bugReports, members, testLogs } from "@/db/schema";
import { and, desc, eq, isNull, lte, sql } from "drizzle-orm";

/** Today in YYYY-MM-DD, matching how the date columns store things. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Who is away right now. An absence covers leaveDate up to but NOT
 * including returnDate, because returnDate is the first day the person is
 * available again — so someone back "today" is not counted as away.
 */
export async function currentlyAwayMemberIds(): Promise<Set<string>> {
  const today = todayIso();
  const rows = await db
    .select({ memberId: absences.memberId })
    .from(absences)
    .where(
      and(
        isNull(absences.deletedAt),
        lte(absences.leaveDate, today),
        sql`${absences.returnDate} > ${today}`
      )
    );
  return new Set(rows.map((r) => r.memberId));
}

/** Everything one person has done, for their profile page. */
export async function getMemberActivity(memberId: string, limit = 20) {
  const [logs, bugs, away] = await Promise.all([
    db
      .select()
      .from(testLogs)
      .where(and(eq(testLogs.memberId, memberId), isNull(testLogs.deletedAt)))
      .orderBy(desc(testLogs.testedAt), desc(testLogs.createdAt))
      .limit(limit),
    db
      .select({
        id: bugReports.id,
        title: bugReports.title,
        status: bugReports.status,
        createdAt: bugReports.createdAt,
      })
      .from(bugReports)
      .where(
        and(eq(bugReports.reporterId, memberId), isNull(bugReports.deletedAt))
      )
      .orderBy(desc(bugReports.createdAt))
      .limit(limit),
    db
      .select()
      .from(absences)
      .where(and(eq(absences.memberId, memberId), isNull(absences.deletedAt)))
      .orderBy(desc(absences.leaveDate))
      .limit(limit),
  ]);

  return { logs, bugs, absences: away };
}

/** Totals for the profile header — counts over all time, not just the
 * page of recent rows shown below them. */
export async function getMemberTotals(memberId: string) {
  const [[logCount], [bugCount], [minutes]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(testLogs)
      .where(and(eq(testLogs.memberId, memberId), isNull(testLogs.deletedAt))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(bugReports)
      .where(
        and(eq(bugReports.reporterId, memberId), isNull(bugReports.deletedAt))
      ),
    db
      .select({ n: sql<number>`coalesce(sum(${testLogs.minutesSpent}), 0)::int` })
      .from(testLogs)
      .where(and(eq(testLogs.memberId, memberId), isNull(testLogs.deletedAt))),
  ]);
  return {
    testLogs: logCount?.n ?? 0,
    bugsFiled: bugCount?.n ?? 0,
    minutesLogged: minutes?.n ?? 0,
  };
}

/** A roster row plus the display fields the profile page needs. */
export async function getMemberById(id: string) {
  const [row] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, id), isNull(members.deletedAt)))
    .limit(1);
  return row;
}

/** Upcoming and current absences across everyone — the Absence page.
 * The cutoff is `returnDate > today`, matching currentlyAwayMemberIds:
 * someone whose return date IS today is available today, so their notice
 * belongs in the history, not on the board. */
export async function listAbsences() {
  const today = todayIso();
  return db
    .select({
      id: absences.id,
      memberId: absences.memberId,
      leaveDate: absences.leaveDate,
      returnDate: absences.returnDate,
      reason: absences.reason,
      robloxUsername: members.robloxUsername,
      discordUsername: members.discordUsername,
      discordAvatarUrl: members.discordAvatarUrl,
      rank: members.rank,
    })
    .from(absences)
    .innerJoin(members, eq(absences.memberId, members.id))
    .where(and(isNull(absences.deletedAt), sql`${absences.returnDate} > ${today}`))
    .orderBy(absences.leaveDate);
}

/** Past absences, most recent first — kept separate so the page can lead
 * with what's current rather than burying it under history. */
export async function listPastAbsences(limit = 30) {
  const today = todayIso();
  return db
    .select({
      id: absences.id,
      memberId: absences.memberId,
      leaveDate: absences.leaveDate,
      returnDate: absences.returnDate,
      reason: absences.reason,
      robloxUsername: members.robloxUsername,
      discordUsername: members.discordUsername,
      discordAvatarUrl: members.discordAvatarUrl,
      rank: members.rank,
    })
    .from(absences)
    .innerJoin(members, eq(absences.memberId, members.id))
    .where(and(isNull(absences.deletedAt), lte(absences.returnDate, today)))
    .orderBy(desc(absences.leaveDate))
    .limit(limit);
}

export async function listTestLogs(limit = 50) {
  return db
    .select({
      id: testLogs.id,
      memberId: testLogs.memberId,
      area: testLogs.area,
      findings: testLogs.findings,
      minutesSpent: testLogs.minutesSpent,
      testedAt: testLogs.testedAt,
      robloxUsername: members.robloxUsername,
      discordUsername: members.discordUsername,
      discordAvatarUrl: members.discordAvatarUrl,
    })
    .from(testLogs)
    .innerJoin(members, eq(testLogs.memberId, members.id))
    .where(isNull(testLogs.deletedAt))
    .orderBy(desc(testLogs.testedAt), desc(testLogs.createdAt))
    .limit(limit);
}
