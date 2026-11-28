/**
 * @author: @kokonutui
 * @description: Stacked Empty State
 * @version: 1.0.0
 * @date: 2026-11-28
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type LucideIcon, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StackedEmptyStateProps {
  /** Drawn on the blue tile of the front card. */
  icon?: LucideIcon;
  title?: string;
  description?: ReactNode;
  /** Buttons, primary first. Leave out for the demo's two. */
  actions?: ReactNode;
  className?: string;
}

const BACK_CARD =
  "absolute top-4 h-[78px] w-[128px] rounded-xl border border-black/[0.06] bg-zinc-100/80 motion-safe:transition-[rotate,translate] motion-safe:duration-300 motion-safe:ease-out dark:border-white/[0.08] dark:bg-zinc-800/60";

const DOT =
  "size-4 rounded-full bg-zinc-200 ring-2 ring-white dark:bg-zinc-700 dark:ring-zinc-950";

const LINE = "h-2 rounded-full bg-zinc-100 dark:bg-zinc-800";

/**
 * A blank post on top of two others, fanned out like one post going to
 * several accounts. The back cards spread a little further on hover.
 */
function StackedCards({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div aria-hidden="true" className="relative h-[104px] w-[208px]">
      <div
        className={cn(
          BACK_CARD,
          "left-1 -rotate-6 group-hover/empty:-translate-x-1 group-hover/empty:-rotate-9"
        )}
      />
      <div
        className={cn(
          BACK_CARD,
          "right-1 rotate-6 group-hover/empty:translate-x-1 group-hover/empty:rotate-9"
        )}
      />
      <div className="absolute top-0 left-1/2 flex h-[96px] w-[144px] -translate-x-1/2 flex-col justify-between rounded-xl border border-zinc-300 border-dashed bg-white p-3 group-hover/empty:-translate-y-0.5 motion-safe:transition-[translate] motion-safe:duration-300 motion-safe:ease-out dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white dark:bg-blue-500">
            <Icon className="size-4" strokeWidth={2.5} />
          </span>
          <span className="flex -space-x-1.5">
            <span className={DOT} />
            <span className={DOT} />
            <span className={DOT} />
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={cn(LINE, "w-20")} />
          <span className={cn(LINE, "w-12")} />
        </div>
      </div>
    </div>
  );
}

function DemoActions() {
  return (
    <>
      <button
        className="h-9 rounded-full bg-blue-600 px-4 font-medium text-[13px] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(29_78_216/0.35)] outline-hidden transition-[background-color,scale] duration-150 ease-out hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 active:scale-[0.97] dark:bg-blue-500 dark:focus-visible:ring-offset-zinc-950 dark:hover:bg-blue-600"
        type="button"
      >
        New post
      </button>
      <button
        className="h-9 rounded-full px-4 font-medium text-[13px] text-zinc-700 outline-hidden ring-1 ring-black/[0.08] transition-[background-color,scale] duration-150 ease-out hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-[0.97] dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-white/[0.05]"
        type="button"
      >
        Write a draft
      </button>
    </>
  );
}

/** The stacked-card drawing, a title, one line of copy and the actions. */
export default function StackedEmptyState({
  icon = PenLine,
  title = "No posts yet",
  description = "Write one post and send it to every account you connect.",
  actions,
  className,
}: StackedEmptyStateProps) {
  return (
    <div
      className={cn(
        "group/empty flex flex-col items-center justify-center px-4 text-center",
        className
      )}
    >
      <StackedCards icon={icon} />
      <p className="mt-5 font-medium text-[15px] text-zinc-900 dark:text-zinc-100">
        {title}
      </p>
      <p className="mt-1 max-w-sm text-balance text-[13.5px] text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      {actions === null ? null : (
        <div className="mt-5 flex items-center gap-2">
          {actions === undefined ? <DemoActions /> : actions}
        </div>
      )}
    </div>
  );
}
