import { Command } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * @author: @dorianbaffier
 * @description: Command Button
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

export default function CommandButton({
  className,
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn(
        "relative p-2",
        "overflow-hidden rounded-lg",
        "bg-gradient-to-b from-zinc-50 to-zinc-100",
        "dark:from-zinc-800 dark:to-zinc-900",
        "border border-zinc-200 dark:border-zinc-800",
        "hover:border-zinc-300 dark:hover:border-zinc-700",
        "transition-[border-color,scale] duration-150 ease-out",
        "active:scale-[0.97] motion-reduce:active:scale-100",
        "group",
        className
      )}
    >
      <Command className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {children || "CMD + K"}
      </span>
      {/* Snaps back on leave instead of sweeping back across the label. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0",
          "bg-gradient-to-r from-indigo-500/0 via-indigo-500/10 to-indigo-500/0",
          "translate-x-[-100%]",
          "group-hover:translate-x-[100%]",
          "group-hover:transition-transform group-hover:duration-300 group-hover:ease-out",
          "motion-reduce:hidden"
        )}
      />
    </Button>
  );
}
