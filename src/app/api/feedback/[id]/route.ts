import { NextResponse } from "next/server";
import { db } from "@/db";
import { feedbackReports } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { requireGuildMember } from "@/lib/requireSession";
import { isFullAdmin, hasAction } from "@/lib/permissions";
import type { RankAction } from "@/lib/permissions";
import { z } from "zod";

const updateFeedbackSchema = z.object({
  status: z.enum(["new", "reviewed", "dismissed"]).optional(),
});

function accessCtx(session: { user: { isCreator?: boolean; isPortalAdmin?: boolean; actions?: string[] } }) {
  return {
    isCreator: session.user.isCreator ?? false,
    isPortalAdmin: session.user.isPortalAdmin ?? false,
    actions: (session.user.actions ?? []) as RankAction[],
  };
}

/**
 * PATCH /api/feedback/[id]
 * Triagers (reports.triage or full admin) can update the status of a
 * feedback entry to "reviewed" or "dismissed".
 * (Escalation has its own dedicated POST /api/feedback/[id]/escalate)
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/feedback/[id]">
) {
  const auth = await requireGuildMember();
  if (!auth.ok) return auth.response;

  const c = accessCtx(auth.session);
  if (!isFullAdmin(c) && !hasAction(c, "reports.triage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const [existing] = await db
    .select()
    .from(feedbackReports)
    .where(
      and(eq(feedbackReports.id, id), isNull(feedbackReports.deletedAt))
    );

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Can't re-update an already escalated entry.
  if (existing.status === "escalated") {
    return NextResponse.json(
      { error: "This feedback has already been escalated to a bug report." },
      { status: 409 }
    );
  }

  const parsed = updateFeedbackSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { discordId } = auth.session.user;
  // Look up the reviewer's member row so we can record who acted on it.
  const { getMemberByDiscordId } = await import("@/lib/members");
  const reviewer = await getMemberByDiscordId(discordId);

  const [updated] = await db
    .update(feedbackReports)
    .set({
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      reviewedById: reviewer?.id ?? null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(feedbackReports.id, id))
    .returning();

  return NextResponse.json({ feedback: updated });
}
