import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireAdmin } from "@/lib/requireSession";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { reorder } from "@/lib/bugTaxonomy";
import { reorderTaxonomySchema } from "@/lib/validation";

/**
 * Sets the order of categories, tags or tag types from a full ordered
 * list of ids. Ids that aren't recognised are simply skipped by reorder()
 * rather than erroring, so a stale client can't corrupt entries it
 * doesn't know about — same rule as the ranks ladder.
 */
export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/admin/bug-taxonomy/[kind]/reorder">
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { kind } = await ctx.params;
  if (kind !== "categories" && kind !== "tags" && kind !== "groups") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = reorderTaxonomySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await reorder(kind, parsed.data.order);

  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);
  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: actor ? displayNameFor(actor) : discordId,
    action: `${kind}.reorder`,
    targetType: kind,
    metadata: { order: parsed.data.order },
  });

  return NextResponse.json({ ok: true });
}
