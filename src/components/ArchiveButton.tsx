"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Archiving by hand. Completed reports archive themselves after 30 days
 * anyway (see the cron route); this is for the ones you want out of the
 * list sooner. */
export function ArchiveButton({
  reportId,
  archived,
}: {
  reportId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/reports/${reportId}/archive`, {
          method: archived ? "DELETE" : "POST",
        }).catch(() => null);
        setBusy(false);
        router.refresh();
      }}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
    >
      {busy ? "…" : archived ? "Unarchive" : "Archive"}
    </button>
  );
}
