import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { bugCategories, bugReports, members } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { hasAction, isFullAdmin } from "@/lib/permissions";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { listCategories, listTags, tagsForReports } from "@/lib/bugTaxonomy";
import {
  getReportParticipants,
  getReportTimeline,
  getReportVersion,
  listStages,
} from "@/lib/reports";
import { currentAbsencesByMemberId } from "@/lib/activity";
import { listRanksWithActions } from "@/lib/ranks";
import { nowMs } from "@/lib/presence";
import { TagChip } from "@/components/TagChip";
import { ReportSettings } from "@/components/ReportSettings";
import { ReportThread } from "@/components/ReportThread";
import { ParticipantsPanel } from "@/components/ParticipantsPanel";
import { ReportActions } from "@/components/ReportActions";
import { ArchiveButton } from "@/components/ArchiveButton";

export const dynamic = "force-dynamic";

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

  const [
    timeline,
    stages,
    participants,
    tagsByReport,
    allTags,
    allCategories,
    ranks,
    away,
    roster,
    version,
  ] = await Promise.all([
    getReportTimeline(id),
    listStages(id),
    getReportParticipants(id, report.reporterId),
    tagsForReports([id]),
    listTags(),
    listCategories(),
    listRanksWithActions(),
    currentAbsencesByMemberId(),
    db
      .select({
        id: members.id,
        robloxUsername: members.robloxUsername,
        discordUsername: members.discordUsername,
        discordId: members.discordId,
      })
      .from(members)
      .where(and(isNull(members.deletedAt), isNull(members.parentMemberId)))
      .orderBy(asc(members.robloxUsername)),
    getReportVersion(id),
  ]);

  const tags = tagsByReport.get(id) ?? [];
  const canTriage = live?.user ? hasAction(live.user, "reports.triage") : false;
  const canDelete = live?.user ? hasAction(live.user, "reports.delete") : false;
  const isAdmin = live?.user ? isFullAdmin(live.user) : false;
  const locked = report.completedAt !== null;

  // A stage is a claim about where the work has got to, so it comes from
  // someone doing the work: whoever joined, whoever filed it, or an admin.
  const onIt = participants.some((p) => p.memberId === me?.id);
  const canAddStage = Boolean(
    me && (isAdmin || onIt || report.reporterId === me.id)
  );

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

          {/* Delete on top, Settings tucked underneath it — the pair of
              things you do TO a report, out of the way of the report. */}
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

      {/* The thread takes the width it needs; the member list sits beside
          it on desktop and drops below on narrow screens. */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <ReportThread
            reportId={report.id}
            body={{
              description: report.description,
              attachments: report.attachments ?? [],
              createdAt: report.createdAt.toISOString(),
              authorId: report.reporterId,
              authorName: reporterName,
              authorAvatarUrl: report.reporterAvatarUrl,
            }}
            stages={stages}
            entries={timeline}
            meMemberId={me?.id ?? null}
            canReply={Boolean(me)}
            canAddStage={canAddStage}
            canRemoveStage={isAdmin}
            locked={locked}
            version={version}
          />
        </div>

        <ParticipantsPanel
          reportId={report.id}
          participants={participants}
          rankOrder={ranks.map((r) => r.name)}
          awayMemberIds={[...away.keys()]}
          meMemberId={me?.id ?? null}
          serverNow={nowMs()}
          canManage={isAdmin && !locked}
          roster={roster.map((m) => ({
            id: m.id,
            name: displayNameFor(m),
          }))}
        />
      </div>
    </div>
  );
}
