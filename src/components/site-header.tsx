import { cookies } from "next/headers";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="h-8 w-8 rounded-[10px] bg-primary" aria-hidden="true" />
      Budget Tracker
    </Link>
  );
}

/**
 * Server Component: reads the user once. Signed in: sidebar on large screens, top bar on small ones.
 * Signed out: a bare brand bar. The `sidebar` class lets <main> add left padding via `peer-[.sidebar]`.
 */
export async function SiteHeader() {
  // Always per-request: the header depends on the session cookie.
  await cookies();
  // Without Supabase config (e.g. on the dev-only pdf spike) render a bare header.
  const user = hasSupabaseEnv()
    ? (await (await createClient()).auth.getUser()).data.user
    : null;

  if (!user) {
    return (
      <header className="border-b">
        <div className="mx-auto flex min-h-14 max-w-[1200px] items-center justify-between px-4 py-2 lg:px-10">
          <Brand />
          <ThemeToggle />
        </div>
      </header>
    );
  }

  return (
    <header className="sidebar peer border-b bg-card/60 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:border-b-0 lg:border-r lg:bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 lg:flex-1 lg:flex-col lg:items-stretch lg:justify-start lg:gap-6 lg:px-5 lg:py-6">
        <Brand />
        <NavLinks />
        <div className="flex items-center gap-2 lg:mt-auto lg:flex-col lg:items-stretch lg:gap-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="hidden text-sm text-muted-foreground lg:inline">Theme</span>
            <ThemeToggle />
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="lg:w-full lg:justify-start" title={user.email ?? undefined}>
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
