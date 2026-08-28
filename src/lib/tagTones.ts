/**
 * Tag colours, kept in their own module with no database import so client
 * components can render a tag chip without dragging the server-only
 * query layer into the browser bundle.
 */

/**
 * A tag stores the NAME of a colour, not a hex value. Free colour picking
 * produces tags that are unreadable in one of the two themes and clash
 * with everything else on the page; a fixed palette can't.
 */
export const TAG_TONES = [
  "zinc",
  "emerald",
  "amber",
  "red",
  "sky",
  "indigo",
  "violet",
  "pink",
] as const;
export type TagTone = (typeof TAG_TONES)[number];

export function asTagTone(value: string | null | undefined): TagTone {
  return TAG_TONES.includes(value as TagTone) ? (value as TagTone) : "zinc";
}

/** Tailwind can only see class names it can read in the source, so every
 * combination is written out in full here rather than built by string
 * interpolation — an interpolated `bg-${tone}-100` compiles to nothing. */
export const TAG_TONE_CLASSES: Record<TagTone, string> = {
  zinc: "bg-zinc-100/80 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-300 dark:ring-zinc-400/20",
  emerald:
    "bg-emerald-100/80 text-emerald-800 ring-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  amber:
    "bg-amber-100/80 text-amber-800 ring-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20",
  red: "bg-red-100/80 text-red-800 ring-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20",
  sky: "bg-sky-100/80 text-sky-800 ring-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-400/20",
  indigo:
    "bg-indigo-100/80 text-indigo-800 ring-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-400/20",
  violet:
    "bg-violet-100/80 text-violet-800 ring-violet-500/30 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-400/20",
  pink: "bg-pink-100/80 text-pink-800 ring-pink-500/30 dark:bg-pink-500/10 dark:text-pink-400 dark:ring-pink-400/20",
};
