"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RANK_ACTIONS, type RankAction } from "@/lib/permissions";

const ACTION_LABELS: Record<RankAction, string> = {
  "reports.triage": "Triage bug reports (status & assignee)",
  "reports.delete": "Delete bug reports",
  "roster.manage": "Manage the roster (add / edit / remove)",
};

interface RankRow {
  name: string;
  position: number;
  discordRoleId: string | null;
  actions: RankAction[];
}

interface DiscordRole {
  id: string;
  name: string;
}

export function RanksBoard({
  initialRanks,
  discordRoles,
}: {
  initialRanks: RankRow[];
  discordRoles: DiscordRole[];
}) {
  const router = useRouter();
  const [ranks, setRanks] = useState(initialRanks);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busyRank, setBusyRank] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Adjusts local state when the server hands us fresh props (e.g. after
  // a router.refresh()) — done during render, not in an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevInitialRanks, setPrevInitialRanks] = useState(initialRanks);
  if (initialRanks !== prevInitialRanks) {
    setPrevInitialRanks(initialRanks);
    setRanks(initialRanks);
  }

  const roleName = (id: string | null) =>
    id ? discordRoles.find((r) => r.id === id)?.name ?? `Unknown role (${id})` : null;

  async function persistOrder(order: string[]) {
    const res = await fetch("/api/admin/ranks/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
    if (!res.ok) {
      setError("Couldn't save the new order — refreshing.");
      router.refresh();
    }
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const reordered = [...ranks];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setRanks(reordered);
    setDragIndex(null);
    persistOrder(reordered.map((r) => r.name));
  }

  async function toggleAction(rank: string, action: RankAction, granted: boolean) {
    setBusyRank(rank);
    setError(null);
    setRanks((prev) =>
      prev.map((r) =>
        r.name === rank
          ? {
              ...r,
              actions: granted
                ? [...r.actions, action]
                : r.actions.filter((a) => a !== action),
            }
          : r
      )
    );

    const res = await fetch(
      `/api/admin/ranks/${encodeURIComponent(rank)}/actions`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, granted }),
      }
    );
    setBusyRank(null);
    if (!res.ok) {
      setError("Couldn't update that permission — refreshing.");
      router.refresh();
    }
  }

  async function bindDiscordRole(rank: string, discordRoleId: string | null) {
    setBusyRank(rank);
    setError(null);
    setRanks((prev) =>
      prev.map((r) => (r.name === rank ? { ...r, discordRoleId } : r))
    );

    const res = await fetch(`/api/admin/ranks/${encodeURIComponent(rank)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordRoleId }),
    });
    setBusyRank(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't bind that role — refreshing.");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="flex flex-col gap-2">
        {ranks.map((rank, index) => (
          <li
            key={rank.name}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(index)}
            className={`rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 ${
              dragIndex === index ? "opacity-50" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="cursor-grab select-none text-zinc-400"
                aria-hidden
                title="Drag to reorder"
              >
                ⠿
              </span>
              <span className="font-medium">{rank.name}</span>
              <span className="text-xs text-zinc-400">
                authority #{index + 1}
              </span>

              <div className="ml-auto flex items-center gap-2 text-xs">
                <label className="text-zinc-500">Discord role</label>
                <select
                  value={rank.discordRoleId ?? ""}
                  disabled={busyRank === rank.name}
                  onChange={(e) =>
                    bindDiscordRole(rank.name, e.target.value || null)
                  }
                  className="rounded-md border border-zinc-300 px-2 py-1 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">Unbound</option>
                  {discordRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                  {/* If the bound role no longer shows up in the live
                      Discord role list (deleted, or the bot isn't
                      configured), still show it so it isn't silently
                      dropped from the dropdown. */}
                  {rank.discordRoleId &&
                    !discordRoles.some((r) => r.id === rank.discordRoleId) && (
                      <option value={rank.discordRoleId}>
                        {roleName(rank.discordRoleId)}
                      </option>
                    )}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-900">
              {RANK_ACTIONS.map((action) => (
                <label key={action} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rank.actions.includes(action)}
                    disabled={busyRank === rank.name}
                    onChange={(e) =>
                      toggleAction(rank.name, action, e.target.checked)
                    }
                    className="h-4 w-4"
                  />
                  {ACTION_LABELS[action]}
                </label>
              ))}
            </div>
          </li>
        ))}
        {ranks.length === 0 && (
          <li className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No ranks yet — add someone to the roster first.
          </li>
        )}
      </ul>
    </div>
  );
}
