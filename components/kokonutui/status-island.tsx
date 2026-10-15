"use client";

/**
 * @author: @dorianbaffier
 * @description: Status Island
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Transition,
} from "motion/react";
import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type IslandTaskStatus = "running" | "done" | "error";

export interface IslandTask {
  id: string;
  /** What is happening, e.g. "Uploading 12 photos". */
  label: string;
  /** Optional second part, shown dimmed after the label. */
  detail?: string;
  status: IslandTaskStatus;
  /** 0 to 1 while running. Leave it out for work without a known length. */
  progress?: number;
  /** A follow-up, like Undo, Open or Retry. */
  action?: { label: string; onClick: () => void };
}

export interface StatusIslandProps {
  /** Oldest first; the newest task is the one the island shows. */
  tasks: IslandTask[];
  /** Called when a finished task has been on screen for `dismissAfter`. */
  onDismiss?: (id: string) => void;
  /** Milliseconds a done task stays. Paused while the island is open. */
  dismissAfter?: number;
  className?: string;
}

const MORPH: Transition = { type: "spring", duration: 0.45, bounce: 0.18 };
const SWAP: Transition = { duration: 0.22, ease: [0.23, 1, 0.32, 1] };
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
// Tasks that peek out behind the island when it is closed.
const MAX_PEEK = 2;

