import { db } from "@/db";
import {
  bugParticipants,
  bugReports,
  comments,
  members,
} from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

/**
 * Reading a bug report and the people on it.
 *
 * Participants replaced the old single assignee: nobody hands a bug to
 * anyone, people join it themselves and show up in its member list. The
 * reporter is joined automatically when they file, and commenting joins
 * you too — if you're talking about the bug you're on the bug.
 */

export interface ParticipantRow {
  memberId: string;
  robloxUsername: string | null;
  discordUsername: string | null;
  discordAvatarUrl: string | null;
  rank: string;
  region: string | null;
  hasSignedIn: boolean;
  lastSeenAt: string | null;
  lastActiveAt: string | null;
  lastSignInAt: string | null;
  joinedAt: string;
  isReporter: boolean;
}

export async function getReportParticipants(
  reportId: string,
  reporterId: string
): Promise<ParticipantRow[]> {
  const rows = await db
    .select({
      memberId: members.id,
      robloxUsername: members.robloxUsername,
      discordUsername: members.discordUsername,
      discordAvatarUrl: members.discordAvatarUrl,
      rank: members.rank,
      region: members.region,
      hasSignedIn: members.hasSignedIn,
      lastSeenAt: members.lastSeenAt,
      lastActiveAt: members.lastActiveAt,
      lastSignInAt: members.lastSignInAt,
      joinedAt: bugParticipants.joinedAt,
    })
    .from(bugParticipants)
    .innerJoin(members, eq(bugParticipants.memberId, members.id))
    .where(
      and(
        eq(bugParticipants.bugReportId, reportId),
        isNull(members.deletedAt)
      )
    )
    .orderBy(asc(bugParticipants.joinedAt));

  return rows.map((r) => ({
    ...r,
    lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
    lastActiveAt: r.lastActiveAt?.toISOString() ?? null,
    lastSignInAt: r.lastSignInAt?.toISOString() ?? null,
    joinedAt: r.joinedAt.toISOString(),
    isReporter: r.memberId === reporterId,
  }));
}

/**
 * Adds someone to a report, idempotently. Safe to call on every comment:
 * a second join is a no-op rather than an error, so callers never have to
 * check first.
 */
export async function joinReport(reportId: string, memberId: string) {
  await db
    .insert(bugParticipants)
    .values({ bugReportId: reportId, memberId })
    .onConflictDoNothing();
}

/** Leaving is a real delete. There's no history worth keeping in "was
 * briefly on this bug", and the audit log records it anyway. */
export async function leaveReport(reportId: string, memberId: string) {
  await db
    .delete(bugParticipants)
    .where(
      and(
        eq(bugParticipants.bugReportId, reportId),
        eq(bugParticipants.memberId, memberId)
      )
    );
}

export async function isParticipant(reportId: string, memberId: string) {
  const [row] = await db
    .select({ memberId: bugParticipants.memberId })
    .from(bugParticipants)
    .where(
      and(
        eq(bugParticipants.bugReportId, reportId),
        eq(bugParticipants.memberId, memberId)
      )
    )
    .limit(1);
  return Boolean(row);
}

export interface TimelineEntry {
  id: string;
  body: string;
  attachments: string[];
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRank: string;
}

/**
 * The conversation, oldest first — the report's own description is the
 * first entry, because "the bug, then what people said about it" is one
 * thread rather than a header plus a comment list.
 */
export async function getReportTimeline(
  reportId: string
): Promise<TimelineEntry[]> {
  const [report] = await db
    .select({
      id: bugReports.id,
      body: bugReports.description,
      attachments: bugReports.attachments,
      createdAt: bugReports.createdAt,
      authorId: members.id,
      robloxUsername: members.robloxUsername,
      discordUsername: members.discordUsername,
      authorAvatarUrl: members.discordAvatarUrl,
      authorRank: members.rank,
    })
    .from(bugReports)
    .innerJoin(members, eq(bugReports.reporterId, members.id))
    .where(eq(bugReports.id, reportId))
    .limit(1);

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      attachments: comments.attachments,
      createdAt: comments.createdAt,
      authorId: members.id,
      robloxUsername: members.robloxUsername,
      discordUsername: members.discordUsername,
      authorAvatarUrl: members.discordAvatarUrl,
      authorRank: members.rank,
    })
    .from(comments)
    .innerJoin(members, eq(comments.authorId, members.id))
    .where(and(eq(comments.bugReportId, reportId), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt));

  const shape = (r: typeof rows[number] | typeof report): TimelineEntry => ({
    id: r.id,
    body: r.body,
    attachments: r.attachments ?? [],
    createdAt: r.createdAt.toISOString(),
    authorId: r.authorId,
    authorName:
      r.robloxUsername ?? r.discordUsername ?? "Unknown member",
    authorAvatarUrl: r.authorAvatarUrl,
    authorRank: r.authorRank,
  });

  return report ? [shape(report), ...rows.map(shape)] : rows.map(shape);
}
