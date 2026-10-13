"use client";

/**
 * @author: @dorianbaffier
 * @description: Switch Button
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Works on its own: it toggles the `dark` class on <html>. If a theme provider
 * owns the theme (next-themes or your own), pass `theme` and `onThemeChange`.
 */

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

interface SwitchButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "minimal";
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
  /**
   * The applied theme, when a theme provider owns it (for next-themes, its
   * `resolvedTheme`). Pair it with `onThemeChange`. Without it the button
   * toggles the `dark` class on <html> itself.
   */
  theme?: Theme;
  /** Called with the theme to switch to. */
  onThemeChange?: (theme: Theme) => void;
}

const VARIANTS = {
  minimal: [
    "rounded-lg",
    "bg-linear-to-b from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-900",
    "hover:from-zinc-100 hover:to-zinc-200 dark:hover:from-zinc-700 dark:hover:to-zinc-800",
    "border border-zinc-200 dark:border-zinc-700/80",
    "hover:border-zinc-300 dark:hover:border-zinc-600",
    "shadow-[0_1px_2px_-1px_rgb(0_0_0/0.1),0_1px_3px_-2px_rgb(0_0_0/0.1)] dark:shadow-[0_1px_2px_-1px_rgb(0_0_0/0.3),0_1px_3px_-2px_rgb(0_0_0/0.3)]",
    "hover:shadow-[0_2px_4px_-2px_rgb(0_0_0/0.15),0_2px_6px_-3px_rgb(0_0_0/0.15)] dark:hover:shadow-[0_2px_4px_-2px_rgb(0_0_0/0.4),0_2px_6px_-3px_rgb(0_0_0/0.4)]",
    "active:shadow-[0_0px_1px_0_rgb(0_0_0/0.1)] dark:active:shadow-[0_0px_1px_0_rgb(0_0_0/0.2)]",
    "transition-[color,background-color,border-color,box-shadow,scale,--tw-gradient-from,--tw-gradient-to] duration-200 ease-out",
    "motion-safe:active:scale-[0.97]",
  ],
};

// The base Button sizes every svg with `[&_svg]:size-4`, which beats a class
// on the icon itself, so the icon size is set from the button.
const SIZES = {
  sm: "h-8 px-3 text-sm [&_svg]:size-3.5",
  default: "h-10 px-4",
  lg: "h-11 px-5 [&_svg]:size-5",
};

const ICON_TRANSITION =
  "transition-[opacity,rotate,scale,color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-[opacity,color]";

export default function SwitchButton({
  className,
  variant = "minimal",
  size = "default",
  showLabel = true,
  theme,
  onThemeChange,
  onClick,
  ...props
}: SwitchButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) {
      return;
    }
    const root = document.documentElement;
    const current =
      theme ?? (root.classList.contains("dark") ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    if (theme === undefined) {
      root.classList.toggle("dark", next === "dark");
      root.style.colorScheme = next;
    }
    onThemeChange?.(next);
  };

  // The theme is unknown during SSR, so the light/dark look below is driven by
  // `dark:` classes instead of branching on the theme while rendering.
  return (
    <Button
      aria-label="Toggle theme"
      className={cn(
        "group relative",
        "text-zinc-600 dark:text-zinc-300",
        "hover:text-zinc-800 dark:hover:text-zinc-100",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      variant="ghost"
      {...props}
      onClick={handleClick}
    >
      <span className="flex items-center gap-2">
        <span className="relative inline-flex">
          <Sun
            className={cn(
              ICON_TRANSITION,
              "rotate-0 group-hover:rotate-[360deg] group-hover:scale-110",
              "drop-shadow-[0_0_12px_rgba(252,211,77,0.3)]",
              "text-amber-500 group-hover:text-amber-600",
              "dark:rotate-90 dark:scale-90 dark:opacity-0"
            )}
          />
          <Moon
            className={cn(
              ICON_TRANSITION,
              "absolute inset-0",
              "-rotate-90 scale-90 opacity-0",
              "dark:rotate-0 dark:scale-100 dark:opacity-100",
              "dark:group-hover:-rotate-12 dark:group-hover:scale-110"
            )}
          />
        </span>
        {showLabel && (
          <span aria-hidden="true" className="relative font-medium capitalize">
            <span
              className={cn(
                "absolute inset-0",
                "opacity-100 dark:opacity-0",
                "transition-opacity duration-300 ease-out"
              )}
            >
              Light
              <span
                className={cn(
                  "absolute -bottom-px left-0 h-px w-full",
                  "bg-linear-to-r from-zinc-400/0 via-zinc-400/50 to-zinc-400/0",
                  "dark:from-zinc-600/0 dark:via-zinc-600/50 dark:to-zinc-600/0",
                  "opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-200"
                )}
              />
            </span>
            <span
              className={cn(
                "absolute inset-0",
                "opacity-0 dark:opacity-100",
                "transition-opacity duration-300 ease-out"
              )}
            >
              Dark
              <span
                className={cn(
                  "absolute -bottom-px left-0 h-px w-full",
                  "bg-linear-to-r from-zinc-400/0 via-zinc-400/50 to-zinc-400/0",
                  "dark:from-zinc-600/0 dark:via-zinc-600/50 dark:to-zinc-600/0",
                  "opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-200"
                )}
              />
            </span>
            <span className="opacity-0">Light</span>
          </span>
        )}
      </span>
    </Button>
  );
}
