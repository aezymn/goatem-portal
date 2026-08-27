import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { members } from "@/db/schema";
import { asc, isNull } from "drizzle-orm";
import { hasAction } from "@/lib/permissions";
import { isRobloxGroupConfigured } from "@/lib/roblox";
import { AddMemberForm } from "@/components/AddMemberForm";
import { DeleteMemberButton } from "@/components/DeleteMemberButton";
import { DiscordNameCell } from "@/components/DiscordNameCell";
import { YesNoUnknown } from "@/components/RosterStatusCell";
import { SyncRosterButton } from "@/components/SyncRosterButton";
import { LinkRobloxPanel } from "@/components/LinkRobloxPanel";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const session = await getServerSession(authOptions);
  const canManageRoster = session?.user
    ? hasAction(session.user, "roster.manage")
    : false;
  const myDiscordId = session?.user?.discordId ?? null;

  const rows = await db
    .select()
    .from(members)
    .where(isNull(members.deletedAt))
    .orderBy(asc(members.rank), asc(members.robloxUsername));

  // Alts sit directly under whoever owns them rather than being sorted
  // among strangers — the roster reads as people, with their extra
  // accounts attached.
  const owners = rows.filter((m) => !m.parentMemberId);
  const altsByOwner = new Map<string, typeof rows>();
  for (const m of rows) {
    if (!m.parentMemberId) continue;
    altsByOwner.set(m.parentMemberId, [
      ...(altsByOwner.get(m.parentMemberId) ?? []),
      m,
    ]);
  }
  const ordered = owners.flatMap((o) => [o, ...(altsByOwner.get(o.id) ?? [])]);

  const me = myDiscordId
    ? rows.find((m) => m.discordId === myDiscordId)
    : undefined;
  const myAlts = me ? (altsByOwner.get(me.id) ?? []) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
        {canManageRoster && <SyncRosterButton />}
      </div>

      {!isRobloxGroupConfigured() && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          No Roblox group is configured (<code>ROBLOX_GROUP_ID</code>), so
          game access can&apos;t be checked — that column will stay unknown
          until it&apos;s set.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Roblox Username</th>
              <th className="px-4 py-2 font-medium">Discord</th>
              <th className="px-4 py-2 font-medium">Rank</th>
              <th className="px-4 py-2 font-medium">Game Access</th>
              <th className="px-4 py-2 font-medium">Signed In</th>
              {canManageRoster && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {ordered.map((m) => {
              const isAlt = Boolean(m.parentMemberId);
              return (
                <tr key={m.id} className={isAlt ? "bg-zinc-50/50 dark:bg-zinc-950/50" : ""}>
                  <td className="px-4 py-2">
                    <span className={isAlt ? "pl-4 text-zinc-600 dark:text-zinc-400" : ""}>
                      {m.robloxUsername ?? (
                        <span className="text-zinc-400">not linked yet</span>
                      )}
                    </span>
                    {isAlt && (
                      <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        alt
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isAlt ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <DiscordNameCell
                        discordUsername={m.discordUsername}
                        discordId={m.discordId}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2 uppercase tracking-wide text-xs text-zinc-600 dark:text-zinc-400">
                    {m.rank}
                  </td>
                  <td className="px-4 py-2">
                    <YesNoUnknown
                      value={m.hasGameAccess}
                      yes="Access"
                      no="No access"
                      unknown="Unknown"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {isAlt ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <YesNoUnknown
                        value={m.hasSignedIn}
                        yes="Signed in"
                        no="Never"
                        unknown="Never"
                      />
                    )}
                  </td>
                  {canManageRoster && (
                    <td className="px-4 py-2 text-right">
                      <DeleteMemberButton memberId={m.id} />
                    </td>
                  )}
                </tr>
              );
            })}
            {ordered.length === 0 && (
              <tr>
                <td
                  colSpan={canManageRoster ? 6 : 5}
                  className="px-4 py-6 text-center text-sm text-zinc-500"
                >
                  Nobody on the roster yet.{" "}
                  {canManageRoster
                    ? "Bind a Discord role to a rank on the Ranks page, then hit “Sync from Discord”."
                    : "An admin needs to sync the roster from Discord."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {me && (
        <LinkRobloxPanel
          linkedUsername={me.robloxUsername}
          alts={myAlts.map((a) => ({
            id: a.id,
            robloxUsername: a.robloxUsername,
          }))}
        />
      )}

      {canManageRoster && (
        <details className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer font-medium">
            Add someone manually
          </summary>
          <p className="mt-1 mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            Only needed for people who aren&apos;t in Discord — anyone
            holding a bound role appears automatically on sync, and manual
            rows are never removed by it.
          </p>
          <AddMemberForm />
        </details>
      )}
    </div>
  );
}
