import type { ReactNode } from "react";

/**
 * A yes / no / unknown indicator.
 *
 * "Unknown" is a first-class state, not a styling afterthought: a Roblox
 * outage or an unlinked account genuinely means we don't know, and
 * showing that as a red "no" would assert something false. See the note
 * at the top of src/lib/roblox.ts.
 */
export function YesNoUnknown({
  value,
  yes,
  no,
  unknown,
}: {
  value: boolean | null;
  yes: string;
  no: string;
  unknown: string;
}): ReactNode {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
        <span aria-hidden>✓</span>
        {yes}
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        <span aria-hidden>✕</span>
        {no}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-400 dark:border-zinc-700"
      title="Not checked yet"
    >
      {unknown}
    </span>
  );
}
