"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TagChip } from "@/components/TagChip";

export interface PickerTag {
  id: string;
  name: string;
  tone: string;
  groupId: string | null;
  groupName: string | null;
  groupExclusive: boolean | null;
}

/**
 * Category and tags, tucked into a popover under the Delete button.
 *
 * These used to be a permanently-open panel across the top of the report,
 * which took more room than the bug itself for something you touch once
 * or twice in a report's life.
 */
export function ReportSettings({
  reportId,
  allTags,
  allCategories,
  selectedTagIds,
  categoryId,
}: {
  reportId: string;
  allTags: PickerTag[];
  allCategories: { id: string; name: string }[];
  selectedTagIds: string[];
  categoryId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(selectedTagIds);
  const [category, setCategory] = useState<string | null>(categoryId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Couldn't save that.");
      return;
    }
    router.refresh();
  }

  function toggleTag(tag: PickerTag) {
    let next: string[];
    if (selected.includes(tag.id)) {
      next = selected.filter((t) => t !== tag.id);
    } else if (tag.groupExclusive && tag.groupId) {
      // Picking one from an exclusive type replaces whatever else was
      // chosen from it — a bug is In progress or Complete, not both. The
      // server enforces the same rule; this just makes the UI agree
      // instead of showing an impossible state for a moment.
      const siblings = new Set(
        allTags.filter((t) => t.groupId === tag.groupId).map((t) => t.id)
      );
      next = [...selected.filter((t) => !siblings.has(t)), tag.id];
    } else {
      next = [...selected, tag.id];
    }
    setSelected(next);
    void save({ tagIds: next });
  }

  // Grouped, with ungrouped tags gathered at the end under "Other".
  const groups = new Map<string, PickerTag[]>();
  for (const tag of allTags) {
    const key = tag.groupName ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), tag]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          className="h-4 w-4"
        >
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-3-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.1a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2v-.1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 3 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
        Settings
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Category
            <select
              value={category ?? ""}
              disabled={busy}
              onChange={(e) => {
                const value = e.target.value || null;
                setCategory(value);
                void save({ categoryId: value });
              }}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="">Uncategorised</option>
              {allCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {allTags.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">
              No tags exist yet — add them under Admin → Bug setup.
            </p>
          ) : (
            [...groups.entries()].map(([groupName, tags]) => (
              <div key={groupName} className="mt-3 flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  {groupName}
                  {tags[0]?.groupExclusive && (
                    <span className="ml-1 font-normal normal-case tracking-normal">
                      (pick one)
                    </span>
                  )}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const on = selected.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        disabled={busy}
                        onClick={() => toggleTag(tag)}
                        aria-pressed={on}
                        className={`rounded-full transition disabled:opacity-50 ${
                          on ? "" : "opacity-40 hover:opacity-80"
                        }`}
                      >
                        <TagChip tag={tag} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
