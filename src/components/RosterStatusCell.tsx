import type { ReactNode } from "react";

/**
 * A yes / no / unknown indicator.
 *
 * "Unknown" is a first-class state, not a styling afterthought: a Roblox
 * outage or an unlinked account genuinely means we don't know, and
 * showing that as a red "no" would assert something false. See the note
 * at the top of src/lib/roblox.ts.
 *
 * Only the affirmative state gets a pill. Giving the negatives an outline
 * too turned a forty-row roster into a grid of grey capsules that read as
 * forty problems — when "hasn't signed in yet" is usually just a fact.
 * They're plain muted text now, so the eye lands on who IS in the group
 * and the rest stays quietly readable.
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
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-900">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-emerald-500"
        />
        {yes}
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="whitespace-nowrap pl-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        {no}
      </span>
    );
  }
  return (
    <span
      className="whitespace-nowrap pl-2 text-[11px] text-zinc-400 dark:text-zinc-600"
      title="Not checked yet"
    >
      {unknown}
    </span>
  );
}

/** The slot for a row where the question doesn't apply at all — an alt
 * account can't sign in, so neither "no" nor "unknown" is honest. */
export function NotApplicable({ title }: { title: string }): ReactNode {
  return (
    <span
      className="pl-2 text-[11px] text-zinc-300 dark:text-zinc-700"
      title={title}
    >
      —
    </span>
  );
}
