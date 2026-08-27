import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, asc, eq, ilike, isNull, ne } from "drizzle-orm";
import { requireCreator } from "@/lib/requireSession";
import { addAdminSchema } from "@/lib/validation";
import { getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";

// Everything here is CREATOR-only — see src/lib/permissions.ts for why
// designating full admin access is deliberately not shared even with
// existing portal admins. src/proxy.ts already redirects non-creators
// away from /admin/admins before this ever renders; this is the real
// enforcement underneath.

// GET: the current admin list, plus (with ?search=) roster members that
// match by Roblox username and aren't already admins — candidates for
// the "add" search bar.
export async function GET(request: Request) {
  const auth = await requireCreator();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim();

  const admins = await db
    .select()
    .from(members)
    .where(and(eq(members.isPortalAdmin, true), isNull(members.deletedAt)))
    .orderBy(asc(members.robloxUsername));

  let candidates: typeof admins = [];
  if (search) {
    candidates = await db
      .select()
      .from(members)
      .where(
        and(
          ilike(members.robloxUsername, `%${search}%`),
          eq(members.isPortalAdmin, false),
          isNull(members.deletedAt)
        )
      )
      .orderBy(asc(members.robloxUsername))
      .limit(10);
  }

  return NextResponse.json({ admins, candidates });
}

export async function POST(request: Request) {
  const auth = await requireCreator();
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;
  const actor = await getMemberByDiscordId(discordId);

  const parsed = addAdminSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(members)
      .set({ isPortalAdmin: true, updatedAt: new Date() })
      .where(
        and(eq(members.id, parsed.data.memberId), isNull(members.deletedAt), ne(members.isPortalAdmin, true))
      )
      .returning();
    if (!row) return null;

    await logAudit(tx, {
      actorDiscordId: discordId,
      actorName: actor?.robloxUsername ?? discordId,
      action: "admin.grant",
      targetType: "member",
      targetId: row.id,
      metadata: { robloxUsername: row.robloxUsername },
    });
    return row;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Member not found or already an admin." },
      { status: 404 }
    );
  }
  return NextResponse.json({ member: updated });
}
