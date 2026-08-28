import { describeAttachments } from "@/lib/attachments";

/**
 * Renders a message's attachments inline.
 *
 * Embeddable things (Medal clips, YouTube, Streamable) become players you
 * can watch without leaving the thread — that was the whole point of the
 * feature, since "here's my clip of it happening" is how a bug actually
 * gets explained. Everything else degrades: images render, direct video
 * files render, and anything unrecognised is a plain link rather than an
 * empty frame.
 */
export function AttachmentView({ urls }: { urls: string[] }) {
  const attachments = describeAttachments(urls);
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((a) => {
        if (a.embedUrl) {
          return (
            <div
              key={a.url}
              className="relative w-full overflow-hidden rounded-lg border border-zinc-200 bg-black dark:border-zinc-800"
              // 16:9, held by padding rather than an aspect-ratio class so
              // the iframe can be absolutely positioned inside it — the
              // players don't resize themselves.
              style={{ paddingBottom: "56.25%" }}
            >
              <iframe
                src={a.embedUrl}
                title={a.label}
                allow="encrypted-media *; fullscreen *"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          );
        }

        if (a.kind === "image") {
          return (
            <a key={a.url} href={a.url} target="_blank" rel="noreferrer noopener">
              {/* eslint-disable-next-line @next/next/no-img-element -- an arbitrary third-party URL someone pasted; next/image would need every possible host allowlisted */}
              <img
                src={a.url}
                alt="Attachment"
                loading="lazy"
                className="max-h-96 rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
              />
            </a>
          );
        }

        if (a.kind === "video") {
          return (
            <video
              key={a.url}
              src={a.url}
              controls
              preload="metadata"
              className="max-h-96 w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
            />
          );
        }

        return (
          <a
            key={a.url}
            href={a.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex w-fit max-w-full items-center gap-1.5 truncate rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              className="h-3.5 w-3.5 shrink-0"
            >
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
            </svg>
            <span className="truncate">{a.url}</span>
          </a>
        );
      })}
    </div>
  );
}
