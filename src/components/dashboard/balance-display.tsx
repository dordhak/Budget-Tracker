"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { SlotNumber, type RollDirection } from "./slot-number";

const KEY = (month: string) => `bt:balance:${month}`;
const SETTLE_MS = 600; // remember the new value shortly after the roll starts

interface Props {
  month: string;
  /** Balance in cents, used to detect a change since the last visit. */
  cents: number;
  /** Already-formatted amount, e.g. "RM 2,665.60". */
  text: string;
  className?: string;
}

/**
 * Shows the balance. The first time you see a month it just appears. On later visits, if the balance
 * changed since you last looked (you added income or an expense), the digits roll from the old number
 * to the new one: upward when it grew, downward when it shrank. Unchanged balance: no animation.
 * The colour never changes during the roll.
 * The last seen value is kept in this browser's localStorage, per month.
 */
export function BalanceDisplay({ month, cents, text, className }: Props) {
  const [prev, setPrev] = useState<{ text: string; direction: RollDirection } | null>(null);

  // Layout effect: read before the first paint so the new value never flashes before the roll starts.
  useLayoutEffect(() => {
    let stored: { cents: number; text: string } | null = null;
    try {
      const raw = localStorage.getItem(KEY(month));
      if (raw) stored = JSON.parse(raw) as { cents: number; text: string };
    } catch {
      stored = null;
    }

    if (stored && typeof stored.cents === "number" && typeof stored.text === "string" && stored.cents !== cents) {
      setPrev({ text: stored.text, direction: cents > stored.cents ? "up" : "down" });
    } else {
      setPrev(null);
    }
  }, [month, cents]);

  // Remember what was just shown (after a short delay so React StrictMode's double run reads the same old value).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY(month), JSON.stringify({ cents, text }));
      } catch {
        // Storage may be blocked; the number still shows, it just won't animate next time.
      }
    }, SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [month, cents, text]);

  return (
    <SlotNumber
      text={text}
      prevText={prev?.text ?? null}
      direction={prev?.direction ?? "up"}
      className={className}
    />
  );
}
