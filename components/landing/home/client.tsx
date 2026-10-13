"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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
