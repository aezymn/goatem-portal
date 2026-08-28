import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberByDiscordId } from "@/lib/members";
import { isFullAdmin } from "@/lib/permissions";
import { listAbsences, listPastAbsences, todayIso } from "@/lib/activity";
import { AbsenceForm } from "@/components/AbsenceForm";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { PersonLink } from "@/components/PersonLink";


function formatRange(leave: string, back: string) {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  return `${fmt(leave)} → back ${fmt(back)}`;
}

export default async function AbsencePage() {
  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;
  const me = live?.user?.discordId
    ? await getMemberByDiscordId(live.user.discordId)
    : undefined;
  const canRemoveAny = live?.user ? isFullAdmin(live.user) : false;

  const [upcoming, past] = await Promise.all([
    listAbsences(),
    listPastAbsences(),
  ]);
  const today = todayIso();
  const away = upcoming.filter((a) => a.leaveDate <= today);
  const scheduled = upcoming.filter((a) => a.leaveDate > today);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Absence</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A notice, not a request — nobody has to approve it. Say when you
          go and the first day you&apos;re available again.
        </p>
      </div>

      {me ? (
        <AbsenceForm />
      ) : (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          You need to be on the roster before you can post an absence.
        </p>
      )}

      <Group
        title="Away now"
        empty="Nobody is away right now."
        rows={away}
        me={me?.id}
        canRemoveAny={canRemoveAny}
        tone="amber"
      />
      <Group
        title="Scheduled"
        empty="No upcoming absences."
        rows={scheduled}
        me={me?.id}
        canRemoveAny={canRemoveAny}
      />
      {past.length > 0 && (
        <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
            Past absences ({past.length})
          </summary>
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-900 dark:border-zinc-900">
            {past.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2">
                <PersonLink
                  memberId={a.memberId}
                  robloxUsername={a.robloxUsername}
                  discordUsername={a.discordUsername}
                  avatarUrl={a.discordAvatarUrl}
                />
                <span className="text-xs text-zinc-500">
                  {formatRange(a.leaveDate, a.returnDate)}
                </span>
                {a.reason && (
                  <span className="truncate text-xs text-zinc-400">
                    {a.reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Group({
  title,
  empty,
  rows,
  me,
  canRemoveAny,
  tone,
}: {
  title: string;
  empty: string;
  rows: Awaited<ReturnType<typeof listAbsences>>;
  me?: string;
  canRemoveAny: boolean;
  tone?: "amber";
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <h2 className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 text-sm font-semibold uppercase tracking-wider dark:border-zinc-900 dark:bg-zinc-900/50">
        {title}
        <span className="ml-2 text-xs font-normal normal-case text-zinc-400">
          {rows.length}
        </span>
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <PersonLink
                memberId={a.memberId}
                robloxUsername={a.robloxUsername}
                discordUsername={a.discordUsername}
                avatarUrl={a.discordAvatarUrl}
              />
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  tone === "amber"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                }`}
              >
                {formatRange(a.leaveDate, a.returnDate)}
              </span>
              {a.reason && (
                <span className="min-w-0 truncate text-sm text-zinc-500">
                  {a.reason}
                </span>
              )}
              {(canRemoveAny || a.memberId === me) && (
                <span className="ml-auto">
                  <DeleteEntryButton
                    endpoint={`/api/absences/${a.id}`}
                    confirmText="Withdraw this absence notice?"
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
