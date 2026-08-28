"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TagChip, type TagSummary } from "@/components/TagChip";

/**
 * The category and tag controls on a report, for people who hold
 * reports.triage. Everyone else sees the same tags rendered read-only by
 * the page itself — this component is never sent to them.
 */
export function ReportTriage({
  reportId,
  allTags,
  allCategories,
  selectedTagIds,
  categoryId,
}: {
  reportId: string;
  allTags: TagSummary[];
  allCategories: { id: string; name: string }[];
  selectedTagIds: string[];
  categoryId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(selectedTagIds);
  const [category, setCategory] = useState<string | null>(categoryId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function toggleTag(id: string) {
    // Updated locally first so the chip responds immediately; the refresh
    // that follows re-reads the server's version either way.
    const next = selected.includes(id)
      ? selected.filter((t) => t !== id)
      : [...selected, id];
    setSelected(next);
    void save({ tagIds: next });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="report-category"
          className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
        >
          Category
        </label>
        <select
          id="report-category"
          value={category ?? ""}
          disabled={busy}
          onChange={(e) => {
            const value = e.target.value || null;
            setCategory(value);
            void save({ categoryId: value });
          }}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Uncategorised</option>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Tags
        </span>
        {allTags.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No tags exist yet — an admin can add them under Admin → Bug
            setup.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => {
              const on = selected.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  disabled={busy}
                  onClick={() => toggleTag(tag.id)}
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
        )}
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
