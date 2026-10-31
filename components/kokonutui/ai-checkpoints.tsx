"use client";

/**
 * @author: @kokonutui
 * @description: AI Checkpoints
 * @version: 1.0.0
 * @date: 2026-10-31
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { History, RotateCw } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface CheckpointFile {
  path: string;
  added: number;
  removed: number;
}

export interface CheckpointTurn {
  id: string;
  /** What the person asked for. */
  prompt: string;
  /** One line on what the agent did. */
  summary: string;
  /** Files the agent changed in this turn. */
  files: CheckpointFile[];
}

export interface AICheckpointsProps {
  title?: string;
  turns?: CheckpointTurn[];
  /** Called with the turns that were rewound, oldest first. */
  onRewind?: (removed: CheckpointTurn[]) => void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SNAP = { type: "spring", stiffness: 520, damping: 42 } as const;

const DEMO_TURNS: CheckpointTurn[] = [
  {
    id: "t1",
    prompt: "Add a dark mode toggle to the settings page",
    summary: "Added a theme switch that remembers the choice.",
    files: [
      { path: "settings/page.tsx", added: 42, removed: 3 },
      { path: "lib/theme.ts", added: 28, removed: 0 },
    ],
  },
  {
    id: "t2",
    prompt: "Make it follow the system setting by default",
    summary: "The theme now starts from prefers-color-scheme.",
    files: [{ path: "lib/theme.ts", added: 11, removed: 4 }],
  },
  {
    id: "t3",
    prompt: "Move the toggle into the header instead",
    summary: "Moved the switch to the header, out of settings.",
    files: [
      { path: "header.tsx", added: 19, removed: 0 },
      { path: "settings/page.tsx", added: 2, removed: 31 },
    ],
  },
  {
    id: "t4",
    prompt: "Animate the icon when it switches",
    summary: "Sun and moon icons now cross-fade on toggle.",
    files: [
      { path: "header.tsx", added: 14, removed: 2 },
      { path: "globals.css", added: 9, removed: 0 },
    ],
  },
  {
    id: "t5",
    prompt: "Swap it for a Light, Dark and System menu",
    summary: "Replaced the switch with a three-option menu.",
    files: [
      { path: "header.tsx", added: 36, removed: 24 },
      { path: "theme-menu.tsx", added: 58, removed: 0 },
    ],
  },
];

/** What rewinding to a checkpoint would undo. */
const tally = (dropped: CheckpointTurn[]) => {
  const files = new Set<string>();
  let lines = 0;
  for (const turn of dropped) {
    for (const file of turn.files) {
      files.add(file.path);
      lines += file.added + file.removed;
    }
  }
  return { files: files.size, lines };
};

const nearest = (points: number[], y: number) => {
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i] - y) < Math.abs(points[best] - y)) {
      best = i;
    }
  }
  return best;
};

