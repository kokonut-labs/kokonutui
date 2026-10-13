/**
 * @author: @dorianbaffier
 * @description: Shimmer Text
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// A CSS loop keeps the sweep smooth while the main thread is busy, which is
// exactly when shimmer text tends to be on screen.
const SHIMMER_KEYFRAMES =
  "@keyframes kokonutui-shimmer-text { from { background-position: 200% center; } to { background-position: -200% center; } }";

type ShimmerTextElement =
  | "span"
  | "p"
  | "div"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

interface ShimmerTextProps extends HTMLAttributes<HTMLElement> {
  text?: string;
  className?: string;
  /**
   * Element to render. Defaults to `span`, so it works inline (a status
   * line, a button label) without adding a heading to the page outline.
   */
  as?: ShimmerTextElement;
}

export default function ShimmerText({
  text = "Text Shimmer",
  className,
  children,
  as: Component = "span",
  ...props
}: ShimmerTextProps) {
  return (
    <>
      <style href="kokonutui-shimmer-text" precedence="default">
        {SHIMMER_KEYFRAMES}
      </style>
      <Component
        {...props}
        className={cn(
          "bg-[length:200%_100%] bg-gradient-to-r from-neutral-950 via-neutral-400 to-neutral-950 bg-clip-text font-bold text-3xl text-transparent motion-safe:animate-[kokonutui-shimmer-text_2.5s_linear_infinite] dark:from-white dark:via-neutral-600 dark:to-white",
          className
        )}
      >
        {children ?? text}
      </Component>
    </>
  );
}
