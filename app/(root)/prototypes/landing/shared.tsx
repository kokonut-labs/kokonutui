"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const COPIED_MS = 1600;

/** Press feedback for anything clickable: a quick 0.97 squeeze. */
export const PRESS =
  "transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97]";

/** Copy to clipboard and report it for a moment; the timer is cleaned up. */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    []
  );

  const copy = useCallback((value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        if (timer.current !== null) {
          window.clearTimeout(timer.current);
        }
        timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
      },
      () => {
        // Clipboard can be denied (insecure context, permissions). The
        // command stays visible and selectable, so there is nothing to undo.
      }
    );
  }, []);

  return { copied, copy };
}

const ICON_SWAP =
  "absolute inset-0 size-full transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity";

/**
 * Copy and check icons stacked in one box. They cross-fade with a 2px blur so
 * the swap reads as one icon morphing rather than two icons trading places.
 */
export function CopyIconSwap({
  copied,
  className,
}: {
  copied: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-block size-3.5", className)}
    >
      <CopyIcon
        className={cn(
          ICON_SWAP,
          copied
            ? "scale-[0.8] opacity-0 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none"
            : "scale-100 opacity-100 blur-none"
        )}
      />
      <CheckIcon
        className={cn(
          ICON_SWAP,
          "text-[#2CD242] dark:text-[#3BB44B]",
          copied
            ? "scale-100 opacity-100 blur-none"
            : "scale-[0.8] opacity-0 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none"
        )}
      />
    </span>
  );
}

/** Inline style for one step of a `.proto-enter` cascade. */
export function enter(index: number, delayMs = 0): CSSProperties {
  return {
    "--enter-index": index,
    "--enter-delay": `${delayMs}ms`,
  } as CSSProperties;
}

/** A letter avatar, so quotes don't depend on hot-linked profile images. */
export function Monogram({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] font-medium text-[13px] text-black/70 dark:bg-white/[0.08] dark:text-white/70",
        className
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
