"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, AlertCircle, CheckCircle2, CalendarOff } from "lucide-react";
import type { StaffLeaderboardItem } from "@/lib/activity";

function formatMinutes(mins: number) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function shortDate(date: Date | null) {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function StaffOverviewTable({ staff }: { staff: StaffLeaderboardItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "away">("all");
  const [sortBy, setSortBy] = useState<"minutes" | "sessions" | "bugs">("minutes");

  const filtered = staff
    .filter((m) => {
      const q = query.trim().toLowerCase();
      const roblox = (m.robloxUsername ?? "").toLowerCase();
      const discord = (m.discordUsername ?? "").toLowerCase();
      const rank = (m.rank ?? "").toLowerCase();
      const matchesQuery = !q || roblox.includes(q) || discord.includes(q) || rank.includes(q);

      if (!matchesQuery) return false;

      if (filter === "inactive") return m.isInactiveWarning;
      if (filter === "away") return m.isAway;
      if (filter === "active") return !m.isInactiveWarning && !m.isAway;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "minutes") return b.testMinutesLogged - a.testMinutesLogged;
      if (sortBy === "sessions") return b.testSessionCount - a.testSessionCount;
      if (sortBy === "bugs") return b.bugsFiledCount - a.bugsFiledCount;
      return 0;
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or rank…"
            className="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-sm text-zinc-900 shadow-2xs outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              filter === "all"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            All Staff ({staff.length})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              filter === "active"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Active ({staff.filter((s) => !s.isInactiveWarning && !s.isAway).length})
          </button>
          <button
            onClick={() => setFilter("inactive")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              filter === "inactive"
                ? "bg-amber-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Inactive Warning ({staff.filter((s) => s.isInactiveWarning).length})
          </button>
          <button
            onClick={() => setFilter("away")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              filter === "away"
                ? "bg-red-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            On Absence ({staff.filter((s) => s.isAway).length})
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Rank</th>
              <th
                className="cursor-pointer px-4 py-3 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setSortBy("minutes")}
              >
                <div className="flex items-center gap-1">
                  <span>Testing Time</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setSortBy("sessions")}
              >
                <div className="flex items-center gap-1">
                  <span>Sessions</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setSortBy("bugs")}
              >
                <div className="flex items-center gap-1">
                  <span>Bugs Filed</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-4 py-3">Status & Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-zinc-500">
                  No staff members matched this filter.
                </td>
              </tr>
            ) : (
              filtered.map((m, index) => {
                const name = m.robloxUsername ?? m.discordUsername ?? "Unknown Member";

                return (
                  <tr
                    key={m.id}
                    className="transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {index + 1}
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/members/${m.id}`}
                        className="group flex items-center gap-2.5"
                      >
                        {m.discordAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.discordAvatarUrl}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
                          />
                        ) : (
                          <div className="h-7 w-7 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                            {name}
                          </span>
                          {m.discordUsername && m.robloxUsername && (
                            <span className="block text-xs text-zinc-400">
                              @{m.discordUsername}
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {m.rank}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {formatMinutes(m.testMinutesLogged)}
                    </td>

                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {m.testSessionCount} session{m.testSessionCount === 1 ? "" : "s"}
                    </td>

                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {m.bugsFiledCount} bug{m.bugsFiledCount === 1 ? "" : "s"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {m.isAway ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/80 dark:text-red-300">
                            <CalendarOff className="h-3 w-3" />
                            <span>Away</span>
                            {m.awayUntil && <span>(back {m.awayUntil})</span>}
                          </span>
                        ) : m.isInactiveWarning ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
                            <AlertCircle className="h-3 w-3" />
                            <span>
                              {m.inactiveDays !== null
                                ? `Inactive (${m.inactiveDays}d)`
                                : "No login"}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <span>Active · {shortDate(m.lastActiveAt ?? m.lastSeenAt)}</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
