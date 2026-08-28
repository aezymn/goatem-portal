"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TagChip } from "@/components/TagChip";
import { TAG_TONES, type TagTone } from "@/lib/tagTones";

export interface TaxonomyEntry {
  id: string;
  name: string;
  reportCount?: number;
  tone?: string;
  groupId?: string | null;
  exclusive?: boolean;
}

type Kind = "categories" | "tags" | "groups";

const COPY: Record<Kind, { title: string; blurb: string; add: string; placeholder: string }> = {
  categories: {
    title: "Categories",
    blurb: "Which release or phase a bug belongs to. A report has one.",
    add: "Add category",
    placeholder: "Update v1.02",
  },
  groups: {
    title: "Tag types",
    blurb:
      "Kinds of tag. Mark a type exclusive and a report can only carry one tag from it — that's what stops a bug being both In progress and Complete.",
    add: "Add type",
    placeholder: "Area",
  },
  tags: {
    title: "Tags",
    blurb: "The labels themselves. Each one can belong to a type.",
    add: "Add tag",
    placeholder: "Needs repro",
  },
};

/**
 * Managing the curated lists. Categories, tag types and tags are all the
 * same shape of thing — an ordered list an admin maintains — so they're
 * one component with a `kind`.
 */
export function BugTaxonomyBoard({
  kind,
  entries,
  groups = [],
}: {
  kind: Kind;
  entries: TaxonomyEntry[];
  /** Only used by `tags`, to offer a type to file each tag under. */
  groups?: TaxonomyEntry[];
}) {
  const router = useRouter();
  const copy = COPY[kind];

  const [name, setName] = useState("");
  const [tone, setTone] = useState<TagTone>("zinc");
  const [groupId, setGroupId] = useState("");
  const [exclusive, setExclusive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  async function call(path: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await fetch(path, init).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "That didn't work.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: Record<string, unknown> = { name: name.trim() };
    if (kind === "tags") {
      payload.tone = tone;
      payload.groupId = groupId || null;
    }
    if (kind === "groups") payload.exclusive = exclusive;

    const ok = await call(`/api/admin/bug-taxonomy/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (ok) setName("");
  }

  /** Reorder by swapping with the neighbour and sending the whole list —
   * the API takes a full order, so a swap is just a local edit of the
   * array it already has. */
  async function move(index: number, delta: number) {
    const next = [...entries];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await call(`/api/admin/bug-taxonomy/${kind}/reorder`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order: next.map((e) => e.id) }),
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold uppercase tracking-wider">
        {copy.title}
      </h2>
      <p className="-mt-2 text-sm text-zinc-500">{copy.blurb}</p>

      <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
        {entries.length === 0 && (
          <li className="py-3 text-sm text-zinc-500">Nothing here yet.</li>
        )}
        {entries.map((entry, i) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="flex shrink-0 flex-col">
              <button
                aria-label="Move up"
                disabled={busy || i === 0}
                onClick={() => move(i, -1)}
                className="text-[10px] leading-none text-zinc-400 hover:text-zinc-900 disabled:opacity-25 dark:hover:text-zinc-100"
              >
                ▲
              </button>
              <button
                aria-label="Move down"
                disabled={busy || i === entries.length - 1}
                onClick={() => move(i, 1)}
                className="text-[10px] leading-none text-zinc-400 hover:text-zinc-900 disabled:opacity-25 dark:hover:text-zinc-100"
              >
                ▼
              </button>
            </span>

            {editing === entry.id ? (
              <>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  disabled={busy}
                  onClick={async () => {
                    const ok = await call(
                      `/api/admin/bug-taxonomy/${kind}/${entry.id}`,
                      {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ name: draftName.trim() }),
                      }
                    );
                    if (ok) setEditing(null);
                  }}
                  className="rounded-md bg-indigo-600 px-2.5 py-1 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-sm dark:border-zinc-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {kind === "tags" ? (
                  <TagChip tag={{ name: entry.name, tone: entry.tone ?? "zinc" }} />
                ) : (
                  <span className="text-sm font-medium">{entry.name}</span>
                )}

                {kind === "groups" && (
                  <label className="flex items-center gap-1 text-xs text-zinc-500">
                    <input
                      type="checkbox"
                      checked={entry.exclusive ?? false}
                      disabled={busy}
                      onChange={(e) =>
                        call(`/api/admin/bug-taxonomy/groups/${entry.id}`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            exclusive: e.target.checked,
                          }),
                        })
                      }
                    />
                    exclusive
                  </label>
                )}

                {entry.reportCount !== undefined && (
                  <span className="text-xs text-zinc-400">
                    {entry.reportCount}{" "}
                    {entry.reportCount === 1 ? "report" : "reports"}
                  </span>
                )}

                {kind === "tags" && (
                  <>
                    <select
                      value={entry.groupId ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        call(`/api/admin/bug-taxonomy/tags/${entry.id}`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            groupId: e.target.value || null,
                          }),
                        })
                      }
                      className="rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      <option value="">No type</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={entry.tone ?? "zinc"}
                      disabled={busy}
                      onChange={(e) =>
                        call(`/api/admin/bug-taxonomy/tags/${entry.id}`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ tone: e.target.value }),
                        })
                      }
                      className="rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      {TAG_TONES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setEditing(entry.id);
                      setDraftName(entry.name);
                    }}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                  >
                    Rename
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      const consequence =
                        kind === "categories"
                          ? `${entry.reportCount ?? 0} report(s) will become uncategorised.`
                          : kind === "groups"
                            ? "Its tags stay, but lose their type."
                            : `It'll be removed from ${entry.reportCount ?? 0} report(s).`;
                      if (!confirm(`Delete “${entry.name}”?\n\n${consequence}`))
                        return;
                      void call(`/api/admin/bug-taxonomy/${kind}/${entry.id}`, {
                        method: "DELETE",
                      });
                    }}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:hover:border-red-900 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={create} className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.placeholder}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        {kind === "tags" && (
          <>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">No type</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as TagTone)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {TAG_TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </>
        )}
        {kind === "groups" && (
          <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={exclusive}
              onChange={(e) => setExclusive(e.target.checked)}
            />
            exclusive
          </label>
        )}
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {copy.add}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
