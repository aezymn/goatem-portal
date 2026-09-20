import { db } from "@/db";
import {
  absences,
  bugReports,
  members,
  testLogs,
  testLogAttendees,
  testLogBugs,
} from "@/db/schema";
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

/** Today in YYYY-MM-DD, matching how the date columns store things. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Who is away right now, mapped to the day they're back. An absence
 * covers leaveDate up to but NOT including returnDate, because
 * returnDate is the first day the person is available again — so
 * someone back "today" is not counted as away.
 *
 * Where two notices overlap, the later return date wins: what the roster
 * wants to say is when this person is next actually around.
 */
export async function currentAbsencesByMemberId(): Promise<
  Map<string, string>
> {
  const today = todayIso();
  const rows = await db
    .select({
      memberId: absences.memberId,
      returnDate: absences.returnDate,
    })
    .from(absences)
    .where(
      and(
        isNull(absences.deletedAt),
        lte(absences.leaveDate, today),
        sql`${absences.returnDate} > ${today}`
      )
    );

  const byMember = new Map<string, string>();
  for (const row of rows) {
    const existing = byMember.get(row.memberId);
    if (!existing || row.returnDate > existing) {
      byMember.set(row.memberId, row.returnDate);
    }
  }
  return byMember;
}

/** Everything one person has done, for their profile page. */
export async function getMemberActivity(memberId: string, limit = 20) {
  const attendedLogs = db
    .select({ testLogId: testLogAttendees.testLogId })
    .from(testLogAttendees)
    .where(eq(testLogAttendees.memberId, memberId));

  const [logs, bugs, away] = await Promise.all([
    db
      .select({
        id: testLogs.id,
        memberId: testLogs.memberId,
        area: testLogs.area,
        findings: testLogs.findings,
        minutesSpent: testLogs.minutesSpent,
        testedAt: testLogs.testedAt,
        createdAt: testLogs.createdAt,
        isAuthor: sql<boolean>`${testLogs.memberId} = ${memberId}`,
      })
      .from(testLogs)
      .where(
        and(
          isNull(testLogs.deletedAt),
          or(
            eq(testLogs.memberId, memberId),
            inArray(testLogs.id, attendedLogs)
          )
        )
      )
      .orderBy(desc(testLogs.testedAt), desc(testLogs.createdAt))
      .limit(limit),
    db
      .select({
        id: bugReports.id,
        title: bugReports.title,
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
  const attendedLogs = db
    .select({ testLogId: testLogAttendees.testLogId })
    .from(testLogAttendees)
    .where(eq(testLogAttendees.memberId, memberId));

  const [[logCount], [bugCount], [minutes]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(testLogs)
      .where(
        and(
          isNull(testLogs.deletedAt),
          or(
            eq(testLogs.memberId, memberId),
            inArray(testLogs.id, attendedLogs)
          )
        )
      ),
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

/** The alt/testing accounts belonging to someone. Alts have no profile
 * page of their own — they're listed on their owner's, which is the only
 * place the whole person is visible at once. */
export async function getAltAccounts(memberId: string) {
  return db
    .select({
      id: members.id,
      robloxUsername: members.robloxUsername,
      robloxUserId: members.robloxUserId,
      hasGameAccess: members.hasGameAccess,
    })
    .from(members)
    .where(
      and(eq(members.parentMemberId, memberId), isNull(members.deletedAt))
    )
    .orderBy(members.robloxUsername);
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
 * The cutoff is `returnDate > today`, matching currentAbsencesByMemberId:
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

export interface TestLogAttendeeItem {
  memberId: string;
  robloxUsername: string | null;
  discordUsername: string | null;
  discordAvatarUrl: string | null;
  rank: string;
}

export interface TestLogBugItem {
  bugReportId: string;
  bugTitle: string;
  workedOnById: string | null;
  workerRobloxUsername: string | null;
  workerDiscordUsername: string | null;
}

export interface DetailedTestLog {
  id: string;
  memberId: string;
  area: string;
  findings: string;
  minutesSpent: number | null;
  testedAt: string;
  robloxUsername: string | null;
  discordUsername: string | null;
  discordAvatarUrl: string | null;
  attendees: TestLogAttendeeItem[];
  bugs: TestLogBugItem[];
}

export async function listTestLogs(limit = 50): Promise<DetailedTestLog[]> {
  const baseLogs = await db
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
      rank: members.rank,
    })
    .from(testLogs)
    .innerJoin(members, eq(testLogs.memberId, members.id))
    .where(isNull(testLogs.deletedAt))
    .orderBy(desc(testLogs.testedAt), desc(testLogs.createdAt))
    .limit(limit);

  if (baseLogs.length === 0) return [];

  const logIds = baseLogs.map((l) => l.id);

  const [attendeeRows, bugRows] = await Promise.all([
    db
      .select({
        testLogId: testLogAttendees.testLogId,
        memberId: members.id,
        robloxUsername: members.robloxUsername,
        discordUsername: members.discordUsername,
        discordAvatarUrl: members.discordAvatarUrl,
        rank: members.rank,
      })
      .from(testLogAttendees)
      .innerJoin(members, eq(testLogAttendees.memberId, members.id))
      .where(inArray(testLogAttendees.testLogId, logIds)),
    (() => {
      const worker = alias(members, "worker");
      return db
        .select({
          testLogId: testLogBugs.testLogId,
          bugReportId: bugReports.id,
          bugTitle: bugReports.title,
          workedOnById: testLogBugs.workedOnById,
          workerRobloxUsername: worker.robloxUsername,
          workerDiscordUsername: worker.discordUsername,
        })
        .from(testLogBugs)
        .innerJoin(bugReports, eq(testLogBugs.bugReportId, bugReports.id))
        .leftJoin(worker, eq(testLogBugs.workedOnById, worker.id))
        .where(inArray(testLogBugs.testLogId, logIds));
    })(),
  ]);

  const attendeesByLog = new Map<string, TestLogAttendeeItem[]>();
  for (const row of attendeeRows) {
    const list = attendeesByLog.get(row.testLogId) ?? [];
    list.push({
      memberId: row.memberId,
      robloxUsername: row.robloxUsername,
      discordUsername: row.discordUsername,
      discordAvatarUrl: row.discordAvatarUrl,
      rank: row.rank,
    });
    attendeesByLog.set(row.testLogId, list);
  }

  const bugsByLog = new Map<string, TestLogBugItem[]>();
  for (const row of bugRows) {
    const list = bugsByLog.get(row.testLogId) ?? [];
    list.push({
      bugReportId: row.bugReportId,
      bugTitle: row.bugTitle,
      workedOnById: row.workedOnById,
      workerRobloxUsername: row.workerRobloxUsername,
      workerDiscordUsername: row.workerDiscordUsername,
    });
    bugsByLog.set(row.testLogId, list);
  }

  return baseLogs.map((l) => {
    // If no attendees row was found (legacy log), default attendee is the author
    const attendees = attendeesByLog.get(l.id) ?? [
      {
        memberId: l.memberId,
        robloxUsername: l.robloxUsername,
        discordUsername: l.discordUsername,
        discordAvatarUrl: l.discordAvatarUrl,
        rank: l.rank,
      },
    ];

    return {
      id: l.id,
      memberId: l.memberId,
      area: l.area,
      findings: l.findings,
      minutesSpent: l.minutesSpent,
      testedAt: l.testedAt,
      robloxUsername: l.robloxUsername,
      discordUsername: l.discordUsername,
      discordAvatarUrl: l.discordAvatarUrl,
      attendees,
      bugs: bugsByLog.get(l.id) ?? [],
    };
  });
}

export async function listRosterMembersForSelect() {
  return db
    .select({
      id: members.id,
      robloxUsername: members.robloxUsername,
      discordUsername: members.discordUsername,
      discordAvatarUrl: members.discordAvatarUrl,
      rank: members.rank,
    })
    .from(members)
    .where(and(isNull(members.deletedAt), isNull(members.parentMemberId)))
    .orderBy(asc(members.robloxUsername), asc(members.discordUsername));
}

export async function listActiveBugsForSelect() {
  return db
    .select({
      id: bugReports.id,
      title: bugReports.title,
    })
    .from(bugReports)
    .where(and(isNull(bugReports.deletedAt), isNull(bugReports.archivedAt)))
    .orderBy(desc(bugReports.createdAt))
    .limit(100);
}
