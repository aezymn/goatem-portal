"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Removing someone from the roster.
 *
 * An icon rather than red "Remove" text on every row: with forty rows the
 * old treatment put forty red words down the page, which read as forty
 * warnings and pulled the eye away from the information the roster
 * actually exists to show. It stays reachable — always present for
 * keyboard and touch, and it only picks up its red on hover/focus.
 */
export function DeleteMemberButton({
  memberId,
  label,
}: {
  memberId: string;
  /** Who this removes, so the confirmation and the accessible name say a
   * name rather than "this person". */
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const who = label ? `${label}` : "this person";
    if (!confirm(`Remove ${who} from the roster?`)) return;
    setBusy(true);
    const res = await fetch(`/api/roster/${memberId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      title={label ? `Remove ${label}` : "Remove from roster"}
      aria-label={label ? `Remove ${label}` : "Remove from roster"}
      className="rounded-md p-1.5 text-zinc-300 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 disabled:opacity-40 group-hover/row:text-zinc-400 dark:text-zinc-700 dark:hover:bg-red-950 dark:hover:text-red-400 dark:group-hover/row:text-zinc-500"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
      </svg>
    </button>
  );
}
