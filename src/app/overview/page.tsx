import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getStaffOverviewStats } from "@/lib/activity";
import { StaffOverviewTable } from "@/components/StaffOverviewTable";
import {
  Users,
  Clock,
  FlaskConical,
  Bug,
  CalendarOff,
  Activity,
  ArrowRight,
} from "lucide-react";

function formatMinutes(mins: number) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function timeAgo(date: Date) {
  const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default async function StaffOverviewPage() {
  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;
  if (!live?.user) {
    redirect("/sign-in");
  }

  const { totals, leaderboard, rankDistribution, recentFeed } =
    await getStaffOverviewStats();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            QA Staff Overview
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Staff performance metrics, testing activity leaderboard, and recent submissions overview.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/testing"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <FlaskConical className="h-3.5 w-3.5 text-indigo-500" />
            <span>Testing Logs</span>
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Bug className="h-3.5 w-3.5 text-rose-500" />
            <span>Bug Reports</span>
          </Link>
          <Link
            href="/roster"
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Full Roster</span>
          </Link>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
            <span>Staff Members</span>
            <Users className="h-4 w-4 text-zinc-400" />
          </div>
          <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {totals.totalStaff}
          </span>
          <span className="text-[11px] text-zinc-400">
            {totals.totalCurrentlyAway > 0
              ? `${totals.totalCurrentlyAway} away on leave`
              : "All staff available"}
          </span>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
            <span>Testing Time</span>
            <Clock className="h-4 w-4 text-indigo-500" />
          </div>
          <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {formatMinutes(totals.totalTestMinutes)}
          </span>
          <span className="text-[11px] text-zinc-400">Logged across team</span>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
            <span>Test Sessions</span>
            <FlaskConical className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {totals.totalTestSessions}
          </span>
          <span className="text-[11px] text-zinc-400">Completed test passes</span>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
            <span>Bugs Filed</span>
            <Bug className="h-4 w-4 text-rose-500" />
          </div>
          <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {totals.totalBugsFiled}
          </span>
          <span className="text-[11px] text-zinc-400">Total bug reports</span>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
            <span>Away (NOA)</span>
            <CalendarOff className="h-4 w-4 text-red-500" />
          </div>
          <span className="text-2xl font-semibold tracking-tight text-red-600 dark:text-red-400">
            {totals.totalCurrentlyAway}
          </span>
          <span className="text-[11px] text-zinc-400">Notice of absence active</span>
        </div>
      </div>

      {/* Main Content Layout: Table & Side Panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Interactive Staff Leaderboard Table (2 columns) */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Staff Activity Leaderboard
            </h2>
            <span className="text-xs text-zinc-400">
              Ranked by total testing time logged
            </span>
          </div>

          <StaffOverviewTable staff={leaderboard} />
        </div>

        {/* Right Column: Rank Distribution & Recent Activity Feed */}
        <div className="flex flex-col gap-6">
          {/* Rank Distribution */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Activity by Rank
            </h3>
            <div className="flex flex-col gap-3 pt-1">
              {rankDistribution.map((item) => {
                const totalMinutes = totals.totalTestMinutes || 1;
                const percentage = Math.min(
                  100,
                  Math.round((item.totalMinutes / totalMinutes) * 100)
                );

                return (
                  <div key={item.rank} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {item.rank} ({item.memberCount})
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {formatMinutes(item.totalMinutes)} · {item.totalBugs} bugs
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-500"
                        style={{ width: `${Math.max(5, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unified Recent Activity Feed */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Activity className="h-4 w-4 text-indigo-500" />
                <span>Recent Team Activity</span>
              </h3>
              <span className="text-xs text-zinc-400">Live feed</span>
            </div>

            <ul className="flex flex-col divide-y divide-zinc-100 pt-1 text-xs dark:divide-zinc-900">
              {recentFeed.length === 0 ? (
                <li className="py-4 text-center text-zinc-400">No activity yet.</li>
              ) : (
                recentFeed.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5 py-2.5">
                    {item.actorAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.actorAvatarUrl}
                        alt=""
                        className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <Link
                          href={`/members/${item.actorId}`}
                          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                        >
                          {item.actorName}
                        </Link>
                        <span className="text-[10px] text-zinc-400">
                          {timeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-zinc-600 dark:text-zinc-300">
                        {item.title}
                      </p>
                      {item.detail && (
                        <span className="text-[10px] text-zinc-400">
                          {item.detail}
                        </span>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
