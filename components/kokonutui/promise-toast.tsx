"use client";

/**
 * @author: @kokonutui
 * @description: Promise Toast
 * @version: 1.1.0
 * @date: 2026-11-08
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Download, Globe, UserPlus, X } from "lucide-react";
import {
  AnimatePresence,
  animate,
  MotionConfig,
  type MotionValue,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Status = "loading" | "success" | "error";

/** A title, or a title and a second line. */
export type ToastLines = string | [string, string];

/** Counted work, shown as "Building 12 of 24 pages" with a filling edge. */
export interface ToastCount {
  total: number;
  unit: string;
  verb: string;
}

export interface ToastOptions<T> {
  /** The title while it works. */
  loading: string;
  /** A second line while it works, e.g. who the invite is going to. */
  waiting?: string;
  /** Counted work. The task reports how far it is with `report(done)`. */
  count?: ToastCount;
  /** What it says when the task resolves, from what it resolved with. */
  success: ToastLines | ((value: T) => ToastLines);
  /** What it says when the task throws. Retry runs the task again. */
  error: ToastLines | ((error: unknown) => ToastLines);
  /** Offers Undo once it lands, running this. */
  undo?: {
    run: () => Promise<unknown>;
    loading?: ToastLines;
    success?: ToastLines;
  };
}

/** The work behind a toast. `report` moves a counted toast along. */
export type ToastTask<T> = (report: (done: number) => void) => Promise<T>;

interface ToastState {
  id: number;
  status: Status;
  title: string;
  body: string;
  /** How many times the task has run. */
  attempt: number;
  /** Counted work done so far, while a counted task runs. */
  done?: number;
  undone?: boolean;
  task: ToastTask<unknown>;
  options: ToastOptions<unknown>;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const STACK = { type: "spring", stiffness: 380, damping: 34 } as const;
const TOAST_H = 64;
const GAP = 8;
const VISIBLE = 3;
const WORK_MS = 1800;
const STAY_MS = 5000;

const split = (lines: ToastLines): [string, string] =>
  typeof lines === "string" ? [lines, ""] : lines;

function linesFor<V>(
  lines: ToastLines | ((value: V) => ToastLines),
  value: V
): [string, string] {
  return split(typeof lines === "function" ? lines(value) : lines);
}

/**
 * The toasts and what to do with them. `show` takes the work as a function,
 * so Retry can run it again, and returns the toast's id.
 */
export function usePromiseToast() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const nextId = useRef(1);

  const update = useCallback(
    (id: number, patch: Partial<ToastState>) =>
      setToasts((all) =>
        all.map((t) => (t.id === id ? { ...t, ...patch } : t))
      ),
    []
  );

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    []
  );

  const settle = useCallback(
    (id: number, task: ToastTask<unknown>, options: ToastOptions<unknown>) => {
      task((done) => update(id, { done })).then(
        (value) => {
          const [title, body] = linesFor(options.success, value);
          update(id, { status: "success", title, body, done: undefined });
        },
        (error: unknown) => {
          const [title, body] = linesFor(options.error, error);
          update(id, { status: "error", title, body, done: undefined });
        }
      );
    },
    [update]
  );

  const show = useCallback(
    <T,>(task: ToastTask<T>, options: ToastOptions<T>) => {
      const id = nextId.current++;
      const state: ToastState = {
        id,
        status: "loading",
        title: options.loading,
        body: options.waiting ?? "",
        attempt: 1,
        task: task as ToastTask<unknown>,
        options: options as ToastOptions<unknown>,
      };
      setToasts((all) => [...all, state]);
      settle(id, state.task, state.options);
      return id;
    },
    [settle]
  );

  const retry = useCallback(
    (toast: ToastState) => {
      update(toast.id, {
        status: "loading",
        title: "Trying again",
        body: toast.options.waiting ?? "",
        attempt: toast.attempt + 1,
        done: undefined,
      });
      settle(toast.id, toast.task, toast.options);
    },
    [settle, update]
  );

  const undo = useCallback(
    (toast: ToastState) => {
      const back = toast.options.undo;
      if (!back) {
        return;
      }
      const [title, body] = split(back.loading ?? "Reverting");
      update(toast.id, { status: "loading", title, body, undone: true });
      back.run().then(
        () => {
          const [doneTitle, doneBody] = split(back.success ?? "Reverted");
          update(toast.id, {
            status: "success",
            title: doneTitle,
            body: doneBody,
          });
        },
        (error: unknown) => {
          const [failTitle, failBody] = linesFor(toast.options.error, error);
          update(toast.id, {
            status: "error",
            title: failTitle,
            body: failBody,
          });
        }
      );
    },
    [update]
  );

  return { toasts, show, dismiss, retry, undo };
}

