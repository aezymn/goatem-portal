# Goatem Studios Portal — setup

This is phase 1 of the custom replacement we talked through: bug/issue
tracking (the piece neither Hyra nor FiveRoster had), plus a basic roster
view, both gated behind Discord login (you must be a current member of the
guild). What someone can actually *do* once logged in is decided entirely
inside the app — rank eligibility plus an explicit per-person grant, never
by which Discord role they happen to hold — see §5b below. Analytics, LOA,
and activity-status stay on the sheet for now and migrate over in later
phases.

Everything below assumes zero CLI use after the very first setup — once
it's connected to GitHub, Vercel deploys automatically every time code
changes, the same way you asked for.

## What you'll need accounts for (all free)

- **GitHub** — holds the code. If you don't have an account, sign up at
  github.com.
- **GitHub Desktop** — a normal Windows app (not a terminal) for getting
  code onto GitHub and pushing updates later. Download from
  desktop.github.com.
- **Vercel** — hosting. Sign up at vercel.com (can use your GitHub account
  to sign up, which also makes the next step easier).
- **Neon** (neon.tech) or **Supabase** (supabase.com) — the database.
  Either works fine; Neon's free tier is what this was built and tested
  against, but nothing here is Neon-specific.
- Your **existing Discord Application** (the one behind your bot) — not a
  new one. We're adding a "login with Discord" capability to it, not
  creating a second bot.

## 1. Get the code onto GitHub

1. Open GitHub Desktop, sign in with your GitHub account.
2. **File → Add Local Repository**, point it at this `goatem-portal`
   folder.
3. It'll offer to initialize it as a repository if it isn't already —
   accept that.
4. Click **Publish repository** in the top bar. Keep it **private** (this
   is an internal tool). That's it — no commands.

Every time I hand you an updated version of this project later, the
workflow is: copy the new files over this folder (overwriting), open
GitHub Desktop, you'll see the changed files listed, write a one-line
summary, click **Commit to main**, then **Push origin**. Vercel picks it
up automatically within about a minute.

## 2. Set up the database

1. Create a free Postgres project on Neon or Supabase.
2. Copy its connection string — Neon calls it a "connection string,"
   Supabase shows it under Project Settings → Database → Connection
   string (choose the "URI" / pooled connection option). It looks like
   `postgresql://user:password@host/dbname?sslmode=require`.
3. Keep this handy for step 4 — this becomes `DATABASE_URL`. You never run
   a migration command by hand: it's wired into the build (see
   `package.json`), so every deploy automatically brings the database
   schema up to date on its own.

## 3. Deploy to Vercel

1. On vercel.com, **Add New → Project**, and import the GitHub repo you
   just published.
2. Before clicking Deploy, open **Environment Variables** and add every
   variable listed in `.env.example` in this project — real values this
   time, not the placeholders. A few notes:
   - `DATABASE_URL` — from step 2.
   - `NEXTAUTH_SECRET` — a random secret, not something to reuse from
     anywhere else. Generate one yourself (don't ask me to hand you one —
     a secret I typed into this chat is no longer really secret). Easiest
     way: open a browser console or GitHub Desktop's terminal-free... 
     actually simplest of all — search "random password generator 32
     characters" and use any reputable one, or if you're comfortable
     opening PowerShell just this once: 
     `[Convert]::ToBase64String((1..32|%{Get-Random -Max 256}))`
   - `NEXTAUTH_URL` — leave blank for now, come back to this in step 3b.
   - `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — from step 4 below;
     you can deploy once without these and add them after, then redeploy.
   - `DISCORD_GUILD_ID` — from step 5 below.
   - `AUDIT_WEBHOOK_URL` — optional, from step 6 below.
3. Click **Deploy**. First deploy takes a minute or two.
4. Once it's live, Vercel shows you a URL like
   `https://goatem-portal-xyz.vercel.app`. Go back into **Settings →
   Environment Variables**, set `NEXTAUTH_URL` to that exact URL (no
   trailing slash), and redeploy (Vercel's dashboard has a "Redeploy"
   button — still no CLI).

## 4. Discord application for login

Use a dedicated Discord Application for the portal rather than your
original bot's — cleaner separation, and this app doesn't need to touch
your existing bot's token or behavior at all.

