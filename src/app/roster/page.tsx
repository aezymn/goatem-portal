import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { members, rankPermissions } from "@/db/schema";
import { asc, isNull } from "drizzle-orm";
import { tierAtLeast } from "@/lib/permissions";
import { AddMemberForm } from "@/components/AddMemberForm";
import { DeleteMemberButton } from "@/components/DeleteMemberButton";
import { GrantToggle } from "@/components/GrantToggle";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = tierAtLeast(session?.user?.permissionTier ?? "MEMBER", "ADMIN");

  const [rows, eligibilityRows] = await Promise.all([
    db
      .select()
      .from(members)
      .where(isNull(members.deletedAt))
      .orderBy(asc(members.rank), asc(members.robloxUsername)),
    db.select().from(rankPermissions),
  ]);
  const eligibilityByRank = new Map(
    eligibilityRows.map((r) => [r.rank, r.eligibleTier])
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Roblox Username</th>
              <th className="px-4 py-2 font-medium">Rank</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Discord ID</th>
              {isAdmin && <th className="px-4 py-2 font-medium">Access</th>}
              {isAdmin && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2">{m.robloxUsername}</td>
                <td className="px-4 py-2">{m.rank}</td>
                <td className="px-4 py-2">{m.status ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-500">
                  {m.discordId ?? "—"}
                </td>
                {isAdmin && (
                  <td className="px-4 py-2">
                    <GrantToggle
                      memberId={m.id}
                      grantedTier={m.grantedTier}
                      eligibleTier={eligibilityByRank.get(m.rank) ?? null}
                    />
                  </td>
                )}
                {isAdmin && (
                  <td className="px-4 py-2 text-right">
                    <DeleteMemberButton memberId={m.id} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 font-medium">Add someone to the roster</h2>
          <AddMemberForm />
        </div>
      )}
    </div>
  );
}
