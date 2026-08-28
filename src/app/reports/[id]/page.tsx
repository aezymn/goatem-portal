import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { bugCategories, bugReports, members } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { hasAction } from "@/lib/permissions";
import { getMemberByDiscordId } from "@/lib/members";
import { listCategories, listTags, tagsForReports } from "@/lib/bugTaxonomy";
import { getReportParticipants, getReportTimeline } from "@/lib/reports";
import { currentAbsencesByMemberId } from "@/lib/activity";
import { listRanksWithActions } from "@/lib/ranks";
import { nowMs } from "@/lib/presence";
import { TagChip } from "@/components/TagChip";
import { ReportTriage } from "@/components/ReportTriage";
import { ReportTimeline } from "@/components/ReportTimeline";
import { ParticipantsPanel } from "@/components/ParticipantsPanel";
import { ReportActions } from "@/components/ReportActions";

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
      createdAt: bugReports.createdAt,
      reporterId: bugReports.reporterId,
      categoryId: bugReports.categoryId,
      categoryName: bugCategories.name,
      reporterUsername: members.robloxUsername,
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

  const [timeline, participants, tagsByReport, allTags, allCategories, ranks, away] =
    await Promise.all([
      getReportTimeline(id),
      getReportParticipants(id, report.reporterId),
      tagsForReports([id]),
      listTags(),
      listCategories(),
      listRanksWithActions(),
      currentAbsencesByMemberId(),
    ]);

  const tags = tagsByReport.get(id) ?? [];
  const canTriage = live?.user ? hasAction(live.user, "reports.triage") : false;
  const canDelete = live?.user ? hasAction(live.user, "reports.delete") : false;

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
              filed by {report.reporterUsername ?? "someone"} ·{" "}
              {report.createdAt.toLocaleDateString()}
              {report.categoryName && ` · ${report.categoryName}`}
            </p>
          </div>
          {canDelete && <ReportActions reportId={report.id} />}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
          </div>
        )}
      </div>

      {canTriage && (
        <ReportTriage
          reportId={report.id}
          allTags={allTags}
          allCategories={allCategories}
          selectedTagIds={tags.map((t) => t.id)}
          categoryId={report.categoryId}
        />
      )}

      {/* The conversation takes the width it needs; the member list sits
          beside it on desktop and drops below on narrow screens rather
          than squeezing the thread. */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <ReportTimeline
            reportId={report.id}
            entries={timeline}
            meMemberId={me?.id ?? null}
            canReply={Boolean(me)}
          />
        </div>

        <ParticipantsPanel
          reportId={report.id}
          participants={participants}
          rankOrder={ranks.map((r) => r.name)}
          awayMemberIds={[...away.keys()]}
          meMemberId={me?.id ?? null}
          serverNow={nowMs()}
        />
      </div>
    </div>
  );
}
