"use client";

/**
 * @author: @kokonutui
 * @description: AI Loading State
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ChevronDown } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type AgentStepStatus = "pending" | "running" | "done" | "error";

export interface AgentStep {
  id: string;
  label: string;
  status: AgentStepStatus;
  /** Log lines for the step. The running step shows the latest ones. */
  detail?: string[];
}

interface AILoadingStateProps {
  /**
   * The agent's steps, in order. Update them as work progresses. When
   * omitted, a demo run plays on a loop.
   */
  steps?: AgentStep[];
  /** Collapse the list once every step is done. Defaults to true. */
  collapseWhenDone?: boolean;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LINE_HEIGHT = 24;
const VISIBLE_LINES = 3;

const DEMO_STEPS: Omit<AgentStep, "status">[] = [
  {
    id: "search",
    label: "Searching the web",
    detail: [
      "query: loading states in agent UIs",
      "visiting 5 websites",
      "reading emilkowal.ski/ui/great-animations",
      "reading developer.apple.com/design",
    ],
  },
  {
    id: "read",
    label: "Reading 4 sources",
    detail: [
      "extracting key passages",
      "dropping 1 duplicate source",
      "ranking by relevance",
    ],
  },
  {
    id: "compare",
    label: "Comparing approaches",
    detail: [
      "spinners vs. step lists",
      "progress you can verify",
      "checking motion preferences",
    ],
  },
  {
    id: "write",
    label: "Writing the summary",
    detail: ["drafting 3 sections"],
  },
];

const DEMO_TICK_MS = 750;
const DEMO_REST_MS = 3200;

interface DemoPosition {
  step: number;
  line: number;
}

const advanceDemo = ({ step, line }: DemoPosition): DemoPosition => {
  if (step >= DEMO_STEPS.length) {
    return { step: 0, line: 0 };
  }
  const lineCount = DEMO_STEPS[step].detail?.length ?? 0;
  return line < lineCount
    ? { step, line: line + 1 }
    : { step: step + 1, line: 0 };
};

/** Advances through DEMO_STEPS one log line per tick, pausing offscreen. */
function useDemoRun(
  enabled: boolean,
  rootRef: React.RefObject<HTMLElement | null>
) {
  const [position, setPosition] = useState<DemoPosition>({
    step: 0,
    line: 0,
  });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const element = rootRef.current;
    if (!(enabled && element)) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setIsVisible(entry.isIntersecting)
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, rootRef]);

  const positionRef = useRef(position);

  useEffect(() => {
    if (!(enabled && isVisible)) {
      return;
    }
    let id: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const finished = positionRef.current.step >= DEMO_STEPS.length;
      id = setTimeout(
        () => {
          positionRef.current = advanceDemo(positionRef.current);
          setPosition(positionRef.current);
          schedule();
        },
        finished ? DEMO_REST_MS : DEMO_TICK_MS
      );
    };
    schedule();
    return () => clearTimeout(id);
  }, [enabled, isVisible]);

  return DEMO_STEPS.map((step, i): AgentStep => {
    if (i < position.step) {
      return { ...step, status: "done" };
    }
    if (i === position.step) {
      return {
        ...step,
        status: "running",
        detail: step.detail?.slice(0, position.line),
      };
    }
    return { ...step, status: "pending" };
  });
}

