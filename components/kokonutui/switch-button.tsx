"use client";

/**
 * @author: @dorianbaffier
 * @description: Switch Button
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SwitchButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "minimal";
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
}

export default function SwitchButton({
  className,
  variant = "minimal",
  size = "default",
  showLabel = true,
  ...props
}: SwitchButtonProps) {
  const { setTheme, theme } = useTheme();

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const variants = {
    minimal: [
      "rounded-lg",
      "bg-gradient-to-b from-zinc-50/95 to-zinc-100/95 dark:from-zinc-800/95 dark:to-zinc-900/95",
      "hover:from-zinc-100/95 hover:to-zinc-200/95 dark:hover:from-zinc-700/95 dark:hover:to-zinc-800/95",
      "border border-zinc-200 dark:border-zinc-700/80",
      "hover:border-zinc-300 dark:hover:border-zinc-600",
      "shadow-[0_1px_2px_-1px_rgb(0_0_0/0.1),0_1px_3px_-2px_rgb(0_0_0/0.1)] dark:shadow-[0_1px_2px_-1px_rgb(0_0_0/0.3),0_1px_3px_-2px_rgb(0_0_0/0.3)]",
      "hover:shadow-[0_2px_4px_-2px_rgb(0_0_0/0.15),0_2px_6px_-3px_rgb(0_0_0/0.15)] dark:hover:shadow-[0_2px_4px_-2px_rgb(0_0_0/0.4),0_2px_6px_-3px_rgb(0_0_0/0.4)]",
      "active:shadow-[0_0px_1px_0_rgb(0_0_0/0.1)] dark:active:shadow-[0_0px_1px_0_rgb(0_0_0/0.2)]",
      "transition-[color,background-color,border-color,box-shadow,scale,--tw-gradient-from,--tw-gradient-to] duration-200 ease-out",
      "motion-safe:active:scale-[0.97]",
      "relative",
      "after:absolute after:inset-0 after:rounded-lg after:bg-gradient-to-t after:from-white/10 after:to-transparent after:opacity-0 hover:after:opacity-100 after:transition-opacity",
      "before:absolute before:inset-[1px] before:rounded-[7px] before:bg-gradient-to-b before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity dark:before:from-white/5",
    ],
  };

  const sizes = {
    sm: "h-8 px-3 text-sm",
    default: "h-10 px-4",
    lg: "h-11 px-5",
  };

  return (
    <Button
      className={cn(
        "group relative",
        "text-zinc-600 dark:text-zinc-300",
        "hover:text-zinc-800 dark:hover:text-zinc-100",
        variants[variant],
        sizes[size],
        className
      )}
      onClick={handleThemeToggle}
      {...props}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          "transition-all duration-300 ease-out"
        )}
      >
        <Sun
          className={cn(
            "transition-[rotate,scale,color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-colors",
            size === "sm" && "h-3.5 w-3.5",
            size === "default" && "h-4 w-4",
            size === "lg" && "h-5 w-5",
            "group-hover:rotate-[360deg] group-hover:scale-110",
            theme === "dark" ? "rotate-180" : "rotate-0",
            "transform-gpu",
            "drop-shadow-[0_0_12px_rgba(252,211,77,0.3)] dark:drop-shadow-[0_0_12px_rgba(252,211,77,0.2)]",
            theme === "dark"
              ? "text-zinc-300 group-hover:text-zinc-100"
              : "text-amber-500 group-hover:text-amber-600",
            "group-active:scale-95"
          )}
        />
        {showLabel && (
          <span
            className={cn(
              "relative font-medium capitalize",
              "transition-opacity duration-300 ease-out"
            )}
          >
            <span
              className={cn(
                "absolute inset-0",
                theme === "dark" ? "opacity-0" : "opacity-100",
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
                theme === "dark" ? "opacity-100" : "opacity-0",
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
      </div>
      <span
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100",
          "bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.12),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.07),transparent_70%)]",
          "transition-opacity duration-500",
          "pointer-events-none",
          "z-[2]"
        )}
      />
    </Button>
  );
}
