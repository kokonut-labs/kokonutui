"use client";

/**
 * @author: @dorianbaffier
 * @description: Undo Button
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Archive, Check, type LucideIcon, Undo2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const STROKE = 1.5;
const APPLE_PLATFORM = /Mac|iPhone|iPad/;

type Phase = "idle" | "pending" | "done";

export interface UndoButtonProps {
  /** What the button does, e.g. "Archive". */
  label?: string;
  /** The same action in the past tense, e.g. "Archived". */
  doneLabel?: string;
  icon?: LucideIcon;
  /** How long the action can be undone, in ms. */
  duration?: number;
  /**
   * After the action commits, go back to the start after this many ms.
   * Pass `null` to stay on the done state.
   */
  resetAfter?: number | null;
  /** Called when the button is pressed and the undo window opens. */
  onAction?: () => void;
  /** Called when the window closes without an undo: do the real work here. */
  onCommit?: () => void;
  onUndo?: () => void;
  className?: string;
}

// A pill outline that starts at the top centre and runs clockwise, so the
// countdown drains back toward where it began.
function pillPath(width: number, height: number) {
  const s = STROKE / 2;
  const r = height / 2 - s;
  const left = s + r;
  const right = width - s - r;
  return [
    `M ${width / 2} ${s}`,
    `H ${right}`,
    `A ${r} ${r} 0 0 1 ${right} ${height - s}`,
    `H ${left}`,
    `A ${r} ${r} 0 0 1 ${left} ${s}`,
    "Z",
  ].join(" ");
}

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export default function UndoButton({
  label = "Archive",
  doneLabel = "Archived",
  icon: Icon = Archive,
  duration = 5000,
  resetAfter = 2400,
  onAction,
  onCommit,
  onUndo,
  className,
}: UndoButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(Math.ceil(duration / 1000));
  const [width, setWidth] = useState<number>();
  const [isMac, setIsMac] = useState(true);
  const reduceMotion = useReducedMotion();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const hoveredRef = useRef(false);
  const elapsedRef = useRef(0);
  const remainingRef = useRef(1);

  const callbacks = useRef({ onAction, onCommit, onUndo });
  callbacks.current = { onAction, onCommit, onUndo };

  useEffect(() => {
    setIsMac(APPLE_PLATFORM.test(navigator.platform));
  }, []);

  // The button's width follows its label, so the pill grows into
  // "Archived | Undo 5" instead of jumping.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    // +2 for the 1px border on each side.
    const observer = new ResizeObserver(() =>
      setWidth(content.offsetWidth + 2)
    );
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Dashes in real lengths rather than pathLength, which Chrome scales
  // inconsistently once the path changes size.
  const paint = useCallback(() => {
    const path = pathRef.current;
    if (!path) {
      return;
    }
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length * remainingRef.current} ${length}`;
  }, []);

  // Keep the outline glued to the button while its width animates.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    const observer = new ResizeObserver(() => {
      pathRef.current?.setAttribute(
        "d",
        pillPath(button.offsetWidth, button.offsetHeight)
      );
      paint();
    });
    observer.observe(button);
    return () => observer.disconnect();
  }, [paint]);

  const undo = useCallback(() => {
    setPhase("idle");
    callbacks.current.onUndo?.();
  }, []);

  useEffect(() => {
    if (phase !== "pending") {
      return;
    }
    elapsedRef.current = 0;
    remainingRef.current = 1;
    paint();
    setSeconds(Math.ceil(duration / 1000));

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Hovering the button, or leaving the tab, holds the clock: nobody
      // should lose their chance to undo while reading it.
      if (!(hoveredRef.current || document.hidden)) {
        elapsedRef.current += now - last;
      }
      last = now;
      const left = Math.max(0, duration - elapsedRef.current);
      remainingRef.current = left / duration;
      paint();
      setSeconds(Math.ceil(left / 1000));
      if (left === 0) {
        setPhase("done");
        callbacks.current.onCommit?.();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (
        mod &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z" &&
        !isEditable(event.target)
      ) {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, duration, paint, undo]);

  useEffect(() => {
    if (phase !== "done" || resetAfter === null) {
      return;
    }
    const timer = setTimeout(() => setPhase("idle"), resetAfter);
    return () => clearTimeout(timer);
  }, [phase, resetAfter]);

  const handleClick = () => {
    if (phase === "idle") {
      setPhase("pending");
      callbacks.current.onAction?.();
    } else if (phase === "pending") {
      undo();
    }
  };

  const setHovered = (event: PointerEvent, value: boolean) => {
    if (event.pointerType === "mouse") {
      hoveredRef.current = value;
    }
  };

  const swap = reduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: EASE_OUT };

  const ariaLabel = {
    idle: label,
    pending: `${doneLabel}. Undo, ${seconds} second${seconds === 1 ? "" : "s"} left`,
    done: doneLabel,
  }[phase];

  return (
    <span className="relative inline-flex">
      <motion.button
        animate={{ width: width ?? "auto" }}
        aria-disabled={phase === "done"}
        aria-label={ariaLabel}
        className={cn(
          "relative inline-flex h-10 select-none items-center justify-center overflow-hidden whitespace-nowrap rounded-full border font-medium text-sm outline-none",
          "transition-[background-color,border-color,color] duration-150 ease-out",
          "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
          phase === "done"
            ? "cursor-default border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
            : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:active:bg-zinc-800 dark:hover:bg-zinc-900",
          className
        )}
        initial={false}
        onClick={handleClick}
        onPointerEnter={(event) => setHovered(event, true)}
        onPointerLeave={(event) => setHovered(event, false)}
        ref={buttonRef}
        transition={swap}
        type="button"
      >
        <span className="inline-flex px-4" ref={contentRef}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className="inline-flex items-center gap-2"
              exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
              initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
              key={phase}
              transition={swap}
            >
              {phase === "idle" && (
                <>
                  <Icon aria-hidden className="size-4" />
                  {label}
                </>
              )}
              {phase === "pending" && (
                <>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {doneLabel}
                  </span>
                  <span
                    aria-hidden
                    className="h-4 w-px bg-zinc-200 dark:bg-zinc-800"
                  />
                  <Undo2 aria-hidden className="size-4" />
                  Undo
                  <Countdown reduceMotion={!!reduceMotion} value={seconds} />
                  <kbd className="hidden rounded border border-zinc-200 px-1 font-sans text-[11px] text-zinc-500 sm:inline dark:border-zinc-800 dark:text-zinc-400">
                    {isMac ? "⌘Z" : "Ctrl Z"}
                  </kbd>
                </>
              )}
              {phase === "done" && (
                <>
                  <Check aria-hidden className="size-4" />
                  {doneLabel}
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.button>
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        <title>Time left to undo</title>
        <motion.path
          animate={{ opacity: phase === "pending" ? 1 : 0 }}
          className="stroke-zinc-900 dark:stroke-zinc-100"
          fill="none"
          initial={false}
          ref={pathRef}
          strokeLinecap="round"
          strokeWidth={STROKE}
          transition={{ duration: phase === "pending" ? 0.15 : 0.2 }}
        />
      </svg>
      <span aria-live="polite" className="sr-only">
        {phase === "pending" &&
          `${doneLabel}. Press the button or ${isMac ? "Command" : "Control"} Z to undo.`}
        {phase === "done" && doneLabel}
      </span>
    </span>
  );
}

function Countdown({
  value,
  reduceMotion,
}: {
  value: number;
  reduceMotion: boolean;
}) {
  return (
    <span className="relative inline-flex h-5 w-[1ch] justify-center overflow-hidden text-zinc-500 tabular-nums dark:text-zinc-400">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ y: 0, opacity: 1 }}
          className="leading-5"
          exit={{ y: -10, opacity: 0 }}
          initial={{ y: 10, opacity: 0 }}
          key={value}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }
          }
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
