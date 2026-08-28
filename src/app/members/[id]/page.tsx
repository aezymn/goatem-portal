import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getMemberActivity,
  getMemberById,
  getMemberTotals,
  todayIso,
} from "@/lib/activity";
import { isCreatorDiscordId } from "@/lib/permissions";
import { asRegion } from "@/lib/regions";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

function shortDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00`) : d;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatMinutes(mins: number) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export default async function MemberProfilePage({
  params,
}: PageProps<"/members/[id]">) {
  const { id } = await params;
  const member = await getMemberById(id);
  if (!member) notFound();

  const [activity, totals] = await Promise.all([
    getMemberActivity(id),
    getMemberTotals(id),
  ]);

  const name =
    member.robloxUsername ?? member.discordUsername ?? "Unknown member";
  const today = todayIso();
  const currentAbsence = activity.absences.find(
    (a) => a.leaveDate <= today && a.returnDate > today
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        {member.discordAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- cached Discord CDN avatar
          <img
            src={member.discordAvatarUrl}
            alt=""
            className="h-16 w-16 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        )}
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {name}
            {isCreatorDiscordId(member.discordId ?? undefined) && (
              <Badge tone="emerald">Creator</Badge>
            )}
            {member.isPortalAdmin && <Badge tone="indigo">Admin</Badge>}
            {member.parentMemberId && <Badge tone="zinc">Alt</Badge>}
            {currentAbsence && <Badge tone="amber">NOA</Badge>}
            {asRegion(member.region) && (
              <Badge tone="outline">{asRegion(member.region)}</Badge>
            )}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {member.rank}
            {member.discordUsername && ` · ${member.discordUsername}`}
            {currentAbsence &&
              ` · back ${shortDate(currentAbsence.returnDate)}`}
          </p>
        </div>
        <Link
          href="/roster"
          className="ml-auto text-sm text-zinc-500 hover:underline"
        >
          ← Roster
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Testing logs" value={String(totals.testLogs)} />
        <Stat label="Time logged" value={formatMinutes(totals.minutesLogged)} />
        <Stat label="Bugs filed" value={String(totals.bugsFiled)} />
        <Stat
          label="Absences"
          value={String(activity.absences.length)}
        />
      </div>

      <Panel title="Recent testing">
        {activity.logs.length === 0 ? (
          <Empty>No testing logged.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {activity.logs.map((l) => (
              <li key={l.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{l.area}</span>
                  <span className="text-xs text-zinc-400">
                    {shortDate(l.testedAt)}
                  </span>
                  {l.minutesSpent && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                      {formatMinutes(l.minutesSpent)}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {l.findings}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Bugs filed">
        {activity.bugs.length === 0 ? (
          <Empty>No bug reports filed.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {activity.bugs.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                <StatusBadge status={b.status} />
                <Link
                  href={`/reports/${b.id}`}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {b.title}
                </Link>
                <span className="shrink-0 text-xs text-zinc-400">
                  {shortDate(b.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Absences">
        {activity.absences.length === 0 ? (
          <Empty>No absences recorded.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {activity.absences.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="text-sm">
                  {shortDate(a.leaveDate)} → back {shortDate(a.returnDate)}
                </span>
                {a.reason && (
                  <span className="min-w-0 truncate text-sm text-zinc-500">
                    {a.reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <h2 className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 text-sm font-semibold uppercase tracking-wider dark:border-zinc-900 dark:bg-zinc-900/50">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-6 text-center text-sm text-zinc-500">{children}</p>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "emerald" | "indigo" | "zinc" | "amber" | "outline";
  children: React.ReactNode;
}) {
  const tones = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    zinc: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    outline: "text-zinc-500 ring-1 ring-zinc-300 dark:text-zinc-400 dark:ring-zinc-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}
