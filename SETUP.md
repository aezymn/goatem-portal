# Goatem Studios Portal — setup

This is phase 1 of the custom replacement we talked through: bug/issue
tracking (the piece neither Hyra nor FiveRoster had), plus a basic roster
view, both gated behind Discord login tied to your actual server roles.
Analytics, LOA, and activity-status stay on the sheet for now and migrate
over in later phases.

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
   - `DISCORD_GUILD_ID`, `DISCORD_ADMIN_ROLE_IDS`, `DISCORD_STAFF_ROLE_IDS`
     — from step 5 below.
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

## 5. Find your guild and role IDs

You'll need Developer Mode on in Discord first: User Settings → Advanced →
Developer Mode.

- **Guild ID**: right-click your server's icon → Copy Server ID →
  `DISCORD_GUILD_ID`.
- **Role IDs**: Server Settings → Roles, right-click each role you want
  mapped → Copy Role ID. Put every role that should count as full admin
  access into `DISCORD_ADMIN_ROLE_IDS` (comma-separated, no spaces), and
  everyone who should be able to triage bug reports (but not everything
  admins can do) into `DISCORD_STAFF_ROLE_IDS`. Anyone signed in who
  matches neither list still gets basic access — view the roster, file
  reports, comment — just not triage or admin actions.

Redeploy after adding these (Vercel dashboard → Redeploy).

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
4. You won't be able to file a report yet if you're not on the roster —
   that's expected for the very first login, since nobody's been added
   yet. Add yourself: for now this needs a direct database insert (ask me
   and I'll either walk you through Neon/Supabase's built-in table editor,
   which is a normal web UI, or write you a one-off script) — after that
   first person exists, everything else can be managed from the Roster
   page in the app itself by anyone with admin access.

## How this is organized (for when you poke around the code)

- `src/db/schema.ts` — the four tables: `members`, `bug_reports`,
  `comments`, `audit_log`. Every deletable table has a `deletedAt` column;
  nothing is ever hard-deleted through the app.
- `src/lib/auth.ts` — Discord OAuth, the live guild-membership check, and
  the permission-tier resolution. Re-checks your roles against Discord
  every 15 minutes on an active session, not just once at login.
- `src/lib/permissions.ts` — the three tiers (MEMBER / STAFF / ADMIN) and
  how Discord role IDs map to them.
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
