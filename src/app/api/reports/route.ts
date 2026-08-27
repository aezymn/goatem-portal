import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugReports, members } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { createReportSchema } from "@/lib/validation";
import { getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET() {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      reporterUsername: members.robloxUsername,
    })
    .from(bugReports)
    .innerJoin(members, eq(bugReports.reporterId, members.id))
    .where(isNull(bugReports.deletedAt))
    .orderBy(desc(bugReports.createdAt));

  return NextResponse.json({ reports: rows });
}

export async function POST(request: Request) {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;

  if (!checkRateLimit(`report-create:${discordId}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many reports filed recently. Try again shortly." },
      { status: 429 }
    );
  }

  const reporterMember = await getMemberByDiscordId(discordId);
  if (!reporterMember) {
    return NextResponse.json(
      {
        error:
          "You're logged in but not yet on the roster — ask an admin to add you before filing a report.",
      },
      { status: 409 }
    );
  }

  const parsed = createReportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const report = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(bugReports)
      .values({
        title: parsed.data.title,
        description: parsed.data.description,
        reporterId: reporterMember.id,
      })
      .returning();

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: reporterMember.robloxUsername,
      action: "report.create",
      targetType: "bug_report",
      targetId: created.id,
      metadata: { title: created.title },
    });

    return created;
  });

  return NextResponse.json({ report }, { status: 201 });
}
