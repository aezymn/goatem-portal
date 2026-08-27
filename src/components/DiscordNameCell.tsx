"use client";

import { useState } from "react";

/**
 * The Discord name, with the numeric ID available on hover and copied on
 * click. This replaces the old always-visible "Discord ID" column: the ID
 * is still needed occasionally (bot commands, database work) but it's
 * noise to look at, so it lives behind the name instead.
 */
export function DiscordNameCell({
  discordUsername,
  discordId,
}: {
  discordUsername: string | null;
  discordId: string | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!discordId) {
    return <span className="text-zinc-400">—</span>;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(discordId!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure context, permissions). Say so
      // rather than silently appearing to do nothing.
      setCopied(false);
      alert(`Couldn't copy automatically. Discord ID: ${discordId}`);
    }
  }

  return (
    <button
      onClick={copy}
      title={`${discordId} — click to copy`}
      className="group inline-flex items-center gap-1.5 text-left hover:underline"
    >
      <span>{discordUsername ?? "(unknown name)"}</span>
      <span
        className={`text-xs ${
          copied ? "text-emerald-500" : "text-zinc-400 opacity-0 group-hover:opacity-100"
        }`}
      >
        {copied ? "copied" : "copy ID"}
      </span>
    </button>
  );
}
