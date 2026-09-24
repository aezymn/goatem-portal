import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { bugReports, members } from "@/db/schema";
import { and, count, isNull } from "drizzle-orm";
import { getMemberByDiscordId } from "@/lib/members";
import { currentAbsencesByMemberId, getMemberTotals } from "@/lib/activity";
import { isCreatorDiscordId } from "@/lib/permissions";
import {
  Bug,
  Users,
  BarChart3,
  FlaskConical,
  CalendarOff,
  ScrollText,
  Clock,
  ShieldAlert,
  Settings,
  History,
  FileClock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

function formatMinutes(mins: number) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export default async function Home() {
  const session = await getServerSession(authOptions);
  const authed = session && !session.stale;

  if (!authed) {
    return (
      <div className="flex flex-col items-start gap-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Quality Assurance Portal
        </h1>
        <p className="max-w-lg text-zinc-600 dark:text-zinc-400">
          Sign in with your Discord account to view the roster, file and track
          bugs, log testing sessions, and check published change logs. Access is
          verified against your current server membership and QA roles.
        </p>
        <Link
          href="/sign-in"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-500"
        >
          Sign in with Discord
        </Link>
      </div>
    );
  }

  const member = session.user.discordId
    ? await getMemberByDiscordId(session.user.discordId)
    : null;

  const [memberTotals, awayMap, [openBugsCount], [staffCount]] =
    await Promise.all([
      member
        ? getMemberTotals(member.id)
        : Promise.resolve({ testLogs: 0, bugsFiled: 0, minutesLogged: 0 }),
      currentAbsencesByMemberId(),
      db
        .select({ n: count() })
        .from(bugReports)
        .where(
          and(isNull(bugReports.deletedAt), isNull(bugReports.completedAt))
        ),
      db
        .select({ n: count() })
        .from(members)
        .where(and(isNull(members.deletedAt), isNull(members.parentMemberId))),
    ]);

  const displayName =
    member?.robloxUsername ?? session.user.name ?? "Signed In User";
  const isAway = member ? awayMap.has(member.id) : false;
  const awayUntil = member ? awayMap.get(member.id) : null;
  const isCreator = isCreatorDiscordId(session.user.discordId ?? undefined);
  const isAdmin = isCreator || member?.isPortalAdmin;
  const actions = session.user.actions ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* Profile & Welcome Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-4">
          {member?.discordAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.discordAvatarUrl}
              alt=""
              className="h-16 w-16 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-800"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-xl font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Welcome back, {displayName}
              </h1>
              {isCreator && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                  Creator
                </span>
              )}
              {isAdmin && !isCreator && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  Admin
                </span>
              )}
              {isAway && (
                <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/80 dark:text-red-300">
                  NOA · back {awayUntil}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              {member?.rank && (
                <span className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {member.rank}
                </span>
              )}
              {member?.discordUsername && (
                <span>@{member.discordUsername}</span>
              )}
              {member && (
                <>
                  <span>·</span>
                  <Link
                    href={`/members/${member.id}`}
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    View profile & activity →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Pill Header */}
        {member && (
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3 sm:border-t-0 sm:pt-0 dark:border-zinc-900">
            <div className="flex flex-col rounded-lg bg-zinc-50 px-3.5 py-2 dark:bg-zinc-900/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                My Testing Time
              </span>
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {formatMinutes(memberTotals.minutesLogged)}
              </span>
            </div>
            <div className="flex flex-col rounded-lg bg-zinc-50 px-3.5 py-2 dark:bg-zinc-900/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                My Test Sessions
              </span>
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {memberTotals.testLogs}
              </span>
            </div>
            <div className="flex flex-col rounded-lg bg-zinc-50 px-3.5 py-2 dark:bg-zinc-900/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                My Bugs Filed
              </span>
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {memberTotals.bugsFiled}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Navigation Grid */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Quick Navigation
          </h2>
          <span className="text-xs text-zinc-400">
            {Number(staffCount?.n ?? 0)} Staff on Roster ·{" "}
            {Number(openBugsCount?.n ?? 0)} Active Bugs
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Bug Reports */}
          <Link
            href="/reports"
            className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs transition hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-rose-50 p-2.5 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  <Bug className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {Number(openBugsCount?.n ?? 0)} Open
                </span>
              </div>
              <h3 className="mt-4 font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                Bug Reports
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                File a new bug report, view active reproduction stages, or leave comments and test evidence.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              <span>View reports</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Roster */}
          <Link
            href="/roster"
            className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs transition hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {Number(staffCount?.n ?? 0)} Members
                </span>
              </div>
              <h3 className="mt-4 font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                Staff Roster
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Browse all staff members grouped by rank, view linked Roblox and Discord profiles, and live presence.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              <span>View roster</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Staff Overview */}
          <Link
            href="/overview"
            className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs transition hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Leaderboard
                </span>
              </div>
              <h3 className="mt-4 font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                Staff Overview
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Inspect staff activity leaderboard, total testing hours, bug submission counts, and inactivity alerts.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              <span>View analytics</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Report Testing */}
          <Link
            href="/testing"
            className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs transition hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <FlaskConical className="h-5 w-5" />
                </div>
              </div>
              <h3 className="mt-4 font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                Report Testing
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Log completed testing sessions, record attendees, note findings, and link verified bug reports.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              <span>Log testing</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Report Absence */}
          <Link
            href="/absence"
            className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs transition hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-red-50 p-2.5 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                  <CalendarOff className="h-5 w-5" />
                </div>
                {awayMap.size > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                    {awayMap.size} Away
                  </span>
                )}
              </div>
              <h3 className="mt-4 font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                Report Absence
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Submit an upcoming leave notice with your return date, or check who is currently away.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              <span>Manage absence</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Change Log */}
          <Link
            href="/changelog"
            className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs transition hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <ScrollText className="h-5 w-5" />
                </div>
              </div>
              <h3 className="mt-4 font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                Change Log
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                View released updates, game revisions, and patch notes generated from verified bug fixes.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              <span>Read updates</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>

      {/* Admin / Leadership Quick Controls */}
      {(isAdmin || actions.length > 0) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Administration & Management Controls
            </h2>
            <span className="text-xs text-zinc-400">QA Leadership</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isAdmin && (
              <Link
                href="/admin/ranks"
                className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
              >
                <ShieldAlert className="h-4 w-4 text-zinc-500" />
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Ranks & Permissions
                  </span>
                  <span className="block truncate text-[11px] text-zinc-400">
                    Authority ladder & roles
                  </span>
                </div>
              </Link>
            )}

            {(isAdmin || actions.includes("bugsetup.manage")) && (
              <Link
                href="/admin/bug-setup"
                className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
              >
                <Settings className="h-4 w-4 text-zinc-500" />
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Bug Setup
                  </span>
                  <span className="block truncate text-[11px] text-zinc-400">
                    Categories & tags
                  </span>
                </div>
              </Link>
            )}

            {(isAdmin || actions.includes("changelog.write")) && (
              <Link
                href="/changelog/manage"
                className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
              >
                <History className="h-4 w-4 text-zinc-500" />
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Manage Change Log
                  </span>
                  <span className="block truncate text-[11px] text-zinc-400">
                    Draft & approve release notes
                  </span>
                </div>
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin/audit-log"
                className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
              >
                <FileClock className="h-4 w-4 text-zinc-500" />
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Audit Log
                  </span>
                  <span className="block truncate text-[11px] text-zinc-400">
                    Audit trail of portal actions
                  </span>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
