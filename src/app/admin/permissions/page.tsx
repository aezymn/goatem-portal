import { listRankEligibility } from "@/lib/rankPermissions";
import { RankEligibilitySelect } from "@/components/RankEligibilitySelect";

// Direct DB reads aren't auto-detected as dynamic — force it, same as
// every other data-driven page in this app.
export const dynamic = "force-dynamic";

// src/proxy.ts already redirects non-admins away from anything under
// /admin before this ever renders; the API routes underneath re-check
// independently regardless (see src/app/api/admin/rank-permissions).
export default async function PermissionsPage() {
  const ranks = await listRankEligibility();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Permissions</h1>
      <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        This sets the <strong>ceiling</strong> for each rank — the most
        access anyone holding that rank is allowed to be granted. It does
        not grant anything by itself. To actually give a specific person
        access, use the toggle next to their name on the{" "}
        <a href="/roster" className="underline">
          Roster
        </a>{" "}
        page — that way handing someone a rank in Discord never quietly
        hands them portal access along with it.
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Rank</th>
              <th className="px-4 py-2 font-medium">Eligible for</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {ranks.map((r) => (
              <tr key={r.rank}>
                <td className="px-4 py-2">{r.rank}</td>
                <td className="px-4 py-2">
                  <RankEligibilitySelect
                    rank={r.rank}
                    eligibleTier={r.eligibleTier}
                  />
                </td>
              </tr>
            ))}
            {ranks.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-6 text-center text-zinc-500"
                >
                  No ranks yet — add someone to the roster first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
