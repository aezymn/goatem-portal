"use client";

import { useState } from "react";
import { isValidAttachmentUrl } from "@/lib/attachments";

const MAX = 8;

/**
 * The "paste a link" input, shared by the report form and the reply box.
 *
 * Controlled from the parent so the parent owns the list it's going to
 * submit — this component only handles adding and removing, and rejects a
 * URL the server would reject anyway, in the same words.
 */
export function AttachmentFields({
  urls,
  onChange,
  compact = false,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const value = draft.trim();
    if (!value) return;
    if (!isValidAttachmentUrl(value)) {
      setError("That needs to be a http(s) link.");
      return;
    }
    if (urls.includes(value)) {
      setError("That link is already attached.");
      return;
    }
    if (urls.length >= MAX) {
      setError(`${MAX} attachments is the limit.`);
      return;
    }
    onChange([...urls, value]);
    setDraft("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          // Enter adds the link rather than submitting the whole form,
          // which is what someone pasting three clips in a row expects.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={
            compact ? "Attach a link…" : "Medal clip, YouTube, image URL…"
          }
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Attach
        </button>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {urls.length > 0 && (
        <ul className="flex flex-col gap-1">
          {urls.map((url) => (
            <li
              key={url}
              className="flex items-center gap-2 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs dark:bg-zinc-900"
            >
              <span className="min-w-0 flex-1 truncate">{url}</span>
              <button
                type="button"
                onClick={() => onChange(urls.filter((u) => u !== url))}
                aria-label={`Remove ${url}`}
                className="shrink-0 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
