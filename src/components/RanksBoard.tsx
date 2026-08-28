"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RANK_ACTIONS, type RankAction } from "@/lib/permissions";

// Short labels for the pills; the longer explanation lives in the title
// attribute so the row stays scannable without losing the detail.
const ACTION_LABELS: Record<RankAction, { short: string; hint: string }> = {
  "reports.triage": {
    short: "Triage reports",
    hint: "Set a bug report's category and tags, and archive it",
  },
  "reports.delete": {
    short: "Delete reports",
    hint: "Remove bug reports (recoverable — nothing is truly deleted)",
  },
  "roster.manage": {
    short: "Manage roster",
    hint: "Add, edit and remove people on the roster, and run a Discord sync",
  },
  "bugsetup.manage": {
    short: "Manage bug setup",
    hint: "Create and edit the bug categories, tag types and tags everyone picks from",
  },
};

interface RankRow {
  name: string;
  position: number;
  discordRoleId: string | null;
  actions: RankAction[];
  memberCount: number;
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
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [busyRank, setBusyRank] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  // Which rank is being renamed, and the in-progress text. Null means
  // nobody is editing.
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  // Adjusts local state when the server hands us fresh props, during
  // render rather than in an effect.
  const [prevInitialRanks, setPrevInitialRanks] = useState(initialRanks);
  if (initialRanks !== prevInitialRanks) {
    setPrevInitialRanks(initialRanks);
    setRanks(initialRanks);
  }

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
    setOverIndex(null);
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

  async function toggleAction(
    rank: string,
    action: RankAction,
    granted: boolean
  ) {
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

  async function commitRename(original: string) {
    const next = draftName.trim();
    setEditing(null);
    if (!next || next === original) return;

    setBusyRank(original);
    setError(null);
    setRanks((prev) =>
      prev.map((r) => (r.name === original ? { ...r, name: next } : r))
    );

    const res = await fetch(
      `/api/admin/ranks/${encodeURIComponent(original)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      }
    );
    setBusyRank(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't rename that rank.");
      router.refresh();
      return;
    }
    // Everyone holding the rank moved with it server-side; refresh so the
    // member counts and any other derived text catch up.
    router.refresh();
  }

  async function createRank(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);

    const res = await fetch("/api/admin/ranks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't create that rank.");
      return;
    }
    setNewName("");
    router.refresh();
  }

  async function removeRank(rank: RankRow) {
    if (
      !confirm(
        `Delete the rank “${rank.name}”? Its permissions go with it. This can't be undone, but nothing else is affected.`
      )
    ) {
      return;
    }
    setBusyRank(rank.name);
    setError(null);
    const res = await fetch(`/api/admin/ranks/${encodeURIComponent(rank.name)}`, {
      method: "DELETE",
    });
    setBusyRank(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't delete that rank.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {ranks.map((rank, index) => {
          const boundRoleMissing =
            rank.discordRoleId &&
            !discordRoles.some((r) => r.id === rank.discordRoleId);

          return (
            <li
              key={rank.name}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(index);
              }}
              onDrop={() => onDrop(index)}
              className={`rounded-xl border bg-white transition dark:bg-zinc-950 ${
                dragIndex === index
                  ? "border-zinc-300 opacity-40 dark:border-zinc-700"
                  : overIndex === index
                    ? "border-indigo-400"
                    : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {/* Header row: identity on the left, Discord binding and
                  delete on the right. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <span
                  className="cursor-grab select-none text-lg leading-none text-zinc-300 active:cursor-grabbing dark:text-zinc-600"
                  aria-hidden
                  title="Drag to reorder"
                >
                  ⠿
                </span>

                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold tabular-nums text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  {index + 1}
                </span>

                {editing === rank.name ? (
                  <input
                    autoFocus
                    value={draftName}
                    maxLength={50}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitRename(rank.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(rank.name);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditing(null);
                      }
                    }}
                    aria-label={`Rename ${rank.name}`}
                    className="rounded-md border border-indigo-400 bg-transparent px-1.5 py-0.5 text-sm font-medium outline-none"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditing(rank.name);
                      setDraftName(rank.name);
                    }}
                    disabled={busyRank === rank.name}
                    title="Click to rename"
                    className="rounded px-1 py-0.5 font-medium hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-900"
                  >
                    {rank.name}
                  </button>
                )}

                <span className="text-xs text-zinc-400">
                  {rank.memberCount === 0
                    ? "nobody"
                    : rank.memberCount === 1
                      ? "1 member"
                      : `${rank.memberCount} members`}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <select
                    value={rank.discordRoleId ?? ""}
                    disabled={busyRank === rank.name}
                    onChange={(e) =>
                      bindDiscordRole(rank.name, e.target.value || null)
                    }
                    aria-label={`Discord role for ${rank.name}`}
                    className="max-w-[14rem] rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
                  >
                    <option value="">No Discord role</option>
                    {discordRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                    {boundRoleMissing && (
                      <option value={rank.discordRoleId!}>
                        Unknown role ({rank.discordRoleId})
                      </option>
                    )}
                  </select>

                  <button
                    onClick={() => removeRank(rank)}
                    disabled={busyRank === rank.name}
                    aria-label={`Delete ${rank.name}`}
                    title={
                      rank.memberCount > 0
                        ? "Move its members elsewhere before deleting"
                        : "Delete this rank"
                    }
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      className="h-4 w-4"
                    >
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Permission pills */}
              <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-900">
                {RANK_ACTIONS.map((action) => {
                  const on = rank.actions.includes(action);
                  return (
                    <label
                      key={action}
                      title={ACTION_LABELS[action].hint}
                      className="cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={busyRank === rank.name}
                        onChange={(e) =>
                          toggleAction(rank.name, action, e.target.checked)
                        }
                        className="peer sr-only"
                      />
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 transition peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 peer-disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:peer-checked:bg-indigo-950 dark:peer-checked:text-indigo-300">
                        <span aria-hidden className="text-[10px]">
                          {on ? "✓" : "○"}
                        </span>
                        {ACTION_LABELS[action].short}
                      </span>
                    </label>
                  );
                })}

                {!rank.discordRoleId && (
                  <span className="ml-auto self-center text-xs text-amber-600 dark:text-amber-500">
                    No Discord role bound — nobody joins this rank on sync
                  </span>
                )}
              </div>
            </li>
          );
        })}

        {ranks.length === 0 && (
          <li className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No ranks yet — create one below.
          </li>
        )}
      </ul>

      <form
        onSubmit={createRank}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-3 py-2.5 dark:border-zinc-700"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New rank name…"
          maxLength={50}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {creating ? "Adding…" : "Add rank"}
        </button>
      </form>
    </div>
  );
}
