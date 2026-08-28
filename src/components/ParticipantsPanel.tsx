"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNow } from "@/components/PresenceCell";
import { presenceFor } from "@/lib/presence";
import type { ParticipantRow } from "@/lib/reports";

/**
 * Who's on this bug — the Discord member list, basically, grouped by rank
 * with everything you'd want to know before pinging someone: whether
 * they're around, whether they've filed a notice of absence, where they
 * are. The whole row is a link to their profile.
 *
 * People join themselves — that's how anyone normally gets on the list.
 * A full admin can additionally pull someone in or take them off, for the
 * case where a dev needs to be put on a bug they haven't seen.
 */
export function ParticipantsPanel({
  reportId,
  participants,
  rankOrder,
  awayMemberIds,
  meMemberId,
  serverNow,
  canManage,
  roster,
}: {
  reportId: string;
  participants: ParticipantRow[];
  /** Rank names in authority order, from the Ranks page. */
  rankOrder: string[];
  awayMemberIds: string[];
  meMemberId: string | null;
  serverNow: number;
  /** Full admins may pull someone else onto a bug. Everyone else can only
   * add or remove themselves — the server enforces the same rule. */
  canManage: boolean;
  roster: { id: string; name: string }[];
}) {
  const router = useRouter();
  const now = useNow(serverNow);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState("");

  const away = new Set(awayMemberIds);
  const joined = participants.some((p) => p.memberId === meMemberId);
  const onIt = new Set(participants.map((p) => p.memberId));

  async function call(method: "POST" | "DELETE", memberId?: string) {
    setBusy(true);
    await fetch(`/api/reports/${reportId}/participants`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(memberId ? { memberId } : {}),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  async function toggleJoin() {
    if (!meMemberId) return;
    await call(joined ? "DELETE" : "POST");
  }

  // Grouped by rank in the ladder's own order, the way the roster reads —
  // anyone whose rank isn't in the ladder falls to the bottom rather than
  // vanishing.
  const groups = new Map<string, ParticipantRow[]>();
  for (const p of participants) {
    groups.set(p.rank, [...(groups.get(p.rank) ?? []), p]);
  }
  const orderedGroups = [...groups.entries()].sort(
    ([a], [b]) =>
      (rankOrder.indexOf(a) + 1 || Number.MAX_SAFE_INTEGER) -
      (rankOrder.indexOf(b) + 1 || Number.MAX_SAFE_INTEGER)
  );

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-3 md:w-64 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          On this bug — {participants.length}
        </h2>
      </div>

      {meMemberId && (
        <button
          onClick={toggleJoin}
          disabled={busy}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
            joined
              ? "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              : "bg-indigo-600 text-white hover:bg-indigo-500"
          }`}
        >
          {busy ? "…" : joined ? "Leave this bug" : "Join this bug"}
        </button>
      )}

      {participants.length === 0 && (
        <p className="text-sm text-zinc-500">
          Nobody has joined yet.
        </p>
      )}

      {orderedGroups.map(([rank, people]) => (
        <div key={rank} className="flex flex-col gap-0.5">
          <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            {rank} — {people.length}
          </p>
          {people.map((p) => {
            const presence = presenceFor(p, now);
            const name =
              p.robloxUsername ?? p.discordUsername ?? "Unknown member";
            return (
              <Link
                key={p.memberId}
                href={`/members/${p.memberId}`}
                className="flex items-center gap-2 rounded-md px-1 py-1.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <span className="relative shrink-0">
                  {p.discordAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- cached Discord CDN avatar
                    <img
                      src={p.discordAvatarUrl}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="block h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  )}
                  {/* The presence dot sits on the avatar the way Discord
                      does it, so the list stays scannable at a glance
                      without a status word on every row. */}
                  <span
                    title={presence.title}
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950 ${
                      presence.state === "online"
                        ? "bg-emerald-500"
                        : presence.state === "away"
                          ? "bg-amber-500"
                          : presence.state === "never"
                            ? "bg-zinc-300 dark:bg-zinc-700"
                            : "bg-red-500"
                    }`}
                  />
                </span>

                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-sm">{name}</span>
                    {p.isReporter && <Tag>OP</Tag>}
                    {away.has(p.memberId) && <Tag tone="amber">NOA</Tag>}
                    {p.region && <Tag>{p.region}</Tag>}
                  </span>
                  <span className="truncate text-[11px] text-zinc-400">
                    {presence.label}
                  </span>
                </span>

                {canManage && p.memberId !== meMemberId && (
                  <button
                    disabled={busy}
                    aria-label={`Remove ${name}`}
                    onClick={(e) => {
                      // Inside a Link, so the click has to be stopped
                      // from also navigating to their profile.
                      e.preventDefault();
                      e.stopPropagation();
                      void call("DELETE", p.memberId);
                    }}
                    className="ml-auto shrink-0 text-xs text-zinc-300 transition hover:text-red-600 disabled:opacity-50 dark:text-zinc-700 dark:hover:text-red-400"
                  >
                    ✕
                  </button>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      {canManage && (
        <label className="flex flex-col gap-1 border-t border-zinc-200 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-800">
          Add someone
          <select
            value={adding}
            disabled={busy}
            onChange={(e) => {
              const id = e.target.value;
              setAdding("");
              if (id) void call("POST", id);
            }}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="">Pick someone…</option>
            {roster
              .filter((m) => !onIt.has(m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>
      )}
    </aside>
  );
}

function Tag({
  tone = "zinc",
  children,
}: {
  tone?: "zinc" | "amber";
  children: React.ReactNode;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-1 py-px text-[9px] font-semibold uppercase tracking-wide ${
        tone === "amber"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
          : "text-zinc-500 ring-1 ring-zinc-300 dark:text-zinc-400 dark:ring-zinc-700"
      }`}
    >
      {children}
    </span>
  );
}