/** A number whose digits roll to their new value. */
function RollingNumber({ value }: { value: number }) {
  const text = String(value);
  return (
    <span aria-hidden="true" className="inline-flex tabular-nums">
      {text.split("").map((char, i) => {
        // Keyed from the right, so the ones stay the ones when a digit is added.
        const key = text.length - i;
        const digit = Number(char);
        return (
          <span className="relative inline-block h-4 overflow-hidden" key={key}>
            <span
              className="flex flex-col transition-transform duration-200 motion-reduce:transition-none"
              style={{
                transform: `translateY(${-digit * 10}%)`,
                transitionTimingFunction: EASE_OUT,
              }}
            >
              {"0123456789".split("").map((d) => (
                <span className="h-4 leading-4" key={d}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function TaskIcon({ task }: { task: IslandTask }) {
  if (task.status === "done") {
    return (
      <svg
        aria-hidden="true"
        className="size-4 shrink-0 text-emerald-400"
        fill="none"
        viewBox="0 0 16 16"
      >
        <circle cx="8" cy="8" fill="currentColor" opacity="0.18" r="8" />
        <motion.path
          animate={{ pathLength: 1 }}
          d="M4.75 8.25 7 10.5l4.25-4.75"
          initial={{ pathLength: 0 }}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.08 }}
        />
      </svg>
    );
  }
  if (task.status === "error") {
    return (
      <svg
        aria-hidden="true"
        className="size-4 shrink-0 text-red-400"
        fill="none"
        viewBox="0 0 16 16"
      >
        <circle cx="8" cy="8" fill="currentColor" opacity="0.18" r="8" />
        <path
          d="M8 4.5v4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.75"
        />
        <circle cx="8" cy="11.25" fill="currentColor" r="1" />
      </svg>
    );
  }
  const known = typeof task.progress === "number";
  const circumference = 2 * Math.PI * 6;
  const progress = known ? Math.min(1, Math.max(0, task.progress ?? 0)) : 0.25;
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 -rotate-90",
        !known && "animate-spin motion-reduce:animate-none"
      )}
      fill="none"
      viewBox="0 0 16 16"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="2"
      />
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        strokeLinecap="round"
        strokeWidth="2"
        style={{ transition: `stroke-dashoffset 250ms ${EASE_OUT}` }}
      />
    </svg>
  );
}

function TaskTrailing({ task }: { task: IslandTask }) {
  if (task.action) {
    const { label, onClick } = task.action;
    return (
      <button
        className="-my-1 shrink-0 rounded-full bg-white/12 px-2.5 py-1 font-medium text-white text-xs transition-colors duration-150 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white/60"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        type="button"
      >
        {label}
      </button>
    );
  }
  if (task.status === "running" && typeof task.progress === "number") {
    const percent = Math.round(Math.min(1, Math.max(0, task.progress)) * 100);
    return (
      <span className="flex shrink-0 items-center text-white/55 text-xs">
        <RollingNumber value={percent} />%
      </span>
    );
  }
  return null;
}

function TaskRow({ task }: { task: IslandTask }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <TaskIcon task={task} />
      <span className="min-w-0 flex-1 truncate text-[13px] leading-4">
        {task.label}
        {task.detail ? (
          <span className="text-white/50"> · {task.detail}</span>
        ) : null}
      </span>
      <TaskTrailing task={task} />
    </div>
  );
}

function describe(task: IslandTask) {
  return [task.label, task.detail].filter(Boolean).join(", ");
}

/**
 * A pill that reports background work. It reshapes itself as tasks change
 * and opens into a list of everything in flight on hover, focus or tap.
 */
export function StatusIsland({
  tasks,
  onDismiss,
  dismissAfter = 4000,
  className,
}: StatusIslandProps) {
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const doneAt = useRef(new Map<string, number>());
  const lastStatus = useRef(new Map<string, IslandTaskStatus>());
  const current = tasks.at(-1);
  const behind = Math.min(tasks.length - 1, MAX_PEEK);
  const expanded = open && tasks.length > 0;
  const islandRef = useRef<HTMLDivElement>(null);

  // A tap anywhere else closes the list on touch screens.
  useEffect(() => {
    if (!expanded) {
      return;
    }
    const close = (event: globalThis.PointerEvent) => {
      if (!islandRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [expanded]);

  // Announce new tasks and status changes, not every progress tick.
  useEffect(() => {
    for (const task of tasks) {
      if (lastStatus.current.get(task.id) !== task.status) {
        lastStatus.current.set(task.id, task.status);
        setAnnouncement(describe(task));
      }
    }
    const ids = new Set(tasks.map((task) => task.id));
    for (const id of lastStatus.current.keys()) {
      if (!ids.has(id)) {
        lastStatus.current.delete(id);
        doneAt.current.delete(id);
      }
    }
  }, [tasks]);

  // Finished tasks leave on their own, but never while someone is reading.
  useEffect(() => {
    if (!onDismiss || expanded) {
      return;
    }
    const now = Date.now();
    const timers: number[] = [];
    for (const task of tasks) {
      if (task.status !== "done") {
        continue;
      }
      const since = doneAt.current.get(task.id) ?? now;
      doneAt.current.set(task.id, since);
      const left = Math.max(0, dismissAfter - (now - since));
      timers.push(window.setTimeout(() => onDismiss(task.id), left));
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [tasks, expanded, onDismiss, dismissAfter]);

  // Reading restarts the clock, so a task doesn't vanish as the pointer leaves.
  useEffect(() => {
    if (expanded) {
      const now = Date.now();
      for (const id of doneAt.current.keys()) {
        doneAt.current.set(id, now);
      }
    }
  }, [expanded]);

  const handlePointerEnter = useCallback((event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      setOpen(true);
    }
  }, []);

  const handlePointerLeave = useCallback((event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      setOpen(false);
    }
  }, []);

  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("relative flex flex-col items-center", className)}>
        <output aria-live="polite" className="sr-only">
          {announcement}
        </output>
        <AnimatePresence>
          {current ? (
            <motion.div
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className="relative"
              exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              key="island"
              transition={SWAP}
            >
              {/* Tasks waiting behind the current one peek out above it. */}
              {Array.from({ length: behind }, (_, i) => (
                <motion.div
                  animate={{
                    opacity: expanded ? 0 : 1 - (i + 1) * 0.3,
                    y: expanded ? 0 : -(i + 1) * 5,
                    scale: 1 - (i + 1) * 0.06,
                  }}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[20px] bg-zinc-800 ring-1 ring-white/5 dark:bg-zinc-800"
                  initial={false}
                  // biome-ignore lint/suspicious/noArrayIndexKey: layers are positional
                  key={i}
                  style={{ zIndex: -1 - i }}
                  transition={MORPH}
                />
              ))}
              <motion.div
                className="relative overflow-hidden bg-zinc-950 text-white shadow-black/20 shadow-lg ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
                layout
                onBlur={handleBlur}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                ref={islandRef}
                style={{ borderRadius: 20 }}
                transition={MORPH}
              >
                {expanded ? (
                  <motion.ul
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3.5 px-4 py-3.5"
                    initial={{ opacity: 0, filter: "blur(4px)" }}
                    key="list"
                    layout="position"
                    transition={{ ...SWAP, delay: 0.05 }}
                  >
                    {tasks.map((task) => (
                      <li key={task.id}>
                        <TaskRow task={task} />
                      </li>
                    ))}
                  </motion.ul>
                ) : (
                  <button
                    aria-expanded={false}
                    aria-label={`${describe(current)}. ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}, show all`}
                    className="flex h-10 max-w-[calc(100vw-2rem)] items-center px-4 text-left focus-visible:outline-none"
                    onClick={() => setOpen(true)}
                    type="button"
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.div
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        className="min-w-0"
                        exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                        initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                        key={`${current.id}-${current.status}`}
                        layout="position"
                        transition={SWAP}
                      >
                        <div className="flex min-w-48 items-center gap-2.5">
                          <TaskIcon task={current} />
                          <span className="min-w-0 flex-1 truncate text-[13px] leading-4">
                            {current.label}
                            {current.detail ? (
                              <span className="text-white/50">
                                {" "}
                                · {current.detail}
                              </span>
                            ) : null}
                          </span>
                          <span className="pl-3">
                            <TaskTrailingInert task={current} />
                          </span>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </button>
                )}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

/**
 * The trailing slot inside the closed pill. The pill itself is a button, so
 * the action shows as a label here and becomes a real button in the list.
 */
function TaskTrailingInert({ task }: { task: IslandTask }) {
  if (task.action) {
    return (
      <span className="-my-1 inline-block rounded-full bg-white/12 px-2.5 py-1 font-medium text-xs">
        {task.action.label}
      </span>
    );
  }
  return <TaskTrailing task={task} />;
}

type DemoKind = "upload" | "export" | "archive" | "sync";

const DEMO_ACTIONS: { kind: DemoKind; label: string }[] = [
  { kind: "upload", label: "Upload photos" },
  { kind: "export", label: "Export report" },
  { kind: "archive", label: "Archive thread" },
  { kind: "sync", label: "Sync calendar" },
];

/** A playground: each button starts a pretend task that reports to the island. */
export default function StatusIslandDemo({
  className,
}: {
  className?: string;
}) {
  const [tasks, setTasks] = useState<IslandTask[]>([]);
  const timers = useRef(new Set<number>());
  const counter = useRef(0);

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active) {
        window.clearInterval(timer);
        window.clearTimeout(timer);
      }
    };
  }, []);

  const update = useCallback((id: string, patch: Partial<IslandTask>) => {
    setTasks((list) =>
      list.map((task) => (task.id === id ? { ...task, ...patch } : task))
    );
  }, []);

  const remove = useCallback((id: string) => {
    setTasks((list) => list.filter((task) => task.id !== id));
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      fn();
    }, ms);
    timers.current.add(timer);
  }, []);

  const run = useCallback(
    (
      id: string,
      options: { speed: number; failAt?: number; onDone: () => void }
    ) => {
      let progress = 0;
      const timer = window.setInterval(() => {
        progress = Math.min(
          1,
          progress + options.speed * (0.5 + Math.random())
        );
        if (options.failAt !== undefined && progress >= options.failAt) {
          window.clearInterval(timer);
          timers.current.delete(timer);
          update(id, {
            status: "error",
            label: "Sync failed",
            detail: "Calendar offline",
            progress: undefined,
            action: {
              label: "Retry",
              onClick: () => {
                update(id, {
                  status: "running",
                  label: "Syncing calendar",
                  detail: undefined,
                  progress: 0,
                  action: undefined,
                });
                run(id, { speed: options.speed, onDone: options.onDone });
              },
            },
          });
          return;
        }
        update(id, { progress });
        if (progress >= 1) {
          window.clearInterval(timer);
          timers.current.delete(timer);
          later(options.onDone, 250);
        }
      }, 180);
      timers.current.add(timer);
    },
    [later, update]
  );

  const start = useCallback(
    (kind: DemoKind) => {
      counter.current += 1;
      const id = `${kind}-${counter.current}`;
      if (kind === "archive") {
        setTasks((list) => [
          ...list,
          {
            id,
            status: "done",
            label: "Thread archived",
            action: {
              label: "Undo",
              onClick: () =>
                update(id, {
                  label: "Thread restored",
                  action: undefined,
                }),
            },
          },
        ]);
        return;
      }
      if (kind === "upload") {
        setTasks((list) => [
          ...list,
          {
            id,
            status: "running",
            label: "Uploading",
            detail: "12 photos",
            progress: 0,
          },
        ]);
        run(id, {
          speed: 0.045,
          onDone: () =>
            update(id, {
              status: "done",
              label: "12 photos uploaded",
              detail: undefined,
              action: { label: "View", onClick: () => remove(id) },
            }),
        });
        return;
      }
      if (kind === "export") {
        setTasks((list) => [
          ...list,
          { id, status: "running", label: "Exporting report", progress: 0 },
        ]);
        run(id, {
          speed: 0.07,
          onDone: () =>
            update(id, {
              status: "done",
              label: "Report ready",
              detail: "Q3.csv",
              action: { label: "Open", onClick: () => remove(id) },
            }),
        });
        return;
      }
      setTasks((list) => [
        ...list,
        { id, status: "running", label: "Syncing calendar", progress: 0 },
      ]);
      run(id, {
        speed: 0.06,
        failAt: counter.current % 2 === 0 ? undefined : 0.62,
        onDone: () =>
          update(id, {
            status: "done",
            label: "Calendar synced",
            detail: undefined,
            action: undefined,
          }),
      });
    },
    [remove, run, update]
  );

  return (
    <div
      className={cn(
        "relative flex h-[360px] w-full max-w-2xl flex-col items-center justify-between py-6",
        className
      )}
    >
      <div className="flex flex-wrap justify-center gap-2 px-4">
        {DEMO_ACTIONS.map((action) => (
          <button
            className="h-8 rounded-full border border-zinc-200 bg-white px-3.5 font-medium text-[13px] text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 hover:text-zinc-950 active:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:active:bg-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-white"
            key={action.kind}
            onClick={() => start(action.kind)}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Start a task, then hover the island
        </p>
      ) : null}
      <StatusIsland onDismiss={remove} tasks={tasks} />
    </div>
  );
}
