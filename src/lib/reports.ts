import { db } from "@/db";
import {
  bugParticipants,
  bugStages,
  comments,
  members,
} from "@/db/schema";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

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

export interface StageRow {
  id: string;
  title: string;
  note: string | null;
  createdAt: string;
  createdById: string;
  createdByName: string;
}

export async function listStages(reportId: string): Promise<StageRow[]> {
  const rows = await db
    .select({
      id: bugStages.id,
      title: bugStages.title,
      note: bugStages.note,
      createdAt: bugStages.createdAt,
      createdById: bugStages.createdById,
      robloxUsername: members.robloxUsername,
      discordUsername: members.discordUsername,
    })
    .from(bugStages)
    .innerJoin(members, eq(bugStages.createdById, members.id))
    .where(
      and(eq(bugStages.bugReportId, reportId), isNull(bugStages.deletedAt))
    )
    .orderBy(asc(bugStages.position), asc(bugStages.createdAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    createdById: r.createdById,
    createdByName:
      r.robloxUsername ?? r.discordUsername ?? "Unknown member",
  }));
}

/** The stage a new comment belongs to: whichever is current. Null when a
 * report has no stages yet, which puts the comment under the report
 * itself. */
export async function currentStageId(reportId: string) {
  const [row] = await db
    .select({ id: bugStages.id })
    .from(bugStages)
    .where(
      and(eq(bugStages.bugReportId, reportId), isNull(bugStages.deletedAt))
    )
    .orderBy(desc(bugStages.position), desc(bugStages.createdAt))
    .limit(1);
  return row?.id ?? null;
}

export async function addStage(
  reportId: string,
  createdById: string,
  title: string,
  note: string | null
) {
  const [maxRow] = await db
    .select({ max: sql<number | null>`max(${bugStages.position})` })
    .from(bugStages)
    .where(eq(bugStages.bugReportId, reportId));

  const [row] = await db
    .insert(bugStages)
    .values({
      bugReportId: reportId,
      createdById,
      title,
      note,
      position: (maxRow?.max ?? -1) + 1,
    })
    .returning();
  return row;
}

/** Soft delete, like everything else that holds someone's words nearby —
 * the comments written under it survive and fall back to the report (the
 * FK is ON DELETE SET NULL, but a soft delete doesn't even reach that). */
export async function removeStage(stageId: string) {
  await db
    .update(bugStages)
    .set({ deletedAt: new Date() })
    .where(eq(bugStages.id, stageId));
  // Comments written during it move back under the report rather than
  // vanishing with the stage they can no longer point at.
  await db
    .update(comments)
    .set({ stageId: null })
    .where(eq(comments.stageId, stageId));
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
  /** Which stage this was said under; null means before any stage. */
  stageId: string | null;
}

/**
 * The conversation, oldest first.
 *
 * The report's own description is NOT in here — it's the report, not
 * somebody's comment, so the page renders it as the report body above the
 * thread. Everything here is a reply, carrying the stage it was written
 * under so the page can file it beneath that stage's marker.
 */
export async function getReportTimeline(
  reportId: string
): Promise<TimelineEntry[]> {
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
      stageId: comments.stageId,
    })
    .from(comments)
    .innerJoin(members, eq(comments.authorId, members.id))
    .where(and(eq(comments.bugReportId, reportId), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt));

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    attachments: r.attachments ?? [],
    createdAt: r.createdAt.toISOString(),
    authorId: r.authorId,
    authorName: r.robloxUsername ?? r.discordUsername ?? "Unknown member",
    authorAvatarUrl: r.authorAvatarUrl,
    authorRank: r.authorRank,
    stageId: r.stageId,
  }));
}

/** Which reports the given member has joined — for marking "yours" in
 * the list without a query per row. */
export async function joinedReportIds(memberId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: bugParticipants.bugReportId })
    .from(bugParticipants)
    .where(eq(bugParticipants.memberId, memberId));
  return new Set(rows.map((r) => r.id));
}
