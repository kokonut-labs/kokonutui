"use client";

/**
 * @author: @kokonutui
 * @description: AI Tool Calls
 * @version: 1.0.0
 * @date: 2026-10-31
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  CalendarCheck,
  ChevronRight,
  FileText,
  Search,
  Wrench,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface ToolCallItem {
  id: string;
  /** The tool's name, such as `web_search`. Picks the icon. */
  tool: string;
  /** While it runs, e.g. "Searching the web". */
  running: string;
  /** Once done, e.g. "Searched the web". */
  done: string;
  /** The main argument: a query, a URL, a file. */
  detail: string;
  /** A short result, e.g. "8 results". */
  result: string;
  /** How long the call takes in the demo, in ms. */
  duration: number;
  icon?: ReactNode;
}

export interface AIToolCallsProps {
  prompt?: string;
  calls?: ToolCallItem[];
  /** The reply written once the tools are done. */
  answer?: string;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const FOLD_DELAY = 650;
const SEARCH_TOOL = /search/;
const READ_TOOL = /read|fetch|page|file/;
const BOOK_TOOL = /calendar|availab|book/;

const DEMO_CALLS: ToolCallItem[] = [
  {
    id: "search",
    tool: "web_search",
    running: "Searching the web",
    done: "Searched the web",
    detail: "quiet hotels Alfama Lisbon",
    result: "8 results",
    duration: 1300,
  },
  {
    id: "read",
    tool: "read_page",
    running: "Reading",
    done: "Read",
    detail: "memmo-alfama.com/rooms",
    result: "1 page",
    duration: 900,
  },
  {
    id: "rooms",
    tool: "check_availability",
    running: "Checking rooms",
    done: "Checked rooms",
    detail: "Memmo Alfama · Nov 14–16",
    result: "€184 / night",
    duration: 1200,
  },
];

const DEMO_ANSWER =
  "Memmo Alfama has a terrace room free for Nov 14–16 at €184 a night. It sits on a pedestrian lane above the river, so it stays quiet after dark, and breakfast is included.";

const iconFor = (tool: string) => {
  if (SEARCH_TOOL.test(tool)) {
    return Search;
  }
  if (READ_TOOL.test(tool)) {
    return FileText;
  }
  if (BOOK_TOOL.test(tool)) {
    return CalendarCheck;
  }
  return Wrench;
};

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export default function AIToolCalls({
  prompt = "Find me a quiet hotel in Alfama for Nov 14–16, under €200",
  calls = DEMO_CALLS,
  answer = DEMO_ANSWER,
  className,
}: AIToolCallsProps) {
  const listId = useId();
  /** Index of the call running now; calls.length once all are done. */
  const [current, setCurrent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [open, setOpen] = useState(true);
  const [answered, setAnswered] = useState(false);
  const finished = current >= calls.length;
  const total = calls.reduce((sum, c) => sum + c.duration, 0);
  const before = calls.slice(0, current).reduce((s, c) => s + c.duration, 0);

  // Runs the calls one after another, then folds them away.
  useEffect(() => {
    if (finished) {
      const fold = setTimeout(() => {
        setOpen(false);
        setAnswered(true);
      }, FOLD_DELAY);
      return () => clearTimeout(fold);
    }
    const call = calls[current];
    const started = performance.now();
    const tick = setInterval(
      () => setElapsed(performance.now() - started),
      100
    );
    const next = setTimeout(() => {
      setElapsed(0);
      setCurrent((i) => i + 1);
    }, call.duration);
    return () => {
      clearInterval(tick);
      clearTimeout(next);
    };
  }, [current, calls, finished]);

  const shown = calls.slice(0, Math.min(current + 1, calls.length));

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex w-full max-w-md flex-col gap-4", className)}>
        <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
          {prompt}
        </p>

        <div>
          <button
            aria-controls={listId}
            aria-expanded={open}
            className="group flex h-7 items-center gap-2 rounded-md text-[13px] outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50"
            disabled={!finished}
            onClick={() => setOpen((o) => !o)}
            type="button"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {finished ? (
                <motion.span
                  animate={{ opacity: 1 }}
                  className="flex items-center"
                  initial={{ opacity: 0 }}
                  key="stack"
                  transition={{ duration: 0.2 }}
                >
                  {calls.map((call, i) => {
                    const Icon = iconFor(call.tool);
                    return (
                      <motion.span
                        animate={{ x: 0, opacity: 1 }}
                        className="-ml-1.5 flex size-5 items-center justify-center rounded-full bg-white text-zinc-500 ring-1 ring-black/[0.08] first:ml-0 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-white/10"
                        initial={{ x: -6 * i, opacity: 0 }}
                        key={call.id}
                        style={{ zIndex: calls.length - i }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                      >
                        {call.icon ?? <Icon className="size-2.5" />}
                      </motion.span>
                    );
                  })}
                </motion.span>
              ) : (
                <motion.span
                  className="flex size-5 items-center justify-center"
                  exit={{ opacity: 0 }}
                  key="spin"
                >
                  <Spinner />
                </motion.span>
              )}
            </AnimatePresence>
            <span
              className={cn(
                "font-medium",
                finished
                  ? "text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100"
                  : "text-zinc-900 dark:text-zinc-100"
              )}
            >
              {finished ? `Used ${calls.length} tools` : "Working"}
            </span>
            <span className="font-mono text-[11.5px] text-zinc-400 tabular-nums dark:text-zinc-500">
              {seconds(finished ? total : before + elapsed)}
            </span>
            {finished && (
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "size-3.5 text-zinc-400 transition-transform duration-200 dark:text-zinc-500",
                  open && "rotate-90"
                )}
              />
            )}
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                id={listId}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
              >
                <ol className="ml-[9.5px] border-zinc-200 border-l pt-1 pl-[18px] dark:border-zinc-700/80">
                  <AnimatePresence initial={false}>
                    {shown.map((call, i) => (
                      <CallRow
                        call={call}
                        elapsed={elapsed}
                        key={call.id}
                        running={i === current}
                      />
                    ))}
                  </AnimatePresence>
                </ol>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {answered && (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.1 }}
            >
              {answer}
            </motion.p>
          )}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {finished ? `Used ${calls.length} tools` : calls[current]?.running}
        </p>
      </div>
    </MotionConfig>
  );
}

