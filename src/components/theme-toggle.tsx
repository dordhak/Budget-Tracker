"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "theme";

function applyTheme(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Light/dark switch. With no saved choice the theme follows the OS setting (and keeps following it live).
 * The first paint is handled by the inline script in layout.tsx, so this only syncs state after mount.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // null until mounted, so server and first client render match.
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(STORAGE_KEY)) return; // an explicit choice wins
      document.documentElement.classList.add("theme-transition");
      applyTheme(e.matches);
      setDark(e.matches);
      window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 700);
    };
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    const root = document.documentElement;
    root.classList.add("theme-transition");
    applyTheme(next);
    setDark(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage can be blocked; the toggle still works for this session.
    }
    window.setTimeout(() => root.classList.remove("theme-transition"), 700);
  }, []);

  const isDark = dark === true;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={toggle}
      className={cn(
        "group relative inline-flex h-9 w-[4.25rem] shrink-0 items-center rounded-full p-1",
        "bg-slate-200 shadow-inner ring-1 ring-slate-300/70 transition-[background-color,box-shadow] duration-500 ease-out",
        "dark:bg-[#141d33] dark:ring-white/10 dark:shadow-[0_0_18px_rgba(45,212,191,0.28)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative flex h-7 w-7 items-center justify-center rounded-full",
          "bg-gradient-to-br from-sky-200 to-blue-400 text-slate-800 shadow-md shadow-blue-500/30",
          "transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-active:scale-95",
          isDark ? "translate-x-[2rem]" : "translate-x-0",
        )}
      >
        <Sun
          className={cn(
            "absolute h-4 w-4 transition-all duration-500 ease-out",
            isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        />
        <Moon
          className={cn(
            "absolute h-4 w-4 transition-all duration-500 ease-out",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0",
          )}
        />
      </span>
    </button>
  );
}
