"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInContent() {
  const params = useSearchParams();
  const error = params.get("error");
  const from = params.get("from");

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 pt-16 text-center">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Use the Discord account you use in the Goatem Studios server. If
        you&apos;re not currently a member of that server, sign-in will be
        rejected — the check is live, not a one-time list.
      </p>
      {error === "AccessDenied" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          That Discord account isn&apos;t a member of the Goatem Studios
          server, so sign-in was rejected.
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
