import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberByDiscordId } from "@/lib/members";
import { isFullAdmin } from "@/lib/permissions";
import {
  listTestLogs,
  listRosterMembersForSelect,
  listActiveBugsForSelect,
} from "@/lib/activity";
import { TestLogForm } from "@/components/TestLogForm";
import { EditTestLogDialog } from "@/components/EditTestLogDialog";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { PersonLink } from "@/components/PersonLink";
import { Bug, Users } from "lucide-react";

export function formatMinutes(mins: number | null) {
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default async function TestingPage() {
  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;
  const me = live?.user?.discordId
    ? await getMemberByDiscordId(live.user.discordId)
    : undefined;
  const canRemoveAny = live?.user ? isFullAdmin(live.user) : false;

  const [logs, rosterMembers, availableBugs] = await Promise.all([
    listTestLogs(),
    listRosterMembersForSelect(),
    listActiveBugsForSelect(),
  ]);

  const totalMinutes = logs.reduce((sum, l) => sum + (l.minutesSpent ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Testing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A record of testing done — bug reports capture what broke, these
          capture the work. {logs.length} log
          {logs.length === 1 ? "" : "s"}
          {totalMinutes > 0 && ` · ${formatMinutes(totalMinutes)} recorded`}
        </p>
      </div>

      {me ? (
        <TestLogForm
          currentMemberId={me.id}
          rosterMembers={rosterMembers}
          availableBugs={availableBugs}
        />
      ) : (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          You need to be on the roster before you can log testing.
        </p>
      )}

      {logs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No testing logged yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {logs.map((l) => {
            const canManage = canRemoveAny || l.memberId === me?.id;

            return (
              <li
                key={l.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950"
              >
                {/* Header Row: Title, Date, Duration, Author, Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-900">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {l.area}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(`${l.testedAt}T00:00:00`).toLocaleDateString(
                        undefined,
                        { dateStyle: "medium" }
                      )}
                    </span>
                    {l.minutesSpent && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {formatMinutes(l.minutesSpent)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Logged by:</span>
                    <PersonLink
                      memberId={l.memberId}
                      robloxUsername={l.robloxUsername}
                      discordUsername={l.discordUsername}
                      avatarUrl={l.discordAvatarUrl}
                      size="xs"
                    />

                    {canManage && (
                      <div className="ml-1 flex items-center gap-1 border-l border-zinc-200 pl-2 dark:border-zinc-800">
                        <EditTestLogDialog
                          log={l}
                          rosterMembers={rosterMembers}
                          availableBugs={availableBugs}
                        />
                        <DeleteEntryButton
                          endpoint={`/api/test-logs/${l.id}`}
                          confirmText="Remove this testing log?"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Attendees Row */}
                {l.attendees.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="flex items-center gap-1 font-medium text-zinc-600 dark:text-zinc-400">
                      <Users className="h-3.5 w-3.5" />
                      <span>Who attended ({l.attendees.length}):</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {l.attendees.map((a) => (
                        <span
                          key={a.memberId}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50/80 py-0.5 pl-1 pr-2 dark:border-zinc-800 dark:bg-zinc-900/60"
                        >
                          <PersonLink
                            memberId={a.memberId}
                            robloxUsername={a.robloxUsername}
                            discordUsername={a.discordUsername}
                            avatarUrl={a.discordAvatarUrl}
                            size="xs"
                          />
                          {a.rank && (
                            <span className="rounded bg-zinc-200 px-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              {a.rank}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* General TL;DR */}
                <div className="rounded-lg bg-zinc-50/60 p-3 text-sm text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {l.findings}
                  </p>
                </div>

                {/* Attached Bugs */}
                {l.bugs.length > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200/70 bg-zinc-50/40 p-3 dark:border-zinc-800/80 dark:bg-zinc-900/20">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Bug className="h-3.5 w-3.5" />
                      <span>Attached Bugs ({l.bugs.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {l.bugs.map((b) => (
                        <div
                          key={b.bugReportId}
                          className="inline-flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs shadow-2xs dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <a
                            href={`/reports/${b.bugReportId}`}
                            className="font-medium text-zinc-900 hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400"
                          >
                            {b.bugTitle}
                          </a>
                          {b.workedOnById && (
                            <span className="flex items-center gap-1 border-l border-zinc-200 pl-2 text-zinc-500 dark:border-zinc-700">
                              <span className="text-[11px]">Worked by:</span>
                              <PersonLink
                                memberId={b.workedOnById}
                                robloxUsername={b.workerRobloxUsername}
                                discordUsername={b.workerDiscordUsername}
                                size="xs"
                              />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
