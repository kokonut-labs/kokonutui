"use client";

/**
 * @author: @kokonutui
 * @description: AI Code Run
 * @version: 1.1.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { RotateCcw } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface CodeRunBar {
  label: string;
  value: number;
}

/**
 * Where the run is: the model `writing` the code, the code `running`, then
 * `done` or `error`. Matches a code tool's part going from input-streaming
 * to input-available to output-available or output-error.
 */
export type CodeRunStatus = "writing" | "running" | "done" | "error";

export interface AICodeRunProps {
  /** The user's message, drawn as a bubble. Only the demo draws one by default. */
  prompt?: string;
  /** What the assistant says before the code. */
  message?: string;
  filename?: string;
  /** The script. While `writing`, pass it as it streams in. */
  code?: string;
  /** What the script prints, or the error when it fails. */
  stdout?: string;
  /** The chart the script draws, shown once it's done. */
  bars?: CodeRunBar[];
  /** The reply under the run, shown once it's done. */
  answer?: ReactNode;
  /**
   * Pass it to drive the card from your run; leave it out and the code
   * plays through line by line on `lineMs`.
   */
  status?: CodeRunStatus;
  /** The line running now, from 1, while `running`. */
  activeLine?: number;
  /** How long the run took, in seconds, shown once it's done. */
  duration?: number;
  /** Shows Run again once the run is over. The demo replays by itself. */
  onRunAgain?: () => void;
  /** Demo only: how long each line takes, in ms. */
  lineMs?: number;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
const LINE_HEIGHT = 20;
/** Comments, strings, keywords, numbers and calls, in that order. */
const TOKEN =
  /(#.*$)|(f?"[^"]*"|f?'[^']*')|\b(import|from|as|def|return|for|in|if|else|with|lambda|None|True|False)\b|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_]\w*)(?=\()/g;

const DEMO_CODE = `import pandas as pd

df = pd.read_csv("signups.csv")
weekly = df.groupby("week").size().tail(6)
growth = weekly.iloc[-1] / weekly.iloc[0] - 1

print(f"{weekly.sum():,} signups, {growth:+.0%}")
weekly.plot.bar()`;

const DEMO_BARS: CodeRunBar[] = [
  { label: "Oct 5", value: 690 },
  { label: "Oct 12", value: 742 },
  { label: "Oct 19", value: 788 },
  { label: "Oct 26", value: 856 },
  { label: "Nov 2", value: 784 },
  { label: "Nov 9", value: 952 },
];

const DEMO_ANSWER =
  "Signups grew 38% over six weeks, to 952 last week. The one dip, the week of Nov 2, lines up with the pricing page being down for a day.";

/** Splits a line of Python into coloured spans. */
const highlight = (line: string): ReactNode[] => {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) {
      out.push(line.slice(last, at));
    }
    let tone = "text-blue-600 dark:text-blue-400";
    if (m[1]) {
      tone = "text-zinc-400 dark:text-zinc-500";
    } else if (m[2]) {
      tone = "text-emerald-700 dark:text-emerald-400";
    } else if (m[3]) {
      tone = "text-violet-600 dark:text-violet-400";
    } else if (m[4]) {
      tone = "text-amber-700 dark:text-amber-400";
    }
    out.push(
      <span className={tone} key={at}>
        {m[0]}
      </span>
    );
    last = at + m[0].length;
  }
  if (last < line.length) {
    out.push(line.slice(last));
  }
  return out;
};

const DEMO = {
  prompt: "How did signups do over the last six weeks?",
  message: "I’ll pull them from the export and plot it.",
  filename: "signups.py",
  stdout: "4,812 signups, +38%",
};

/** Plays the code line by line, as the demo and for code with no status. */
function usePlayback(lines: string[], lineMs: number, active: boolean) {
  /** Lines that actually run; blank ones are skipped. */
  const steps = lines.flatMap((l, i) => (l.trim() ? [i] : []));
  const [run, setRun] = useState(0);
  const [step, setStep] = useState(0);
  const finished = step >= steps.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: run restarts the effect
  useEffect(() => {
    if (finished || !active) {
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), lineMs);
    return () => clearTimeout(t);
  }, [step, finished, lineMs, run, active]);

  /** stdout shows once the print line has run. */
  const printAt = lines.findIndex((l) => l.trimStart().startsWith("print"));
  const current = finished ? -1 : steps[step];
  return {
    run,
    status: (finished ? "done" : "running") as CodeRunStatus,
    current,
    ranUpTo: (i: number) => steps.includes(i) && steps.indexOf(i) < step,
    printed: finished || (printAt >= 0 && current > printAt),
    seconds: (steps.length * lineMs) / 1000,
    again: () => {
      setStep(0);
      setRun((r) => r + 1);
    },
  };
}

