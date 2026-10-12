/**
 * @author: @dorianbaffier
 * @description: Swoosh Text
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface SwooshTextProps {
  text?: string;
  className?: string;
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
  className,
  shadowColors,
}: SwooshTextProps) {
  // Merge so a partial `shadowColors` keeps the other defaults instead of
  // producing `undefined` (which invalidates the whole text-shadow).
  const colors = { ...DEFAULT_SHADOW_COLORS, ...shadowColors };
  const style: CSSProperties & Record<"--swoosh-shadow", string> = {
    "--swoosh-shadow": `10px 10px 0px ${colors.first}, 15px 15px 0px ${colors.second}, 20px 20px 0px ${colors.third}, 25px 25px 0px ${colors.fourth}, 45px 45px 10px ${colors.glow}`,
  };

  return (
    <div
      className={cn(
        "w-full cursor-pointer text-center font-bold text-3xl tracking-widest",
        "text-black italic dark:text-white",
        "[text-shadow:var(--swoosh-shadow)] hover:[text-shadow:none]",
        "transition-[text-shadow] duration-200 ease-[ease] motion-reduce:transition-none",
        className
      )}
      style={style}
    >
      {text}
    </div>
  );
}
