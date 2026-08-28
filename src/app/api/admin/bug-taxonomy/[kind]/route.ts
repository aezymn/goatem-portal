import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireAdmin } from "@/lib/requireSession";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import {
  asTagTone,
  createCategory,
  createTag,
  listCategories,
  listTags,
} from "@/lib/bugTaxonomy";
import { createCategorySchema, createTagSchema } from "@/lib/validation";

/**
 * Categories and tags share one route because they're the same shape of
 * thing — a curated list an admin maintains and everyone else picks from.
 * The [kind] segment picks which, rather than duplicating the whole file.
 */

type Kind = "categories" | "tags";

function kindOf(raw: string): Kind | null {
  return raw === "categories" || raw === "tags" ? raw : null;
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/admin/bug-taxonomy/[kind]">
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const kind = kindOf((await ctx.params).kind);
  if (!kind) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(
    kind === "categories"
      ? { categories: await listCategories() }
      : { tags: await listTags() }
  );
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/bug-taxonomy/[kind]">
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const kind = kindOf((await ctx.params).kind);
  if (!kind) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const body = await request.json();
  const parsed =
    kind === "categories"
      ? createCategorySchema.safeParse(body)
      : createTagSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const created =
      kind === "categories"
        ? await createCategory(parsed.data.name)
        : await createTag(
            parsed.data.name,
            asTagTone(
              "tone" in parsed.data
                ? (parsed.data.tone as string | undefined)
                : undefined
            )
          );

    await logAudit(db, {
      actorDiscordId: discordId,
      actorName: actor ? displayNameFor(actor) : discordId,
      action: kind === "categories" ? "category.create" : "tag.create",
      targetType: kind === "categories" ? "bug_category" : "bug_tag",
      targetId: created?.id,
      metadata: { name: parsed.data.name },
    });

    return NextResponse.json({ created }, { status: 201 });
  } catch (err) {
    // The name is UNIQUE, so a duplicate is a real answer to give back
    // rather than a 500 — this is the only way this insert fails.
    if (String(err).includes("unique")) {
      return NextResponse.json(
        { error: `A ${kind === "categories" ? "category" : "tag"} called “${parsed.data.name}” already exists.` },
        { status: 409 }
      );
    }
    throw err;
  }
}
