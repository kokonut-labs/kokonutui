"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { EASE_COLORS, FOCUS } from "./styles";

const COPIED_MS = 1600;

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
  "absolute inset-0 size-full transition-[opacity,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity";

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
      className={cn("relative inline-block size-3.5 shrink-0", className)}
    >
      <CopyIcon
        className={cn(
          ICON_SWAP,
          copied
            ? "opacity-0 blur-[2px] motion-reduce:blur-none"
            : "opacity-100 blur-none"
        )}
      />
      <CheckIcon
        className={cn(
          ICON_SWAP,
          "text-[#2CD242] dark:text-[#3BB44B]",
          copied
            ? "opacity-100 blur-none"
            : "opacity-0 blur-[2px] motion-reduce:blur-none"
        )}
      />
    </span>
  );
}

/** A copyable shell command. The whole chip is the button. */
export function CommandChip({
  command,
  prefix = "$",
  label,
  className,
}: {
  command: string;
  /** Shell prompt shown before the command; null for a code snippet. */
  prefix?: string | null;
  /** Accessible name when the command alone doesn't say what it is. */
  label?: string;
  className?: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <button
      aria-label={copied ? "Copied" : `Copy ${label ?? command}`}
      className={cn(
        "group flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-black/[0.08] bg-white px-4 py-2.5 text-left font-mono text-[13px] text-black/80 hover:border-black/15 active:bg-black/[0.02] dark:border-white/[0.1] dark:bg-black dark:text-white/80 dark:active:bg-white/[0.03] dark:hover:border-white/20",
        EASE_COLORS,
        FOCUS,
        className
      )}
      onClick={() => copy(command)}
      type="button"
    >
      {prefix ? (
        <span aria-hidden className="text-black/30 dark:text-white/30">
          {prefix}
        </span>
      ) : null}
      {/* Wraps on narrow screens (at spaces first) rather than hiding the
          flag you came for. */}
      <span className="wrap-anywhere min-w-0 flex-1 leading-snug sm:truncate">
        {command}
      </span>
      <CopyIconSwap
        className="text-black/45 group-hover:text-black/70 dark:text-white/45 dark:group-hover:text-white/70"
        copied={copied}
      />
    </button>
  );
}

/**
 * A round avatar for a post. The initial sits underneath, so a profile image
 * that fails to load (or is blocked) leaves a clean letter, not a broken icon.
 */
export function Avatar({
  src,
  name,
  size = 36,
  className,
}: {
  src: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/[0.06] font-medium text-[13px] text-black/60 dark:bg-white/[0.08] dark:text-white/60",
        className
      )}
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase()}
      {failed ? null : (
        <Image
          alt=""
          className="absolute inset-0 size-full object-cover"
          height={size}
          onError={() => setFailed(true)}
          src={src}
          width={size}
        />
      )}
    </span>
  );
}
