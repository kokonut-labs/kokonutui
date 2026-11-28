"use client";

/**
 * @author: @kokonutui
 * @description: Platform Picker
 * @version: 1.0.0
 * @date: 2026-11-28
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Platform {
  id: string;
  name: string;
  /** A mark for the tile. Known ids get one; others get their initial. */
  icon?: ReactNode;
  /** Accounts already connected on it. */
  connected?: number;
  /** One line on what connecting needs, shown on the second step. */
  hint?: string;
}

export interface PlatformPickerProps {
  title?: string;
  description?: string;
  platforms?: Platform[];
  /** Accounts the plan allows. Shows a meter under the grid. */
  limit?: number;
  /**
   * Connects an account on the picked platform. Resolve when it's done; the
   * picker goes back to the grid and counts it. Leave out for the demo.
   */
  onConnect?: (platform: Platform) => Promise<void> | void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const DEMO_CONNECT_MS = 1100;

const DEMO_PLATFORMS: Platform[] = [
  { id: "x", name: "X", connected: 1 },
  {
    id: "bluesky",
    name: "Bluesky",
    hint: "Connect with your handle and an app password.",
  },
  { id: "linkedin", name: "LinkedIn", connected: 1 },
  { id: "threads", name: "Threads" },
  {
    id: "discord",
    name: "Discord",
    hint: "Connect a channel with its webhook URL.",
  },
  { id: "pinterest", name: "Pinterest" },
];

export default function PlatformPicker({
  title = "Add an account",
  description = "Pick a platform. You can connect several accounts on each one.",
  platforms: given,
  limit = 5,
  onConnect,
  className,
}: PlatformPickerProps) {
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<Platform | null>(null);
  const [connecting, setConnecting] = useState(false);
  // The step swap unmounts what had focus, so going back puts it on the
  // platform that was open.
  const last = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const platforms = (given ?? DEMO_PLATFORMS).map((platform) => ({
    ...platform,
    connected: (platform.connected ?? 0) + (extra[platform.id] ?? 0),
  }));
  const used = platforms.reduce((sum, p) => sum + (p.connected ?? 0), 0);
  const isFull = used >= limit;

  const back = () => {
    last.current = open?.id ?? null;
    setOpen(null);
  };

  const connect = async (platform: Platform) => {
    setConnecting(true);
    try {
      if (onConnect) {
        await onConnect(platform);
      } else {
        await new Promise((resolve) => {
          timer.current = setTimeout(resolve, DEMO_CONNECT_MS);
        });
      }
      setExtra((counts) => ({
        ...counts,
        [platform.id]: (counts[platform.id] ?? 0) + 1,
      }));
      back();
    } catch {
      // A refused sign-in leaves the step open, so they can try again.
    } finally {
      setConnecting(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "flex w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_6px_16px_rgb(0_0_0/0.06)] ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:shadow-none dark:ring-white/10",
          className
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {open ? (
            <Step direction={1} key={open.id}>
              <ConnectStep
                connecting={connecting}
                isFull={isFull}
                onBack={back}
                onConnect={() => connect(open)}
                platform={open}
              />
            </Step>
          ) : (
            <Step direction={-1} key="pick">
              <PickStep
                description={description}
                onPick={setOpen}
                platforms={platforms}
                returnFocusTo={last.current}
                title={title}
              />
            </Step>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 border-black/[0.06] border-t px-5 py-3 text-[13px] dark:border-white/[0.08]">
          <p className="text-zinc-500 tabular-nums dark:text-zinc-400">
            {isFull
              ? `All ${limit} accounts on your plan are in use.`
              : `${used} of ${limit} accounts on your plan`}
          </p>
          <span className="flex h-1 w-20 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <span
              className="h-full origin-left rounded-full bg-blue-600 transition-[scale] duration-300 ease-out dark:bg-blue-500"
              style={{ width: "100%", scale: `${Math.min(1, used / limit)} 1` }}
            />
          </span>
        </div>
      </div>
    </MotionConfig>
  );
}

function Step({
  children,
  direction,
}: {
  children: ReactNode;
  direction: 1 | -1;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 * direction }}
      initial={{ opacity: 0, x: 8 * direction }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

function PickStep({
  title,
  description,
  platforms,
  onPick,
  returnFocusTo,
}: {
  title: string;
  description: string;
  platforms: Platform[];
  onPick: (platform: Platform) => void;
  returnFocusTo: string | null;
}) {
  const grid = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: on mount only
  useEffect(() => {
    if (returnFocusTo) {
      grid.current
        ?.querySelector<HTMLElement>(`[data-platform="${returnFocusTo}"]`)
        ?.focus();
    }
  }, []);

  return (
    <div>
      <div className="px-5 pt-5 pb-4">
        <p className="font-semibold text-[17px] text-zinc-900 tracking-tight dark:text-zinc-100">
          {title}
        </p>
        <p className="mt-1 text-[13.5px] text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      <div
        className="grid grid-cols-1 gap-1.5 px-5 pb-5 sm:grid-cols-2"
        ref={grid}
      >
        {platforms.map((platform) => (
          <button
            className="group/tile flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-hidden ring-1 ring-black/[0.08] transition-[background-color,box-shadow,scale] duration-150 ease-out hover:bg-zinc-50 hover:ring-black/[0.12] focus-visible:ring-2 focus-visible:ring-blue-500/60 active:scale-[0.98] dark:ring-white/10 dark:hover:bg-white/[0.04] dark:hover:ring-white/[0.16]"
            data-platform={platform.id}
            key={platform.id}
            onClick={() => onPick(platform)}
            type="button"
          >
            <Tile platform={platform} />
            <span className="flex-1 truncate font-medium text-[14px] text-zinc-900 dark:text-zinc-100">
              {platform.name}
            </span>
            {platform.connected ? (
              <span className="text-[12.5px] text-zinc-500 tabular-nums dark:text-zinc-400">
                {platform.connected} connected
              </span>
            ) : (
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-zinc-400 opacity-0 transition-opacity duration-150 ease-out group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConnectStep({
  platform,
  connecting,
  isFull,
  onBack,
  onConnect,
}: {
  platform: Platform;
  connecting: boolean;
  isFull: boolean;
  onBack: () => void;
  onConnect: () => void;
}) {
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => primary.current?.focus(), []);

  return (
    <div className="px-5 pt-4 pb-5">
      <button
        className="-ml-1.5 flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] text-zinc-500 outline-hidden transition-colors duration-150 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:text-zinc-400 dark:hover:text-zinc-100"
        disabled={connecting}
        onClick={onBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        All platforms
      </button>

      <div className="mt-3 flex items-center gap-3">
        <Tile large platform={platform} />
        <div className="min-w-0">
          <p className="font-semibold text-[17px] text-zinc-900 tracking-tight dark:text-zinc-100">
            Connect {platform.name}
          </p>
          <p className="text-[13.5px] text-zinc-500 dark:text-zinc-400">
            {platform.hint ??
              `You'll sign in on ${platform.name} and come straight back.`}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        {isFull ? (
          <p className="mr-auto text-[13px] text-zinc-500 dark:text-zinc-400">
            Your plan has no free account slots.
          </p>
        ) : null}
        <button
          className="flex h-9 items-center gap-2 rounded-full bg-blue-600 px-4 font-medium text-[13px] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(29_78_216/0.35)] outline-hidden transition-[background-color,opacity,scale] duration-150 ease-out hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 dark:bg-blue-500 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-blue-600"
          disabled={connecting || isFull}
          onClick={onConnect}
          ref={primary}
          type="button"
        >
          {connecting ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-3.5 animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {connecting ? "Connecting…" : `Continue with ${platform.name}`}
        </button>
      </div>
    </div>
  );
}

function Tile({ platform, large }: { platform: Platform; large?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-white text-zinc-900 ring-1 ring-black/[0.08] dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10",
        large ? "size-10 rounded-xl [&_svg]:size-[18px]" : "size-7"
      )}
    >
      {platform.icon ?? <PlatformMark id={platform.id} />}
    </span>
  );
}

const MARKS: Record<string, { viewBox: string; d: string }> = {
  x: {
    viewBox: "0 0 24 24",
    d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  bluesky: {
    viewBox: "0 0 24 24",
    d: "M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z",
  },
  linkedin: {
    viewBox: "0 0 24 24",
    d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.064 2.064 0 1 1 0-4.128 2.064 2.064 0 0 1 0 4.128zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  threads: {
    viewBox: "0 0 192 192",
    d: "M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.07 0h-.113C68.882.194 47.292 9.642 32.788 28.08 19.882 44.485 13.224 67.315 13.001 95.932L13 96v.067c.224 28.617 6.882 51.447 19.788 67.854C47.292 182.358 68.882 191.806 96.957 192h.113c24.96-.173 42.554-6.708 57.048-21.189 18.963-18.945 18.392-42.692 12.142-57.27-4.484-10.454-13.033-18.945-24.723-24.553ZM98.44 129.507c-10.44.588-21.286-4.098-21.82-14.135-.397-7.442 5.296-15.746 22.461-16.735 1.966-.114 3.895-.169 5.79-.169 6.235 0 12.068.606 17.371 1.765-1.978 24.702-13.58 28.713-23.802 29.274Z",
  },
  discord: {
    viewBox: "0 0 256 199",
    d: "M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046-19.692-2.961-39.203-2.961-58.533 0-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161.094 161.094 0 0 0 79.735 175.3a136.413 136.413 0 0 1-21.846-10.632 108.636 108.636 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237 136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848 21.142-6.58 42.646-16.637 64.815-33.213 5.316-56.288-9.08-105.09-38.056-148.36ZM85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.804 23.015 26.2.02 14.375-10.148 26.18-23.015 26.18Zm85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2 0 14.375-10.148 26.18-23.015 26.18Z",
  },
  pinterest: {
    viewBox: "0 0 256 256",
    d: "M0 128.002c0 52.414 31.518 97.442 76.619 117.239c-.36-8.938-.064-19.668 2.228-29.393c2.461-10.391 16.47-69.748 16.47-69.748s-4.089-8.173-4.089-20.252c0-18.969 10.994-33.136 24.686-33.136c11.643 0 17.268 8.745 17.268 19.217c0 11.704-7.465 29.211-11.304 45.426c-3.207 13.578 6.808 24.653 20.203 24.653c24.252 0 40.586-31.149 40.586-68.055c0-28.054-18.895-49.052-53.262-49.052c-38.828 0-63.017 28.956-63.017 61.3c0 11.152 3.288 19.016 8.438 25.106c2.368 2.797 2.697 3.922 1.84 7.134c-.614 2.355-2.024 8.025-2.608 10.272c-.852 3.242-3.479 4.401-6.409 3.204c-17.884-7.301-26.213-26.886-26.213-48.902c0-36.361 30.666-79.961 91.482-79.961c48.87 0 81.035 35.364 81.035 73.325c0 50.213-27.916 87.726-69.066 87.726c-13.819 0-26.818-7.47-31.271-15.955c0 0-7.431 29.492-9.005 35.187c-2.714 9.869-8.026 19.733-12.883 27.421a127.897 127.897 0 0 0 36.277 5.249c70.684 0 127.996-57.309 127.996-128.005C256.001 57.309 198.689 0 128.005 0C57.314 0 0 57.309 0 128.002",
  },
};

/** Single-color marks, so they take the tile's ink in both themes. */
function PlatformMark({ id }: { id: string }) {
  const mark = MARKS[id];
  if (!mark) {
    return (
      <span className="font-semibold text-[12px] uppercase">
        {id.slice(0, 1)}
      </span>
    );
  }
  return (
    <svg aria-hidden="true" className="size-3.5" viewBox={mark.viewBox}>
      <path d={mark.d} fill="currentColor" />
    </svg>
  );
}
