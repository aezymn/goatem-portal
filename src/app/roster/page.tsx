import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { members } from "@/db/schema";
import { asc, isNull } from "drizzle-orm";
import { hasAction, isCreatorDiscordId } from "@/lib/permissions";
import { isRobloxGroupConfigured, generateVerificationCode } from "@/lib/roblox";
import { listRanksWithActions } from "@/lib/ranks";
import { currentAbsencesByMemberId } from "@/lib/activity";
import { asRegion } from "@/lib/regions";
import { nowMs } from "@/lib/presence";
import { AddMemberForm } from "@/components/AddMemberForm";
import { RosterToolbar } from "@/components/RosterToolbar";
import { LinkRobloxPanel } from "@/components/LinkRobloxPanel";
import {
  RosterGroups,
  type RosterGroup,
  type RosterMember,
} from "@/components/RosterGroups";


export default async function RosterPage() {
  const session = await getServerSession(authOptions);
  // A stale session carries no access fields at all — treat it as
  // signed out rather than reading half a context.
  const live = session && !session.stale ? session : null;
  const canManageRoster = live?.user
    ? hasAction(live.user, "roster.manage")
    : false;
  const myDiscordId = live?.user?.discordId ?? null;

  const [rows, ranks, awayUntil] = await Promise.all([
    db
      .select()
      .from(members)
      .where(isNull(members.deletedAt))
      .orderBy(asc(members.robloxUsername), asc(members.discordUsername)),
    listRanksWithActions(),
    currentAbsencesByMemberId(),
  ]);

  // Rank authority order comes from the Ranks page, not the alphabet —
  // the ladder an admin arranged is the order this should read in.
  const rankOrder = new Map(ranks.map((r, i) => [r.name, i]));

  const altsByOwner = new Map<string, typeof rows>();
  for (const m of rows) {
    if (!m.parentMemberId) continue;
    altsByOwner.set(m.parentMemberId, [
      ...(altsByOwner.get(m.parentMemberId) ?? []),
      m,
    ]);
  }

  function toRosterMember(m: (typeof rows)[number]): RosterMember {
    return {
      id: m.id,
      robloxUsername: m.robloxUsername,
      discordId: m.discordId,
      discordUsername: m.discordUsername,
      discordAvatarUrl: m.discordAvatarUrl,
      rank: m.rank,
      hasGameAccess: m.hasGameAccess,
      hasSignedIn: m.hasSignedIn,
      // Serialised for the client component, which turns them into
      // Online / Away / Active 3h ago on a ticking clock.
      lastSeenAt: m.lastSeenAt?.toISOString() ?? null,
      lastActiveAt: m.lastActiveAt?.toISOString() ?? null,
      lastSignInAt: m.lastSignInAt?.toISOString() ?? null,
      isPortalAdmin: m.isPortalAdmin,
      isCreator: isCreatorDiscordId(m.discordId ?? undefined),
      isAlt: Boolean(m.parentMemberId),
      parentMemberId: m.parentMemberId,
      region: asRegion(m.region),
      // An alt is the same human as its owner, so the absence tag goes on
      // the owner's row only rather than repeating down the group.
      awayUntil: m.parentMemberId ? null : (awayUntil.get(m.id) ?? null),
    };
  }

  // Group by rank, each owner immediately followed by their alt accounts.
  const byRank = new Map<string, RosterMember[]>();
  for (const m of rows) {
    if (m.parentMemberId) continue; // alts ride along with their owner
    const list = byRank.get(m.rank) ?? [];
    list.push(toRosterMember(m));
    for (const alt of altsByOwner.get(m.id) ?? []) {
      list.push(toRosterMember(alt));
    }
    byRank.set(m.rank, list);
  }

  const groups: RosterGroup[] = [...byRank.entries()]
    .map(([rank, groupMembers]) => ({ rank, members: groupMembers }))
    .sort(
      (a, b) =>
        (rankOrder.get(a.rank) ?? Number.MAX_SAFE_INTEGER) -
          (rankOrder.get(b.rank) ?? Number.MAX_SAFE_INTEGER) ||
        a.rank.localeCompare(b.rank)
    );

  const me = myDiscordId
    ? rows.find((m) => m.discordId === myDiscordId)
    : undefined;
  const myAlts = me ? (altsByOwner.get(me.id) ?? []) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
        {canManageRoster && (
          <RosterToolbar groupConfigured={isRobloxGroupConfigured()} />
        )}
      </div>

      {!isRobloxGroupConfigured() && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          No Roblox group is configured (<code>ROBLOX_GROUP_ID</code>), so
          game access can&apos;t be checked.
        </p>
      )}

      <RosterGroups
        groups={groups}
        canManage={canManageRoster}
        serverNow={nowMs()}
        currentMemberId={me?.id}
      />

      {me && myDiscordId && (
        <LinkRobloxPanel
          linkedUsername={me.robloxUsername}
          alts={myAlts.map((a) => ({
            id: a.id,
            robloxUsername: a.robloxUsername,
          }))}
          verificationCode={generateVerificationCode(myDiscordId)}
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
