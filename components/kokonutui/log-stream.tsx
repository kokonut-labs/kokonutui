"use client";

/**
 * @author: @kokonutui
 * @description: Log Stream
 * @version: 1.0.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowDown, Check, ChevronRight, RotateCcw } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type LogLevel = "info" | "warn" | "error";

export interface LogLine {
  text: string;
  level?: LogLevel;
  /** Wait before this line appears, in ms. */
  delay?: number;
}

export interface LogStep {
  name: string;
  lines: LogLine[];
}

export interface LogStreamProps {
  title?: string;
  /** Shown beside the title, e.g. the branch and commit. */
  meta?: string;
  steps?: LogStep[];
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// How close to the bottom still counts as following, in px.
const STICK = 24;
const DEFAULT_DELAY = 140;
const CHECK_MARK = /^✓ /;

const DEMO_STEPS: LogStep[] = [
  {
    name: "Install",
    lines: [
      { text: "$ bun install --frozen-lockfile", delay: 300 },
      { text: "bun install v1.2.19 (a6f1c2d0)" },
      { text: "Resolving dependencies", delay: 420 },
      { text: "Resolved, downloaded and extracted [412]", delay: 620 },
      { text: "+ next@16.0.3" },
      { text: "+ react@19.2.0", delay: 60 },
      { text: "+ react-dom@19.2.0", delay: 60 },
      { text: "+ stripe@19.1.0", delay: 60 },
      { text: "+ zod@4.1.12", delay: 60 },
      { text: "+ @tanstack/react-query@5.90.2", delay: 60 },
      { text: "+ tailwindcss@4.1.14", delay: 60 },
      { text: "+ typescript@5.9.3", delay: 60 },
      { text: "412 packages installed [2.31s]", delay: 260 },
    ],
  },
  {
    name: "Build",
    lines: [
      { text: "$ next build", delay: 300 },
      { text: "▲ Next.js 16.0.3" },
      { text: "Creating an optimized production build ...", delay: 900 },
      { text: "✓ Compiled successfully in 8.4s", delay: 1100 },
      { text: "Linting and checking validity of types ...", delay: 300 },
      {
        text: "./app/(shop)/cart.tsx  14:9  'total' is assigned a value but never used.",
        level: "warn",
        delay: 700,
      },
      { text: "Collecting page data ...", delay: 400 },
      { text: "Collecting build traces ...", delay: 300 },
      { text: "✓ Generating static pages (42/42)", delay: 800 },
      { text: "Route (app)                 Size   First Load JS", delay: 300 },
      { text: "○ /                         5.2 kB        112 kB", delay: 50 },
      { text: "○ /cart                     3.8 kB        109 kB", delay: 50 },
      { text: "ƒ /checkout                 7.1 kB        118 kB", delay: 50 },
      { text: "● /products/[slug]          4.4 kB        110 kB", delay: 50 },
    ],
  },
  {
    name: "Test",
    lines: [
      { text: "$ vitest run", delay: 300 },
      { text: "✓ lib/cart.test.ts (12 tests) 41ms", delay: 500 },
      { text: "✓ lib/price.test.ts (8 tests) 12ms", delay: 220 },
      { text: "✓ lib/inventory.test.ts (14 tests) 63ms", delay: 200 },
      { text: "✓ lib/coupons.test.ts (11 tests) 29ms", delay: 180 },
      { text: "✓ app/cart/actions.test.ts (7 tests) 141ms", delay: 260 },
      { text: "✓ app/checkout/actions.test.ts (5 tests) 188ms", delay: 380 },
      {
        text: "lib/tax.test.ts > rounds EU VAT  took 1204ms, over the 1000ms budget",
        level: "warn",
        delay: 600,
      },
      { text: "✓ lib/tax.test.ts (9 tests) 1204ms", delay: 120 },
      { text: "Test Files  7 passed (7)", delay: 240 },
      { text: "Tests      66 passed (66)" },
    ],
  },
  {
    name: "Deploy",
    lines: [
      { text: "Uploading build outputs (142 files)", delay: 400 },
      { text: "Deploying to iad1, fra1, hnd1", delay: 900 },
      {
        text: "fra1: cold start 1.9s on /checkout, above the 1.5s target",
        level: "warn",
        delay: 600,
      },
      { text: "Assigning domain acme-shop-git-main.example.app", delay: 700 },
      { text: "✓ Ready in 41s", delay: 500 },
    ],
  },
];

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function LogStream({
  title = "Production build",
  meta = "main · a1f3c9e",
  steps = DEMO_STEPS,
  className,
}: LogStreamProps) {
  const id = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  /** Lines shown so far, per step. */
  const [shown, setShown] = useState<number[]>(() => steps.map(() => 0));
  const [stepIndex, setStepIndex] = useState(0);
  /** Steps the reader opened or closed, which stay as they left them. */
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [unseen, setUnseen] = useState(0);
  const [isFollowing, setIsFollowing] = useState(true);
  const [run, setRun] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [durations, setDurations] = useState<number[]>([]);
  const finished = stepIndex >= steps.length;

  const startedAt = useRef<number | null>(null);
  const stepStartedAt = useRef(0);

  // Streams lines into the running step, one at a time.
  useEffect(() => {
    if (finished) {
      return;
    }
    const step = steps[stepIndex];
    const count = shown[stepIndex];
    if (count >= step.lines.length) {
      const done = setTimeout(() => {
        const now = performance.now();
        const took = now - stepStartedAt.current;
        setDurations((d) => [...d, took]);
        stepStartedAt.current = now;
        setElapsed(now - (startedAt.current ?? now));
        setStepIndex((i) => i + 1);
      }, 250);
      return () => clearTimeout(done);
    }
    const timer = setTimeout(() => {
      setShown((s) => s.map((n, i) => (i === stepIndex ? n + 1 : n)));
      if (!following.current) {
        setUnseen((n) => n + 1);
      }
    }, step.lines[count].delay ?? DEFAULT_DELAY);
    return () => clearTimeout(timer);
  }, [finished, shown, stepIndex, steps]);

  // The clock runs until the last step ends.
  useEffect(() => {
    if (finished) {
      return;
    }
    if (startedAt.current === null) {
      startedAt.current = performance.now();
      stepStartedAt.current = startedAt.current;
    }
    const tick = setInterval(
      () => setElapsed(performance.now() - (startedAt.current ?? 0)),
      250
    );
    return () => clearInterval(tick);
  }, [finished]);

  const toBottom = useCallback(() => {
    const el = scroller.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // While following, any growth (a new line, a step folding) keeps the
  // bottom in view.
  useEffect(() => {
    const el = content.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (following.current) {
        toBottom();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [toBottom]);

  const follow = (on: boolean) => {
    following.current = on;
    setIsFollowing(on);
    if (on) {
      setUnseen(0);
      toBottom();
    }
  };

  // Scrolling up stops the follow; reaching the bottom again resumes it. Our
  // own scrolls only ever go down, so they never stop it.
  const lastTop = useRef(0);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) {
      return;
    }
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK;
    if (atBottom) {
      if (!following.current) {
        follow(true);
      }
    } else if (el.scrollTop < lastTop.current && following.current) {
      following.current = false;
      setIsFollowing(false);
    }
    lastTop.current = el.scrollTop;
  };

  const restart = () => {
    setShown(steps.map(() => 0));
    setStepIndex(0);
    setOpen({});
    setDurations([]);
    setElapsed(0);
    startedAt.current = null;
    setRun((r) => r + 1);
    follow(true);
  };

  const isOpen = (i: number) => open[i] ?? i <= stepIndex;
  const warnings = steps.reduce(
    (sum, step, i) =>
      sum +
      step.lines.slice(0, shown[i]).filter((l) => l.level === "warn").length,
    0
  );

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex h-11 items-center gap-2.5 border-zinc-200 border-b px-3.5 dark:border-zinc-800">
          <span className="flex size-4 items-center justify-center">
            {finished ? (
              <Check
                aria-hidden="true"
                className="size-3.5 text-emerald-600 dark:text-emerald-400"
                strokeWidth={2.5}
              />
            ) : (
              <Spinner />
            )}
          </span>
          <span className="font-medium text-[13px]">{title}</span>
          <span className="truncate font-mono text-[11.5px] text-zinc-400 dark:text-zinc-500">
            {meta}
          </span>
          <span className="ml-auto flex items-center gap-3">
            {warnings > 0 && (
              <span className="text-[12px] text-orange-600 tabular-nums dark:text-orange-400">
                {warnings} {warnings === 1 ? "warning" : "warnings"}
              </span>
            )}
            <span className="font-mono text-[11.5px] text-zinc-500 tabular-nums dark:text-zinc-400">
              {clock(elapsed)}
            </span>
            <button
              aria-label="Run again"
              className="flex size-7 items-center justify-center rounded-md text-zinc-400 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 disabled:pointer-events-none disabled:opacity-0 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              disabled={!finished}
              onClick={restart}
              type="button"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </span>
        </div>

        <div className="relative">
          <section
            aria-label="Build log"
            className="h-72 overflow-y-auto overscroll-contain py-1.5 font-mono text-[12px] leading-5 outline-hidden [overflow-anchor:none] focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-inset"
            onScroll={onScroll}
            ref={scroller}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the log scrolls by keyboard
            tabIndex={0}
          >
            <div ref={content}>
              {steps.map((step, i) => {
                if (i > stepIndex) {
                  return null;
                }
                const running = i === stepIndex;
                const stepWarnings = step.lines
                  .slice(0, shown[i])
                  .filter((line) => line.level === "warn").length;
                const panel = `${id}-step-${i}`;
                const offset = steps
                  .slice(0, i)
                  .reduce((sum, s) => sum + s.lines.length, 0);
                return (
                  <section key={`${run}-${step.name}`}>
                    <button
                      aria-controls={panel}
                      aria-expanded={isOpen(i)}
                      className="flex h-7 w-full items-center gap-2 pr-14 pl-3 text-left font-sans text-[12.5px] outline-hidden transition-colors duration-150 hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-900 dark:hover:bg-zinc-900"
                      data-label={step.name}
                      data-mini="header"
                      onClick={() =>
                        setOpen((o) => ({ ...o, [i]: !isOpen(i) }))
                      }
                      type="button"
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={cn(
                          "size-3 text-zinc-400 transition-transform duration-200 dark:text-zinc-500",
                          isOpen(i) && "rotate-90"
                        )}
                      />
                      <span className="flex size-3.5 items-center justify-center">
                        {running ? (
                          <Spinner />
                        ) : (
                          <Check
                            aria-hidden="true"
                            className="size-3 text-emerald-600 dark:text-emerald-400"
                            strokeWidth={2.5}
                          />
                        )}
                      </span>
                      <span
                        className={cn(
                          running
                            ? "text-zinc-900 dark:text-zinc-100"
                            : "text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        {step.name}
                      </span>
                      {stepWarnings > 0 && (
                        <span className="ml-1 flex h-4 items-center rounded-full bg-orange-500/10 px-1.5 font-mono text-[10.5px] text-orange-700 tabular-nums dark:text-orange-300">
                          {stepWarnings}
                          <span className="sr-only">
                            {stepWarnings === 1 ? " warning" : " warnings"}
                          </span>
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
                        {running
                          ? ""
                          : `${((durations[i] ?? 0) / 1000).toFixed(1)}s`}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen(i) && (
                        <motion.div
                          animate={{ height: "auto", opacity: 1 }}
                          className="overflow-hidden"
                          exit={{ height: 0, opacity: 0 }}
                          id={panel}
                          initial={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: EASE_OUT }}
                        >
                          <ol className="pb-1">
                            {step.lines.slice(0, shown[i]).map((line, n) => (
                              <Line
                                key={`${n}-${line.text}`}
                                line={line}
                                number={offset + n + 1}
                              />
                            ))}
                          </ol>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                );
              })}
            </div>
          </section>

          <Minimap content={content} scroller={scroller} />

          <AnimatePresence>
            {!isFollowing && (
              <motion.button
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-3 left-1/2 flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-full bg-zinc-900 pr-3 pl-2.5 text-[12px] text-white shadow-sm outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-zinc-100 dark:text-zinc-900"
                exit={{ opacity: 0, y: 6 }}
                initial={{ opacity: 0, y: 6 }}
                onClick={() => follow(true)}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                type="button"
              >
                <ArrowDown aria-hidden="true" className="size-3.5" />
                {unseen > 0 ? (
                  <span className="tabular-nums">
                    {unseen} new {unseen === 1 ? "line" : "lines"}
                  </span>
                ) : (
                  "Follow"
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <p aria-live="polite" className="sr-only">
          {finished ? "Build finished" : `Running ${steps[stepIndex]?.name}`}
        </p>
      </div>
    </MotionConfig>
  );
}

function Line({ line, number }: { line: LogLine; number: number }) {
  const check = CHECK_MARK.test(line.text);
  return (
    <motion.li
      animate={{ opacity: 1 }}
      className={cn(
        "flex gap-3 border-l-2 pr-14 pl-[calc(0.75rem-2px)]",
        line.level === "warn"
          ? "border-orange-500 bg-orange-500/[0.06] text-orange-700 dark:text-orange-300"
          : "border-transparent text-zinc-700 dark:text-zinc-300",
        line.level === "error" &&
          "border-red-500 bg-red-500/[0.06] text-red-700 dark:text-red-300"
      )}
      data-mini={line.level ?? "info"}
      data-number={number}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <span className="w-6 shrink-0 select-none text-right text-zinc-300 tabular-nums dark:text-zinc-600">
        {number}
      </span>
      <span className="min-w-0 whitespace-pre-wrap break-words">
        {check ? (
          <>
            <span className="text-emerald-600 dark:text-emerald-400">✓</span>
            {line.text.slice(1)}
          </>
        ) : (
          line.text
        )}
      </span>
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

interface MiniItem {
  top: number;
  height: number;
  kind: string;
  number?: string;
  text: string;
}

// Characters that fill the rail's width, for sizing each line's bar.
const MINI_CHARS = 64;
const LEADING_NUMBER = /^\d+/;

/**
 * The whole log in miniature down the right edge: a bar per line sized to its
 * text, warnings in orange and a window for what's on screen. Drag or click it
 * to move through the log; hover a bar to read its line.
 */
function Minimap({
  scroller,
  content,
}: {
  scroller: RefObject<HTMLElement | null>;
  content: RefObject<HTMLDivElement | null>;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<MiniItem[]>([]);
  const [view, setView] = useState({ top: 0, height: 1, total: 1 });
  const [hover, setHover] = useState<MiniItem | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const sc = scroller.current;
    const c = content.current;
    if (!(sc && c)) {
      return;
    }
    const measure = () => {
      const origin = sc.getBoundingClientRect().top - sc.scrollTop;
      setItems(
        [...c.querySelectorAll<HTMLElement>("[data-mini]")].map((el) => {
          const box = el.getBoundingClientRect();
          return {
            top: box.top - origin,
            height: box.height,
            kind: el.dataset.mini ?? "info",
            number: el.dataset.number,
            text:
              el.dataset.label ??
              el.textContent?.replace(LEADING_NUMBER, "").trim() ??
              "",
          };
        })
      );
    };
    const sync = () =>
      setView({
        top: sc.scrollTop,
        height: sc.clientHeight,
        total: Math.max(sc.scrollHeight, sc.clientHeight),
      });
    const observer = new ResizeObserver(() => {
      measure();
      sync();
    });
    observer.observe(c);
    sc.addEventListener("scroll", sync, { passive: true });
    measure();
    sync();
    return () => {
      observer.disconnect();
      sc.removeEventListener("scroll", sync);
    };
  }, [scroller, content]);

  const railHeight = rail.current?.clientHeight ?? 1;
  const scale = railHeight / view.total;

  const yOf = (event: PointerEvent) =>
    event.clientY - (rail.current?.getBoundingClientRect().top ?? 0);

  // Centers the window on the pointer.
  const scrollTo = (event: PointerEvent) => {
    const sc = scroller.current;
    if (sc) {
      sc.scrollTop = yOf(event) / scale - sc.clientHeight / 2;
    }
  };

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) {
      scrollTo(event);
      return;
    }
    const at = yOf(event) / scale;
    setHover(
      items.find(
        (item) => at >= item.top - 2 && at <= item.top + item.height + 2
      ) ?? null
    );
  };

  return (
    <div
      aria-hidden="true"
      className="absolute top-1.5 right-1.5 bottom-1.5 w-10 cursor-pointer touch-none"
      onPointerDown={(e) => {
        dragging.current = true;
        setHover(null);
        e.currentTarget.setPointerCapture(e.pointerId);
        scrollTo(e);
      }}
      onPointerLeave={() => setHover(null)}
      onPointerMove={onMove}
      onPointerUp={() => {
        dragging.current = false;
      }}
      ref={rail}
    >
      {items.map((item) => (
        <span
          className={cn(
            "absolute left-1 rounded-full transition-[top] duration-200",
            item.kind === "header" && "bg-zinc-400 dark:bg-zinc-500",
            item.kind === "info" && "bg-zinc-300 dark:bg-zinc-700",
            item.kind === "warn" && "bg-orange-500",
            item.kind === "error" && "bg-red-500"
          )}
          key={`${item.kind}-${item.number ?? item.text}`}
          style={{
            top: (item.top + item.height / 2) * scale - 1,
            height: item.kind === "warn" ? 3 : 2,
            width:
              item.kind === "header"
                ? 12
                : Math.max(
                    4,
                    (Math.min(item.text.length, MINI_CHARS) / MINI_CHARS) * 32
                  ),
          }}
        />
      ))}
      <span
        className="absolute inset-x-0 rounded-[3px] border border-zinc-300 bg-zinc-900/[0.04] transition-[height] duration-150 dark:border-zinc-700 dark:bg-white/[0.05]"
        style={{
          top: view.top * scale,
          height: Math.max(10, view.height * scale),
        }}
      />
      {hover && (
        <span
          className={cn(
            "pointer-events-none absolute right-full mr-2 flex max-w-[22rem] -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-[11px] shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
            hover.kind === "warn"
              ? "text-orange-700 dark:text-orange-300"
              : "text-zinc-700 dark:text-zinc-300"
          )}
          style={{ top: (hover.top + hover.height / 2) * scale }}
        >
          {hover.number && (
            <span className="text-zinc-400 dark:text-zinc-500">
              {hover.number}
            </span>
          )}
          <span className="truncate">{hover.text}</span>
        </span>
      )}
    </div>
  );
}
