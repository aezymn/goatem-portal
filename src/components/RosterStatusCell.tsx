import type { ReactNode } from "react";

/**
 * A yes / no / unknown indicator.
 *
 * "Unknown" is a first-class state, not a styling afterthought: a Roblox
 * outage or an unlinked account genuinely means we don't know, and
 * showing that as a red "no" would assert something false. See the note
 * at the top of src/lib/roblox.ts.
 *
 * Only the affirmative state carries colour. On a roster of forty rows,
 * colouring the negatives too turns the page into a wall of red that
 * reads as forty problems — when "hasn't signed in yet" is usually just
 * a fact, not a fault.
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
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

  if (value === true) {
    return (
      <span
        className={`${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-900`}
      >
        <Dot className="bg-emerald-500" />
        {yes}
      </span>
    );
  }
  if (value === false) {
    return (
      <span
        className={`${base} text-zinc-500 ring-1 ring-zinc-200 dark:text-zinc-400 dark:ring-zinc-800`}
      >
        <Dot className="bg-zinc-300 dark:bg-zinc-600" />
        {no}
      </span>
    );
  }
  return (
    <span
      className={`${base} text-zinc-400 ring-1 ring-dashed ring-zinc-200 dark:text-zinc-500 dark:ring-zinc-800`}
      title="Not checked yet"
    >
      {unknown}
    </span>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${className}`} />
  );
}
