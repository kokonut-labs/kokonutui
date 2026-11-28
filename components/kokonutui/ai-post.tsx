"use client";

/**
 * @author: @kokonutui
 * @description: AI Post
 * @version: 1.0.0
 * @date: 2026-11-28
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, LoaderCircle } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Where a target is: waiting for its time, going out, live or refused. */
export type PostTargetStatus = "scheduled" | "posting" | "posted" | "failed";

export interface PostTarget {
  /** "x", "bluesky" and "linkedin" get their marks and limits; any other name gets its initial. */
  platform: string;
  /** The account it posts as, e.g. "@northwind". */
  account: string;
  status: PostTargetStatus;
  /** The time, as shown: when it goes out if scheduled, when it went out if posted. */
  when?: string;
  /** The live post, for a View link once posted. */
  url?: string;
  /** Why it failed, in the platform's own words if you have them. */
  error?: string;
  /** Characters allowed. Defaults to the platform's limit when known. */
  limit?: number;
}

export interface AIPostProps {
  /** The user's message, drawn as a bubble. Only the demo draws one by default. */
  prompt?: string;
  /** What the assistant says above the card. */
  message?: string;
  /** Said under the card once every target is live. */
  done?: string;
  /** A short name for the post, above the card. */
  label?: string;
  /** The text that goes out. */
  caption?: string;
  /**
   * One row per account. Pass them to drive the card from your scheduler;
   * leave them out for the demo.
   */
  targets?: PostTarget[];
  /** Shows Post now while any target is still scheduled. */
  onPostNow?: () => void;
  /** Shows Edit while any target is still scheduled. */
  onEdit?: () => void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const LIMITS: Record<string, number> = {
  x: 280,
  bluesky: 300,
  linkedin: 3000,
};

const NAMES: Record<string, string> = {
  x: "X",
  bluesky: "Bluesky",
  linkedin: "LinkedIn",
};

const DEMO = {
  prompt: "Post the launch to X, Bluesky and LinkedIn. LinkedIn at 9 tomorrow.",
  message: "Sending X and Bluesky now. LinkedIn goes out at 9:00 tomorrow.",
  done: "All three are live.",
  label: "Launch post",
  caption:
    "Northwind 2.0 is out. Offline sync, a faster editor, and dark mode that finally matches your OS. Free for everyone today.",
};

const DEMO_TARGETS: PostTarget[] = [
  { platform: "x", account: "@northwind", status: "posting" },
  { platform: "bluesky", account: "northwind.dev", status: "posting" },
  {
    platform: "linkedin",
    account: "Northwind",
    status: "scheduled",
    when: "Tomorrow 9:00",
  },
];

/** When each demo row lands, in ms from the step that started it. */
const DEMO_STEP_MS = [900, 1500];
const DEMO_POSTED_AT = "8:02";

/**
 * The demo's rows: the first two go live one after the other, and Post now
 * sends the scheduled one.
 */
function useDemoTargets(enabled: boolean) {
  const [targets, setTargets] = useState(DEMO_TARGETS);
  const sending = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(sending.current), []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timers = DEMO_STEP_MS.map((ms, i) =>
      setTimeout(
        () =>
          setTargets((rows) =>
            rows.map((row, j) =>
              j === i ? { ...row, status: "posted", when: DEMO_POSTED_AT } : row
            )
          ),
        ms
      )
    );
    return () => {
      for (const t of timers) {
        clearTimeout(t);
      }
    };
  }, [enabled]);

  const postNow = () => {
    setTargets((rows) =>
      rows.map((row) =>
        row.status === "scheduled"
          ? { ...row, status: "posting", when: undefined }
          : row
      )
    );
    clearTimeout(sending.current);
    sending.current = setTimeout(
      () =>
        setTargets((rows) =>
          rows.map((row) =>
            row.status === "posting"
              ? { ...row, status: "posted", when: "Just now" }
              : row
          )
        ),
      DEMO_STEP_MS[0]
    );
  };

  return { targets, postNow };
}

/** The one line of state above the card: how many are live. */
function summarize(targets: PostTarget[]) {
  const live = targets.filter((t) => t.status === "posted").length;
  const failed = targets.some((t) => t.status === "failed");
  if (failed) {
    return { tone: "failed" as const, text: "Needs a look" };
  }
  if (live === targets.length) {
    return { tone: "done" as const, text: "All live" };
  }
  if (live === 0 && targets.every((t) => t.status === "scheduled")) {
    return { tone: "waiting" as const, text: "Scheduled" };
  }
  return {
    tone: "waiting" as const,
    text: `${live} of ${targets.length} live`,
  };
}

