/**
 * Attachments are links, not uploads — the portal never hosts media, it
 * points at where the media already lives. That keeps storage, quotas and
 * moderation out of scope entirely, and a Medal clip is already a URL
 * somebody has in their clipboard.
 *
 * This module's whole job is turning a pasted URL into "how should this
 * be shown". Anything it doesn't recognise degrades to a plain link
 * rather than a broken frame.
 */

export type AttachmentKind = "medal" | "youtube" | "streamable" | "image" | "video" | "link";

export interface Attachment {
  /** The original URL, as pasted — always what the "open" link points at. */
  url: string;
  kind: AttachmentKind;
  /** Where an <iframe> should point for the embeddable kinds. */
  embedUrl?: string;
  /** Short human label for the link fallback. */
  label: string;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
const VIDEO_EXT = /\.(mp4|webm|ogv)$/i;

/**
 * Only http(s) is ever accepted. This is the one function that decides
 * whether a string is allowed to become an href or an iframe src at all,
 * so javascript:, data: and friends have to die here — everything
 * downstream trusts that this said yes.
 */
export function parseAttachmentUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url;
}

export function isValidAttachmentUrl(raw: string): boolean {
  return parseAttachmentUrl(raw) !== null;
}

/** Hostname without "www.", so medal.tv and www.medal.tv are one thing. */
function host(url: URL): string {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

export function describeAttachment(raw: string): Attachment | null {
  const url = parseAttachmentUrl(raw);
  if (!url) return null;

  const h = host(url);
  const segments = url.pathname.split("/").filter(Boolean);

  // An http:// subresource on an https:// page is mixed content and the
  // browser blocks it, so promising to embed one would just render a
  // broken box. Links are fine over http — those aren't subresources —
  // so it degrades to a link rather than being rejected.
  if (url.protocol !== "https:") {
    return { url: raw, kind: "link", label: h };
  }

  // Medal share links look like /games/<game>/clips/<clipId>/<hash>, while
  // the embeddable player is the same path with a singular "clip" and no
  // hash. Verified against Medal's published embed code rather than
  // guessed — see docs.medal.tv.
  if (h === "medal.tv") {
    const clipsAt = segments.findIndex((s) => s === "clips" || s === "clip");
    const clipId = clipsAt >= 0 ? segments[clipsAt + 1] : undefined;
    if (clipId) {
      const game =
        segments[0] === "games" && segments[1] ? segments[1] : undefined;
      return {
        url: raw,
        kind: "medal",
        embedUrl: game
          ? `https://medal.tv/games/${game}/clip/${clipId}`
          : `https://medal.tv/clip/${clipId}`,
        label: "Medal clip",
      };
    }
  }

  if (h === "youtube.com" || h === "youtu.be" || h === "m.youtube.com") {
    let videoId: string | undefined;
    if (h === "youtu.be") videoId = segments[0];
    else if (segments[0] === "shorts" || segments[0] === "embed")
      videoId = segments[1];
    else videoId = url.searchParams.get("v") ?? undefined;

    // YouTube IDs are 11 characters of [A-Za-z0-9_-]. Checking the shape
    // keeps a malformed link out of an iframe src.
    if (videoId && /^[\w-]{11}$/.test(videoId)) {
      return {
        url: raw,
        kind: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        label: "YouTube video",
      };
    }
  }

  if (h === "streamable.com" && segments[0] && segments[0] !== "e") {
    return {
      url: raw,
      kind: "streamable",
      embedUrl: `https://streamable.com/e/${segments[0]}`,
      label: "Streamable video",
    };
  }

  if (IMAGE_EXT.test(url.pathname)) {
    return { url: raw, kind: "image", label: "Image" };
  }
  if (VIDEO_EXT.test(url.pathname)) {
    return { url: raw, kind: "video", label: "Video" };
  }

  return { url: raw, kind: "link", label: h };
}

export function describeAttachments(raws: string[] | null | undefined): Attachment[] {
  if (!raws) return [];
  return raws
    .map(describeAttachment)
    .filter((a): a is Attachment => a !== null);
}

/** Hosts whose players are allowed in an iframe. Kept beside the parser
 * that produces those URLs, and mirrored in next.config.ts's
 * frame-src — if the two ever disagree, the CSP wins and the embed
 * silently shows nothing, so they're commented as a pair. */
export const EMBED_FRAME_HOSTS = [
  "https://medal.tv",
  "https://www.youtube-nocookie.com",
  "https://streamable.com",
];
