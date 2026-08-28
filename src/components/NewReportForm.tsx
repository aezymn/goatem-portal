"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttachmentFields } from "@/components/AttachmentFields";
import { TagChip, type TagSummary } from "@/components/TagChip";

export function NewReportForm({
  categories,
  tags,
}: {
  categories: { id: string; name: string }[];
  tags: TagSummary[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        categoryId: categoryId || null,
        tagIds,
        attachments,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setSubmitting(false);
      return;
    }

    const { report } = await res.json();
    router.push(`/reports/${report.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        File a bug report
      </h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Short summary of the problem"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description
          <textarea
            required
            minLength={1}
            maxLength={5000}
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="What happened, what did you expect, how to reproduce it, etc."
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {tags.length > 0 && (
          <div className="flex flex-col gap-1.5 text-sm">
            Tags
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const on = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setTagIds((prev) =>
                        prev.includes(tag.id)
                          ? prev.filter((t) => t !== tag.id)
                          : [...prev, tag.id]
                      )
                    }
                    className={`rounded-full transition ${
                      on ? "" : "opacity-40 hover:opacity-80"
                    }`}
                  >
                    <TagChip tag={tag} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5 text-sm">
          Attachments
          <p className="-mt-1 text-xs text-zinc-500">
            Paste a Medal clip, YouTube link or image URL — it&apos;ll play
            inline in the thread.
          </p>
          <AttachmentFields urls={attachments} onChange={setAttachments} />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </div>
  );
}