/** What the card shows: the demo's content only when it's the demo. */
function shownContent(
  props: Pick<
    AICodeRunProps,
    "prompt" | "message" | "filename" | "stdout" | "bars" | "answer"
  >,
  isDemo: boolean
) {
  if (isDemo) {
    return {
      prompt: props.prompt ?? DEMO.prompt,
      message: props.message ?? DEMO.message,
      filename: props.filename ?? DEMO.filename,
      stdout: props.stdout ?? DEMO.stdout,
      bars: props.bars ?? DEMO_BARS,
      answer: props.answer ?? DEMO_ANSWER,
    };
  }
  return {
    ...props,
    filename: props.filename ?? "script.py",
    bars: props.bars ?? [],
  };
}

/** The card's state from props, in the same shape playback gives. */
function drivenView(
  status: CodeRunStatus,
  activeLine: number | undefined,
  stdout: string | undefined
) {
  // A failed run keeps its marker on the line that failed.
  const marked = status === "running" || status === "error";
  const current = marked && activeLine !== undefined ? activeLine - 1 : -1;
  return {
    current,
    ranUpTo: (i: number) => !marked || current < 0 || i < current,
    printed: Boolean(stdout),
  };
}

export default function AICodeRun({
  prompt,
  message,
  filename,
  code,
  stdout,
  bars,
  answer,
  status: statusProp,
  activeLine,
  duration,
  onRunAgain,
  lineMs = 320,
  className,
}: AICodeRunProps) {
  const outputId = useId();
  const driven = statusProp !== undefined;
  const isDemo = !driven && code === undefined;
  const shown = shownContent(
    { prompt, message, filename, stdout, bars, answer },
    isDemo
  );
  const lines = (code ?? DEMO_CODE).split("\n");
  const playback = usePlayback(lines, lineMs, !driven);
  const status = statusProp ?? playback.status;
  const view = driven ? drivenView(status, activeLine, shown.stdout) : playback;
  const { current, printed } = view;
  const finished = status === "done" || status === "error";
  const run = playback.run;
  const again = driven ? onRunAgain : playback.again;
  const seconds = driven ? duration : playback.seconds;
  const max = Math.max(1, ...shown.bars.map((b) => b.value));

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("flex w-full max-w-md flex-col gap-4", className)}
        data-state={status}
      >
        {shown.prompt ? (
          <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
            {shown.prompt}
          </p>
        ) : null}
        {shown.message ? (
          <p className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200">
            {shown.message}
          </p>
        ) : null}

        <AutoHeight className="rounded-[22px] bg-black/[0.04] dark:bg-white/[0.06]">
          <div className="flex h-8 items-center gap-2 pr-1 pl-3 text-[12px] text-zinc-500 dark:text-zinc-400">
            <span className="rounded-[4px] bg-black/[0.06] px-1 font-medium font-mono text-[10px] text-zinc-600 leading-4 dark:bg-white/[0.08] dark:text-zinc-300">
              py
            </span>
            <span className="min-w-0 truncate font-mono text-[11.5px] text-zinc-600 dark:text-zinc-300">
              {shown.filename}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5"
                  exit={{ opacity: 0, y: -4 }}
                  initial={{ opacity: 0, y: 4 }}
                  key={status}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  <StatusLabel seconds={seconds} status={status} />
                </motion.span>
              </AnimatePresence>
              <button
                aria-label="Run again"
                className="flex size-6 items-center justify-center rounded-md text-zinc-500 outline-hidden transition-[color,background-color,opacity] duration-150 hover:bg-black/[0.05] hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500/40 active:bg-black/[0.08] disabled:pointer-events-none disabled:opacity-0 dark:text-zinc-400 dark:active:bg-white/[0.12] dark:hover:bg-white/[0.08] dark:hover:text-zinc-100"
                disabled={!(finished && again)}
                onClick={again}
                type="button"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          </div>

          <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/[0.08]">
            <pre className="relative overflow-x-auto py-2.5 font-mono text-[11.5px] leading-[20px]">
              {/* One marker that slides between lines, on transform only. */}
              <motion.span
                animate={{
                  y: Math.max(current, 0) * LINE_HEIGHT,
                  opacity: current >= 0 ? 1 : 0,
                }}
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 top-2.5 h-5 border-l-2",
                  status === "error"
                    ? "border-rose-500 bg-rose-500/[0.07] dark:border-rose-400 dark:bg-rose-400/10"
                    : "border-violet-500 bg-violet-500/[0.07] dark:border-violet-400 dark:bg-violet-400/10"
                )}
                initial={false}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              />
              <code className="relative block min-w-max">
                {lines.map((line, i) => {
                  const ran = finished || view.ranUpTo(i);
                  return (
                    <span
                      className="relative flex pr-4"
                      // biome-ignore lint/suspicious/noArrayIndexKey: lines are a fixed, ordered list
                      key={i}
                    >
                      <span
                        className={cn(
                          "relative w-8 shrink-0 select-none pr-3 text-right tabular-nums transition-colors duration-200",
                          lineTone(i === current, status)
                        )}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={cn(
                          "relative whitespace-pre text-zinc-800 transition-opacity duration-200 dark:text-zinc-200",
                          !ran && i !== current && line.trim() && "opacity-55"
                        )}
                      >
                        {highlight(line)}
                        {line ? "" : " "}
                      </span>
                    </span>
                  );
                })}
              </code>
            </pre>

            <AnimatePresence initial={false}>
              {printed && (
                <motion.div
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  className="border-black/[0.06] border-t dark:border-white/[0.08]"
                  exit={{ opacity: 0, filter: "blur(2px)" }}
                  id={outputId}
                  initial={{ opacity: 0, filter: "blur(2px)" }}
                  key={`out-${run}`}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                >
                  <p
                    className={cn(
                      "flex items-baseline gap-2 whitespace-pre-wrap px-3.5 pt-3 font-mono text-[11.5px]",
                      status === "error"
                        ? "pb-3 text-rose-600 dark:text-rose-400"
                        : "text-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    <span className="select-none text-zinc-300 dark:text-zinc-600">
                      ›
                    </span>
                    {shown.stdout}
                  </p>
                  {status === "done" && shown.bars.length > 0 ? (
                    <Chart bars={shown.bars} key={`chart-${run}`} max={max} />
                  ) : (
                    <div className="h-3" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AutoHeight>

        <AnimatePresence>
          {finished && shown.answer ? (
            <motion.div
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              key={`answer-${run}`}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.7 }}
            >
              {shown.answer}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {finished
            ? `${statusText(status, seconds)}. ${shown.stdout ?? ""}`
            : statusText(status, seconds)}
        </p>
      </div>
    </MotionConfig>
  );
}

/** The line number's colour: marked lines take the run's colour. */
const lineTone = (marked: boolean, status: CodeRunStatus) => {
  if (!marked) {
    return "text-zinc-300 dark:text-zinc-600";
  }
  return status === "error"
    ? "text-rose-600 dark:text-rose-400"
    : "text-violet-600 dark:text-violet-400";
};

const statusText = (status: CodeRunStatus, seconds?: number) => {
  if (status === "writing") {
    return "Writing";
  }
  if (status === "running") {
    return "Running";
  }
  if (status === "error") {
    return "Failed";
  }
  return seconds === undefined ? "Ran" : `Ran in ${seconds.toFixed(1)}s`;
};

function StatusLabel({
  status,
  seconds,
}: {
  status: CodeRunStatus;
  seconds?: number;
}) {
  const ended = status === "done" || status === "error";
  return (
    <>
      {ended ? (
        <span
          className={cn(
            "size-1.5 rounded-full",
            status === "done" ? "bg-emerald-500" : "bg-rose-500"
          )}
        />
      ) : (
        <span className="relative flex size-1.5">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            className={cn(
              "size-1.5 rounded-full",
              status === "writing" ? "bg-zinc-400" : "bg-violet-500"
            )}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
          />
        </span>
      )}
      {statusText(status, seconds)}
    </>
  );
}

/** The chart the script drew. Bars grow in one after another. */
function Chart({ bars, max }: { bars: CodeRunBar[]; max: number }) {
  const last = bars.length - 1;
  return (
    <figure className="px-3.5 pt-3 pb-3.5">
      <div className="relative flex h-28 items-end gap-1.5 sm:gap-2">
        <span className="pointer-events-none absolute inset-x-0 top-0 border-black/[0.06] border-t border-dashed dark:border-white/[0.08]" />
        <span className="pointer-events-none absolute inset-x-0 top-1/2 border-black/[0.06] border-t border-dashed dark:border-white/[0.08]" />
        {bars.map((bar, i) => (
          <div
            className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
            key={bar.label}
          >
            {i === last && (
              <motion.span
                animate={{ opacity: 1, y: 0 }}
                className="mb-1 self-center font-medium text-[11px] text-zinc-900 tabular-nums dark:text-zinc-100"
                initial={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.6 }}
              >
                {bar.value}
              </motion.span>
            )}
            <motion.div
              animate={{ clipPath: "inset(0% 0 0 0)" }}
              className={cn(
                "rounded-t-[4px] rounded-b-[2px]",
                i === last
                  ? "bg-violet-500 dark:bg-violet-400"
                  : "bg-zinc-200 dark:bg-zinc-700"
              )}
              initial={{ clipPath: "inset(100% 0 0 0)" }}
              style={{ height: `${(bar.value / max) * 82}%` }}
              title={`${bar.label}: ${bar.value}`}
              transition={{ duration: 0.45, ease: EASE_OUT, delay: i * 0.05 }}
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-1.5 flex gap-1.5 sm:gap-2">
        {bars.map((bar) => (
          <span
            className="min-w-0 flex-1 truncate text-center text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500"
            key={bar.label}
          >
            {bar.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Eases the card to its content's height when the content grows. */
function AutoHeight({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(inner.offsetHeight));
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height }}
      className={cn("overflow-hidden", className)}
      initial={false}
      transition={{ duration: 0.3, ease: EASE_DRAWER }}
    >
      <div className="p-1" ref={innerRef}>
        {children}
      </div>
    </motion.div>
  );
}
