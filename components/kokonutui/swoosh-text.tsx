/**
 * @author: @dorianbaffier
 * @description: Swoosh Text
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SwooshTextProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  text?: string;
  /** Element to render, e.g. "h1" for a heading. */
  as?: "div" | "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  shadowColors?: {
    first?: string;
    second?: string;
    third?: string;
    fourth?: string;
    glow?: string;
  };
}

const DEFAULT_SHADOW_COLORS = {
  first: "#07bccc",
  second: "#e601c0",
  third: "#e9019a",
  fourth: "#f40468",
  glow: "#f40468",
};

export default function SwooshText({
  text = "Hover Me",
  as: Tag = "div",
  className,
  shadowColors,
  style,
  ...props
}: SwooshTextProps) {
  // Merge so a partial `shadowColors` keeps the other defaults instead of
  // producing `undefined` (which invalidates the whole text-shadow).
  const colors = { ...DEFAULT_SHADOW_COLORS, ...shadowColors };
  // Offsets are in em so the shadow scales with the font size. They equal
  // the original 10/15/20/25/45px at 60px (the size the docs show).
  const shadowStyle: CSSProperties & Record<"--swoosh-shadow", string> = {
    ...style,
    "--swoosh-shadow": `0.1667em 0.1667em 0 ${colors.first}, 0.25em 0.25em 0 ${colors.second}, 0.3333em 0.3333em 0 ${colors.third}, 0.4167em 0.4167em 0 ${colors.fourth}, 0.75em 0.75em 0.1667em ${colors.glow}`,
  };

  return (
    <Tag
      className={cn(
        "w-full text-center font-bold text-3xl tracking-widest",
        "text-black italic dark:text-white",
        "[text-shadow:var(--swoosh-shadow)] hover:[text-shadow:none]",
        "transition-[text-shadow] duration-200 ease-[ease] motion-reduce:transition-none",
        className
      )}
      style={shadowStyle}
      {...props}
    >
      {text}
    </Tag>
  );
}
