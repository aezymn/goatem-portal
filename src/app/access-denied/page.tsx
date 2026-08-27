export default function AccessDeniedPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 pt-16 text-center">
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        You&apos;re signed in, but your current role doesn&apos;t have
        access to this page.
      </p>
    </div>
  );
}
