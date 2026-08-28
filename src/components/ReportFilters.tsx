"use client";

import { usePathname, useRouter } from "next/navigation";
import { TagChip } from "@/components/TagChip";
import type { PickerTag } from "@/components/ReportSettings";

/**
 * Filter the list by tag, and switch to the archive.
 *
 * State lives in the URL rather than component state, so a filtered view
 * is a link you can keep or send to someone — "all the Cosmetics bugs" is
 * a thing worth bookmarking.
 */
export function ReportFilters({
  allTags,
  selected,
  showArchived,
}: {
  allTags: PickerTag[];
  selected: string[];
  showArchived: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(next: string[], archived: boolean) {
    const q = new URLSearchParams();
    for (const t of next) q.append("tag", t);
    if (archived) q.set("archived", "1");
    const query = q.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const on = new Set(selected);

  // Grouped so "Progress" and "Priority" read as separate rows of filters
  // rather than one undifferentiated wall of chips.
  const groups = new Map<string, PickerTag[]>();
  for (const tag of allTags) {
    const key = tag.groupName ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), tag]);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {[...groups.entries()].map(([groupName, tags]) => (
          <div key={groupName} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {groupName}
            </span>
            {tags.map((tag) => (
              <button
                key={tag.id}
                aria-pressed={on.has(tag.id)}
                onClick={() =>
                  apply(
                    on.has(tag.id)
                      ? selected.filter((t) => t !== tag.id)
                      : [...selected, tag.id],
                    showArchived
                  )
                }
                className={`rounded-full transition ${
                  on.has(tag.id) ? "" : "opacity-40 hover:opacity-80"
                }`}
              >
                <TagChip tag={tag} />
              </button>
            ))}
          </div>
        ))}

        <label className="ml-auto flex shrink-0 items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => apply(selected, e.target.checked)}
          />
          Archived
        </label>
      </div>

      {(selected.length > 0 || showArchived) && (
        <button
          onClick={() => apply([], false)}
          className="w-fit text-xs text-zinc-500 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
