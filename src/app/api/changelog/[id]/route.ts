import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireAction } from "@/lib/requireSession";
import { hasAction } from "@/lib/permissions";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import {
  deletePost,
  getPost,
  setPostStatus,
  updatePost,
  type PostStatus,
} from "@/lib/changelog";
import { parseVersion } from "@/lib/versions";
import { updateChangelogPostSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/changelog/[id]">
) {
  const auth = await requireAction("changelog.write");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  const actor = await getMemberByDiscordId(discordId);
  if (!actor) {
    return NextResponse.json({ error: "You're not on the roster." }, { status: 409 });
  }
  if (!(await getPost(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = updateChangelogPostSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { title, body, version, status } = parsed.data;

  // Publishing is a separate grant from writing: whoever drafts a release
  // note isn't automatically the person who decides it goes out. Pulling
  // one back to draft is treated the same way — unpublishing is a
  // publishing decision.
  if (status === "published" || (status && status !== "pending")) {
    if (!hasAction(auth.session.user, "changelog.approve")) {
      return NextResponse.json(
        { error: "You can draft and submit, but not publish." },
        { status: 403 }
      );
    }
  }

  const parsedVersion = version ? parseVersion(version) : undefined;
  if (version && !parsedVersion) {
    return NextResponse.json(
      { error: "Versions look like 0.9 or 0.9.1" },
      { status: 400 }
    );
  }

  if (title !== undefined || body !== undefined || parsedVersion) {
    await updatePost(id, {
      ...(title !== undefined ? { title } : {}),
      ...(body !== undefined ? { body } : {}),
      ...(parsedVersion ? { version: parsedVersion } : {}),
    });
  }

  if (status) {
    await setPostStatus(id, status as PostStatus, actor.id);
  }

  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: displayNameFor(actor),
    action: status ? `changelog.${status}` : "changelog.update",
    targetType: "changelog_post",
    targetId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/changelog/[id]">
) {
  const auth = await requireAction("changelog.approve");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { discordId } = auth.session.user;

  if (!(await getPost(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await deletePost(id);
  const actor = await getMemberByDiscordId(discordId);
  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor ? displayNameFor(actor) : discordId,
    action: "changelog.delete",
    targetType: "changelog_post",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
