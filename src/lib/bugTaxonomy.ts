import { db } from "@/db";
import {
  bugCategories,
  bugReportTags,
  bugReports,
  bugTagGroups,
  bugTags,
} from "@/db/schema";
import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { TagTone } from "@/lib/tagTones";

/**
 * Categories (which release a bug belongs to) and tags (its state and
 * priority) — the two lists admins curate and everyone else picks from.
 */

export {
  TAG_TONES,
  TAG_TONE_CLASSES,
  asTagTone,
  type TagTone,
} from "@/lib/tagTones";

export async function listCategories() {
  return db
    .select({
      id: bugCategories.id,
      name: bugCategories.name,
      position: bugCategories.position,
      // Written with an explicit alias and fully-qualified names rather
      // than drizzle's column interpolation: inside a sql`` template
      // drizzle emits BARE column names when the outer query has no
      // joins, so `${bugReports.categoryId} = ${bugCategories.id}`
      // rendered as `"category_id" = "id"` and quietly resolved "id" to
      // bug_reports' own id — a correlation that is always false. Caught
      // by every category reporting 0 on a page where they plainly
      // weren't.
      reportCount: sql<number>`(
        select count(*)::int from "bug_reports" br
        where br."category_id" = "bug_categories"."id"
          and br."deleted_at" is null
      )`,
    })
    .from(bugCategories)
    .orderBy(asc(bugCategories.position), asc(bugCategories.name));
}

export async function listTagGroups() {
  return db
    .select({
      id: bugTagGroups.id,
      name: bugTagGroups.name,
      exclusive: bugTagGroups.exclusive,
      position: bugTagGroups.position,
    })
    .from(bugTagGroups)
    .orderBy(asc(bugTagGroups.position), asc(bugTagGroups.name));
}

export async function createTagGroup(name: string, exclusive: boolean) {
  const [row] = await db
    .insert(bugTagGroups)
    .values({ name, exclusive, position: await nextPosition(bugTagGroups) })
    .returning();
  return row;
}

export async function updateTagGroup(
  id: string,
  changes: { name?: string; exclusive?: boolean }
) {
  await db
    .update(bugTagGroups)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(bugTagGroups.id, id));
}

/** Deleting a group ungroups its tags (ON DELETE SET NULL) rather than
 * deleting labels reports are still wearing. */
export async function deleteTagGroup(id: string) {
  await db.delete(bugTagGroups).where(eq(bugTagGroups.id, id));
}

export async function listTags() {
  return db
    .select({
      id: bugTags.id,
      name: bugTags.name,
      tone: bugTags.tone,
      position: bugTags.position,
      groupId: bugTags.groupId,
      groupName: bugTagGroups.name,
      groupExclusive: bugTagGroups.exclusive,
      // Same explicit form as listCategories above. This one happened to
      // work — bug_report_tags has no "id" column of its own, so the bare
      // name resolved outward by luck — which is exactly the kind of
      // accident worth removing rather than relying on.
      reportCount: sql<number>`(
        select count(*)::int from "bug_report_tags" brt
        where brt."tag_id" = "bug_tags"."id"
      )`,
    })
    .from(bugTags)
    .leftJoin(bugTagGroups, eq(bugTags.groupId, bugTagGroups.id))
    .orderBy(
      asc(bugTagGroups.position),
      asc(bugTags.position),
      asc(bugTags.name)
    );
}

/** New entries land at the bottom of the list rather than jumping to the
 * top, which is where someone adding "Update v1.02" expects it. */
async function nextPosition(
  table: typeof bugCategories | typeof bugTags | typeof bugTagGroups
) {
  const [row] = await db
    .select({ max: sql<number | null>`max(${table.position})` })
    .from(table);
  return (row?.max ?? -1) + 1;
}

export async function createCategory(name: string) {
  const [row] = await db
    .insert(bugCategories)
    .values({ name, position: await nextPosition(bugCategories) })
    .returning();
  return row;
}

export async function createTag(
  name: string,
  tone: TagTone,
  groupId: string | null
) {
  const [row] = await db
    .insert(bugTags)
    .values({ name, tone, groupId, position: await nextPosition(bugTags) })
    .returning();
  return row;
}

export async function renameCategory(id: string, name: string) {
  await db
    .update(bugCategories)
    .set({ name, updatedAt: new Date() })
    .where(eq(bugCategories.id, id));
}

