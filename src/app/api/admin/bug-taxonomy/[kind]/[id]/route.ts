import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireAdmin } from "@/lib/requireSession";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import {
  asTagTone,
  deleteCategory,
  deleteTag,
  renameCategory,
  updateTag,
} from "@/lib/bugTaxonomy";
import { updateCategorySchema, updateTagSchema } from "@/lib/validation";

type Kind = "categories" | "tags";

function kindOf(raw: string): Kind | null {
  return raw === "categories" || raw === "tags" ? raw : null;
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/bug-taxonomy/[kind]/[id]">
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { kind: rawKind, id } = await ctx.params;
  const kind = kindOf(rawKind);
  if (!kind) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);
  const body = await request.json();

  const parsed =
    kind === "categories"
      ? updateCategorySchema.safeParse(body)
      : updateTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    if (kind === "categories") {
      await renameCategory(id, parsed.data.name!);
    } else {
      const changes = parsed.data as { name?: string; tone?: string };
      await updateTag(id, {
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.tone !== undefined
          ? { tone: asTagTone(changes.tone) }
          : {}),
      });
    }
  } catch (err) {
    if (String(err).includes("unique")) {
      return NextResponse.json(
        { error: "Something else already has that name." },
        { status: 409 }
      );
    }
    throw err;
  }

  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor ? displayNameFor(actor) : discordId,
    action: kind === "categories" ? "category.update" : "tag.update",
    targetType: kind === "categories" ? "bug_category" : "bug_tag",
    targetId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true });
}

// Unlike reports, these are real deletes. A category or tag carries no
// history of its own — reports keep theirs either way, becoming
// uncategorised (ON DELETE SET NULL) or simply losing the label.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/bug-taxonomy/[kind]/[id]">
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { kind: rawKind, id } = await ctx.params;
  const kind = kindOf(rawKind);
  if (!kind) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  if (kind === "categories") await deleteCategory(id);
  else await deleteTag(id);

  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor ? displayNameFor(actor) : discordId,
    action: kind === "categories" ? "category.delete" : "tag.delete",
    targetType: kind === "categories" ? "bug_category" : "bug_tag",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
