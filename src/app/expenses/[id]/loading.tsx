export default function Loading() {
  return (
    <div role="status" aria-label="Loading transaction" className="mx-auto max-w-3xl space-y-6">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg bg-muted" />
        <div className="h-72 animate-pulse rounded-lg bg-muted" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
