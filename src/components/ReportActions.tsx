"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Deleting a report. Triage moved to ReportTriage (category and tags) and
 * assignment is gone entirely — people join a bug rather than being given
 * it — so this is all that's left here.
 */
export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reports/${reportId}`, {
      method: "DELETE",
    }).catch(() => null);

    if (!res?.ok) {
      setBusy(false);
      setError("Couldn't delete that report.");
      return;
    }
    router.push("/reports");
    router.refresh();
  }

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => setConfirming(true)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-900 dark:hover:text-red-400"
        >
          Delete
        </button>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-500">Delete this report?</span>
      <button
        onClick={remove}
        disabled={busy}
        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
      >
        {busy ? "…" : "Delete"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
      >
        Cancel
      </button>
    </div>
  );
}
