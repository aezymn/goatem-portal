"use client";

import Link from "next/link";
import { useState } from "react";
import { DiscordNameCell } from "@/components/DiscordNameCell";
import { YesNoUnknown } from "@/components/RosterStatusCell";
import { PresenceCell, useNow } from "@/components/PresenceCell";
import { DeleteMemberButton } from "@/components/DeleteMemberButton";
import type { Region } from "@/lib/regions";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface RosterMember {
  id: string;
  robloxUsername: string | null;
  discordId: string | null;
  discordUsername: string | null;
  discordAvatarUrl: string | null;
  rank: string;
  region: Region | null;
  /** The day they're next available, if a notice of absence covers today.
   * Null for anyone who is around. */
  awayUntil: string | null;
  hasGameAccess: boolean | null;
  hasSignedIn: boolean;
  /** ISO timestamps for the activity column — see src/lib/presence.ts. */
  lastSeenAt: string | null;
  lastActiveAt: string | null;
  lastSignInAt: string | null;
  isPortalAdmin: boolean;
  isCreator: boolean;
  isAlt: boolean;
  /** Set on alts, pointing at the owner's row. Alts have no profile page
   * of their own — they're listed on their owner's. */
  parentMemberId: string | null;
}

export interface RosterGroup {
  rank: string;
  members: RosterMember[];
}

export function RosterGroups({
  groups,
  canManage,
  serverNow,
  currentMemberId,
}: {
  groups: RosterGroup[];
  canManage: boolean;
  /** The server's clock at render time. The activity column then ticks
   * on the browser's own clock, so "Online" decays by itself on a page
   * that's been left open. */
  serverNow: number;
  currentMemberId?: string | null;
}) {
  const now = useNow(serverNow);
  // Collapsed rather than expanded is tracked, so a rank added later
  // starts open rather than mysteriously hidden.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(rank: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank);
      else next.add(rank);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Nobody on the roster yet.
        {canManage
          ? " Bind a Discord role to a rank on the Ranks page, then hit “Sync from Discord”."
          : " An admin needs to sync the roster from Discord."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.rank);
        const people = group.members.filter((m) => !m.isAlt);

        return (
          <section
            key={group.rank}
            className="overflow-hidden border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-lg"
          >
            <button
              onClick={() => toggle(group.rank)}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center gap-2.5 bg-zinc-50/80 px-4 py-3 text-left transition hover:bg-zinc-100 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800"
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200",
                  !isCollapsed && "rotate-90"
                )}
              />

              <span className="text-sm uppercase tracking-wider">
                {group.rank}
              </span>

              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {people.length}
              </span>

            </button>

            {!isCollapsed && (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {group.members.map((m) => (
                  <li
                    key={m.id}
                    className="group/row flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    {/* Alts carry no Discord identity, so they have no
                        avatar to show and never will — the guide line
                        alone marks them as belonging to the row above.
                        It's sized to land the name at roughly the same
                        indent an avatar would have, so the column still
                        reads straight. */}
                    {m.isAlt ? (
                      <span
                        aria-hidden
                        className="ml-2 h-4 w-8 shrink-0 rounded-bl-md border-b border-l border-zinc-200 dark:border-zinc-800"
                      />
                    ) : (
                      <Avatar url={m.discordAvatarUrl} />
                    )}

                    <div className="flex min-w-0 flex-col leading-tight">
                      <span className="flex items-center gap-1.5">
                        {/* The name is the way into someone's activity —
                            recent tests, bugs filed, absences — so it's a
                            link even when no Roblox account is linked yet,
                            since the profile is still worth reaching. */}
                        <Link
                          href={`/members/${m.parentMemberId ?? m.id}`}
                          className={`truncate hover:underline ${
                            m.robloxUsername
                              ? "text-sm font-medium"
                              : "text-sm italic text-zinc-400"
                          }`}
                        >
                          {m.robloxUsername ?? "not linked"}
                        </Link>
                        {/* Order is priority order: who they are, then
                            what they are, then where they are. */}
                        {m.isCreator && <Badge variant="default">Creator</Badge>}
                        {m.isPortalAdmin && !m.isCreator && (
                          <Badge variant="secondary">Admin</Badge>
                        )}
                        {m.isAlt && <Badge variant="outline">Alt</Badge>}
                        {m.awayUntil && (
                          <span
                            title={`On a notice of absence — back ${formatDay(
                              m.awayUntil
                            )}`}
                            className="flex h-2 w-2 rounded-full bg-orange-500"
                          />
                        )}
                        {m.region && (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {m.region}
                          </span>
                        )}
                      </span>
                      {!m.isAlt && m.discordId && (
                        <span className="text-xs text-zinc-500">
                          <DiscordNameCell
                            discordUsername={m.discordUsername}
                            discordId={m.discordId}
                          />
                        </span>
                      )}
                    </div>

                    {/* Status capsules ride the right edge at their own
                        width rather than sitting in fixed columns — with
                        most rows showing nothing for one or both, reserved
                        columns were mostly reserving empty space. */}
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      {m.robloxUsername && (
                        <span className="hidden sm:flex">
                          <YesNoUnknown
                            value={m.hasGameAccess}
                            yes="In group"
                            no="Not in group"
                            unknown="Unchecked"
                          />
                        </span>
                      )}
                      {!m.isAlt && (
                        <span className="hidden sm:flex">
                          <PresenceCell member={m} now={now} />
                        </span>
                      )}
                      {(canManage ||
                        (m.isAlt &&
                          Boolean(
                            currentMemberId &&
                              m.parentMemberId === currentMemberId
                          ))) && (
                        <DeleteMemberButton
                          memberId={m.id}
                          label={
                            m.robloxUsername ??
                            m.discordUsername ??
                            "this person"
                          }
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Only ever rendered for real people — alts have no Discord account, so
 * there is nothing to show and no point reserving space for it. */
function Avatar({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-800" />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Discord CDN avatar cached at sync time
    <img
      src={url}
      alt=""
      className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
    />
  );
}



/** "12 Sep" — short enough for a tooltip, unambiguous enough to plan
 * around. */
function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
