import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// The catalog is drawn with rules, not cards: cells share one hairline, the
// corners are square, and type does the decorating. The docs pages use the
// same pieces, so a part looks the same on the homepage and on its own page.
/** A plain class (globals.css), so cn() never mistakes it for a font weight. */
export const MONO = "home-mono";
export const LINE = "border-black/[0.13] dark:border-white/[0.14]";
export const GRID = "gap-px bg-black/[0.13] dark:bg-white/[0.14]";
export const CELL = "bg-white dark:bg-black";
export const META = cn(MONO, "text-[11.5px] text-black/50 dark:text-white/50");
export const INK = "text-black dark:text-white";
export const SOFT = "text-black/60 dark:text-white/60";
/** The one color in the catalog: Kokonut's leaf, for the codes. */
export const LEAF = "text-[color:var(--leaf)]";

/** Hover and press read through color alone; nothing on the page scales. */
export const EASE_COLORS =
  "transition-[background-color,border-color,color] duration-150 ease-out";

/** One focus ring for every control on the page, keyboard only. */
export const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-white/35 dark:focus-visible:ring-offset-black";

/** For controls that fill a clipped card: the ring draws inside the edge. */
export const FOCUS_INSET =
  "outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-inset dark:focus-visible:ring-white/40";

/** Inline style for one step of a `.home-enter` cascade. */
export function enter(index: number, delayMs = 0): CSSProperties {
  return {
    "--enter-index": index,
    "--enter-delay": `${delayMs}ms`,
  } as CSSProperties;
}
