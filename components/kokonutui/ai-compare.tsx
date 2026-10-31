"use client";

/**
 * @author: @kokonutui
 * @description: AI Compare
 * @version: 1.0.0
 * @date: 2026-10-31
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** -2 means A is much better, 0 a tie, 2 B is much better. */
export type Preference = -2 | -1 | 0 | 1 | 2;

export interface AICompareProps {
  prompt?: string;
  responses?: [string, string];
  /** Called when the person submits, with how strongly they lean. */
  onSubmit?: (preference: Preference) => void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SNAP = { type: "spring", stiffness: 600, damping: 38 } as const;
const STEPS: Preference[] = [-2, -1, 0, 1, 2];
const LABELS: Record<Preference, string> = {
  [-2]: "A is much better",
  [-1]: "A is better",
  0: "About the same",
  1: "B is better",
  2: "B is much better",
};

const DEMO_PROMPT =
  "Make this error friendlier: “Error 409: conflict detected.”";
const DEMO_RESPONSES: [string, string] = [
  "This file changed while you were editing. Reload to get the latest version, then save again.",
  "Someone saved this file a moment ago. Your changes are safe, so compare both versions and keep what you need.",
];

const clampStep = (n: number) =>
  Math.max(-2, Math.min(2, Math.round(n))) as Preference;

export default function AICompare({
  prompt = DEMO_PROMPT,
  responses = DEMO_RESPONSES,
  onSubmit,
  className,
}: AICompareProps) {
  const [value, setValue] = useState<Preference>(0);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  let winner: number | null = null;
  if (submitted && value !== 0) {
    winner = value < 0 ? 0 : 1;
  }

  const fromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const r = track.getBoundingClientRect();
    const t = (clientX - r.left) / r.width;
    setValue(clampStep(t * 4 - 2));
    setTouched(true);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (submitted) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    fromPointer(event.clientX);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: value - 1,
      ArrowDown: value - 1,
      ArrowRight: value + 1,
      ArrowUp: value + 1,
      Home: -2,
      End: 2,
    };
    if (event.key in moves) {
      event.preventDefault();
      setValue(clampStep(moves[event.key]));
      setTouched(true);
    } else if (event.key === "Enter" && touched) {
      event.preventDefault();
      submit();
    }
  };

  const submit = () => {
    onSubmit?.(value);
    setSubmitted(true);
  };

  const reset = () => {
    setSubmitted(false);
    setTouched(false);
    setValue(0);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-2xl rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
      >
        <div className="flex justify-end px-4 pt-4">
          <p className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[13px] text-zinc-700 leading-snug dark:bg-zinc-800 dark:text-zinc-200">
            {prompt}
          </p>
        </div>

        <motion.div
          className={cn(
            "grid gap-2 p-4",
            winner === null ? "sm:grid-cols-2" : "grid-cols-1"
          )}
          layout
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {responses.map((text, side) =>
              winner !== null && winner !== side ? null : (
                <Response
                  key={side === 0 ? "a" : "b"}
                  lean={side === 0 ? Math.max(0, -value) : Math.max(0, value)}
                  other={side === 0 ? Math.max(0, value) : Math.max(0, -value)}
                  picked={winner === side}
                  side={side}
                  text={text}
                />
              )
            )}
          </AnimatePresence>
        </motion.div>

        <footer className="border-black/[0.06] border-t px-4 pt-3 pb-3.5 dark:border-white/[0.08]">
          <AnimatePresence initial={false} mode="wait">
            {submitted ? (
              <motion.div
                animate={{ opacity: 1 }}
                className="flex h-[58px] items-center gap-3"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="done"
                transition={{ duration: 0.15 }}
              >
                <p className="flex-1 text-[13px] text-zinc-600 dark:text-zinc-300">
                  {winner === null
                    ? "Marked as a tie. Both replies stay in the thread."
                    : `Continuing with ${winner === 0 ? "A" : "B"}. Thanks, that helps tune replies.`}
                </p>
                <button
                  className="h-8 rounded-lg px-2.5 text-[13px] text-zinc-600 outline-hidden transition-colors duration-100 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-teal-600/40 dark:text-zinc-300 dark:hover:bg-white/[0.07]"
                  onClick={reset}
                  type="button"
                >
                  Change
                </button>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1 }}
                className="flex items-center gap-4"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="pick"
                transition={{ duration: 0.15 }}
              >
                <div className="min-w-0 flex-1">
                  <p className="mb-2 flex h-4 items-center text-[12px]">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          touched
                            ? "font-medium text-zinc-900 dark:text-zinc-100"
                            : "text-zinc-500 dark:text-zinc-400"
                        )}
                        exit={{ opacity: 0, y: -4 }}
                        initial={{ opacity: 0, y: 4 }}
                        key={touched ? value : "hint"}
                        transition={{ duration: 0.14, ease: EASE_OUT }}
                      >
                        {touched
                          ? LABELS[value]
                          : "Drag toward the better reply"}
                      </motion.span>
                    </AnimatePresence>
                  </p>
                  <div
                    aria-label="Which reply is better"
                    aria-valuemax={2}
                    aria-valuemin={-2}
                    aria-valuenow={value}
                    aria-valuetext={LABELS[value]}
                    className={cn(
                      "relative h-7 touch-none select-none rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-teal-600/40",
                      dragging ? "cursor-grabbing" : "cursor-pointer"
                    )}
                    onKeyDown={onKeyDown}
                    onLostPointerCapture={() => setDragging(false)}
                    onPointerDown={onPointerDown}
                    onPointerMove={(e) => dragging && fromPointer(e.clientX)}
                    onPointerUp={() => setDragging(false)}
                    ref={trackRef}
                    role="slider"
                    tabIndex={0}
                  >
                    <Track value={value} />
                  </div>
                  <div className="mt-1 flex justify-between font-medium text-[11px] text-zinc-400 dark:text-zinc-500">
                    <span>A</span>
                    <span>B</span>
                  </div>
                </div>
                <button
                  className="h-8 shrink-0 rounded-lg bg-zinc-900 px-3 font-medium text-[13px] text-white outline-hidden transition-[background-color,opacity] duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-teal-600/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-zinc-200"
                  disabled={!touched}
                  onClick={submit}
                  type="button"
                >
                  Submit
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </footer>
      </div>
    </MotionConfig>
  );
}

