"use client";

import { RotateCcwIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { EASE_COLORS, FOCUS, META } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import { Preview, type PreviewProps } from "./preview";

/** A preview whose demo plays once on mount, so it offers a Replay. */
export function PreviewClient({ children, ...props }: PreviewProps) {
  const [run, setRun] = useState(0);

  return (
    <Preview
      {...props}
      actions={
        <button
          className={cn(
            META,
            "inline-flex shrink-0 items-center gap-1.5 hover:text-black dark:hover:text-white",
            EASE_COLORS,
            FOCUS
          )}
          onClick={() => setRun((r) => r + 1)}
          type="button"
        >
          Replay
          <RotateCcwIcon aria-hidden className="size-3" />
        </button>
      }
    >
      <Fragment key={run}>{children}</Fragment>
    </Preview>
  );
}