1. On the [Discord Developer Portal](https://discord.com/developers/applications),
   click **New Application**, name it something recognizable (e.g. "Goatem
   Studios Portal"), create it.
2. **OAuth2 → General**: copy the **Client ID** and (Reset/reveal + copy)
   the **Client Secret**. These go into Vercel as `DISCORD_CLIENT_ID` /
   `DISCORD_CLIENT_SECRET`.
3. Still on **OAuth2 → General**, under **Redirects**, click **Add
   Redirect** and enter: `https://<your-vercel-url>/api/auth/callback/discord`
   — using the real URL from step 3.4 above. Save.

That's everything needed for login itself — no Bot tab, no server invite,
no permissions to configure. Step 6 below adds a bot to this *same*
application for avatars and role colors, which is a separate, optional
capability layered on top.

## 5. Find your guild ID

You'll need Developer Mode on in Discord first: User Settings → Advanced →
Developer Mode.

- **Guild ID**: right-click your server's icon → Copy Server ID →
  `DISCORD_GUILD_ID`.

Redeploy after adding this (Vercel dashboard → Redeploy).

Note: Discord roles are used **only** for this membership check — whether
someone is currently in the server at all. They're never used to decide
what someone can do inside the portal. That's deliberate: whoever manages
roles in Discord might not be a portal admin, and a role by itself should
never quietly hand someone elevated access. See "Granting access" below.

## 5b. Granting access (rank eligibility + per-person grants)

This is a two-step, admin-only process inside the app itself — nothing to
configure in Vercel or Discord for this part.

1. **Set which ranks are even eligible for anything** — the **Permissions**
   page (nav bar, admin only). For each organizational rank on your
   roster, choose "Not eligible," "Staff," or "Admin." This is a
   *ceiling*, not a grant — setting a rank to "Staff" doesn't give anyone
   access yet, it just makes people with that rank *eligible* to be
   granted it.
2. **Actually grant it to a specific person** — the **Roster** page. Next
   to each person whose rank has been made eligible, there's an "Grant
   access" toggle. An admin has to deliberately switch it on for *that
   person*. This is the step that stops someone who can hand out a
   Discord role (or edit the roster rank field) from silently giving a
   friend portal access — a named admin has to have actually looked at
   that specific person and decided yes.

If a rank's eligibility is later lowered or removed, everyone holding that
rank loses the corresponding access immediately (their next request just
resolves to the lower tier) — there's no separate cleanup step.

**Staff** can triage bug reports (change status, assign). **Admin** can
also do everything on the Roster and Permissions pages, and delete
reports. If you want every QA staffer to have full triage access, just set
their rank's eligibility to "Staff" (or "Admin," if you want them able to
manage the roster too) and grant it to each of them — there's no
requirement to split people between the two tiers if you don't want to.

## 6. Optional: real avatars and Discord role colors

Login works fine without this — it's purely for showing people's actual
Discord pictures and their Discord role color (e.g. the navbar identity
chip) instead of placeholders. Uses the same dedicated application from
step 4, not your original bot.

This is meaningfully easier than the Apps-Script-era attempts at this
(the abandoned Vercel relay project) for a specific reason: Discord blocks
API requests from Apps Script's shared, flagged IP pool, not from Vercel's
— so this app can just call Discord's API directly, no relay needed.

1. On that same application in the Discord Developer Portal, click **Bot**
   in the left sidebar → **Add Bot** (or **Reset Token** if a bot already
   exists there) → copy the token. This is `DISCORD_BOT_TOKEN` in Vercel.
   You do **not** need to enable any "Privileged Gateway Intents" toggles
   on this page — the lookups this uses don't need them.
2. Invite the bot to your server: **OAuth2 → URL Generator**, check the
   **bot** scope, pick a minimal permission like "View Channels" (the
   lookups this app does don't actually need any permission bits, Discord
   just wants something checked), copy the generated URL at the bottom,
   open it in a browser, and authorize it into the Goatem Studios server.
3. Add `DISCORD_BOT_TOKEN` to Vercel's Environments, redeploy.

The bot never needs to be "online" or connected anywhere — this app only
ever makes plain REST calls with the token, on demand, cached briefly
(`src/lib/discordBot.ts`) to avoid hammering Discord's API. Everything
that uses this degrades gracefully to placeholders if the token's missing
or the bot's ever removed from the server — nothing breaks, it just goes
back to showing generic avatars and default text color.

## 7. Optional: the audit trail mirror

Every sensitive action (status changes, roster edits, deletions) gets
logged in the database — that part works with no setup. If you also want
a live copy posted to a private Discord channel (recommended — it's a
copy nobody inside the app can edit or clear), create a webhook: channel
Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL → set
as `AUDIT_WEBHOOK_URL` in Vercel, redeploy.

## 8. First login

1. Visit your Vercel URL, click **Sign in with Discord**.
2. Approve the Discord authorization prompt.
3. You should land back on the portal, signed in. If you get bounced to
   an "access denied" style message, it means the account you used isn't
   currently a member of the guild `DISCORD_GUILD_ID` points at — the
   membership check is live against Discord, not a guess.
4. You won't be able to file a report, and won't see the Roster or
   Permissions pages, until you're on the roster with access actually
   granted — that's expected for the very first login, since nobody's
   been added yet, and there's a genuine chicken-and-egg problem here: the
   Permissions page is how eligibility normally gets set, but you need
   ADMIN access to open it. Bootstrapping the very first admin needs two
   direct database rows (ask me and I'll either walk you through
   Neon/Supabase's built-in table editor, which is a normal web UI, or
   write you a one-off script): a `members` row for you with `rank` set to
   whatever you want (e.g. "Founder") and `granted_tier` set to `ADMIN`,
   **and** a matching `rank_permissions` row for that same rank with
   `eligible_tier` set to `ADMIN` — both have to exist, since your actual
   access is always the lower of the two (see src/lib/permissions.ts).
   After that first person exists, everything else (adding people, rank
   eligibility, granting access to anyone else) can be done from inside
   the app.

## How this is organized (for when you poke around the code)

- `src/db/schema.ts` — the five tables: `members`, `rank_permissions`,
  `bug_reports`, `comments`, `audit_log`. Every deletable table has a
  `deletedAt` column; nothing is ever hard-deleted through the app.
- `src/lib/auth.ts` — Discord OAuth and the live guild-membership check
  ONLY. Re-checks membership against Discord every 15 minutes on an active
  session, not just once at login. It has no say in what someone can do —
  it calls into `src/lib/rankPermissions.ts` for that.
- `src/lib/permissions.ts` — the three tiers (MEMBER / STAFF / ADMIN),
  `tierAtLeast()` for comparisons, and `resolveTier()` / `isGrantAllowed()`
  — the capping logic that combines a rank's eligibility with a person's
  actual grant (the lower of the two always wins).
- `src/lib/rankPermissions.ts` — reads/lists rank eligibility
  (`rank_permissions`) and resolves a member's effective tier from it plus
  their `granted_tier`.
- `src/app/admin/permissions/page.tsx` +
  `src/app/api/admin/rank-permissions/route.ts` — the Permissions page:
  sets each rank's eligibility ceiling. Admin-only, audit-logged.
- The Roster page's access toggle
  (`src/components/GrantToggle.tsx` → `PATCH /api/roster/[id]`) — the
  actual per-person grant, capped server-side by the target's rank
  eligibility regardless of what the request claims.
- `src/lib/requireSession.ts` — the one function every API route calls to
  find out who's asking and whether they're allowed. This is the actual
  security boundary — page-level redirects (`src/proxy.ts`) are just a
  nicety on top.
- `src/lib/audit.ts` — the append-only audit logger, with the optional
  Discord webhook mirror.
- `src/lib/discordBot.ts` — bot-token-backed avatar and role-color lookups
  for any guild member (not just whoever's logged in). Fails soft to
  placeholders if the bot isn't configured. `src/app/api/me/route.ts` is
  the one route that currently uses it, backing the navbar's identity
  chip — reusable anywhere else a picture would help (e.g. the roster
  page) whenever that's wanted.
- `src/app/api/**` — every backend endpoint. Reports, comments, roster,
  and the read-only audit log viewer.
- `src/app/**` (outside `api/`) — the actual pages.
- `scripts/smoke-test.ts` — not part of the app; a one-off script that
  exercises the database end to end (insert, transaction, audit logging,
  soft delete). Useful to re-run (`npx tsx --env-file=.env.local
  scripts/smoke-test.ts`) after connecting a fresh database, to confirm
  the connection string works before moving on to the Discord setup
  steps.

## What's deliberately NOT done yet (phase 2+)

- Live Roblox group sync for the roster (phase 1 roster is admin-managed
  by hand, same as adding someone to the Data tab today).
- Points/Hosted/Attended analytics, LOA workflow, activity-status tiers —
  all still on the sheet.
- The in-memory rate limiter on report/comment creation is a floor, not a
  permanent solution — it resets on cold starts and doesn't share state
  across concurrent server instances. Fine for now at this scale; if it
  ever needs to hold up against a determined distributed attempt, swap
  `src/lib/rateLimit.ts` for Upstash Redis (same call sites, different
  backing store).
- A nonce-based Content-Security-Policy (currently allows `unsafe-inline`
  for scripts/styles, which Next.js needs a few of even in production) —
  worth tightening once there's a live deployment to test it against.
- Editing/removing a comment, and a UI for restoring something that was
  soft-deleted (the data survives either way; there's just no button for
  it yet).