export type PromiseToaster = ReturnType<typeof usePromiseToast>;

/**
 * Where the toasts land: stacked when idle, fanned out while the pointer or
 * focus is on it. Put it once, near the bottom of your layout.
 */
export function Toaster({
  toaster,
  className,
}: {
  toaster: PromiseToaster;
  className?: string;
}) {
  const { toasts, dismiss, retry, undo } = toaster;
  const [expanded, setExpanded] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    // Timers stop while the tab is in the background, so nothing is missed.
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Newest first, so index 0 sits in front.
  const ordered = [...toasts].reverse();

  return (
    <MotionConfig reducedMotion="user">
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: hover and focus only fan the stack out; every action is a button inside it. */}
      <section
        aria-label="Notifications"
        aria-live="polite"
        className={cn("relative h-[232px]", className)}
        data-state={
          toasts.some((t) => t.status === "loading") ? "busy" : "idle"
        }
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setExpanded(false);
          }
        }}
        onFocus={() => setExpanded(true)}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            setExpanded(true);
          }
        }}
        onPointerLeave={() => setExpanded(false)}
      >
        <ol className="absolute inset-x-0 bottom-0">
          <AnimatePresence initial={false}>
            {ordered.map((toast, index) => (
              <ToastItem
                expanded={expanded}
                index={index}
                key={toast.id}
                onDismiss={() => dismiss(toast.id)}
                onRetry={() => retry(toast)}
                onUndo={() => undo(toast)}
                paused={expanded || tabHidden}
                toast={toast}
              />
            ))}
          </AnimatePresence>
        </ol>
      </section>
    </MotionConfig>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Demo work that counts up to `total` over `ms`, easing out. */
const countTo =
  (total: number, ms: number): ToastTask<void> =>
  async (report) => {
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      await wait(ms / steps);
      report(Math.round(total * (1 - (1 - i / steps) ** 2)));
    }
  };

interface DemoTask {
  label: string;
  icon: ReactNode;
  note?: string;
  run: (toaster: PromiseToaster) => void;
}

const DEMO_TASKS: DemoTask[] = [
  {
    label: "Publish site",
    icon: <Globe aria-hidden="true" className="size-4" />,
    run: ({ show }) =>
      show(countTo(24, WORK_MS), {
        loading: "Publishing changes",
        count: { total: 24, unit: "pages", verb: "Building" },
        success: ["Published", "kokonut.dev is live"],
        error: "Couldn’t publish",
        undo: {
          run: () => wait(900),
          loading: ["Reverting", "Putting the last version back"],
          success: ["Reverted", "The previous version is live again"],
        },
      }),
  },
  {
    label: "Invite Maya",
    icon: <UserPlus aria-hidden="true" className="size-4" />,
    note: "fails once",
    run: ({ show }) => {
      let tries = 0;
      show(
        async () => {
          tries += 1;
          await wait(tries === 1 ? WORK_MS * 0.7 : WORK_MS);
          if (tries === 1) {
            throw new Error("The mail server timed out");
          }
        },
        {
          loading: "Sending invite",
          waiting: "maya@studio.co",
          success: ["Invite sent", "Maya can join the workspace"],
          error: (e) => ["Invite failed", (e as Error).message],
        }
      );
    },
  },
  {
    label: "Export CSV",
    icon: <Download aria-hidden="true" className="size-4" />,
    run: ({ show }) =>
      show(countTo(1284, WORK_MS), {
        loading: "Exporting orders",
        count: { total: 1284, unit: "rows", verb: "Writing" },
        success: ["Export ready", "orders-november.csv · 212 KB"],
        error: "Export failed",
      }),
  },
];

export interface PromiseToastProps {
  className?: string;
}

