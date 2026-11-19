"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const CELL = 1.15; // em; reel cell height
const isDigit = (c: string | undefined): c is string => c !== undefined && c >= "0" && c <= "9";

export type RollDirection = "up" | "down";

interface ReelProps {
  digit: number;
  /** Digit shown before the change, or null to just show `digit` without moving. */
  from: number | null;
  direction: RollDirection;
  delay: number;
  extraLaps: number;
}

/**
 * One reel (digits 0-9 repeated). Rolls from `from` to `digit` in the given direction:
 * "up" scrolls the strip upward (digits count up), "down" scrolls it downward (digits count down).
 */
function Reel({ digit, from, direction, delay, extraLaps }: ReelProps) {
  const moves = from !== null && from !== digit;

  let start = digit;
  let end = digit;
  if (moves && from !== null) {
    if (direction === "up") {
      const dist = ((digit - from + 10) % 10) + 10 * extraLaps;
      start = from;
      end = from + dist;
    } else {
      const dist = ((from - digit + 10) % 10) + 10 * extraLaps;
      start = digit + dist;
      end = digit;
    }
  }
  const length = Math.max(start, end) + 2;
  const cells = Array.from({ length }, (_, i) => i % 10);

  const [state, setState] = useState<"idle" | "rolling" | "done">("idle");

  useEffect(() => {
    if (!moves || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setState("done");
      return;
    }
    // Two frames so the browser paints the start position before transitioning to the end.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setState("rolling"));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [moves]);

  const offset = !moves ? digit : state === "idle" ? start : end;
  const duration = 1.2 + extraLaps * 0.25;

  return (
    <span className="relative inline-block w-[1ch] overflow-hidden align-bottom" style={{ height: `${CELL}em` }} aria-hidden="true">
      {/* Invisible spacer keeps the width and height identical for every digit. */}
      <span className="invisible block text-center" style={{ height: `${CELL}em`, lineHeight: `${CELL}em` }}>
        0
      </span>
      <span
        className="absolute inset-x-0 top-0 flex flex-col will-change-transform"
        style={{
          transform: `translateY(${-offset * CELL}em)`,
          transition: state === "rolling" ? `transform ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms` : "none",
          // Motion blur: ramps up as the reel starts moving, eases back to sharp as it lands.
          animation: state === "rolling" ? `reel-blur ${duration}s ease-in-out ${delay}ms backwards` : "none",
        }}
      >
        {cells.map((d, i) => (
          <span key={i} className="block text-center" style={{ height: `${CELL}em`, lineHeight: `${CELL}em` }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Odometer-style number. When `prevText` is given, digits that changed roll from their old value to
 * the new one (up if the number went up, down if it went down); unchanged digits stay still.
 * With no `prevText` it just shows the number. Size comes only from the caller's class, so the
 * font never changes with the value. Screen readers get the plain text via aria-label.
 */
export function SlotNumber({
  text,
  prevText = null,
  direction = "up",
  className,
}: {
  text: string;
  prevText?: string | null;
  direction?: RollDirection;
  className?: string;
}) {
  const chars = Array.from(text);
  const prevChars = prevText ? Array.from(prevText) : null;
  let rolled = 0;

  return (
    <span role="img" aria-label={text} className={cn("inline-flex whitespace-nowrap tabular-nums", className)}>
      {chars.map((ch, i) => {
        if (!isDigit(ch)) {
          return (
            <span
              key={`${text}-${i}`}
              aria-hidden="true"
              className="inline-block whitespace-pre"
              style={{ height: `${CELL}em`, lineHeight: `${CELL}em` }}
            >
              {ch}
            </span>
          );
        }
        // Align the old and new strings from the right so decimals and thousands line up.
        const prevCh = prevChars ? prevChars[prevChars.length - (chars.length - i)] : undefined;
        const from = isDigit(prevCh) ? Number(prevCh) : null;
        const delay = from !== null && from !== Number(ch) ? rolled++ * 90 : 0;
        return (
          <Reel
            key={`${text}-${prevText ?? ""}-${i}`}
            digit={Number(ch)}
            from={from}
            direction={direction}
            delay={delay}
            extraLaps={1 + (i % 2)}
          />
        );
      })}
    </span>
  );
}
