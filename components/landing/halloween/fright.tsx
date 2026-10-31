"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useHalloween } from "@/lib/halloween";

/**
 * "Components that feel right." becomes "feel fright." for the day: once the
 * cover has landed, "right" steps aside and a pumpkin f drops into the gap.
 * The letter is hidden from screen readers and crawlers, so the headline
 * still reads as it always does.
 */
export function Fright({ children }: { children: ReactNode }) {
  const on = useHalloween("fright");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) {
      return;
    }
    // After the cover's own entrance, so the change is seen happening.
    const id = window.setTimeout(() => setShown(true), 900);
    return () => window.clearTimeout(id);
  }, [on]);
  if (!on) {
    return children;
  }
  return (
    <span className="whitespace-nowrap">
      <span aria-hidden className="fright" data-shown={shown || undefined}>
        <span>
          <span className="text-[color:var(--leaf)]">f</span>
        </span>
      </span>
      {children}
    </span>
  );
}

/**
 * The one color in the catalog, Kokonut's leaf, turns pumpkin for the day on
 * the homepage and the docs: every part code, New tag and caret follows it.
 */
export function PumpkinAccent() {
  const on = useHalloween("fright");
  useEffect(() => {
    if (!on) {
      return;
    }
    const root = document.documentElement;
    root.dataset.halloween = "";
    return () => {
      delete root.dataset.halloween;
    };
  }, [on]);
  return null;
}
