"use client";

/**
 * @author: @kokonutui
 * @description: Helpful Rating
 * @version: 1.0.0
 * @date: 2026-11-08
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface HelpfulRatingProps {
  question?: string;
  onSubmit?: (feedback: {
    rating: number;
    reasons: string[];
    note: string;
  }) => void;
  className?: string;
}

interface Level {
  label: string;
  color: string;
  /** How far the mouth bends: below 0 frowns, above 0 smiles. */
  mouth: number;
  /** Brows tilt up in the middle when sad; 0 hides them. */
  brow: number;
  /** Eye height; small when the face is grinning. */
  eye: number;
}

const LEVELS: Level[] = [
  { label: "Awful", color: "#f43f5e", mouth: -13, brow: 6, eye: 6 },
  { label: "Meh", color: "#f97316", mouth: -6, brow: 3, eye: 6 },
  { label: "Okay", color: "#a1a1aa", mouth: 0, brow: 0, eye: 6 },
  { label: "Good", color: "#0ea5e9", mouth: 9, brow: 0, eye: 5.5 },
  { label: "Love it", color: "#10b981", mouth: 17, brow: 0, eye: 3 },
];

const LOW_REASONS = [
  "Hard to follow",
  "Missing an example",
  "Out of date",
  "Code didn't work",
];
const HIGH_REASONS = ["Clear steps", "Good examples", "Found it fast"];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const FACE = { type: "spring", stiffness: 400, damping: 30 } as const;

export default function HelpfulRating({
  question = "Was this page helpful?",
  onSubmit,
  className,
}: HelpfulRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const shown = preview ?? rating ?? 2;
  const level = LEVELS[shown];
  const low = rating !== null && rating < 2;
  const choices = low ? LOW_REASONS : HIGH_REASONS;

  const pick = (index: number) => {
    if (rating !== null && index < 2 !== rating < 2) {
      setReasons([]);
    }
    setRating(index);
  };

  const toggle = (reason: string) =>
    setReasons((all) =>
      all.includes(reason) ? all.filter((r) => r !== reason) : [...all, reason]
    );

  const reset = () => {
    setRating(null);
    setReasons([]);
    setNote("");
    setSent(false);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-sm overflow-hidden rounded-[24px] border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex flex-col items-center text-center">
          <Face level={level} sent={sent} />
          <AnimatePresence initial={false} mode="popLayout">
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 font-semibold text-[16px] tracking-tight"
              exit={{ opacity: 0, y: -6 }}
              initial={{ opacity: 0, y: 6 }}
              key={sent ? "sent" : "ask"}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {sent ? "Thanks, that helps" : question}
            </motion.p>
          </AnimatePresence>
          <p className="mt-0.5 h-5 text-[13px] text-zinc-500 dark:text-zinc-400">
            {sent ? "We read every note." : level.label}
          </p>
        </div>

        {!sent && (
          <fieldset
            className="mt-4 grid grid-cols-5 gap-1.5"
            onPointerLeave={() => setPreview(null)}
          >
            <legend className="sr-only">{question}</legend>
            {LEVELS.map((l, i) => {
              const selected = rating === i;
              return (
                <button
                  aria-label={l.label}
                  aria-pressed={selected}
                  className={cn(
                    "relative flex h-10 items-center justify-center rounded-xl outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
                    selected
                      ? "text-white"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  )}
                  key={l.label}
                  onBlur={() => setPreview(null)}
                  onClick={() => pick(i)}
                  onFocus={() => setPreview(i)}
                  onPointerEnter={() => setPreview(i)}
                  style={selected ? { backgroundColor: l.color } : undefined}
                  type="button"
                >
                  <MiniMouth bend={l.mouth} />
                </button>
              );
            })}
          </fieldset>
        )}

        <AnimatePresence initial={false}>
          {rating !== null && !sent && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              <p className="pt-4 text-[13px] text-zinc-500 dark:text-zinc-400">
                {low ? "What went wrong?" : "What helped most?"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {choices.map((reason) => {
                  const on = reasons.includes(reason);
                  return (
                    <button
                      aria-pressed={on}
                      className={cn(
                        "h-8 rounded-full border px-3 text-[12.5px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
                        on
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                      )}
                      key={reason}
                      onClick={() => toggle(reason)}
                      type="button"
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
              <textarea
                aria-label="Anything else?"
                className="mt-3 block h-20 w-full resize-none rounded-xl bg-zinc-100 px-3 py-2 text-[16px] outline-hidden placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/50 sm:text-[14px] dark:bg-zinc-900 dark:placeholder:text-zinc-500"
                onChange={(event) => setNote(event.target.value)}
                placeholder="Anything else? (optional)"
                value={note}
              />
              <button
                className="mt-3 h-10 w-full rounded-xl bg-zinc-900 font-medium text-[14px] text-white outline-hidden transition-colors duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                onClick={() => {
                  setSent(true);
                  onSubmit?.({ rating: rating + 1, reasons, note });
                }}
                type="button"
              >
                Send feedback
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {sent && (
          <motion.button
            animate={{ opacity: 1 }}
            className="mx-auto mt-3 block text-[12.5px] text-zinc-500 underline-offset-4 outline-hidden hover:text-zinc-900 hover:underline focus-visible:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            initial={{ opacity: 0 }}
            onClick={reset}
            transition={{ delay: 0.2 }}
            type="button"
          >
            Change my answer
          </motion.button>
        )}
      </div>
    </MotionConfig>
  );
}

const mouthPath = (bend: number) => `M33 64 Q50 ${64 + bend} 67 64`;
const browPath = (side: -1 | 1, tilt: number) => {
  const outer = side === -1 ? 26 : 74;
  const inner = side === -1 ? 42 : 58;
  return `M${outer} ${30 + tilt * 0.4} L${inner} ${30 - tilt}`;
};

/** One face that bends its mouth, brows and eyes toward the hovered answer. */
function Face({ level, sent }: { level: Level; sent: boolean }) {
  return (
    <motion.svg
      animate={sent ? { y: [0, -6, 0] } : { y: 0 }}
      aria-hidden="true"
      className="size-20"
      transition={{ duration: 0.4, ease: EASE_OUT }}
      viewBox="0 0 100 100"
    >
      <circle
        cx={50}
        cy={50}
        r={47}
        style={{ fill: level.color, transition: "fill 200ms ease-out" }}
      />
      {([-1, 1] as const).map((side) => (
        <motion.path
          animate={{
            d: browPath(side, level.brow),
            opacity: level.brow ? 1 : 0,
          }}
          fill="none"
          initial={false}
          key={`brow${side}`}
          stroke="white"
          strokeLinecap="round"
          strokeWidth={4}
          transition={FACE}
        />
      ))}
      {[36, 64].map((cx) => (
        <motion.ellipse
          animate={{ ry: level.eye }}
          cx={cx}
          cy={44}
          fill="white"
          initial={false}
          key={cx}
          rx={5}
          transition={FACE}
        />
      ))}
      <motion.path
        animate={{ d: mouthPath(level.mouth) }}
        fill="none"
        initial={false}
        stroke="white"
        strokeLinecap="round"
        strokeWidth={5}
        transition={FACE}
      />
    </motion.svg>
  );
}

function MiniMouth({ bend }: { bend: number }) {
  return (
    <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
      <circle cx={8.5} cy={9} fill="currentColor" r={1.8} />
      <circle cx={15.5} cy={9} fill="currentColor" r={1.8} />
      <path
        d={`M7 15 Q12 ${15 + bend * 0.35} 17 15`}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2.4}
      />
    </svg>
  );
}