export default function AICheckpoints({
  title = "Theme switcher",
  turns: initialTurns = DEMO_TURNS,
  onRewind,
  className,
}: AICheckpointsProps) {
  const [turns, setTurns] = useState(initialTurns);
  const [rewound, setRewound] = useState<CheckpointTurn[]>([]);
  /** The checkpoint the handle sits on: 0 is the start, turns.length is now. */
  const [target, setTarget] = useState(initialTurns.length);
  const [dragY, setDragY] = useState<number | null>(null);
  const [points, setPoints] = useState<number[]>([]);
  const listRef = useRef<HTMLOListElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const grabOffset = useRef(0);

  const now = turns.length;
  const dropped = turns.slice(target);
  const undo = tally(dropped);
  const pending = target < now;

  // Where each checkpoint sits on the rail: above the first turn, then
  // below every turn.
  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const next = [0];
    for (const turn of turns) {
      const row = rowRefs.current.get(turn.id);
      if (row) {
        next.push(row.offsetTop + row.offsetHeight);
      }
    }
    setPoints(next);
  }, [turns]);

  useLayoutEffect(() => {
    measure();
    const list = listRef.current;
    if (!list) {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  const restore = () => {
    if (!pending) {
      return;
    }
    onRewind?.(dropped);
    setRewound(dropped);
    setTurns(turns.slice(0, target));
  };

  const redo = () => {
    const all = [...turns, ...rewound];
    setTurns(all);
    setRewound([]);
    setTarget(all.length);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const top = list.getBoundingClientRect().top;
    grabOffset.current = event.clientY - top - (points[target] ?? 0);
    setDragY(points[target] ?? 0);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const list = listRef.current;
    if (dragY === null || !list || points.length === 0) {
      return;
    }
    const top = list.getBoundingClientRect().top;
    const y = Math.min(
      points.at(-1) ?? 0,
      Math.max(0, event.clientY - top - grabOffset.current)
    );
    setDragY(y);
    setTarget(nearest(points, y));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowUp: target - 1,
      ArrowDown: target + 1,
      Home: 0,
      End: now,
    };
    if (event.key in moves) {
      event.preventDefault();
      setTarget(Math.max(0, Math.min(now, moves[event.key])));
    } else if (event.key === "Enter") {
      event.preventDefault();
      restore();
    } else if (event.key === "Escape") {
      setTarget(now);
    }
  };

  const handleY = dragY ?? points[target] ?? 0;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
      >
        <header className="flex items-center gap-2 border-black/[0.06] border-b px-4 py-3 dark:border-white/[0.08]">
          <History
            aria-hidden="true"
            className="size-3.5 text-zinc-400 dark:text-zinc-500"
          />
          <h3 className="font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <span className="ml-auto text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
            {now + 1} checkpoints
          </span>
        </header>

        <div className="relative px-4 pt-3 pb-2">
          <ol className="relative" ref={listRef}>
            <span
              aria-hidden="true"
              className="absolute top-0 bottom-0 left-[9px] w-px bg-zinc-200 dark:bg-zinc-700/80"
            />
            <AnimatePresence initial={false}>
              {turns.map((turn, index) => (
                <TurnRow
                  index={index}
                  key={turn.id}
                  ref={(el) => {
                    if (el) {
                      rowRefs.current.set(turn.id, el);
                    } else {
                      rowRefs.current.delete(turn.id);
                    }
                  }}
                  reverting={index >= target}
                  turn={turn}
                />
              ))}
            </AnimatePresence>

            {points.map((y, index) => (
              <button
                aria-label={
                  index === 0
                    ? "Checkpoint at the start"
                    : `After turn ${index}`
                }
                className="absolute left-[9.5px] flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-hidden"
                // biome-ignore lint/suspicious/noArrayIndexKey: one point per checkpoint, in order
                key={index}
                onClick={() => setTarget(index)}
                style={{ top: y }}
                tabIndex={-1}
                type="button"
              >
                <span
                  className={cn(
                    "size-[7px] rounded-full ring-[1.5px] transition-[background-color,box-shadow,opacity] duration-200",
                    index === target && "opacity-0",
                    index <= target
                      ? "bg-white ring-zinc-400 dark:bg-zinc-900 dark:ring-zinc-500"
                      : "bg-zinc-100 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700"
                  )}
                />
              </button>
            ))}

            {points.length > 0 && (
              <motion.div
                animate={{ y: handleY }}
                className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-0"
                initial={false}
                transition={dragY === null ? SNAP : { duration: 0 }}
              >
                <motion.span
                  animate={{ opacity: pending ? 1 : 0 }}
                  aria-hidden="true"
                  className="absolute top-0 right-0 left-[18px] h-px bg-orange-500/70 dark:bg-orange-400/70"
                  initial={false}
                  transition={{ duration: 0.15 }}
                />
                <button
                  aria-label="Rewind to checkpoint"
                  aria-valuemax={now}
                  aria-valuemin={0}
                  aria-valuenow={target}
                  aria-valuetext={
                    pending
                      ? `Rewind to ${target === 0 ? "the start" : `turn ${target}`}`
                      : "Now"
                  }
                  className={cn(
                    "pointer-events-auto absolute left-[1px] flex h-[22px] w-[17px] -translate-y-1/2 touch-none items-center justify-center rounded-[6px] outline-hidden ring-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-orange-500/50",
                    dragY === null ? "cursor-grab" : "cursor-grabbing",
                    pending
                      ? "bg-orange-500 ring-orange-600/20 dark:bg-orange-500"
                      : "bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-black/[0.12] hover:ring-black/20 dark:bg-zinc-800 dark:ring-white/15"
                  )}
                  onKeyDown={onKeyDown}
                  onLostPointerCapture={() => setDragY(null)}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => setDragY(null)}
                  role="slider"
                  type="button"
                >
                  <span aria-hidden="true" className="flex flex-col gap-[2px]">
                    {[0, 1, 2].map((line) => (
                      <span
                        className={cn(
                          "h-px w-[7px] rounded-full",
                          pending ? "bg-white" : "bg-zinc-400 dark:bg-zinc-500"
                        )}
                        key={line}
                      />
                    ))}
                  </span>
                </button>
              </motion.div>
            )}
          </ol>

          <AnimatePresence initial={false}>
            {rewound.length > 0 && (
              <motion.div
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
                exit={{ opacity: 0, height: 0 }}
                initial={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                <div className="flex items-center gap-2 py-2 pl-7 text-[12px] text-zinc-500 dark:text-zinc-400">
                  <span>
                    {rewound.length} {rewound.length === 1 ? "turn" : "turns"}{" "}
                    rewound
                  </span>
                  <button
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-zinc-700 outline-hidden transition-colors duration-100 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-orange-500/40 dark:text-zinc-200 dark:hover:bg-white/[0.07]"
                    onClick={redo}
                    type="button"
                  >
                    <RotateCw aria-hidden="true" className="size-3" />
                    Redo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="flex min-h-14 items-center gap-3 border-black/[0.06] border-t px-4 py-2.5 dark:border-white/[0.08]">
          <AnimatePresence initial={false} mode="wait">
            {pending ? (
              <motion.div
                animate={{ opacity: 1 }}
                className="flex min-w-0 flex-1 items-center gap-3"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="pending"
                transition={{ duration: 0.12 }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
                    Rewind to {target === 0 ? "the start" : `turn ${target}`}
                  </p>
                  <p className="text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
                    Restores <Count value={undo.files} />{" "}
                    {undo.files === 1 ? "file" : "files"} ·{" "}
                    <Count value={undo.lines} /> lines
                  </p>
                </div>
                <button
                  className="h-8 rounded-lg px-2.5 text-[13px] text-zinc-600 outline-hidden transition-colors duration-100 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-orange-500/40 dark:text-zinc-300 dark:hover:bg-white/[0.07]"
                  onClick={() => setTarget(now)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-8 rounded-lg bg-zinc-900 px-3 font-medium text-[13px] text-white outline-hidden transition-colors duration-100 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-orange-500/50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  onClick={restore}
                  type="button"
                >
                  Restore
                </button>
              </motion.div>
            ) : (
              <motion.p
                animate={{ opacity: 1 }}
                className="flex-1 text-[12px] text-zinc-500 dark:text-zinc-400"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="idle"
                transition={{ duration: 0.12 }}
              >
                Drag the handle up to rewind the code and the chat
              </motion.p>
            )}
          </AnimatePresence>
        </footer>
        <p aria-live="polite" className="sr-only">
          {pending
            ? `Rewinding ${dropped.length} turns restores ${undo.files} files`
            : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

function TurnRow({
  turn,
  index,
  reverting,
  ref,
}: {
  turn: CheckpointTurn;
  index: number;
  reverting: boolean;
  ref: (el: HTMLLIElement | null) => void;
}) {
  return (
    <motion.li
      animate={{ opacity: 1, height: "auto" }}
      className="overflow-hidden"
      exit={{ opacity: 0, height: 0 }}
      initial={{ opacity: 0, height: 0 }}
      ref={ref}
      transition={{ duration: 0.3, ease: EASE_OUT }}
    >
      <div
        className={cn(
          "py-3 pl-7 transition-[opacity,filter] duration-200",
          reverting && "opacity-40 grayscale"
        )}
      >
        <p className="flex items-baseline gap-2 text-[13.5px] text-zinc-900 leading-snug dark:text-zinc-100">
          <span className="shrink-0 font-mono text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
            {index + 1}
          </span>
          <span className="font-medium">{turn.prompt}</span>
        </p>
        <p className="mt-1 pl-[18px] text-[12.5px] text-zinc-500 leading-snug dark:text-zinc-400">
          {turn.summary}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5 pl-[18px]">
          {turn.files.map((file) => (
            <li
              className={cn(
                "flex h-5 items-center gap-1.5 rounded-md bg-zinc-100 px-1.5 font-mono text-[10.5px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                reverting && "line-through decoration-zinc-400/80"
              )}
              key={file.path}
            >
              {file.path}
              {file.added > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  +{file.added}
                </span>
              )}
              {file.removed > 0 && (
                <span className="text-rose-600 dark:text-rose-400">
                  −{file.removed}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </motion.li>
  );
}

/** A number that rolls when it changes. */
function Count({ value }: { value: number }) {
  return (
    <span className="relative inline-flex overflow-hidden align-bottom">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          initial={{ y: 8, opacity: 0 }}
          key={value}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
