import Link from "next/link";
import { db } from "@/db";
import { bugReports, members } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { StatusBadge } from "@/components/StatusBadge";

// This page reads straight from the database (not via fetch()), which
// Next's static-vs-dynamic heuristics don't automatically detect — without
// this, the report list would get frozen at build time instead of
// reflecting live data on every request. Found by actually running a
// production build, not assumed.
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  // Page-level access is already gated by src/proxy.ts before this ever
  // renders; this query itself has no extra auth check because reading
  // the report list needs no elevated tier (any signed-in roster member
  // can see it) — mutations are where the real per-action checks live,
  // in the API routes.
  const rows = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
      reporterUsername: members.robloxUsername,
    })
    .from(bugReports)
    .innerJoin(members, eq(bugReports.reporterId, members.id))
    .where(isNull(bugReports.deletedAt))
    .orderBy(desc(bugReports.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bug Reports
        </h1>
        <Link
          href="/reports/new"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          File a report
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No open reports. Nice.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {rows.map((report) => (
            <li key={report.id}>
              <Link
                href={`/reports/${report.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{report.title}</p>
                  <p className="text-xs text-zinc-500">
                    filed by {report.reporterUsername} ·{" "}
                    {report.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={report.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
