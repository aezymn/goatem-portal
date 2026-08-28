import { db } from "@/db";
import {
  bugChanges,
  bugReports,
  changelogEntries,
  changelogPosts,
  members,
} from "@/db/schema";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PostStatus } from "@/lib/changelogStatus";
import {
  compareVersions,
  formatVersion,
  nextVersion,
  parseVersion,
  type ReleaseKind,
  type Version,
} from "@/lib/versions";

/**
 * The change log: what shipped, when, and which bugs it closed.
 *
 * Posts move draft → pending → published. Only published ones appear on
 * the master log, and only someone with changelog.approve can put them
 * there — writing a release note and deciding it goes out are separate
 * grants on purpose.
 */

export {
  STATUS_LABEL,
  asPostStatus,
  type PostStatus,
} from "@/lib/changelogStatus";

function versionOf(row: {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number | null;
}): Version {
  return {
    major: row.versionMajor,
    minor: row.versionMinor,
    patch: row.versionPatch,
  };
}

/** The highest version in the log, published or not — drafts count, or
 * two people drafting at once would both be handed the same number. */
export async function latestVersion(): Promise<Version | null> {
  const rows = await db
    .select({
      versionMajor: changelogPosts.versionMajor,
      versionMinor: changelogPosts.versionMinor,
      versionPatch: changelogPosts.versionPatch,
    })
    .from(changelogPosts)
    .where(isNull(changelogPosts.deletedAt));

  if (rows.length === 0) return null;
  return rows.map(versionOf).sort(compareVersions)[0];
}

/** What the next post's version would be, for each kind of release —
 * shown side by side so the choice is "which of these two numbers", not
 * "type a version and hope". */
export async function suggestedVersions(): Promise<{
  update: string;
  continuation: string;
}> {
  const latest = await latestVersion();
  return {
    update: formatVersion(nextVersion(latest, "update")),
    continuation: formatVersion(nextVersion(latest, "continuation")),
  };
}

export async function listPosts(opts: { publishedOnly: boolean }) {
  const rows = await db
    .select({
      id: changelogPosts.id,
      title: changelogPosts.title,
      version: changelogPosts.version,
      versionMajor: changelogPosts.versionMajor,
      versionMinor: changelogPosts.versionMinor,
      versionPatch: changelogPosts.versionPatch,
      body: changelogPosts.body,
      status: changelogPosts.status,
      publishedAt: changelogPosts.publishedAt,
      createdAt: changelogPosts.createdAt,
      authorRoblox: members.robloxUsername,
      authorDiscord: members.discordUsername,
      entryCount: sql<number>`(
        select count(*)::int from "changelog_entries" e
        where e."post_id" = "changelog_posts"."id"
      )`,
    })
    .from(changelogPosts)
    .innerJoin(members, eq(changelogPosts.createdById, members.id))
    .where(
      opts.publishedOnly
        ? and(
            isNull(changelogPosts.deletedAt),
            eq(changelogPosts.status, "published")
          )
        : isNull(changelogPosts.deletedAt)
    );

  // Sorted in TypeScript rather than SQL so the "a plain release comes
  // before its own continuations" rule lives in exactly one place —
  // compareVersions — instead of being restated as an ORDER BY that has
  // to special-case a null patch.
  return rows.sort((a, b) => compareVersions(versionOf(a), versionOf(b)));
}

export async function getPost(id: string) {
  const [post] = await db
    .select({
      id: changelogPosts.id,
      title: changelogPosts.title,
      version: changelogPosts.version,
      versionMajor: changelogPosts.versionMajor,
      versionMinor: changelogPosts.versionMinor,
      versionPatch: changelogPosts.versionPatch,
      body: changelogPosts.body,
      status: changelogPosts.status,
      publishedAt: changelogPosts.publishedAt,
      createdAt: changelogPosts.createdAt,
      createdById: changelogPosts.createdById,
      approvedById: changelogPosts.approvedById,
      authorRoblox: members.robloxUsername,
      authorDiscord: members.discordUsername,
    })
    .from(changelogPosts)
    .innerJoin(members, eq(changelogPosts.createdById, members.id))
    .where(and(eq(changelogPosts.id, id), isNull(changelogPosts.deletedAt)))
    .limit(1);
  return post;
}

export async function listEntries(postId: string) {
  return db
    .select({
      id: changelogEntries.id,
      text: changelogEntries.text,
      position: changelogEntries.position,
      bugReportId: changelogEntries.bugReportId,
      reportTitle: bugReports.title,
    })
    .from(changelogEntries)
    .leftJoin(bugReports, eq(changelogEntries.bugReportId, bugReports.id))
    .where(eq(changelogEntries.postId, postId))
    .orderBy(asc(changelogEntries.position));
}

export async function createPost(input: {
  title: string;
  version: Version;
  body: string | null;
  createdById: string;
}) {
  const [row] = await db
    .insert(changelogPosts)
    .values({
      title: input.title,
      version: formatVersion(input.version),
      versionMajor: input.version.major,
      versionMinor: input.version.minor,
      versionPatch: input.version.patch,
      body: input.body,
      createdById: input.createdById,
    })
    .returning();
  return row;
}

