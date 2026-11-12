import Link from "next/link";

export default function EntryNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-12 text-center">
      <h1 className="text-xl font-semibold">Entry not found</h1>
      <p className="text-sm text-muted-foreground">It may have been deleted, or the link is wrong.</p>
      <Link href="/entries" className="text-sm underline underline-offset-4">
        Back to entries
      </Link>
    </div>
  );
}
