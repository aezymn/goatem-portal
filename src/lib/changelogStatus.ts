/**
 * Post status, in its own module with no database import so client
 * components can render a status pill without dragging the server-only
 * query layer into the browser bundle. (Same reason as src/lib/tagTones.)
 */

export type PostStatus = "draft" | "pending" | "published";

export function asPostStatus(value: string): PostStatus {
  return value === "pending" || value === "published" ? value : "draft";
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  pending: "Awaiting approval",
  published: "Published",
};
