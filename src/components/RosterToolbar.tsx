"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The two roster-wide actions: pull people in from Discord, and re-check
 * everyone's Roblox group membership. Kept together because they're the
 * pair an admin reaches for, and both report what actually happened
 * rather than silently refreshing.
 */
export function RosterToolbar({
  groupConfigured,
}: {
  groupConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "access" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function run(
    which: "sync" | "access",
    url: string,
    describe: (data: Record<string, number>) => string
  ) {
    setBusy(which);
    setMessage(null);
    const res = await fetch(url, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setIsError(true);
      setMessage(data.error ?? "That didn't work.");
      return;
    }
    setIsError(false);
    setMessage(data.message ?? describe(data));
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() =>
            run("sync", "/api/roster/sync", (d) =>
              d.added || d.updated || d.removed
                ? `Synced — ${d.added} added, ${d.updated} updated, ${d.removed} removed.`
                : "Synced — already up to date."
            )
          }
          disabled={busy !== null}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {busy === "sync" ? "Syncing…" : "Sync from Discord"}
        </button>

        <button
          onClick={() =>
            run("access", "/api/roster/refresh-access", (d) =>
              `Checked ${d.checked} account${d.checked === 1 ? "" : "s"}${
                d.failed ? `, ${d.failed} couldn't be checked` : ""
              }.`
            )
          }
          disabled={busy !== null || !groupConfigured}
          title={
            groupConfigured
              ? "Re-check everyone's Roblox group membership"
              : "Set ROBLOX_GROUP_ID first"
          }
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {busy === "access" ? "Checking…" : "Check game access"}
        </button>
      </div>

      {message && (
        <p
          className={`text-xs ${
            isError ? "text-red-600" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
