import { cookies } from "next/headers";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "./nav-links";

/** Server Component: reads the user once and renders nav only when signed in. */
export async function SiteHeader() {
  // Always per-request: the header depends on the session cookie.
  await cookies();
  // Without Supabase config (e.g. on the dev-only pdf spike) render a bare header.
  const user = hasSupabaseEnv()
    ? (await (await createClient()).auth.getUser()).data.user
    : null;

  return (
    <header className="border-b bg-background">
      <div className="container flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <Link
          href="/"
          className="rounded-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Budget Tracker
        </Link>
        {user && (
          <div className="flex flex-wrap items-center gap-1 sm:gap-4">
            <NavLinks />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" title={user.email ?? undefined}>
                Sign out
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
