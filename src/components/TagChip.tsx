import { TAG_TONE_CLASSES, asTagTone } from "@/lib/tagTones";

export interface TagSummary {
  id: string;
  name: string;
  tone: string;
}

/** One tag. The tone is a palette name, never a raw colour — see
 * src/lib/tagTones.ts for why. */
export function TagChip({
  tag,
  size = "sm",
}: {
  tag: Pick<TagSummary, "name" | "tone">;
  size?: "sm" | "xs";
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md font-medium border transition-colors ${
        size === "xs" ? "px-1.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
      } ${TAG_TONE_CLASSES[asTagTone(tag.tone)]}`}
    >
      {tag.name}
    </span>
  );
}
