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
  zinc: "bg-zinc-100/50 text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800",
  emerald: "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  amber: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  red: "bg-red-50 text-red-900 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  sky: "bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20",
  indigo: "bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
  violet: "bg-violet-50 text-violet-900 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
  pink: "bg-pink-50 text-pink-900 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20",
};
