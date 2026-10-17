"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import Image from "next/image";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { announceCopy } from "@/components/copy-toast";
import { cn } from "@/lib/utils";

const COPIED_MS = 1600;

/**
 * Copy to clipboard and report it for a moment; the timer is cleaned up. The
 * site toast confirms it too, naming `detail` (the value itself by default).
 */
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

  const copy = useCallback((value: string, detail: string = value) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        announceCopy(detail);
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

/** Hugeicons AI Chat 02, the icon Pro uses for agents. */
export function AgentIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Agent</title>
      <path
        d="M14.1706 20.8905C18.3536 20.6125 21.6856 17.2332 21.9598 12.9909C22.0134 12.1607 22.0134 11.3009 21.9598 10.4707C21.6856 6.22838 18.3536 2.84913 14.1706 2.57107C12.7435 2.47621 11.2536 2.47641 9.8294 2.57107C5.64639 2.84913 2.31441 6.22838 2.04024 10.4707C1.98659 11.3009 1.98659 12.1607 2.04024 12.9909C2.1401 14.536 2.82343 15.9666 3.62791 17.1746C4.09501 18.0203 3.78674 19.0758 3.30021 19.9978C2.94941 20.6626 2.77401 20.995 2.91484 21.2351C3.05568 21.4752 3.37026 21.4829 3.99943 21.4982C5.24367 21.5285 6.08268 21.1757 6.74868 20.6846C7.1264 20.4061 7.31527 20.2668 7.44544 20.2508C7.5756 20.2348 7.83177 20.3403 8.34401 20.5513C8.8044 20.7409 9.33896 20.8579 9.8294 20.8905C11.2536 20.9852 12.7435 20.9854 14.1706 20.8905Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M7.5 15L9.34189 9.47434C9.43631 9.19107 9.7014 9 10 9C10.2986 9 10.5637 9.19107 10.6581 9.47434L12.5 15M15.5 9V15M8.5 13H11.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
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
  icon: Icon = CopyIcon,
}: {
  copied: boolean;
  className?: string;
  /** The resting icon; the check replaces it once copied. */
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-block size-3.5 shrink-0", className)}
    >
      <Icon
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
