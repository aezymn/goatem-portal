// One-off local smoke test, not part of the app — exercises the DB layer
// end to end (insert, soft-delete, audit log with jsonb metadata, enum
// column) against the local dev database. Not shipped, not referenced by
// any route; safe to delete after verifying, and not linked from package.json.
import { db } from "../src/db";
import { members, bugReports, comments, auditLog } from "../src/db/schema";
import { logAudit } from "../src/lib/audit";
import { eq } from "drizzle-orm";

async function main() {
  const [member] = await db
    .insert(members)
    .values({ robloxUsername: "SmokeTestUser", rank: "QA Tester", discordId: "999999999999999999" })
    .returning();
  console.log("inserted member:", member.id);

  const report = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(bugReports)
      .values({
        title: "Smoke test report",
        description: "Verifying the schema end to end.",
        reporterId: member.id,
      })
      .returning();
    await logAudit(tx, {
      actorDiscordId: member.discordId!,
      actorName: member.robloxUsername ?? member.id,
      action: "report.create",
      targetType: "bug_report",
      targetId: r.id,
      metadata: { title: r.title, nested: { ok: true } },
    });
    return r;
  });
  console.log("inserted report:", report.id, report.status);

  const [comment] = await db
    .insert(comments)
    .values({ body: "Looks good.", bugReportId: report.id, authorId: member.id })
    .returning();
  console.log("inserted comment:", comment.id);

  const [updated] = await db
    .update(bugReports)
    .set({ status: "RESOLVED", deletedAt: new Date() })
    .where(eq(bugReports.id, report.id))
    .returning();
  console.log("soft-deleted + resolved report:", updated.status, updated.deletedAt !== null);

  const auditRows = await db.select().from(auditLog).where(eq(auditLog.targetId, report.id));
  console.log("audit log entries for this report:", auditRows.length, auditRows[0]?.metadata);

  // cleanup
  await db.delete(comments).where(eq(comments.id, comment.id));
  await db.delete(bugReports).where(eq(bugReports.id, report.id));
  await db.delete(auditLog).where(eq(auditLog.targetId, report.id));
  await db.delete(members).where(eq(members.id, member.id));
  console.log("cleaned up smoke-test rows");

  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