function StepIcon({ status }: { status: AgentStepStatus }) {
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, filter: "blur(0px)" }}
          className="absolute inset-0 flex items-center justify-center"
          exit={{ opacity: 0, filter: "blur(2px)" }}
          initial={{ opacity: 0, filter: "blur(2px)" }}
          key={status}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {status === "pending" && (
            <span className="size-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          )}
          {status === "running" && (
            <svg
              aria-hidden="true"
              className="size-3.5 motion-safe:animate-spin"
              fill="none"
              style={{ animationDuration: "0.8s" }}
              viewBox="0 0 16 16"
            >
              <circle
                className="stroke-gray-200 dark:stroke-gray-700"
                cx="8"
                cy="8"
                r="6.25"
                strokeWidth="1.5"
              />
              <path
                className="stroke-gray-700 dark:stroke-gray-200"
                d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          )}
          {status === "done" && (
            <svg
              aria-hidden="true"
              className="size-3.5 text-gray-700 dark:text-gray-200"
              fill="none"
              viewBox="0 0 16 16"
            >
              {/* The check draws itself once, from the short stroke out. */}
              <motion.path
                animate={{ pathLength: 1 }}
                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                initial={{ pathLength: 0 }}
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.05 }}
              />
            </svg>
          )}
          {status === "error" && (
            <svg
              aria-hidden="true"
              className="size-3.5 text-red-500"
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="M4.5 4.5l7 7m0-7-7 7"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.75"
              />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The running step's latest log lines, scrolling up as new ones arrive. */
function StepLog({ lines }: { lines: string[] }) {
  const offset = Math.max(0, lines.length - VISIBLE_LINES);
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden font-mono text-xs"
      style={{
        height: LINE_HEIGHT * Math.min(lines.length, VISIBLE_LINES),
        maskImage:
          lines.length > VISIBLE_LINES - 1
            ? "linear-gradient(to bottom, rgb(0 0 0 / 0.25), black 70%)"
            : undefined,
        WebkitMaskImage:
          lines.length > VISIBLE_LINES - 1
            ? "linear-gradient(to bottom, rgb(0 0 0 / 0.25), black 70%)"
            : undefined,
        transition: "height 240ms cubic-bezier(0.23, 1, 0.32, 1)",
      }}
    >
      <div
        className="transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        style={{ transform: `translateY(${-offset * LINE_HEIGHT}px)` }}
      >
        {lines.map((line, index) => (
          <motion.div
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400"
            initial={{ opacity: 0 }}
            key={`${index}-${line}`}
            style={{ height: LINE_HEIGHT }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <span className="w-4 select-none text-right text-gray-300 tabular-nums dark:text-gray-600">
              {index + 1}
            </span>
            <span className="truncate">{line}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const formatDuration = (seconds: number) =>
  seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${(seconds % 60).toString().padStart(2, "0")}s`;

/**
 * Seconds since the run started. Freezes while nothing runs, and restarts
 * when a step runs again after the whole list was done.
 */
function useElapsed(active: boolean, done: boolean) {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (done) {
      finishedRef.current = true;
    }
  }, [done]);

  useEffect(() => {
    if (!active) {
      return;
    }
    if (finishedRef.current) {
      finishedRef.current = false;
      startRef.current = null;
    }
    const start = startRef.current ?? Date.now();
    startRef.current = start;
    const tick = () => setSeconds(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [active]);

  return seconds;
}

export default function AILoadingState({
  steps: stepsProp,
  collapseWhenDone = true,
  className,
}: AILoadingStateProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const demoSteps = useDemoRun(stepsProp === undefined, rootRef);
  const steps = stepsProp ?? demoSteps;
  const listId = useId();

  const running = steps.find((step) => step.status === "running");
  const failed = steps.find((step) => step.status === "error");
  const isDone =
    steps.length > 0 && steps.every((step) => step.status === "done");
  const isActive = Boolean(running);
  const seconds = useElapsed(isActive, isDone);

  // Open while working; folds away once everything is done, until the user
  // opens it again.
  const [isOpen, setIsOpen] = useState(true);
  useEffect(() => {
    setIsOpen(!(isDone && collapseWhenDone));
  }, [isDone, collapseWhenDone]);

  let title = "Getting ready";
  if (failed) {
    title = `Stopped at: ${failed.label}`;
  } else if (isDone) {
    title = `Worked for ${formatDuration(seconds)}`;
  } else if (running) {
    title = running.label;
  }

  return (
    <div
      className={cn("flex w-full items-center justify-center", className)}
      ref={rootRef}
    >
      <MotionConfig reducedMotion="user">
        <div className="w-full max-w-sm">
          <button
            aria-controls={listId}
            aria-expanded={isOpen}
            className="group/header flex w-full items-center gap-2 rounded-md py-1 text-left font-medium text-gray-600 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-gray-400/40 dark:text-gray-300"
            onClick={() => setIsOpen((open) => !open)}
            type="button"
          >
            {/* <output> has the implicit role="status", so the current step
                is announced as it changes. */}
            <output className="min-w-0 truncate">{title}</output>
            {isActive && (
              <span className="text-gray-400 tabular-nums dark:text-gray-500">
                {formatDuration(seconds)}
              </span>
            )}
            {isDone && (
              <span className="text-gray-400 dark:text-gray-500">
                · {steps.length} steps
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "ml-auto size-4 text-gray-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/header:text-gray-600 dark:group-hover/header:text-gray-300",
                isOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.ol
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                id={listId}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                {steps.map((step) => (
                  <li className="relative flex gap-3 pt-2.5" key={step.id}>
                    <StepIcon status={step.status} />
                    <div className="-mt-0.5 min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm transition-colors duration-200",
                          step.status === "pending" &&
                            "text-gray-400 dark:text-gray-500",
                          step.status === "running" &&
                            "text-gray-900 dark:text-gray-100",
                          step.status === "done" &&
                            "text-gray-500 dark:text-gray-400",
                          step.status === "error" &&
                            "text-red-600 dark:text-red-400"
                        )}
                      >
                        {step.label}
                      </p>
                      {step.status === "running" && step.detail?.length ? (
                        <div className="mt-1">
                          <StepLog lines={step.detail} />
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </div>
  );
}
