"use client";

/**
 * @author: @kokonutui
 * @description: Account Card
 * @version: 1.0.0
 * @date: 2026-11-28
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { RefreshCw } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

export interface AccountCardProps {
  /** The handle, e.g. "@northwind". Bluesky's ".bsky.social" is dropped. */
  handle?: string;
  /** "x", "bluesky", "linkedin" and "threads" get their marks; others get an initial. */
  platform?: string;
  /** Shown next to the platform, e.g. "Bluesky". Defaults to a known name. */
  platformName?: string;
  avatarUrl?: string;
  followers?: number;
  /** Posts per day, oldest first, usually the last 14 days. */
  activity?: number[];
  /** A dead connection swaps the activity line for Reconnect. */
  status?: "active" | "expired";
  onReconnect?: () => void;
  /** A menu or buttons on the right of the header. */
  actions?: ReactNode;
  className?: string;
}

const NAMES: Record<string, string> = {
  x: "X",
  bluesky: "Bluesky",
  linkedin: "LinkedIn",
  threads: "Threads",
};

const DEMO = {
  handle: "northwind.bsky.social",
  platform: "bluesky",
  followers: 2430,
  activity: [0, 1, 0, 2, 1, 0, 0, 3, 1, 0, 2, 0, 1, 1],
};

const DEFAULT_HANDLE_SUFFIX = /\.bsky\.social$/;
const LEADING_AT = /^@/;

