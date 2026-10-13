import type { CSSProperties } from "react";

/** Hover and press read through color alone; nothing on the page scales. */
export const EASE_COLORS =
  "transition-[background-color,border-color,color] duration-150 ease-out";

/** One focus ring for every control on the page, keyboard only. */
export const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-white/35 dark:focus-visible:ring-offset-black";

/** For controls that fill a clipped card: the ring draws inside the edge. */
export const FOCUS_INSET =
  "outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-inset dark:focus-visible:ring-white/40";

export const PRIMARY_BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-black px-5 font-medium text-[14px] text-white hover:bg-black/85 active:bg-black/75 dark:bg-white dark:text-black dark:active:bg-white/75 dark:hover:bg-white/85";

/** Inline style for one step of a `.home-enter` cascade. */
export function enter(index: number, delayMs = 0): CSSProperties {
  return {
    "--enter-index": index,
    "--enter-delay": `${delayMs}ms`,
  } as CSSProperties;
}
