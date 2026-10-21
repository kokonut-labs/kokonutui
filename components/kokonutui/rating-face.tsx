"use client";

/**
 * @author: @dorianbaffier
 * @description: Rating Face
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check } from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const STEPS = [0, 1, 2, 3, 4];

export interface RatingFollowUp {
  prompt: string;
  /** Quick reasons to tap instead of typing. */
  reasons: string[];
}

export interface RatingFaceResult {
  /** 1 to 5. */
  rating: number;
  reasons: string[];
  comment: string;
}

export interface RatingFaceProps {
  question?: string;
  context?: string;
  /** One word per step, worst first. */
  labels?: string[];
  /** What to ask next for each step, worst first. */
  followUps?: RatingFollowUp[];
  onSubmit?: (result: RatingFaceResult) => void;
  className?: string;
}

const DEFAULT_LABELS = ["Terrible", "Bad", "Okay", "Good", "Great"];

const DEFAULT_FOLLOW_UPS: RatingFollowUp[] = [
  {
    prompt: "Sorry about that. What went wrong?",
    reasons: ["Late", "Damaged", "Wrong item", "Courier"],
  },
  {
    prompt: "What could we have done better?",
    reasons: ["Late", "Packaging", "Missing item", "Updates"],
  },
  {
    prompt: "What would have made it great?",
    reasons: ["Faster", "Better updates", "Packaging"],
  },
  {
    prompt: "Nice. What went well?",
    reasons: ["On time", "Well packed", "Friendly courier"],
  },
  {
    prompt: "Glad to hear it. What did you like most?",
    reasons: ["On time", "Well packed", "Friendly courier", "Updates"],
  },
];

// Face tints from worst to best, light enough to sit under ink in both themes.
const TINTS = [
  "rgba(239, 68, 68, 0.16)",
  "rgba(249, 115, 22, 0.16)",
  "rgba(161, 161, 170, 0.14)",
  "rgba(132, 204, 22, 0.18)",
  "rgba(16, 185, 129, 0.2)",
];

/** The mouth: a curve whose middle drops to smile and lifts to frown. */
const mouthPath = (v: number) => {
  const mood = (v - 2) / 2;
  const half = 15 + mood * 3;
  const corners = 78 - mood * 3;
  const middle = corners + mood * 16;
  return `M ${60 - half} ${corners} Q 60 ${middle} ${60 + half} ${corners}`;
};

/** A brow over one eye; the inner end rises as the mood sinks. */
const browPath = (v: number, side: -1 | 1) => {
  const worry = Math.max(0, (2 - v) / 2);
  const outerX = 60 + side * 30;
  const innerX = 60 + side * 13;
  return `M ${outerX} ${41 + worry * 2} L ${innerX} ${43 - worry * 7}`;
};

