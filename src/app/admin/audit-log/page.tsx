import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import Link from "next/link";

// Direct DB reads (not fetch()) aren't auto-detected as dynamic — force it
// so this never gets frozen at build time. See src/app/reports/page.tsx.

// src/proxy.ts already redirects non-admins away from anything under
// /admin before this ever renders, but note that page gate is a UX
// convenience only — there is still no write route for this table
// anywhere in the app, admin or not. See src/lib/audit.ts.
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;

  const query = db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(50); // Reduced to 50 for realistic pagination

  if (cursor) {
    // We import `lt` dynamically or ensure it's in the drizzle-orm imports
    // Actually we'll use `sql` to avoid needing to add an import if it's not there, 
    // but Drizzle has lt. Let's just use sql to be safe.
    query.where(sql`${auditLog.createdAt} < ${new Date(cursor)}`);
  }

  const rows = await query;
  const nextCursor = rows.length === 50 ? rows[rows.length - 1].createdAt.toISOString() : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Read-only, most recent 200 entries. Nothing here can be edited or
        cleared from the app.
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-zinc-500">
                  {entry.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-2">{entry.actorName}</td>
                <td className="px-4 py-2 font-mono text-xs">
                  {entry.action}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {entry.targetType}
                  {entry.targetId ? ` · ${entry.targetId}` : ""}
                </td>
                <td className="max-w-xs truncate px-4 py-2 text-xs text-zinc-500">
                  {entry.metadata ? JSON.stringify(entry.metadata) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Link
            href={`/admin/audit-log?cursor=${nextCursor}`}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Load More
          </Link>
        </div>
      )}
    </div>
  );
}
