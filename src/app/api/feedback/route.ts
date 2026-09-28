import { NextResponse } from "next/server";
import { db } from "@/db";
import { feedbackReports } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { requireGuildMember } from "@/lib/requireSession";
import { isFullAdmin, hasAction } from "@/lib/permissions";
import type { RankAction } from "@/lib/permissions";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";

const createFeedbackSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  stepsToReproduce: z.string().max(5000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  attachments: z.array(z.string().url()).max(10).optional(),
});

function accessCtx(session: { user: { isCreator?: boolean; isPortalAdmin?: boolean; actions?: string[] } }) {
  return {
    isCreator: session.user.isCreator ?? false,
    isPortalAdmin: session.user.isPortalAdmin ?? false,
    actions: (session.user.actions ?? []) as RankAction[],
  };
}

/**
 * GET /api/feedback
 * - Full admins and reports.triage holders see ALL feedback.
 * - Everyone else (including Beta Testers) sees only their own submissions.
 */
export async function GET() {
  const auth = await requireGuildMember();
  if (!auth.ok) return auth.response;

  const { discordId } = auth.session.user;
  const ctx = accessCtx(auth.session);
  const canTriageAll = isFullAdmin(ctx) || hasAction(ctx, "reports.triage");

  const rows = await db
    .select()
    .from(feedbackReports)
    .where(
      canTriageAll
        ? isNull(feedbackReports.deletedAt)
        : eq(feedbackReports.submitterDiscordId, discordId)
    )
    .orderBy(desc(feedbackReports.createdAt));

  return NextResponse.json({ feedback: rows });
}

/**
 * POST /api/feedback
 * Any guild member can submit feedback — no roster membership required.
 */
export async function POST(request: Request) {
  const auth = await requireGuildMember();
  if (!auth.ok) return auth.response;

  const { discordId } = auth.session.user;

  if (!checkRateLimit(`feedback-create:${discordId}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many feedback submissions recently. Try again shortly." },
      { status: 429 }
    );
  }

  const parsed = createFeedbackSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Snapshot the submitter's Discord display name at submit time so the
  // report stays legible even if they change their username later.
  const username =
    auth.session.user.name ?? `discord:${discordId}`;
  const avatarUrl = auth.session.user.image ?? null;

  const [entry] = await db
    .insert(feedbackReports)
    .values({
      submitterDiscordId: discordId,
      submitterDiscordUsername: username,
      submitterAvatarUrl: avatarUrl,
      title: parsed.data.title,
      description: parsed.data.description,
      stepsToReproduce: parsed.data.stepsToReproduce ?? null,
      severity: parsed.data.severity,
      attachments: parsed.data.attachments ?? [],
    })
    .returning();

  return NextResponse.json({ feedback: entry }, { status: 201 });
}
