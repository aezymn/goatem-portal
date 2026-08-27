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
        const people = group.members.filter((m) => !m.isAlt);
        const linked = group.members.filter((m) => m.robloxUsername).length;
        const allLinked = linked === group.members.length;

        return (
          <section
            key={group.rank}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
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

              <span
                className={`ml-auto text-xs tabular-nums ${
                  allLinked
                    ? "text-emerald-600 dark:text-emerald-500"
                    : "text-zinc-400"
                }`}
              >
                {linked}/{group.members.length} linked
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
                        <span
                          className={`truncate ${
                            m.robloxUsername
                              ? "text-sm font-medium"
                              : "text-sm italic text-zinc-400"
                          }`}
                        >
                          {m.robloxUsername ?? "not linked"}
                        </span>
                        {m.isCreator && <Badge tone="emerald">Creator</Badge>}
                        {m.isPortalAdmin && !m.isCreator && (
                          <Badge tone="indigo">Admin</Badge>
                        )}
                        {m.isAlt && <Badge tone="zinc">Alt</Badge>}
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

                    {/* Fixed-width slots so the pills form tidy columns
                        down the list instead of jittering with their own
                        label lengths. */}
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      <span className="hidden w-[112px] justify-end sm:flex">
                        <YesNoUnknown
                          value={m.robloxUsername ? m.hasGameAccess : null}
                          yes="In group"
                          no="Not in group"
                          unknown={m.robloxUsername ? "Unchecked" : "No account"}
                        />
                      </span>
                      <span className="hidden w-[104px] justify-end sm:flex">
                        {!m.isAlt && (
                          <YesNoUnknown
                            value={m.hasSignedIn}
                            yes="Signed in"
                            no="Never"
                            unknown="Never"
                          />
                        )}
                      </span>
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
      className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
