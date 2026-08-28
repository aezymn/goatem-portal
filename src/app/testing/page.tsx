import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberByDiscordId } from "@/lib/members";
import { isFullAdmin } from "@/lib/permissions";
import { listTestLogs } from "@/lib/activity";
import { TestLogForm } from "@/components/TestLogForm";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { PersonLink } from "@/components/PersonLink";

export const dynamic = "force-dynamic";

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

  const logs = await listTestLogs();
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
        <TestLogForm />
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
        <ul className="flex flex-col gap-2">
          {logs.map((l) => (
            <li
              key={l.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{l.area}</span>
                <span className="text-xs text-zinc-400">
                  {new Date(`${l.testedAt}T00:00:00`).toLocaleDateString()}
                </span>
                {l.minutesSpent && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                    {formatMinutes(l.minutesSpent)}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  <PersonLink
                    memberId={l.memberId}
                    robloxUsername={l.robloxUsername}
                    discordUsername={l.discordUsername}
                    avatarUrl={l.discordAvatarUrl}
                    size="xs"
                  />
                  {(canRemoveAny || l.memberId === me?.id) && (
                    <DeleteEntryButton
                      endpoint={`/api/test-logs/${l.id}`}
                      confirmText="Remove this testing log?"
                    />
                  )}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {l.findings}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
