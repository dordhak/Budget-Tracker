"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Budget" },
  { href: "/statements", label: "Statements" },
  { href: "/entries", label: "Entries" },
  { href: "/expenses", label: "Expenses" },
  { href: "/import", label: "Import" },
] as const;

/** Client Component only because it needs the current pathname for the active state. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-wrap items-center gap-1 lg:flex-col lg:items-stretch">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300 ease-out hover:bg-accent lg:hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-accent text-primary" : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