export async function updatePost(
  id: string,
  changes: { title?: string; body?: string | null; version?: Version }
) {
  await db
    .update(changelogPosts)
    .set({
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.body !== undefined ? { body: changes.body } : {}),
      ...(changes.version
        ? {
            version: formatVersion(changes.version),
            versionMajor: changes.version.major,
            versionMinor: changes.version.minor,
            versionPatch: changes.version.patch,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(changelogPosts.id, id));
}

/**
 * Moves a post along the workflow.
 *
 * Publishing stamps who approved it and when. Sending a published post
 * back to draft clears both — a post that has been pulled shouldn't still
 * claim someone signed it off in its current state. The date is NOT
 * re-stamped on a later re-publish, so editing a typo doesn't silently
 * move a release's date.
 */
export async function setPostStatus(
  id: string,
  status: PostStatus,
  approvedById: string | null
) {
  const [current] = await db
    .select({ publishedAt: changelogPosts.publishedAt })
    .from(changelogPosts)
    .where(eq(changelogPosts.id, id))
    .limit(1);

  await db
    .update(changelogPosts)
    .set({
      status,
      approvedById: status === "published" ? approvedById : null,
      publishedAt:
        status === "published"
          ? (current?.publishedAt ?? new Date())
          : null,
      updatedAt: new Date(),
    })
    .where(eq(changelogPosts.id, id));
}

export async function deletePost(id: string) {
  await db
    .update(changelogPosts)
    .set({ deletedAt: new Date() })
    .where(eq(changelogPosts.id, id));
}

async function nextEntryPosition(postId: string) {
  const [row] = await db
    .select({ max: sql<number | null>`max(${changelogEntries.position})` })
    .from(changelogEntries)
    .where(eq(changelogEntries.postId, postId));
  return (row?.max ?? -1) + 1;
}

export async function addEntry(
  postId: string,
  text: string,
  bugReportId: string | null
) {
  const [row] = await db
    .insert(changelogEntries)
    .values({
      postId,
      text,
      bugReportId,
      position: await nextEntryPosition(postId),
    })
    .returning();
  return row;
}

export async function updateEntry(id: string, text: string) {
  await db
    .update(changelogEntries)
    .set({ text })
    .where(eq(changelogEntries.id, id));
}

export async function deleteEntry(id: string) {
  await db.delete(changelogEntries).where(eq(changelogEntries.id, id));
}

/**
 * Completed reports that haven't been written up yet — the candidates for
 * a new post. Excludes anything already linked from any post, so a bug
 * can't quietly appear in two releases.
 */
export async function unloggedCompletedReports() {
  const linked = db
    .select({ id: changelogEntries.bugReportId })
    .from(changelogEntries)
    .where(sql`${changelogEntries.bugReportId} is not null`);

  const rows = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      completedAt: bugReports.completedAt,
    })
    .from(bugReports)
    .where(
      and(
        isNull(bugReports.deletedAt),
        sql`${bugReports.completedAt} is not null`,
        sql`${bugReports.id} not in ${linked}`
      )
    )
    .orderBy(desc(bugReports.completedAt));

  const notes = await changeNotesFor(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, notes: notes.get(r.id) ?? [] }));
}

/** What the devs said they changed, per report. This is what a new entry
 * is pre-filled from — the release note starts as the words of whoever
 * did the work, then gets edited for players. */
export async function changeNotesFor(reportIds: string[]) {
  const byReport = new Map<string, { author: string; body: string }[]>();
  if (reportIds.length === 0) return byReport;

  const rows = await db
    .select({
      bugReportId: bugChanges.bugReportId,
      body: bugChanges.body,
      robloxUsername: members.robloxUsername,
      discordUsername: members.discordUsername,
    })
    .from(bugChanges)
    .innerJoin(members, eq(bugChanges.memberId, members.id))
    .where(inArray(bugChanges.bugReportId, reportIds))
    .orderBy(asc(bugChanges.createdAt));

  for (const row of rows) {
    const list = byReport.get(row.bugReportId) ?? [];
    list.push({
      author: row.robloxUsername ?? row.discordUsername ?? "Unknown member",
      body: row.body,
    });
    byReport.set(row.bugReportId, list);
  }
  return byReport;
}

/** One person's note about what they changed for a report. Upserted, so
 * the prompt is a question with one editable answer rather than a
 * growing pile. */
export async function saveChangeNote(
  bugReportId: string,
  memberId: string,
  body: string
) {
  await db
    .insert(bugChanges)
    .values({ bugReportId, memberId, body })
    .onConflictDoUpdate({
      target: [bugChanges.bugReportId, bugChanges.memberId],
      set: { body, updatedAt: new Date() },
    });
}

export async function getChangeNote(bugReportId: string, memberId: string) {
  const [row] = await db
    .select({ body: bugChanges.body })
    .from(bugChanges)
    .where(
      and(
        eq(bugChanges.bugReportId, bugReportId),
        eq(bugChanges.memberId, memberId)
      )
    )
    .limit(1);
  return row?.body ?? null;
}

export { formatVersion, nextVersion, parseVersion };
export type { ReleaseKind, Version };