export async function updateTag(
  id: string,
  changes: { name?: string; tone?: TagTone; groupId?: string | null }
) {
  await db
    .update(bugTags)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(bugTags.id, id));
}

/** Deleting a category leaves its reports alone — the FK is ON DELETE SET
 * NULL, so they simply become uncategorised rather than disappearing. */
export async function deleteCategory(id: string) {
  await db.delete(bugCategories).where(eq(bugCategories.id, id));
}

/** Deleting a tag cascades to its assignments only. */
export async function deleteTag(id: string) {
  await db.delete(bugTags).where(eq(bugTags.id, id));
}

export async function reorder(
  kind: "categories" | "tags" | "groups",
  orderedIds: string[]
): Promise<void> {
  const table =
    kind === "categories"
      ? bugCategories
      : kind === "tags"
        ? bugTags
        : bugTagGroups;
  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(table)
        .set({ position: index, updatedAt: new Date() })
        .where(eq(table.id, id));
    }
  });
}

/** Every tag on a set of reports, for list pages that would otherwise do
 * one query per row. */
export async function tagsForReports(reportIds: string[]) {
  const byReport = new Map<
    string,
    { id: string; name: string; tone: string }[]
  >();
  if (reportIds.length === 0) return byReport;

  const rows = await db
    .select({
      bugReportId: bugReportTags.bugReportId,
      id: bugTags.id,
      name: bugTags.name,
      tone: bugTags.tone,
      position: bugTags.position,
    })
    .from(bugReportTags)
    .innerJoin(bugTags, eq(bugReportTags.tagId, bugTags.id))
    .where(inArray(bugReportTags.bugReportId, reportIds))
    .orderBy(asc(bugTags.position));

  for (const row of rows) {
    const list = byReport.get(row.bugReportId) ?? [];
    list.push({ id: row.id, name: row.name, tone: row.tone });
    byReport.set(row.bugReportId, list);
  }
  return byReport;
}

/**
 * Replaces a report's tags wholesale.
 *
 * Exclusivity is enforced HERE, not just in the picker: a group marked
 * exclusive keeps at most one tag, and where a request names several from
 * the same group the LAST one wins — which is what "click the one you
 * want" means when the client sends the whole set. Doing it server-side
 * means a report can't end up both In progress and Complete through a
 * direct API call or a stale tab.
 *
 * Unknown tag ids are dropped rather than erroring, so a stale picker
 * can't wedge the request.
 */
export async function setReportTags(reportId: string, tagIds: string[]) {
  const rows =
    tagIds.length > 0
      ? await db
          .select({
            id: bugTags.id,
            groupId: bugTags.groupId,
            exclusive: bugTagGroups.exclusive,
          })
          .from(bugTags)
          .leftJoin(bugTagGroups, eq(bugTags.groupId, bugTagGroups.id))
          .where(inArray(bugTags.id, tagIds))
      : [];

  // Walk the caller's order so "last wins" is the caller's last, not the
  // database's — the row order above is arbitrary.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const chosen = new Map<string, string>(); // exclusive group -> tag id
  const free: string[] = [];
  for (const id of tagIds) {
    const row = byId.get(id);
    if (!row) continue;
    if (row.exclusive && row.groupId) chosen.set(row.groupId, row.id);
    else if (!free.includes(row.id)) free.push(row.id);
  }
  const known = [...free, ...chosen.values()].map((id) => ({ id }));

  await db.transaction(async (tx) => {
    await tx
      .delete(bugReportTags)
      .where(eq(bugReportTags.bugReportId, reportId));
    if (known.length > 0) {
      await tx
        .insert(bugReportTags)
        .values(known.map((t) => ({ bugReportId: reportId, tagId: t.id })));
    }
  });
  return known.map((t) => t.id);
}

export async function categoryExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: bugCategories.id })
    .from(bugCategories)
    .where(eq(bugCategories.id, id))
    .limit(1);
  return Boolean(row);
}

/** Categories that currently have at least one live report, for grouping
 * the list page. */
export async function categoriesInUse() {
  return db
    .select({ id: bugCategories.id, name: bugCategories.name })
    .from(bugCategories)
    .innerJoin(bugReports, eq(bugReports.categoryId, bugCategories.id))
    .where(isNull(bugReports.deletedAt))
    .groupBy(bugCategories.id, bugCategories.name, bugCategories.position)
    .orderBy(asc(bugCategories.position));
}
