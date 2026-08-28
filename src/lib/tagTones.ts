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
  zinc: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
  emerald:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-900",
  amber:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-900",
  red: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-400 dark:ring-red-900",
  sky: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:ring-sky-900",
  indigo:
    "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900",
  violet:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900",
  pink: "bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:ring-pink-900",
};
