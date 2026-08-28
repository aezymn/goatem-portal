import { ChangeNotePrompt } from "@/components/ChangeNotePrompt";
import { ReportThread } from "@/components/ReportThread";
import { ParticipantsPanel } from "@/components/ParticipantsPanel";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, asc, isNull } from "drizzle-orm";
import {
  getReportParticipants,
  getReportTimeline,
  getReportVersion,
  listStages,
} from "@/lib/reports";
import { changeNotesFor, getChangeNote } from "@/lib/changelog";
import { currentAbsencesByMemberId } from "@/lib/activity";
import { getCachedRanks } from "@/lib/ranks";
import { nowMs } from "@/lib/presence";
import { displayNameFor } from "@/lib/members";

export async function ReportDetailsLoader({
  report,
  me,
  isAdmin,
}: {
  report: any;
  me: any;
  isAdmin: boolean;
}) {
  const [
    timeline,
    stages,
    participants,
    ranks,
    away,
    roster,
    version,
  ] = await Promise.all([
    getReportTimeline(report.id),
    listStages(report.id),
    getReportParticipants(report.id, report.reporterId),
    getCachedRanks(),
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
    getReportVersion(report.id),
  ]);

  const locked = report.completedAt !== null;
  const onIt = participants.some((p) => p.memberId === me?.id);
  const shouldAskForChanges =
    locked && Boolean(me) && (onIt || report.reporterId === me?.id);

  const [myNote, allNotes] = shouldAskForChanges
    ? await Promise.all([
        getChangeNote(report.id, me!.id),
        changeNotesFor([report.id]),
      ])
    : [null, new Map<string, { author: string; body: string }[]>()];

  const canAddStage = Boolean(
    me && (isAdmin || onIt || report.reporterId === me.id)
  );

  const reporterName =
    report.reporterRoblox ?? report.reporterDiscord ?? "someone";

  return (
    <>
      {shouldAskForChanges && (
        <ChangeNotePrompt
          reportId={report.id}
          existing={myNote}
          otherNotes={(allNotes.get(report.id) ?? []).filter(
            (n) => n.body !== myNote
          )}
        />
      )}

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
    </>
  );
}
