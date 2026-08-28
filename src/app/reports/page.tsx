import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberByDiscordId } from "@/lib/members";
import { joinedReportIds } from "@/lib/reports";
import { getBugReportsList } from "@/db/repositories/reports";
import { listTags, tagsForReports } from "@/lib/bugTaxonomy";
import { TagChip } from "@/components/TagChip";
import { ReportFilters } from "@/components/ReportFilters";

// This page reads straight from the database (not via fetch()), which
// Next's static-vs-dynamic heuristics don't automatically detect — without
// this, the report list would get frozen at build time instead of
// reflecting live data on every request. Found by actually running a
// production build, not assumed.

export default async function ReportsPage({
  searchParams,
}: PageProps<"/reports">) {
  const params = await searchParams;
  const raw = params.tag;
  const page = parseInt(params.page as string || "1", 10);
  const offset = (page - 1) * 50;
  // Several ?tag= values narrow the list to reports carrying ALL of them,
  // which is what picking two filters visibly means.
  const tagFilter = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
    (t) => typeof t === "string" && t.length > 0
  );
  const showArchived = params.archived === "1";

  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;
  const me = live?.user?.discordId
    ? await getMemberByDiscordId(live.user.discordId)
    : undefined;
  const mine = me ? await joinedReportIds(me.id) : new Set<string>();

  // Page-level access is already gated by src/proxy.ts before this ever
  // renders; this query itself has no extra auth check because reading
  // the report list needs no elevated tier (any signed-in roster member
  // can see it) — mutations are where the real per-action checks live,
  // in the API routes.
  const rows = await getBugReportsList(tagFilter, showArchived, offset);
  
  const [tags, allTags] = await Promise.all([
    tagsForReports(rows.map((r) => r.id)),
    listTags(),
  ]);

  // Grouped by category in the order an admin arranged them, with
  // uncategorised reports last — they're the ones needing attention, not
  // the ones to lead with.
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.categoryName ?? "";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return 0;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Bug Reports</h1>
        <Link
          href="/reports/new"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          File a report
        </Link>
      </div>

      <ReportFilters
        allTags={allTags}
        selected={tagFilter}
        showArchived={showArchived}
      />

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {tagFilter.length > 0 || showArchived
            ? "Nothing matches that."
            : "No reports yet. Nice."}
        </p>
      ) : (
        ordered.map(([category, reports]) => (
          <section key={category || "uncategorised"} className="flex flex-col gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {category || "Uncategorised"}
              <span className="ml-2 font-normal normal-case">
                {reports.length}
              </span>
            </h2>

            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
              {reports.map((report) => (
                <li key={report.id}>
                  <Link
                    href={`/reports/${report.id}`}
                    // Reports you're on carry an accent down the left edge
                    // and a tinted background — enough to pick yours out
                    // of a long list at a glance, without shouting.
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l-2 py-3 pr-4 transition ${
                      mine.has(report.id)
                        ? "border-indigo-500 bg-indigo-50/50 pl-3.5 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40"
                        : "border-transparent pl-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {report.title}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {mine.has(report.id) && (
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            You&apos;re on this ·{" "}
                          </span>
                        )}
                        {report.reporterUsername ?? "someone"} ·{" "}
                        {report.createdAt.toLocaleDateString()}
                        {report.replyCount > 0 &&
                          ` · ${report.replyCount} ${
                            report.replyCount === 1 ? "reply" : "replies"
                          }`}
                        {report.participantCount > 0 &&
                          ` · ${report.participantCount} on it`}
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {(tags.get(report.id) ?? []).map((t) => (
                        <TagChip key={t.id} tag={t} />
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {/* Pagination Controls */}
      <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <Link
          href={`/reports?page=${Math.max(1, page - 1)}${tagFilter.map(t => `&tag=${t}`).join('')}${showArchived ? '&archived=1' : ''}`}
          className={`px-4 py-2 text-sm font-medium rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 ${page <= 1 ? 'opacity-50 pointer-events-none' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
        >
          Previous
        </Link>
        <span className="text-sm text-zinc-500">Page {page}</span>
        <Link
          href={`/reports?page=${page + 1}${tagFilter.map(t => `&tag=${t}`).join('')}${showArchived ? '&archived=1' : ''}`}
          className={`px-4 py-2 text-sm font-medium rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 ${rows.length < 50 ? 'opacity-50 pointer-events-none' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
