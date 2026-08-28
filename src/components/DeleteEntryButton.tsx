"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Shared remove control for absence notices and test logs — same
 * behaviour, different endpoint. */
export function DeleteEntryButton({
  endpoint,
  confirmText,
}: {
  endpoint: string;
  confirmText: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(confirmText)) return;
    setBusy(true);
    const res = await fetch(endpoint, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      title="Remove"
      aria-label="Remove"
      className="rounded-md p-1.5 text-zinc-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-zinc-700 dark:hover:bg-red-950 dark:hover:text-red-400"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
      </svg>
    </button>
  );
}
