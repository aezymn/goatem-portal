"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncRosterButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function sync() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/roster/sync", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setIsError(true);
      setMessage(data.error ?? "Sync failed.");
      return;
    }

    setIsError(false);
    const { added = 0, updated = 0, removed = 0 } = data;
    setMessage(
      added || updated || removed
        ? `Synced — ${added} added, ${updated} updated, ${removed} removed.`
        : "Synced — already up to date."
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={sync}
        disabled={busy}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {busy ? "Syncing…" : "Sync from Discord"}
      </button>
      {message && (
        <p
          className={`text-sm ${
            isError ? "text-red-600" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
