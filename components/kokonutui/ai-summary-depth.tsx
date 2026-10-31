"use client";

/**
 * @author: @kokonutui
 * @description: AI Summary Depth
 * @version: 1.0.0
 * @date: 2026-10-31
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { FileText } from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "motion/react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface SummaryPiece {
  /** The shallowest depth that shows this piece, from 1. */
  depth: number;
  text: string;
}

export interface AISummaryDepthProps {
  title?: string;
  meta?: string;
  /** One name per depth, shallowest first. */
  depths?: string[];
  /** Read in order. Each depth adds its pieces in place around the others. */
  pieces?: SummaryPiece[];
  defaultDepth?: number;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const WORDS = /\S+/g;

const DEMO_PIECES: SummaryPiece[] = [
  { depth: 1, text: "Launch moves to " },
  { depth: 3, text: "Wednesday, " },
  { depth: 1, text: "Nov 12" },
  {
    depth: 2,
    text: ", a week later than planned, because the payments review isn’t done",
  },
  { depth: 1, text: ". " },
  {
    depth: 3,
    text: "Legal found two gaps in the refund flow on Tuesday, and both need a fix before sign off. ",
  },
  { depth: 2, text: "Priya owns the review" },
  { depth: 3, text: " and expects to finish by Nov 7" },
  { depth: 2, text: ". " },
  { depth: 1, text: "Marketing holds the announcement until then" },
  {
    depth: 3,
    text: ", but the press kit and the changelog are ready to go",
  },
  { depth: 1, text: "." },
];

const countWords = (pieces: SummaryPiece[], depth: number) =>
  pieces
    .filter((p) => p.depth <= depth)
    .map((p) => p.text)
    .join("")
    .match(WORDS)?.length ?? 0;

export default function AISummaryDepth({
  title = "Launch sync",
  meta = "Meeting · 32 min",
  depths = ["TL;DR", "Summary", "Detailed"],
  pieces = DEMO_PIECES,
  defaultDepth = 1,
  className,
}: AISummaryDepthProps) {
  const [depth, setDepth] = useState(defaultDepth);
  /** Pieces added by the last change, so only they get the reveal. */
  const previous = useRef(defaultDepth);
  const grew = depth > previous.current;
  const words = countWords(pieces, depth);

  const pick = (next: number) => {
    previous.current = depth;
    setDepth(next);
  };

  let added = 0;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
      >
        <header className="flex items-start gap-3 px-4 pt-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <FileText aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-[14px] text-zinc-900 leading-tight dark:text-zinc-100">
              {title}
            </h3>
            <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
              {meta}
            </p>
          </div>
          <span className="pt-0.5 font-mono text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
            <Count value={words} /> words
          </span>
        </header>

        <AutoHeight>
          <p
            aria-live="polite"
            className="px-4 pt-3.5 pb-5 text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
          >
            <AnimatePresence initial={false}>
              {pieces.map((piece, i) => {
                if (piece.depth > depth) {
                  return null;
                }
                const fresh = grew && piece.depth > previous.current;
                if (fresh) {
                  added += 1;
                }
                return (
                  <Piece
                    delay={fresh ? (added - 1) * 0.07 : 0}
                    fresh={fresh}
                    // biome-ignore lint/suspicious/noArrayIndexKey: pieces are a fixed, ordered list
                    key={i}
                    text={piece.text}
                  />
                );
              })}
            </AnimatePresence>
          </p>
        </AutoHeight>

        <footer className="flex items-center gap-3 border-black/[0.06] border-t px-3 py-2.5 dark:border-white/[0.08]">
          <DepthControl depth={depth} depths={depths} onPick={pick} />
        </footer>
      </div>
    </MotionConfig>
  );
}

function Piece({
  text,
  fresh,
  delay,
}: {
  text: string;
  fresh: boolean;
  delay: number;
}) {
  return (
    <motion.span
      animate={{
        opacity: 1,
        filter: "blur(0px)",
        backgroundColor: "rgb(14 165 233 / 0)",
      }}
      className="rounded-[3px] [box-decoration-break:clone]"
      exit={{
        opacity: 0,
        filter: "blur(3px)",
        transition: { duration: 0.14 },
      }}
      initial={
        fresh
          ? {
              opacity: 0,
              filter: "blur(5px)",
              backgroundColor: "rgb(14 165 233 / 0.16)",
            }
          : false
      }
      transition={{
        opacity: { duration: 0.4, ease: EASE_OUT, delay },
        filter: { duration: 0.4, ease: EASE_OUT, delay },
        backgroundColor: { duration: 1.4, ease: "easeOut", delay: delay + 0.6 },
      }}
    >
      {text}
    </motion.span>
  );
}

function DepthControl({
  depths,
  depth,
  onPick,
}: {
  depths: string[];
  depth: number;
  onPick: (depth: number) => void;
}) {
  const group = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
    };
    if (event.key in step) {
      event.preventDefault();
      const next = Math.max(
        1,
        Math.min(depths.length, depth + step[event.key])
      );
      onPick(next);
      event.currentTarget
        .querySelectorAll<HTMLButtonElement>('[role="radio"]')
        [next - 1]?.focus();
    }
  };

  return (
    <LayoutGroup id={group}>
      <div
        aria-label="Summary depth"
        className="relative grid w-full rounded-[10px] bg-zinc-100 p-0.5 dark:bg-white/[0.06]"
        onKeyDown={onKeyDown}
        role="radiogroup"
        style={{ gridTemplateColumns: `repeat(${depths.length}, 1fr)` }}
      >
        {depths.map((label, i) => {
          const value = i + 1;
          const selected = value === depth;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a segment with a depth glyph doesn't fit a native radio input
            <button
              aria-checked={selected}
              className={cn(
                "relative flex h-8 items-center justify-center gap-1.5 rounded-lg text-[13px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sky-500/40",
                selected
                  ? "font-medium text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
              key={label}
              onClick={() => onPick(value)}
              role="radio"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {selected && (
                <motion.span
                  className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-black/[0.06] dark:bg-zinc-700 dark:ring-white/10"
                  layoutId="depth-thumb"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span
                aria-hidden="true"
                className="relative flex items-end gap-[2px]"
              >
                {depths.map((d, bar) => (
                  <span
                    className={cn(
                      "w-[3px] rounded-full transition-colors duration-150",
                      bar < value
                        ? "bg-current"
                        : "bg-zinc-300 dark:bg-zinc-600"
                    )}
                    key={d}
                    style={{ height: 4 + bar * 3 }}
                  />
                ))}
              </span>
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
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

/** Eases the card to the height of the text instead of jumping. */
function AutoHeight({ children }: { children: ReactNode }) {
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
      className="overflow-hidden"
      initial={false}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}