export default function RatingFace({
  question = "How was your delivery?",
  context = "Order #4821 · arrived 12:40",
  labels = DEFAULT_LABELS,
  followUps = DEFAULT_FOLLOW_UPS,
  onSubmit,
  className,
}: RatingFaceProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [shown, setShown] = useState(2);
  const [dragging, setDragging] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const reduceMotion = useReducedMotion();

  const trackRef = useRef<HTMLDivElement>(null);
  const value = useMotionValue(2);
  useMotionValueEvent(value, "change", (v) => setShown(Math.round(v)));

  const mouth = useTransform(value, mouthPath);
  const leftBrow = useTransform(value, (v) => browPath(v, -1));
  const rightBrow = useTransform(value, (v) => browPath(v, 1));
  const browOpacity = useTransform(value, [0, 1.6, 2.4, 4], [1, 0, 0, 0]);
  const tint = useTransform(value, STEPS, TINTS);
  // Eyes narrow into a happy squint toward the top of the scale.
  const eyeHeight = useTransform(value, [0, 2, 4], [4.4, 4.4, 2.4]);
  // And glance toward the side of the scale being pointed at.
  const look = useTransform(value, [0, 4], [-1.5, 1.5]);
  const knobLeft = useTransform(value, (v) => `${(v / 4) * 100}%`);

  const settle = (step: number) => {
    animate(
      value,
      step,
      reduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 420, damping: 30 }
    );
    if (step !== rating) {
      setReasons([]);
    }
    setRating(step);
  };

  const stepAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) {
      return 2;
    }
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(4, Math.max(0, ratio * 4));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (sent || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    value.stop();
    setDragging(true);
    // The face eases to the pointer rather than jumping on the first press.
    animate(value, stepAt(event.clientX), { duration: 0.16, ease: EASE_OUT });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging) {
      value.stop();
      value.set(stepAt(event.clientX));
    }
  };

  const onPointerUp = () => {
    if (!dragging) {
      return;
    }
    setDragging(false);
    settle(Math.round(value.get()));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (sent) {
      return;
    }
    const current = rating ?? 2;
    const moves: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      Home: 0,
      End: 4,
    };
    if (event.key in moves) {
      event.preventDefault();
      settle(Math.min(4, Math.max(0, moves[event.key])));
    }
  };

  const toggleReason = (reason: string) =>
    setReasons((current) =>
      current.includes(reason)
        ? current.filter((r) => r !== reason)
        : [...current, reason]
    );

  const submit = () => {
    if (rating === null) {
      return;
    }
    onSubmit?.({ rating: rating + 1, reasons, comment });
    setSent(true);
  };

  const rated = rating !== null;
  const followUp = rated ? followUps[rating] : null;

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <p className="text-center font-semibold text-zinc-900 dark:text-zinc-50">
        {question}
      </p>
      <p className="mt-0.5 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {context}
      </p>

      <svg
        aria-hidden
        className={cn(
          "mx-auto mt-5 block size-28 transition-opacity duration-300",
          rated || dragging ? "opacity-100" : "opacity-50"
        )}
        viewBox="0 0 120 120"
      >
        <title>Face</title>
        <motion.circle
          className="stroke-zinc-900 dark:stroke-zinc-100"
          cx="60"
          cy="60"
          r="52"
          strokeWidth="3"
          style={{ fill: tint }}
        />
        <g
          className="stroke-zinc-900 dark:stroke-zinc-100"
          fill="none"
          strokeLinecap="round"
          strokeWidth="3"
        >
          <motion.path d={leftBrow} style={{ opacity: browOpacity }} />
          <motion.path d={rightBrow} style={{ opacity: browOpacity }} />
          <motion.path d={mouth} />
        </g>
        <motion.g
          className="fill-zinc-900 dark:fill-zinc-100"
          style={{ x: look }}
        >
          <motion.ellipse cx="45" cy="55" rx="4.2" ry={eyeHeight} />
          <motion.ellipse cx="75" cy="55" rx="4.2" ry={eyeHeight} />
        </motion.g>
      </svg>

      <div className="relative mt-3 h-6 overflow-hidden text-center font-medium text-sm">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className={
              rated || dragging
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-zinc-400 dark:text-zinc-500"
            }
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: 10 }}
            key={rated || dragging ? shown : "idle"}
            transition={{ duration: 0.16, ease: EASE_OUT }}
          >
            {rated || dragging ? labels[shown] : "Drag or tap to rate"}
          </motion.p>
        </AnimatePresence>
      </div>

      <div
        aria-disabled={sent}
        aria-label={question}
        aria-valuemax={5}
        aria-valuemin={1}
        aria-valuenow={rated ? rating + 1 : undefined}
        aria-valuetext={rated ? labels[rating] : "Not rated"}
        className={cn(
          "group/scale relative mx-2 mt-3 h-10 touch-none select-none rounded-full outline-none",
          "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-zinc-950",
          sent ? "cursor-default" : "cursor-pointer"
        )}
        onKeyDown={onKeyDown}
        onLostPointerCapture={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={trackRef}
        role="slider"
        tabIndex={0}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-100 dark:bg-zinc-900" />
        {STEPS.map((step) => (
          <span
            className={cn(
              "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-150",
              rated && step <= shown
                ? "bg-zinc-900 dark:bg-zinc-100"
                : "bg-zinc-300 dark:bg-zinc-700"
            )}
            key={step}
            style={{ left: `${(step / 4) * 100}%` }}
          />
        ))}
        <motion.span
          className={cn(
            "absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1.5px_rgb(24_24_27),0_2px_6px_rgb(0_0_0/0.15)] dark:bg-zinc-950 dark:shadow-[0_0_0_1.5px_rgb(244_244_245),0_2px_6px_rgb(0_0_0/0.5)]",
            "transition-opacity duration-200",
            rated || dragging ? "opacity-100" : "opacity-0"
          )}
          style={{ left: knobLeft }}
        />
      </div>
      <div className="mx-2 mt-1 flex justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
        <span>{labels[0]}</span>
        <span>{labels.at(-1)}</span>
      </div>

      <AnimatePresence initial={false}>
        {followUp && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: EASE_OUT }}
          >
            <div className="mt-5 border-zinc-100 border-t pt-4 dark:border-zinc-900">
              <AnimatePresence initial={false} mode="wait">
                {sent ? (
                  <motion.p
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 py-6 font-medium text-sm text-zinc-900 dark:text-zinc-100"
                    initial={{ opacity: 0, y: 6 }}
                    key="sent"
                    transition={{ duration: 0.22, ease: EASE_OUT }}
                  >
                    <Check
                      aria-hidden
                      className="size-4 text-emerald-600 dark:text-emerald-400"
                      strokeWidth={2.5}
                    />
                    Thanks, that helps
                  </motion.p>
                ) : (
                  <motion.div
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    key={rating}
                    transition={{ duration: 0.16 }}
                  >
                    <p className="text-sm text-zinc-900 dark:text-zinc-100">
                      {followUp.prompt}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {followUp.reasons.map((reason) => {
                        const on = reasons.includes(reason);
                        return (
                          <button
                            aria-pressed={on}
                            className={cn(
                              "h-8 rounded-full border px-3 text-xs transition-colors duration-150",
                              on
                                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                                : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                            )}
                            key={reason}
                            onClick={() => toggleReason(reason)}
                            type="button"
                          >
                            {reason}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      aria-label="Anything else?"
                      className="mt-3 block h-20 w-full resize-none rounded-2xl border border-zinc-200 bg-transparent p-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:placeholder:text-zinc-600"
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Anything else? (optional)"
                      value={comment}
                    />
                    <button
                      className="mt-3 h-10 w-full rounded-2xl bg-zinc-900 font-medium text-sm text-white transition-colors duration-150 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                      onClick={submit}
                      type="button"
                    >
                      Send feedback
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
