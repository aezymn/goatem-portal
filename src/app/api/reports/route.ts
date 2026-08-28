import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugReports, members } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { requireRosterMember } from "@/lib/requireSession";
import { createReportSchema } from "@/lib/validation";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rateLimit";
import { categoryExists, setReportTags, tagsForReports } from "@/lib/bugTaxonomy";
import { joinReport } from "@/lib/reports";

export async function GET() {
  const auth = await requireRosterMember();
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      categoryId: bugReports.categoryId,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      reporterUsername: members.robloxUsername,
    })
    .from(bugReports)
    .innerJoin(members, eq(bugReports.reporterId, members.id))
    .where(isNull(bugReports.deletedAt))
    .orderBy(desc(bugReports.createdAt));

  const tags = await tagsForReports(rows.map((r) => r.id));
  return NextResponse.json({
    reports: rows.map((r) => ({ ...r, tags: tags.get(r.id) ?? [] })),
  });
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

  // An unknown category is dropped rather than rejected: the report
  // itself is the thing worth saving, and landing it uncategorised beats
  // losing someone's write-up to a stale dropdown.
  const categoryId =
    parsed.data.categoryId && (await categoryExists(parsed.data.categoryId))
      ? parsed.data.categoryId
      : null;

  const report = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(bugReports)
      .values({
        title: parsed.data.title,
        description: parsed.data.description,
        reporterId: reporterMember.id,
        categoryId,
        attachments: parsed.data.attachments ?? [],
      })
      .returning();

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: displayNameFor(reporterMember),
      action: "report.create",
      targetType: "bug_report",
      targetId: created.id,
      metadata: { title: created.title },
    });

    return created;
  });

  // Filing a bug puts you on it — you don't then have to join your own
  // report to appear in its member list.
  await joinReport(report.id, reporterMember.id);
  if (parsed.data.tagIds?.length) {
    await setReportTags(report.id, parsed.data.tagIds);
  }

  return NextResponse.json({ report }, { status: 201 });
}