function formatFollowers(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

function posts(count: number) {
  return `${count} ${count === 1 ? "post" : "posts"}`;
}

/** "Today", "Yesterday" or "N days ago", counted back from the last bar. */
function dayLabel(index: number, length: number) {
  const back = length - 1 - index;
  if (back === 0) {
    return "today";
  }
  return back === 1 ? "yesterday" : `${back} days ago`;
}

function summary(activity: number[]) {
  const total = activity.reduce((sum, count) => sum + count, 0);
  return total === 0
    ? `No posts in ${activity.length} days`
    : `${posts(total)} in ${activity.length} days`;
}

export default function AccountCard({
  handle = DEMO.handle,
  platform = DEMO.platform,
  platformName,
  avatarUrl,
  followers = DEMO.followers,
  activity = DEMO.activity,
  status = "active",
  onReconnect,
  actions,
  className,
}: AccountCardProps) {
  const [day, setDay] = useState<number | null>(null);
  const shown = handle.replace(DEFAULT_HANDLE_SUFFIX, "");
  const name = platformName ?? NAMES[platform] ?? platform;
  const active = status === "active";

  return (
    // The same frame in every state: a dead connection is said once, by the
    // Reconnect line, not by a red ring around the whole card.
    <div
      className={cn(
        "w-full max-w-[300px] rounded-xl bg-white p-3 ring-1 ring-black/[0.08] transition-[box-shadow] duration-150 ease-out hover:ring-black/[0.12] dark:bg-zinc-900 dark:ring-white/10 dark:hover:ring-white/[0.16]",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Avatar handle={shown} src={avatarUrl} />
          {/* The platform rides on the avatar: one identity, not two. */}
          <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-white text-zinc-900 ring-2 ring-white dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-900">
            <PlatformMark platform={platform} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate font-medium text-[14px] text-zinc-900 leading-tight dark:text-zinc-100"
            title={handle}
          >
            {shown}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-zinc-500 dark:text-zinc-400">
            {name}
            {followers === undefined
              ? null
              : ` · ${formatFollowers(followers)} followers`}
          </p>
        </div>
        {actions}
      </div>

      <div className="mt-3 flex h-6 items-center justify-between gap-3">
        {active ? (
          <span
            aria-live="polite"
            className="truncate text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400"
          >
            {day === null
              ? summary(activity)
              : `${posts(activity[day] ?? 0)} ${dayLabel(day, activity.length)}`}
          </span>
        ) : (
          <button
            className="-ml-1 flex items-center gap-1.5 rounded-md px-1 font-medium text-[13px] text-red-600 outline-hidden transition-colors duration-150 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-400 dark:hover:text-red-300"
            onClick={onReconnect}
            type="button"
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            Reconnect
          </button>
        )}
        <Sparkbars
          onDay={active ? setDay : undefined}
          selected={day}
          values={activity}
        />
      </div>
    </div>
  );
}

function Avatar({ handle, src }: { handle: string; src?: string }) {
  if (src) {
    return (
      // biome-ignore lint/performance/noImgElement: plain <img> keeps the component framework-agnostic and works with any avatar host.
      <img
        alt=""
        className="size-10 rounded-full bg-zinc-100 object-cover dark:bg-zinc-800"
        draggable={false}
        height={40}
        src={src}
        width={40}
      />
    );
  }
  return (
    <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 font-medium text-[14px] text-zinc-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">
      {handle.replace(LEADING_AT, "").slice(0, 1)}
    </span>
  );
}

/**
 * A day per bar. Empty days are faint dots on the baseline, so a quiet
 * fortnight reads as calm rather than as a dashed rule. Hovering a day names
 * it in the line on the left.
 */
function Sparkbars({
  values,
  selected,
  onDay,
}: {
  values: number[];
  selected: number | null;
  onDay?: (day: number | null) => void;
}) {
  const peak = Math.max(1, ...values);
  return (
    <span
      aria-hidden="true"
      className="flex h-4 shrink-0 items-end"
      onPointerLeave={() => onDay?.(null)}
    >
      {values.map((count, day) => (
        <span
          className="flex h-full w-[6px] items-end justify-center"
          // biome-ignore lint/suspicious/noArrayIndexKey: days are positions
          key={day}
          onPointerEnter={() => onDay?.(day)}
        >
          <span
            className={cn(
              "w-[3px] rounded-full transition-colors duration-150",
              count === 0 ? "size-[3px]" : "",
              barTone(count, selected === null || selected === day)
            )}
            style={
              count === 0
                ? undefined
                : { height: `${Math.max(40, (count / peak) * 100)}%` }
            }
          />
        </span>
      ))}
    </span>
  );
}

function barTone(count: number, lit: boolean) {
  if (count === 0) {
    return lit
      ? "bg-zinc-900/20 dark:bg-white/20"
      : "bg-zinc-900/10 dark:bg-white/10";
  }
  return lit
    ? "bg-zinc-900/45 dark:bg-white/50"
    : "bg-zinc-900/15 dark:bg-white/15";
}

/** Single-color marks, so they take the card's ink in both themes. */
function PlatformMark({ platform }: { platform: string }) {
  switch (platform) {
    case "x":
      return (
        <svg aria-hidden="true" className="size-3" viewBox="0 0 24 24">
          <path
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
            fill="currentColor"
          />
        </svg>
      );
    case "bluesky":
      return (
        <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24">
          <path
            d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"
            fill="currentColor"
          />
        </svg>
      );
    case "linkedin":
      return (
        <svg aria-hidden="true" className="size-3" viewBox="0 0 24 24">
          <path
            d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.064 2.064 0 1 1 0-4.128 2.064 2.064 0 0 1 0 4.128zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
            fill="currentColor"
          />
        </svg>
      );
    case "threads":
      return (
        <svg aria-hidden="true" className="size-3" viewBox="0 0 192 192">
          <path
            d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.07 0h-.113C68.882.194 47.292 9.642 32.788 28.08 19.882 44.485 13.224 67.315 13.001 95.932L13 96v.067c.224 28.617 6.882 51.447 19.788 67.854C47.292 182.358 68.882 191.806 96.957 192h.113c24.96-.173 42.554-6.708 57.048-21.189 18.963-18.945 18.392-42.692 12.142-57.27-4.484-10.454-13.033-18.945-24.723-24.553ZM98.44 129.507c-10.44.588-21.286-4.098-21.82-14.135-.397-7.442 5.296-15.746 22.461-16.735 1.966-.114 3.895-.169 5.79-.169 6.235 0 12.068.606 17.371 1.765-1.978 24.702-13.58 28.713-23.802 29.274Z"
            fill="currentColor"
          />
        </svg>
      );
    default:
      return (
        <span className="font-semibold text-[10px] uppercase">
          {platform.slice(0, 1)}
        </span>
      );
  }
}
