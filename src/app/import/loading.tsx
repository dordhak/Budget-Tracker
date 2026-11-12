export default function Loading() {
  return (
    <div role="status" aria-label="Loading import page" className="space-y-6">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-36 animate-pulse rounded-lg bg-muted" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
