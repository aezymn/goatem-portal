import { db } from "@/db";
import { bugCategories, bugReportTags, bugReports, bugTags } from "@/db/schema";
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

export async function listTags() {
  return db
    .select({
      id: bugTags.id,
      name: bugTags.name,
      tone: bugTags.tone,
      position: bugTags.position,
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
    .orderBy(asc(bugTags.position), asc(bugTags.name));
}

/** New entries land at the bottom of the list rather than jumping to the
 * top, which is where someone adding "Update v1.02" expects it. */
async function nextPosition(table: typeof bugCategories | typeof bugTags) {
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

export async function createTag(name: string, tone: TagTone) {
  const [row] = await db
    .insert(bugTags)
    .values({ name, tone, position: await nextPosition(bugTags) })
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
  changes: { name?: string; tone?: TagTone }
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
  kind: "category" | "tag",
  orderedIds: string[]
): Promise<void> {
  const table = kind === "category" ? bugCategories : bugTags;
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

/** Replaces a report's tags wholesale. Unknown tag ids are dropped rather
 * than erroring, so a stale picker can't wedge the request. */
export async function setReportTags(reportId: string, tagIds: string[]) {
  const known =
    tagIds.length > 0
      ? await db
          .select({ id: bugTags.id })
          .from(bugTags)
          .where(inArray(bugTags.id, tagIds))
      : [];

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
