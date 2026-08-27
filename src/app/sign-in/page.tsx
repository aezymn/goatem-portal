"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Each of these is a genuinely different problem with a different fix, so
// they get genuinely different messages. "AccessDenied" is next-auth's
// own generic code, kept as a catch-all for anything not classified.
const ERROR_MESSAGES: Record<string, string> = {
  NotInGuild:
    "That Discord account isn't a member of the Goatem Studios server, so sign-in was rejected.",
  ScopeRejected:
    "Discord wouldn't confirm your server membership — this usually means the permission request was declined, or a previous authorisation is stale. In Discord: User Settings → Authorised Apps → remove this app, then sign in again and accept the prompt.",
  DiscordUnavailable:
    "Couldn't reach Discord to check your server membership just now — possibly rate limited from repeated sign-ins. Wait a minute and try again; nothing is wrong with your account.",
  AccessDenied: "Sign-in was rejected.",
};

function SignInContent() {
  const params = useSearchParams();
  const error = params.get("error");
  const from = params.get("from");
  const message = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.AccessDenied : null;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 pt-16 text-center">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Use the Discord account you use in the Goatem Studios server. If
        you&apos;re not currently a member of that server, sign-in will be
        rejected — the check is live, not a one-time list.
      </p>
      {message && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-left text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {message}
        </p>
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

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