/** The chat text around the card: the demo's only when it's the demo. */
function shownText(
  text: Pick<AIPostProps, "prompt" | "message" | "done" | "label" | "caption">,
  isDemo: boolean
) {
  const pick = (value: string | undefined, demo: string) =>
    value ?? (isDemo ? demo : undefined);
  return {
    prompt: pick(text.prompt, DEMO.prompt),
    message: pick(text.message, DEMO.message),
    done: pick(text.done, DEMO.done),
    label: pick(text.label, DEMO.label) ?? "Post",
    caption: pick(text.caption, DEMO.caption) ?? "",
  };
}

/** The post's name and how many of its rows are live. */
function Header({ label, targets }: { label: string; targets: PostTarget[] }) {
  const summary = summarize(targets);
  return (
    <div className="flex h-8 items-center justify-between gap-3 px-3 text-[12px] text-zinc-500 dark:text-zinc-400">
      <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
        <span
          className={cn(
            "size-1.5 rounded-full transition-colors duration-300",
            summary.tone === "done" && "bg-emerald-500",
            summary.tone === "waiting" && "bg-blue-500",
            summary.tone === "failed" && "bg-red-500"
          )}
        />
        {summary.text}
      </span>
    </div>
  );
}

/** Edit and Post now, while a row is still waiting for its time. */
function Actions({
  onEdit,
  onPostNow,
}: {
  onEdit?: () => void;
  onPostNow?: () => void;
}) {
  return (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      className="overflow-hidden"
      exit={{ height: 0, opacity: 0 }}
      initial={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      <div className="flex items-center justify-between gap-3 border-black/[0.06] border-t px-4 py-2.5 dark:border-white/[0.08]">
        <span className="min-w-0 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
          Change or cancel it until it posts
        </span>
        <span className="flex shrink-0 gap-1.5">
          {onEdit ? (
            <button
              className="h-8 rounded-full px-3 font-medium text-[12.5px] text-zinc-700 outline-hidden ring-1 ring-black/[0.08] transition-colors duration-150 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500/50 active:bg-zinc-100 dark:text-zinc-200 dark:ring-white/10 dark:active:bg-white/[0.08] dark:hover:bg-white/[0.05]"
              onClick={onEdit}
              type="button"
            >
              Edit
            </button>
          ) : null}
          {onPostNow ? (
            <button
              className="h-8 rounded-full bg-blue-600 px-3.5 font-medium text-[12.5px] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(29_78_216/0.35)] outline-hidden transition-colors duration-150 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 active:bg-blue-800 dark:bg-blue-500 dark:active:bg-blue-700 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-blue-600"
              onClick={onPostNow}
              type="button"
            >
              Post now
            </button>
          ) : null}
        </span>
      </div>
    </motion.div>
  );
}

export default function AIPost({
  prompt,
  message,
  done,
  label,
  caption,
  targets,
  onPostNow,
  onEdit,
  className,
}: AIPostProps) {
  const isDemo = targets === undefined;
  const demo = useDemoTargets(isDemo);
  const rows = targets ?? demo.targets;
  const text = shownText({ prompt, message, done, label, caption }, isDemo);
  const postNow = onPostNow ?? (isDemo ? demo.postNow : undefined);
  const edit = onEdit ?? (isDemo ? () => undefined : undefined);
  const waiting = rows.some((t) => t.status === "scheduled");
  const allLive = rows.length > 0 && rows.every((t) => t.status === "posted");

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("flex w-full max-w-md flex-col gap-4", className)}
        data-state={allLive ? "live" : "pending"}
      >
        {text.prompt ? (
          <p className="max-w-[85%] self-end text-pretty rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
            {text.prompt}
          </p>
        ) : null}
        {text.message ? (
          <p className="text-pretty text-[15px] text-zinc-800 leading-7 dark:text-zinc-200">
            {text.message}
          </p>
        ) : null}

        <div className="rounded-[22px] bg-black/[0.04] p-1 dark:bg-white/[0.06]">
          <Header label={text.label} targets={rows} />

          <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/[0.08]">
            {text.caption ? (
              <p className="line-clamp-4 whitespace-pre-line text-pretty border-black/[0.06] border-b px-4 py-3.5 text-[14px] text-zinc-800 leading-relaxed dark:border-white/[0.08] dark:text-zinc-200">
                {text.caption}
              </p>
            ) : null}

            <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {rows.map((target) => (
                <TargetRow
                  captionLength={text.caption.length}
                  key={`${target.platform}:${target.account}`}
                  target={target}
                />
              ))}
            </ul>

            <AnimatePresence initial={false}>
              {waiting && (postNow || edit) ? (
                <Actions onEdit={edit} onPostNow={postNow} />
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {allLive && text.done ? (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-pretty text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.3 }}
            >
              {text.done}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {summarize(rows).text}
        </p>
      </div>
    </MotionConfig>
  );
}

/** One account: its mark, the character count, and where the post is. */
function TargetRow({
  target,
  captionLength,
}: {
  target: PostTarget;
  captionLength: number;
}) {
  const limit = target.limit ?? LIMITS[target.platform];
  const over = limit !== undefined && captionLength > limit;
  const name = NAMES[target.platform] ?? target.platform;

  return (
    <li className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-900 ring-1 ring-black/[0.08] dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10">
          <PlatformMark platform={target.platform} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-[13.5px] text-zinc-900 capitalize leading-5 dark:text-zinc-100">
            {name}
          </span>
          <span className="block truncate text-[12px] text-zinc-500 leading-4 dark:text-zinc-400">
            {target.account}
            {limit === undefined ? null : (
              <>
                {" · "}
                <span
                  className={cn(
                    "tabular-nums",
                    over && "font-medium text-red-600 dark:text-red-400"
                  )}
                >
                  {captionLength.toLocaleString("en-US")} /{" "}
                  {limit.toLocaleString("en-US")}
                </span>
              </>
            )}
          </span>
        </span>
        <span className="relative flex h-5 shrink-0 items-center overflow-hidden text-[12.5px]">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              className="flex items-center gap-1.5 whitespace-nowrap"
              exit={{ y: -10, opacity: 0, filter: "blur(2px)" }}
              initial={{ y: 10, opacity: 0, filter: "blur(2px)" }}
              key={target.status}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              <Status target={target} />
            </motion.span>
          </AnimatePresence>
        </span>
        {target.status === "posted" && target.url ? (
          <a
            className="shrink-0 rounded-sm font-medium text-[12.5px] text-zinc-900 underline-offset-4 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:text-zinc-100"
            href={target.url}
            rel="noopener"
            target="_blank"
          >
            View
          </a>
        ) : null}
      </div>
      {target.status === "failed" && target.error ? (
        <p className="mt-1.5 pl-10 text-[12px] text-red-600 leading-snug dark:text-red-400">
          {target.error}
        </p>
      ) : null}
    </li>
  );
}

function Status({ target }: { target: PostTarget }): ReactNode {
  switch (target.status) {
    case "scheduled":
      return (
        <span className="font-medium text-blue-600 tabular-nums dark:text-blue-400">
          {target.when ?? "Scheduled"}
        </span>
      );
    case "posting":
      return (
        <>
          <LoaderCircle
            aria-hidden="true"
            className="size-3.5 animate-spin text-zinc-400 motion-reduce:animate-none"
          />
          <span className="text-zinc-500 dark:text-zinc-400">Posting</span>
        </>
      );
    case "posted":
      return (
        <>
          <Check
            aria-hidden="true"
            className="size-3.5 text-emerald-600 dark:text-emerald-400"
            strokeWidth={2.5}
          />
          <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
            {target.when ? `Posted ${target.when}` : "Posted"}
          </span>
        </>
      );
    default:
      return (
        <span className="font-medium text-red-600 dark:text-red-400">
          Failed
        </span>
      );
  }
}

/** Single-color marks, so they take the row's ink in both themes. */
function PlatformMark({ platform }: { platform: string }) {
  switch (platform) {
    case "x":
      return (
        <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24">
          <path
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
            fill="currentColor"
          />
        </svg>
      );
    case "bluesky":
      return (
        <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
          <path
            d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"
            fill="currentColor"
          />
        </svg>
      );
    case "linkedin":
      return (
        <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24">
          <path
            d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.064 2.064 0 1 1 0-4.128 2.064 2.064 0 0 1 0 4.128zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
            fill="currentColor"
          />
        </svg>
      );
    default:
      return (
        <span className="font-semibold text-[12px] uppercase">
          {platform.slice(0, 1)}
        </span>
      );
  }
}
