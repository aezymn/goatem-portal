import Link from "next/link";

/** A person's name, linking to their profile. Used everywhere a member
 * is mentioned so "who is this and how active are they" is always one
 * click away rather than a search. */
export function PersonLink({
  memberId,
  robloxUsername,
  discordUsername,
  avatarUrl,
  size = "sm",
}: {
  memberId: string;
  robloxUsername: string | null;
  discordUsername: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "xs";
}) {
  const name = robloxUsername ?? discordUsername ?? "Unknown member";
  const dim = size === "xs" ? "h-5 w-5" : "h-6 w-6";
  return (
    <Link
      href={`/members/${memberId}`}
      className="inline-flex items-center gap-2 hover:underline"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- cached Discord CDN avatar
        <img src={avatarUrl} alt="" className={`${dim} shrink-0 rounded-full object-cover`} />
      ) : (
        <span className={`${dim} shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800`} />
      )}
      <span className={size === "xs" ? "text-xs" : "text-sm"}>{name}</span>
    </Link>
  );
}
