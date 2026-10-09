"use client";

import { signIn } from "next-auth/react";

// Each of these is a genuinely different problem with a different fix, so
// they get genuinely different messages. "AccessDenied" is next-auth's
// own generic code, kept as a catch-all for anything not classified.
const ERROR_MESSAGES: Record<string, string> = {
  NotInGuild:
    "That Discord account is not currently a member of the Goatem Studios Discord server. Make sure you are signed into the correct Discord account in your browser.",
  ScopeRejected:
    "Discord wouldn't confirm your server membership — this usually means the permission request was declined, or a previous authorization is stale. In Discord: User Settings → Authorized Apps → remove this app, then sign in again and accept the prompt.",
  DiscordUnavailable:
    "Couldn't reach Discord to check your server membership just now — possibly rate limited from repeated sign-ins. Wait a minute and try again; nothing is wrong with your account.",
  OAuthCallback:
    "The authorization check failed. This usually happens if cookies are blocked, you opened this link inside the Discord in-app browser, or the authorization timed out.",
  OAuthSignin:
    "Could not initiate sign-in with Discord. Please try again.",
  Callback:
    "An error occurred while verifying your Discord account. Please try signing in again.",
  AccessDenied:
    "That sign-in attempt was rejected or cancelled. If you clicked Cancel, please try again and click Authorize. If you didn't see the prompt or this keeps happening, follow the troubleshooting steps below.",
};

export function SignInForm({
  error,
  from,
}: {
  error: string | null;
  from: string | null;
}) {
  const message = error
    ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.AccessDenied)
    : null;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 pt-16 text-center">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Use the Discord account you use in the Goatem Studios server. If
        you&apos;re not currently a member of that server, sign-in will be
        rejected — the check is live, not a one-time list.
      </p>
      {message && (
        <div className="w-full rounded-md bg-red-50 p-3 text-left text-sm text-red-700 dark:bg-red-950/70 dark:text-red-300">
          <p className="font-medium">{message}</p>
          <div className="mt-2 space-y-1 border-t border-red-200 pt-2 text-xs text-red-600 dark:border-red-900/60 dark:text-red-400">
            <p className="font-semibold">How to fix this:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Open in a regular browser (Chrome, Edge, Safari) — <strong>do not</strong> use Discord's in-app browser.</li>
              <li>Make sure you are logged into Discord with the account that is inside the server.</li>
              <li>In Discord: <strong>User Settings → Authorized Apps</strong> → find this portal and click <strong>Deauthorize</strong>, then try again.</li>
              <li>Make sure browser cookies are enabled.</li>
            </ul>
          </div>
        </div>
      )}
      <button
        onClick={() => signIn("discord", { callbackUrl: from ?? "/" })}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500"
      >
        Sign in with Discord
      </button>
    </div>
  );
}
