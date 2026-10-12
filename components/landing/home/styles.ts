import type { CSSProperties } from "react";

/** Press feedback for anything clickable: a quick 0.97 squeeze. */
export const PRESS =
  "transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out active:scale-[0.97]";

/** One focus ring for every control on the page, keyboard only. */
export const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-white/35 dark:focus-visible:ring-offset-black";

export const PRIMARY_BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-black px-5 font-medium text-[14px] text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85";

export const SECONDARY_BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-lg border border-black/10 px-4 font-medium text-[14px] text-black/80 hover:bg-black/[0.04] dark:border-white/10 dark:text-white/80 dark:hover:bg-white/[0.06]";

/** Inline style for one step of a `.home-enter` cascade. */
export function enter(index: number, delayMs = 0): CSSProperties {
  return {
    "--enter-index": index,
    "--enter-delay": `${delayMs}ms`,
  } as CSSProperties;
}
