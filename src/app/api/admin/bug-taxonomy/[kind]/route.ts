import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireAction } from "@/lib/requireSession";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import {
  asTagTone,
  createCategory,
  createTag,
  createTagGroup,
  listCategories,
  listTagGroups,
  listTags,
} from "@/lib/bugTaxonomy";
import {
  createCategorySchema,
  createTagGroupSchema,
  createTagSchema,
} from "@/lib/validation";

/**
 * Categories and tags share one route because they're the same shape of
 * thing — a curated list an admin maintains and everyone else picks from.
 * The [kind] segment picks which, rather than duplicating the whole file.
 */

type Kind = "categories" | "tags" | "groups";

function kindOf(raw: string): Kind | null {
  return raw === "categories" || raw === "tags" || raw === "groups"
    ? raw
    : null;
}

const LABEL: Record<Kind, string> = {
  categories: "category",
  tags: "tag",
  groups: "tag type",
};

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/admin/bug-taxonomy/[kind]">
) {
  const auth = await requireAction("bugsetup.manage");
  if (!auth.ok) return auth.response;
  const kind = kindOf((await ctx.params).kind);
  if (!kind) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (kind === "categories")
    return NextResponse.json({ categories: await listCategories() });
  if (kind === "groups")
    return NextResponse.json({ groups: await listTagGroups() });
  return NextResponse.json({ tags: await listTags() });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/bug-taxonomy/[kind]">
) {
  const auth = await requireAction("bugsetup.manage");
  if (!auth.ok) return auth.response;
  const kind = kindOf((await ctx.params).kind);
  if (!kind) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const body = await request.json();
  const parsed =
    kind === "categories"
      ? createCategorySchema.safeParse(body)
      : kind === "groups"
        ? createTagGroupSchema.safeParse(body)
        : createTagSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const data = parsed.data as {
      name: string;
      tone?: string;
      groupId?: string | null;
      exclusive?: boolean;
      locksReport?: boolean;
    };

    const created =
      kind === "categories"
        ? await createCategory(data.name)
        : kind === "groups"
          ? await createTagGroup(data.name, data.exclusive === true)
          : await createTag(
              data.name,
              asTagTone(data.tone),
              data.groupId ?? null,
              data.locksReport === true
            );

    await logAudit(db, {
      actorDiscordId: discordId,
      actorName: actor ? displayNameFor(actor) : discordId,
      action: `${LABEL[kind].replace(" ", "_")}.create`,
      targetType: kind,
      targetId: created?.id,
      metadata: { name: data.name },
    });

    return NextResponse.json({ created }, { status: 201 });
  } catch (err) {
    // The name is UNIQUE, so a duplicate is a real answer to give back
    // rather than a 500 — this is the only way this insert fails.
    if (String(err).includes("unique")) {
      return NextResponse.json(
        {
          error: `A ${LABEL[kind]} called “${parsed.data.name}” already exists.`,
        },
        { status: 409 }
      );
    }
    throw err;
  }
}
