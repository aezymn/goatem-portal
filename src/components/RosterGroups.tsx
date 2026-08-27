"use client";

import { useState } from "react";
import { DiscordNameCell } from "@/components/DiscordNameCell";
import { YesNoUnknown } from "@/components/RosterStatusCell";
import { DeleteMemberButton } from "@/components/DeleteMemberButton";

export interface RosterMember {
  id: string;
  robloxUsername: string | null;
  discordId: string | null;
  discordUsername: string | null;
  discordAvatarUrl: string | null;
  rank: string;
  hasGameAccess: boolean | null;
  hasSignedIn: boolean;
  isPortalAdmin: boolean;
  isCreator: boolean;
  isAlt: boolean;
}

export interface RosterGroup {
  rank: string;
  members: RosterMember[];
}

export function RosterGroups({
  groups,
  canManage,
}: {
  groups: RosterGroup[];
  canManage: boolean;
}) {
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
        const linked = group.members.filter((m) => m.robloxUsername).length;

        return (
          <section
            key={group.rank}
            className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
          >
            <button
              onClick={() => toggle(group.rank)}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center gap-3 bg-zinc-50 px-4 py-2.5 text-left hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
            >
              <span
                aria-hidden
                className={`text-xs text-zinc-400 transition-transform ${
                  isCollapsed ? "" : "rotate-90"
                }`}
              >
                ▶
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider">
                {group.rank}
              </span>
              <span className="text-xs text-zinc-400">
                {group.members.length}
              </span>
              <span className="ml-auto text-xs text-zinc-400">
                {linked}/{group.members.length} linked
              </span>
            </button>

            {!isCollapsed && (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {group.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    {m.discordAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Discord CDN avatar cached at sync time
                      <img
                        src={m.discordAvatarUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    )}

                    <div className="flex min-w-0 flex-col leading-tight">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={
                            m.robloxUsername
                              ? "font-medium"
                              : "text-sm italic text-zinc-400"
                          }
                        >
                          {m.robloxUsername ?? "not linked yet"}
                        </span>
                        {m.isCreator && <Badge tone="emerald">Creator</Badge>}
                        {m.isPortalAdmin && !m.isCreator && (
                          <Badge tone="indigo">Admin</Badge>
                        )}
                        {m.isAlt && <Badge tone="zinc">Alt</Badge>}
                      </span>
                      {!m.isAlt && (
                        <span className="text-xs text-zinc-500">
                          <DiscordNameCell
                            discordUsername={m.discordUsername}
                            discordId={m.discordId}
                          />
                        </span>
                      )}
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <YesNoUnknown
                        value={m.robloxUsername ? m.hasGameAccess : null}
                        yes="In group"
                        no="Not in group"
                        unknown={m.robloxUsername ? "Unchecked" : "No account"}
                      />
                      {!m.isAlt && (
                        <YesNoUnknown
                          value={m.hasSignedIn}
                          yes="Signed in"
                          no="Never signed in"
                          unknown="Never signed in"
                        />
                      )}
                      {canManage && <DeleteMemberButton memberId={m.id} />}
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

function Badge({
  tone,
  children,
}: {
  tone: "emerald" | "indigo" | "zinc";
  children: React.ReactNode;
}) {
  const tones = {
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    indigo:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    zinc: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span
      className={`rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
