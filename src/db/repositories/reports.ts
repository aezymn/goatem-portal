import { db } from "@/db";
import { bugCategories, bugReports, members, bugReportTags } from "@/db/schema";
import { and, asc, desc, eq, exists, isNotNull, isNull, sql } from "drizzle-orm";

export async function getBugReportsList(
  tagFilter: string[],
  showArchived: boolean,
  offset: number = 0,
  limit: number = 50
) {
  return await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      createdAt: bugReports.createdAt,
      reporterUsername: members.robloxUsername,
      categoryId: bugReports.categoryId,
      categoryName: bugCategories.name,
      categoryPosition: bugCategories.position,
      replyCount: sql<number>`(
        select count(*)::int from "comments" c
        where c."bug_report_id" = "bug_reports"."id"
          and c."deleted_at" is null
      )`,
      participantCount: sql<number>`(
        select count(*)::int from "bug_participants" bp
        where bp."bug_report_id" = "bug_reports"."id"
      )`,
    })
    .from(bugReports)
    .innerJoin(members, eq(bugReports.reporterId, members.id))
    .leftJoin(bugCategories, eq(bugReports.categoryId, bugCategories.id))
    .where(
      and(
        isNull(bugReports.deletedAt),
        showArchived
          ? isNotNull(bugReports.archivedAt)
          : isNull(bugReports.archivedAt),
        ...tagFilter.map((tagId) =>
          exists(
            db
              .select({ one: sql`1` })
              .from(bugReportTags)
              .where(
                and(
                  eq(bugReportTags.bugReportId, bugReports.id),
                  eq(bugReportTags.tagId, tagId)
                )
              )
          )
        )
      )
    )
    .orderBy(asc(bugCategories.position), desc(bugReports.createdAt))
    .limit(limit)
    .offset(offset);
}
