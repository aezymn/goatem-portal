import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignInForm } from "@/components/SignInForm";

export const dynamic = "force-dynamic";

/**
 * Checks for an existing session BEFORE rendering anything.
 *
 * Without this, someone who is perfectly well signed in can sit staring
 * at "sign-in was rejected" — because the message comes from an `?error=`
 * still in the URL (a stale link, a back-button, a redirect from an
 * earlier attempt), and the page had no idea a valid session existed.
 * A rejection notice shown to an authenticated person is just wrong, so
 * the session check comes first and wins.
 */
export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const session = await getServerSession(authOptions);
  const { error, from } = await searchParams;

  const destination = typeof from === "string" && from.startsWith("/") ? from : "/";

  if (session && !session.stale && session.user?.discordId) {
    redirect(destination);
  }

  return (
    <SignInForm
      error={typeof error === "string" ? error : null}
      from={destination}
    />
  );
}
