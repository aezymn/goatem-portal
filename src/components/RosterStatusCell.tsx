import type { ReactNode } from "react";

export type CapsuleTone = "positive" | "warning" | "muted" | "unknown";

/**
 * The one capsule every roster status is drawn with, so "In group",
 * "Not in group", "Online" and "Active 3h ago" all read as answers to the
 * same kind of question instead of four different visual ideas.
 *
 * Only the affirmative and the attention states carry colour. The
 * negatives keep the capsule but drop to a plain outline — present and
 * legible, without turning a roster of forty into forty warnings.
 */
export function Capsule({
  tone,
  dot = true,
  title,
  children,
}: {
  tone: CapsuleTone;
  dot?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const tones: Record<CapsuleTone, string> = {
    positive:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-900",
    warning:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:ring-amber-900",
    muted: "text-zinc-500 ring-zinc-200 dark:text-zinc-400 dark:ring-zinc-800",
    unknown:
      "text-zinc-400 ring-dashed ring-zinc-200 dark:text-zinc-500 dark:ring-zinc-800",
  };
  const dots: Record<CapsuleTone, string> = {
    positive: "bg-emerald-500",
    warning: "bg-amber-500",
    muted: "bg-zinc-300 dark:bg-zinc-600",
    unknown: "bg-transparent",
  };

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tones[tone]}`}
    >
      {dot && tone !== "unknown" && (
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} />
      )}
      {children}
    </span>
  );
}

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
  if (value === true) return <Capsule tone="positive">{yes}</Capsule>;
  if (value === false) return <Capsule tone="muted">{no}</Capsule>;
  return (
    <Capsule tone="unknown" title="Not checked yet">
      {unknown}
    </Capsule>
  );
}

/** The slot for a row where the question doesn't apply at all — an alt
 * account can't sign in, so neither "no" nor "unknown" is honest, and a
 * capsule would imply there's an answer to read. */
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
