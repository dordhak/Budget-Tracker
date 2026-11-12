import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-12 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">That page doesn&apos;t exist.</p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Go to the dashboard
      </Link>
    </div>
  );
}