function CallRow({
  call,
  running,
  elapsed,
}: {
  call: ToolCallItem;
  running: boolean;
  elapsed: number;
}) {
  const Icon = iconFor(call.tool);
  return (
    <motion.li
      animate={{ height: "auto", opacity: 1, filter: "blur(0px)" }}
      className="list-none"
      initial={{ height: 0, opacity: 0, filter: "blur(3px)" }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
    >
      <div className="flex h-8 items-center gap-2 text-[13px]">
        <Icon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-zinc-400 dark:text-zinc-500"
        />
        <span
          className={cn(
            "shrink-0",
            running
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-600 dark:text-zinc-400"
          )}
        >
          {running ? call.running : call.done}
        </span>
        <span className="min-w-0 truncate font-mono text-[11.5px] text-zinc-400 dark:text-zinc-500">
          {call.detail}
        </span>
        <span className="ml-auto shrink-0 pl-2 text-[12px] tabular-nums">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "block",
                running
                  ? "font-mono text-[11.5px] text-zinc-400 dark:text-zinc-500"
                  : "text-zinc-600 dark:text-zinc-300"
              )}
              initial={{ opacity: 0, y: 4 }}
              key={running ? "time" : "result"}
              transition={{ duration: 0.18, ease: EASE_OUT }}
            >
              {running ? seconds(elapsed) : call.result}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
    </motion.li>
  );
}

function Spinner() {
  return (
    <motion.svg
      animate={{ rotate: 360 }}
      aria-hidden="true"
      className="size-3.5 text-zinc-900 dark:text-zinc-100"
      fill="none"
      transition={{
        duration: 0.8,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      }}
      viewBox="0 0 16 16"
    >
      <circle
        cx="8"
        cy="8"
        opacity="0.15"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </motion.svg>
  );
}
