import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { bugCategories, bugReports, members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { hasAction, isFullAdmin } from "@/lib/permissions";
import { getMemberByDiscordId } from "@/lib/members";
import { listCategories, listTags, tagsForReports } from "@/lib/bugTaxonomy";
import { TagChip } from "@/components/TagChip";
import { ReportSettings } from "@/components/ReportSettings";
import { ReportActions } from "@/components/ReportActions";
import { ArchiveButton } from "@/components/ArchiveButton";
import { Suspense } from "react";
import { ReportDetailsLoader } from "@/components/ReportDetailsLoader";

export default async function ReportDetailPage({
  params,
}: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;

  const [report] = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      description: bugReports.description,
      attachments: bugReports.attachments,
      createdAt: bugReports.createdAt,
      completedAt: bugReports.completedAt,
      archivedAt: bugReports.archivedAt,
      reporterId: bugReports.reporterId,
      categoryId: bugReports.categoryId,
      categoryName: bugCategories.name,
      reporterRoblox: members.robloxUsername,
      reporterDiscord: members.discordUsername,
      reporterAvatarUrl: members.discordAvatarUrl,
    })
    .from(bugReports)
    .innerJoin(members, eq(bugReports.reporterId, members.id))
    .leftJoin(bugCategories, eq(bugReports.categoryId, bugCategories.id))
    .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
    .limit(1);

  if (!report) notFound();

  const me = live?.user?.discordId
    ? await getMemberByDiscordId(live.user.discordId)
    : undefined;

  // Header data needed immediately
  const [tagsByReport, allTags, allCategories] = await Promise.all([
    tagsForReports([id]),
    listTags(),
    listCategories(),
  ]);

  const tags = tagsByReport.get(id) ?? [];
  const canTriage = live?.user ? hasAction(live.user, "reports.triage") : false;
  const canDelete = live?.user ? hasAction(live.user, "reports.delete") : false;
  const isAdmin = live?.user ? isFullAdmin(live.user) : false;
  const locked = report.completedAt !== null;

  const reporterName =
    report.reporterRoblox ?? report.reporterDiscord ?? "someone";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link
          href="/reports"
          className="w-fit text-sm text-zinc-500 hover:underline"
        >
          ← Bug Reports
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {report.title}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              filed by {reporterName} ·{" "}
              {report.createdAt.toLocaleDateString()}
              {report.categoryName && ` · ${report.categoryName}`}
            </p>
            {(locked || report.archivedAt) && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {locked && (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    Locked
                  </span>
                )}
                {report.archivedAt && (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    Archived
                  </span>
                )}
              </p>
            )}
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <TagChip key={t.id} tag={t} />
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {canDelete && <ReportActions reportId={report.id} />}
            {canTriage && (
              <ArchiveButton
                reportId={report.id}
                archived={report.archivedAt !== null}
              />
            )}
            {canTriage && (
              <ReportSettings
                reportId={report.id}
                allTags={allTags}
                allCategories={allCategories}
                selectedTagIds={tags.map((t) => t.id)}
                categoryId={report.categoryId}
              />
            )}
          </div>
        </div>
      </div>

      <Suspense fallback={
        <div className="animate-pulse flex flex-col gap-5">
          <div className="h-64 bg-zinc-100 dark:bg-zinc-900 rounded-xl"></div>
          <div className="h-32 bg-zinc-100 dark:bg-zinc-900 rounded-xl"></div>
        </div>
      }>
        <ReportDetailsLoader report={report} me={me} isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
