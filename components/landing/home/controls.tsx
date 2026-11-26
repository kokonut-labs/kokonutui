"use client";

import type { ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { CopyIconSwap, useCopy } from "./client";
import type { McpClient } from "./data";
import { ClaudeMark, CursorMark, OpenAIMark, VSCodeMark } from "./logos";
import { EASE_COLORS, FOCUS } from "./styles";

// Each editor's mark takes its own color once picked.
export const CLIENT_MARKS: Record<
  McpClient,
  { Mark: (props: SVGProps<SVGSVGElement>) => ReactNode; color: string }
> = {
  claude: { Mark: ClaudeMark, color: "text-[#D57156]" },
  cursor: { Mark: CursorMark, color: "text-black dark:text-white" },
  vscode: { Mark: VSCodeMark, color: "text-[#0078D4] dark:text-[#3EA2FF]" },
  codex: { Mark: OpenAIMark, color: "text-black dark:text-white" },
};

/**
 * A copyable line that wraps instead of truncating, for narrow columns where
 * the part you came for (the component name) sits at the end.
 */
export function CopyLine({
  value,
  display,
  prefix,
  label,
  className,
}: {
  value: string;
  /** What to show, when it should break somewhere better than anywhere. */
  display?: ReactNode;
  prefix?: ReactNode;
  label?: string;
  className?: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <button
      aria-label={copied ? "Copied" : `Copy ${label ?? value}`}
      className={cn(
        "group flex w-full min-w-0 items-start gap-2.5 text-left font-mono text-[12px] leading-[1.6]",
        EASE_COLORS,
        FOCUS,
        className
      )}
      onClick={() => copy(value)}
      type="button"
    >
      {prefix ? (
        <span aria-hidden className="shrink-0 text-black/35 dark:text-white/35">
          {prefix}
        </span>
      ) : null}
      <span className="wrap-anywhere min-w-0 flex-1">{display ?? value}</span>
      <CopyIconSwap
        className="mt-[3px] text-black/45 group-hover:text-black/70 dark:text-white/45 dark:group-hover:text-white/70"
        copied={copied}
      />
    </button>
  );
}
