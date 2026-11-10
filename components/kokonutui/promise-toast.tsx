"use client";

/**
 * @author: @kokonutui
 * @description: Promise Toast
 * @version: 1.0.0
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
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "loading" | "success" | "error";
type TaskKey = "publish" | "invite" | "export";

interface ToastState {
  id: number;
  task: TaskKey;
  status: Status;
  title: string;
  body: string;
  /** How many times this task has run, so a retry can succeed. */
  attempt: number;
  undone?: boolean;
}

interface Task {
  label: string;
  icon: ReactNode;
  loading: string;
  /** Counted work, shown as "12 of 24 pages" while it runs. */
  count?: { total: number; unit: string; verb: string };
  waiting?: string;
  success: [string, string];
  /** Fails on the first attempt, so Retry has something to do. */
  error?: [string, string];
  undo?: boolean;
}

const TASKS: Record<TaskKey, Task> = {
  publish: {
    label: "Publish site",
    icon: <Globe aria-hidden="true" className="size-4" />,
    loading: "Publishing changes",
    count: { total: 24, unit: "pages", verb: "Building" },
    success: ["Published", "kokonut.dev is live"],
    undo: true,
  },
  invite: {
    label: "Invite Maya",
    icon: <UserPlus aria-hidden="true" className="size-4" />,
    loading: "Sending invite",
    waiting: "maya@studio.co",
    success: ["Invite sent", "Maya can join the workspace"],
    error: ["Invite failed", "The mail server timed out"],
  },
  export: {
    label: "Export CSV",
    icon: <Download aria-hidden="true" className="size-4" />,
    loading: "Exporting orders",
    count: { total: 1284, unit: "rows", verb: "Writing" },
    success: ["Export ready", "orders-november.csv · 212 KB"],
  },
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const STACK = { type: "spring", stiffness: 380, damping: 34 } as const;
const TOAST_H = 64;
const GAP = 8;
const VISIBLE = 3;
const WORK_MS = 1800;
const STAY_MS = 5000;

export interface PromiseToastProps {
  className?: string;
}

export default function PromiseToast({ className }: PromiseToastProps) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  useEffect(() => {
    const pending = timers.current;
    // Timers stop while the tab is in the background, so nothing is missed.
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      for (const id of pending.values()) {
        window.clearTimeout(id);
      }
    };
  }, []);

  const update = (id: number, patch: Partial<ToastState>) =>
    setToasts((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const dismiss = (id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((all) => all.filter((t) => t.id !== id));
  };

  // Pretend to do the work, then land on success or failure.
  const run = (id: number, key: TaskKey, attempt: number) => {
    const task = TASKS[key];
    const fails = Boolean(task.error) && attempt === 1;
    const done = window.setTimeout(
      () => {
        const [title, body] = fails && task.error ? task.error : task.success;
        update(id, { status: fails ? "error" : "success", title, body });
      },
      fails ? WORK_MS * 0.7 : WORK_MS
    );
    timers.current.set(id, done);
  };

  const start = (key: TaskKey) => {
    const id = nextId.current++;
    setToasts((all) => [
      ...all,
      {
        id,
        task: key,
        status: "loading",
        title: TASKS[key].loading,
        body: TASKS[key].waiting ?? "",
        attempt: 1,
      },
    ]);
    run(id, key, 1);
  };

  const retry = (toast: ToastState) => {
    const attempt = toast.attempt + 1;
    update(toast.id, {
      status: "loading",
      title: "Trying again",
      body: TASKS[toast.task].waiting ?? "",
      attempt,
    });
    run(toast.id, toast.task, attempt);
  };

  const undo = (toast: ToastState) => {
    update(toast.id, {
      status: "loading",
      title: "Reverting",
      body: "Putting the last version back",
      undone: true,
    });
    const id = window.setTimeout(() => {
      update(toast.id, {
        status: "success",
        title: "Reverted",
        body: "The previous version is live again",
      });
    }, 900);
    timers.current.set(toast.id, id);
  };

  // Newest first, so index 0 sits in front.
  const ordered = [...toasts].reverse();

  return (
    <MotionConfig reducedMotion="user">
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
            {(Object.keys(TASKS) as TaskKey[]).map((key) => (
              <button
                className="flex h-11 items-center gap-3 rounded-2xl bg-zinc-100 px-3.5 text-left text-[14px] outline-hidden transition-colors duration-150 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400/50 active:bg-zinc-300 dark:bg-zinc-900 dark:active:bg-zinc-700 dark:hover:bg-zinc-800"
                key={key}
                onClick={() => start(key)}
                type="button"
              >
                <span className="text-zinc-500 dark:text-zinc-400">
                  {TASKS[key].icon}
                </span>
                {TASKS[key].label}
                {key === "invite" && (
                  <span className="ml-auto text-[12px] text-zinc-400 dark:text-zinc-500">
                    fails once
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* The toaster: stacked when idle, fanned out while the pointer or focus is on it. */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: hover and focus only fan the stack out; every action is a button inside it. */}
        <section
          aria-label="Notifications"
          aria-live="polite"
          className="relative mx-3 mb-3 h-[232px]"
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
          <AnimatePresence>
            {toasts.length === 0 && (
              <motion.p
                animate={{ opacity: 1 }}
                className="absolute inset-x-0 bottom-6 text-center text-[12.5px] text-zinc-400 dark:text-zinc-500"
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                Toasts land here
              </motion.p>
            )}
          </AnimatePresence>
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
      </div>
    </MotionConfig>
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
  const task = TASKS[toast.task];
  const canUndo = task.undo && !toast.undone;
  const settled = toast.status === "success";
  const loading = toast.status === "loading";
  const counted = loading && Boolean(task.count) && toast.attempt === 1;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // Counted work fills the bar along the bottom edge.
  useEffect(() => {
    if (!counted) {
      return;
    }
    work.set(0);
    const controls = animate(work, 1, {
      duration: WORK_MS / 1000,
      ease: [0.33, 0.6, 0.4, 1],
    });
    return () => controls.stop();
  }, [counted, work]);

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
                  {counted && task.count ? (
                    <Counted count={task.count} work={work} />
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
  count: NonNullable<Task["count"]>;
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