/** The demo: three tasks to run, and the toaster they land in. */
export default function PromiseToast({ className }: PromiseToastProps) {
  const toaster = usePromiseToast();

  return (
    <div
      className={cn(
        "relative w-full max-w-sm overflow-hidden rounded-[28px] border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div className="p-5">
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
          Run a task
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {DEMO_TASKS.map((task) => (
            <button
              className="flex h-11 items-center gap-3 rounded-2xl bg-zinc-100 px-3.5 text-left text-[14px] outline-hidden transition-colors duration-150 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400/50 active:bg-zinc-300 dark:bg-zinc-900 dark:active:bg-zinc-700 dark:hover:bg-zinc-800"
              key={task.label}
              onClick={() => task.run(toaster)}
              type="button"
            >
              <span className="text-zinc-500 dark:text-zinc-400">
                {task.icon}
              </span>
              {task.label}
              {task.note ? (
                <span className="ml-auto text-[12px] text-zinc-400 dark:text-zinc-500">
                  {task.note}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mx-3 mb-3">
        <AnimatePresence>
          {toaster.toasts.length === 0 && (
            <motion.p
              animate={{ opacity: 1 }}
              className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-[12.5px] text-zinc-400 dark:text-zinc-500"
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              Toasts land here
            </motion.p>
          )}
        </AnimatePresence>
        <Toaster toaster={toaster} />
      </div>
    </div>
  );
}

function ToastItem({
  toast,
  index,
  expanded,
  paused,
  onDismiss,
  onRetry,
  onUndo,
}: {
  toast: ToastState;
  index: number;
  expanded: boolean;
  paused: boolean;
  onDismiss: () => void;
  onRetry: () => void;
  onUndo: () => void;
}) {
  const [swiped, setSwiped] = useState(false);
  const life = useMotionValue(1);
  const work = useMotionValue(0);
  const x = useMotionValue(0);
  // The further it's swiped, the more it fades.
  const fade = useTransform(x, [0, 160], [1, 0]);
  const { count } = toast.options;
  const canUndo = Boolean(toast.options.undo) && !toast.undone;
  const settled = toast.status === "success";
  const loading = toast.status === "loading";
  const counted = loading && count !== undefined && toast.done !== undefined;
  const progress =
    count && toast.done !== undefined ? toast.done / count.total : 0;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // Counted work fills the bar along the bottom edge as the task reports.
  useEffect(() => {
    if (!counted) {
      work.set(0);
      return;
    }
    const controls = animate(work, progress, {
      duration: 0.3,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [counted, progress, work]);

  // A settled toast drains, then leaves. Hovering or hiding the tab pauses it.
  useEffect(() => {
    if (!settled) {
      life.set(1);
      return;
    }
    const controls = animate(life, 0, {
      duration: (life.get() * STAY_MS) / 1000,
      ease: "linear",
      onComplete: () => dismissRef.current(),
    });
    if (paused) {
      controls.pause();
    }
    return () => controls.stop();
  }, [settled, paused, life]);

  const front = index === 0;
  const hidden = index >= VISIBLE;
  const y = expanded ? -index * (TOAST_H + GAP) : -index * 12;
  const scale = expanded ? 1 : 1 - index * 0.05;

  return (
    <motion.li
      animate={{ y, scale, opacity: hidden ? 0 : 1 }}
      className="absolute inset-x-0 bottom-0 origin-top touch-pan-y"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.05, right: 0.9 }}
      exit={
        swiped
          ? { x: "110%", opacity: 0, transition: { duration: 0.2 } }
          : {
              y: y + 10,
              opacity: 0,
              scale: scale * 0.97,
              transition: { duration: 0.15, ease: EASE_OUT },
            }
      }
      initial={{ y: TOAST_H, opacity: 0, scale: 1 }}
      onDragEnd={(_, info) => {
        // A quick flick is enough; a slow drag has to go most of the way.
        if (info.offset.x > 100 || info.velocity.x > 400) {
          setSwiped(true);
          onDismiss();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onDismiss();
        }
      }}
      style={{
        x,
        zIndex: 100 - index,
        pointerEvents: hidden ? "none" : "auto",
      }}
      transition={STACK}
    >
      <motion.div
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white px-3 shadow-[0_6px_20px_rgba(0,0,0,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_6px_20px_rgba(0,0,0,0.4)]"
        style={{ height: TOAST_H, opacity: fade }}
      >
        {/* Toasts behind the front one stay quiet until the stack fans out. */}
        <motion.div
          animate={{ opacity: front || expanded ? 1 : 0 }}
          className="flex min-w-0 flex-1 items-center gap-3"
          initial={false}
          transition={{ duration: 0.2 }}
        >
          <StatusIcon status={toast.status} />
          <div className="relative min-w-0 flex-1">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
                initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
                key={toast.title}
                transition={{ duration: 0.22, ease: EASE_OUT }}
              >
                <p className="truncate font-medium text-[14px]">
                  {toast.title}
                </p>
                <p className="truncate text-[12.5px] text-zinc-500 tabular-nums dark:text-zinc-400">
                  {counted && count ? (
                    <Counted count={count} work={work} />
                  ) : (
                    toast.body
                  )}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence initial={false} mode="popLayout">
            {toast.status === "error" && (
              <ActionButton key="retry" onClick={onRetry}>
                Retry
              </ActionButton>
            )}
            {settled && canUndo && (
              <ActionButton key="undo" onClick={onUndo}>
                <svg
                  aria-hidden="true"
                  className="-ml-0.5 size-4 -rotate-90"
                  viewBox="0 0 16 16"
                >
                  <circle
                    className="fill-none stroke-zinc-300 dark:stroke-zinc-600"
                    cx={8}
                    cy={8}
                    r={6}
                    strokeWidth={2}
                  />
                  <motion.circle
                    className="fill-none stroke-zinc-900 dark:stroke-zinc-100"
                    cx={8}
                    cy={8}
                    r={6}
                    strokeLinecap="round"
                    strokeWidth={2}
                    style={{ pathLength: life }}
                  />
                </svg>
                Undo
              </ActionButton>
            )}
          </AnimatePresence>
          <button
            aria-label="Dismiss"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-zinc-400 outline-hidden transition-[opacity,color] duration-150 hover:text-zinc-700 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:hover:text-zinc-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
            onClick={onDismiss}
            type="button"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </motion.div>

        {/* Counted work fills a hairline along the bottom edge. */}
        <AnimatePresence>
          {counted && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-zinc-900 dark:bg-zinc-100"
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              style={{ scaleX: work }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.li>
  );
}

function Counted({
  work,
  count,
}: {
  work: MotionValue<number>;
  count: ToastCount;
}) {
  const text = useTransform(
    work,
    (v) =>
      `${count.verb} ${Math.round(v * count.total).toLocaleString("en-US")} of ${count.total.toLocaleString("en-US")} ${count.unit}`
  );
  return <motion.span>{text}</motion.span>;
}

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <motion.button
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-3 font-medium text-[12.5px] outline-hidden transition-colors duration-150 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400/50 active:bg-zinc-300 dark:bg-zinc-800 dark:active:bg-zinc-600 dark:hover:bg-zinc-700"
      exit={{ opacity: 0, filter: "blur(2px)", transition: { duration: 0.12 } }}
      initial={{ opacity: 0, filter: "blur(2px)" }}
      onClick={onClick}
      transition={{ duration: 0.2, delay: 0.1, ease: EASE_OUT }}
      type="button"
    >
      {children}
    </motion.button>
  );
}

const ICON_TONE: Record<Status, string> = {
  loading: "text-zinc-400 dark:text-zinc-500",
  success: "text-emerald-500",
  error: "text-rose-500",
};

/** One ring: it spins while working, closes when done, then draws the mark. */
function StatusIcon({ status }: { status: Status }) {
  const working = status === "loading";
  return (
    <span
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center transition-colors duration-300",
        ICON_TONE[status]
      )}
    >
      <motion.svg
        animate={working ? { rotate: 360 } : { rotate: 0 }}
        aria-hidden="true"
        className="size-8"
        fill="none"
        transition={
          working
            ? {
                duration: 0.9,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              }
            : { duration: 0 }
        }
        viewBox="0 0 32 32"
      >
        <motion.circle
          animate={{ pathLength: working ? 0.3 : 1 }}
          cx={16}
          cy={16}
          initial={false}
          r={13}
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={2.5}
          style={{ rotate: -90, transformOrigin: "16px 16px" }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        />
      </motion.svg>
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-8"
        fill="none"
        viewBox="0 0 32 32"
      >
        <AnimatePresence initial={false}>
          {status === "success" && (
            <motion.path
              animate={{ pathLength: 1 }}
              d="M10.5 16.5l3.6 3.5 7.4-7.6"
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              initial={{ pathLength: 0 }}
              key="check"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              transition={{ duration: 0.25, delay: 0.2, ease: EASE_OUT }}
            />
          )}
          {status === "error" && (
            <motion.path
              animate={{ pathLength: 1 }}
              d="M16 10v7.5M16 21.6v.1"
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              initial={{ pathLength: 0 }}
              key="bang"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={2.5}
              transition={{ duration: 0.2, delay: 0.2, ease: EASE_OUT }}
            />
          )}
        </AnimatePresence>
      </svg>
    </span>
  );
}
