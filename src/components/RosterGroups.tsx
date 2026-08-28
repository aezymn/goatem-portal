"use client";

import Link from "next/link";
import { useState } from "react";
import { DiscordNameCell } from "@/components/DiscordNameCell";
import { YesNoUnknown } from "@/components/RosterStatusCell";
import { PresenceCell, useNow } from "@/components/PresenceCell";
import { DeleteMemberButton } from "@/components/DeleteMemberButton";
import type { Region } from "@/lib/regions";

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
}: {
  groups: RosterGroup[];
  canManage: boolean;
  /** The server's clock at render time. The activity column then ticks
   * on the browser's own clock, so "Online" decays by itself on a page
   * that's been left open. */
  serverNow: number;
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
            className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white/60 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-zinc-200/40 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:hover:shadow-black/60 dark:hover:border-zinc-700/80"
          >
            <button
              onClick={() => toggle(group.rank)}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center gap-2.5 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 text-left transition hover:bg-zinc-100 dark:border-zinc-900 dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform ${
                  isCollapsed ? "" : "rotate-90"
                }`}
              >
                <path d="M9 6l6 6-6 6" />
              </svg>

              <span className="text-sm uppercase tracking-wider">
                {group.rank}
              </span>

              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {people.length}
              </span>

            </button>

            {!isCollapsed && (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {group.members.map((m) => (
                  <li
                    key={m.id}
                    className="group/row flex items-center gap-3 px-4 py-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
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
                        {m.isCreator && <Badge tone="emerald">Creator</Badge>}
                        {m.isPortalAdmin && !m.isCreator && (
                          <Badge tone="indigo">Admin</Badge>
                        )}
                        {m.isAlt && <Badge tone="zinc">Alt</Badge>}
                        {m.awayUntil && (
                          <Badge
                            tone="amber"
                            title={`On a notice of absence — back ${formatDay(
                              m.awayUntil
                            )}`}
                          >
                            NOA
                          </Badge>
                        )}
                        {m.region && (
                          <Badge tone="outline">{m.region}</Badge>
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
                      {canManage && (
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

function Badge({
  tone,
  title,
  children,
}: {
  tone: "emerald" | "indigo" | "zinc" | "amber" | "outline";
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    emerald:
      "bg-emerald-100/80 text-emerald-800 ring-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20",
    indigo:
      "bg-indigo-100/80 text-indigo-800 ring-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-400/20",
    zinc: "bg-zinc-100/80 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-300 dark:ring-zinc-400/20",
    amber:
      "bg-amber-100/80 text-amber-800 ring-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20",
    // Region is an attribute rather than a status, so it's outlined
    // rather than filled — present without competing with the badges
    // that mean something is true of the person right now.
    outline:
      "text-zinc-500 ring-zinc-300/50 dark:text-zinc-400 dark:ring-zinc-700/50",
  };
  return (
    <span
      title={title}
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset shadow-sm backdrop-blur-sm transition-transform hover:scale-105 ${tones[tone]}`}
    >
      {children}
    </span>
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