function Response({
  side,
  text,
  lean,
  other,
  picked,
}: {
  side: number;
  text: string;
  /** How strongly the person leans toward this reply, 0 to 2. */
  lean: number;
  /** How strongly they lean toward the other one. */
  other: number;
  picked: boolean;
}) {
  const letter = side === 0 ? "A" : "B";
  return (
    <motion.article
      animate={{ opacity: 1 - other * 0.22 }}
      className={cn(
        "rounded-xl p-3.5 ring-1 transition-[box-shadow,background-color] duration-200",
        lean > 0 && !picked
          ? "bg-teal-600/[0.04] ring-teal-600/40 dark:bg-teal-400/[0.06] dark:ring-teal-400/40"
          : "ring-black/[0.08] dark:ring-white/10",
        lean > 1 && !picked && "ring-2"
      )}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      initial={{ opacity: 0 }}
      layout
      transition={{
        layout: { duration: 0.35, ease: EASE_OUT },
        opacity: { duration: 0.2 },
      }}
    >
      <header className="mb-1.5 flex h-5 items-center gap-2">
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-md font-medium font-mono text-[11px] transition-colors duration-200",
            lean > 0
              ? "bg-teal-600 text-white dark:bg-teal-500"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          )}
        >
          {letter}
        </span>
        <AnimatePresence initial={false}>
          {lean > 0 && !picked && (
            <motion.span
              animate={{ opacity: 1, x: 0 }}
              className="text-[11px] text-teal-700 dark:text-teal-300"
              exit={{ opacity: 0, x: -4 }}
              initial={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
            >
              {lean > 1 ? "Much better" : "Better"}
            </motion.span>
          )}
        </AnimatePresence>
      </header>
      <motion.p
        className={cn(
          "text-[14px] leading-6 transition-colors duration-200",
          other > 0
            ? "text-zinc-500 dark:text-zinc-400"
            : "text-zinc-800 dark:text-zinc-200"
        )}
        layout="position"
      >
        {text}
      </motion.p>
    </motion.article>
  );
}

/** The detent track: five stops, a fill from the middle to the thumb. */
function Track({ value }: { value: Preference }) {
  const at = ((value + 2) / 4) * 100;
  const from = Math.min(50, at);
  const width = Math.abs(at - 50);

  return (
    <>
      <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-zinc-900/[0.07] dark:bg-white/10" />
      <motion.span
        animate={{ left: `${from}%`, width: `${width}%` }}
        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-teal-600 dark:bg-teal-400"
        initial={false}
        transition={SNAP}
      />
      {STEPS.map((step) => (
        <span
          className={cn(
            "absolute top-1/2 w-px -translate-x-1/2 -translate-y-1/2 rounded-full",
            step === 0 ? "h-3" : "h-2",
            Math.abs(step) <= Math.abs(value) &&
              Math.sign(step) === Math.sign(value) &&
              step !== 0
              ? "bg-teal-600/60 dark:bg-teal-400/60"
              : "bg-zinc-300 dark:bg-zinc-600"
          )}
          key={step}
          style={{ left: `${((step + 2) / 4) * 100}%` }}
        />
      ))}
      <motion.span
        animate={{ left: `${at}%` }}
        className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.15)] ring-1 ring-black/10 dark:bg-zinc-100 dark:ring-white/20"
        initial={false}
        transition={SNAP}
      />
    </>
  );
}
