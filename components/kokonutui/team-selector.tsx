"use client";

/**
 * @author: @dorianbaffier
 * @description: Team Selector
 * @version: 3.0.0
 * @date: 2026-04-23
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Minus, Plus } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const AVATAR_OVERLAP = 12;
const COUNTER_DISTANCE = 10;
const SHAKE_DURATION_MS = 280;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const DICEBEAR_STYLE = "notionists-neutral";
const dicebearUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f4f4f5,e4e4e7,d4d4d8,a1a1aa`;

export interface TeamMember {
  id: string;
  name: string;
  avatarUrl: string;
}

const DEFAULT_MEMBERS: TeamMember[] = [
  { id: "member-1", name: "Alex Rivera", avatarUrl: dicebearUrl("Alex") },
  { id: "member-2", name: "Blair Kim", avatarUrl: dicebearUrl("Blair") },
  { id: "member-3", name: "Casey Lin", avatarUrl: dicebearUrl("Casey") },
  { id: "member-4", name: "Devon Marsh", avatarUrl: dicebearUrl("Devon") },
];

const animations = {
  avatar: {
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 22,
        mass: 0.6,
      },
    },
    hidden: {
      opacity: 0,
      scale: 0.85,
      transition: { duration: 0.18, ease: EASE_OUT },
    },
  } satisfies Variants,
  vibration: {
    idle: { x: 0 },
    shake: {
      x: [-3, 3, -2, 2, 0] as const,
      transition: { duration: SHAKE_DURATION_MS / 1000, ease: EASE_OUT },
    },
  } satisfies Variants,
  // `custom` is the signed offset of the latest step. AnimatePresence hands
  // the current value to the leaving number too, so it always exits opposite
  // to the one coming in.
  counter: {
    enter: (offset: number) => ({ opacity: 0, y: offset }),
    center: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2, ease: EASE_OUT },
    },
    exit: (offset: number) => ({
      opacity: 0,
      y: -offset,
      transition: { duration: 0.12, ease: EASE_OUT },
    }),
  } satisfies Variants,
} as const;

const STEPPER_BUTTON_CLASS =
  "flex size-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-500 transition-[color,background-color,border-color,opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2 active:scale-[0.97] active:bg-zinc-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-white motion-reduce:active:scale-100 dark:border-white/8 dark:bg-zinc-900 dark:text-zinc-400 dark:active:bg-zinc-800/80 dark:focus-visible:ring-zinc-500/40 dark:focus-visible:ring-offset-zinc-900 dark:hover:border-white/16 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:aria-disabled:hover:bg-zinc-900";

interface TeamSelectorProps {
  members?: TeamMember[];
  defaultValue?: number;
  /** Controlled team size. Pair it with `onChange`. */
  value?: number;
  /** Smallest allowed team size. Defaults to 1. */
  min?: number;
  onChange?: (size: number) => void;
  label?: string;
  className?: string;
}

export default function TeamSelector({
  members = DEFAULT_MEMBERS,
  defaultValue = 1,
  value,
  min = 1,
  onChange,
  label = "Team Size",
  className,
}: TeamSelectorProps) {
  const maxTeamSize = members.length;
  const clampCount = (count: number) =>
    Math.min(Math.max(count, min), maxTeamSize);
  const [internalCount, setInternalCount] = useState(() =>
    clampCount(defaultValue)
  );
  const peopleCount = clampCount(value ?? internalCount);
  const [direction, setDirection] = useState<1 | -1>(1);
  // Direction follows every change, including a controlled `value` set from
  // outside (state adjusted during render, as React recommends).
  const [previousCount, setPreviousCount] = useState(peopleCount);
  if (peopleCount !== previousCount) {
    setPreviousCount(peopleCount);
    setDirection(peopleCount > previousCount ? 1 : -1);
  }
  const [isVibrating, setIsVibrating] = useState(false);
  const vibrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const prefersReducedMotion = useReducedMotion();

  useEffect(
    () => () => {
      if (vibrationTimeoutRef.current) {
        clearTimeout(vibrationTimeoutRef.current);
      }
    },
    []
  );

  const triggerVibration = () => {
    if (prefersReducedMotion || vibrationTimeoutRef.current) {
      return;
    }
    setIsVibrating(true);
    vibrationTimeoutRef.current = setTimeout(() => {
      setIsVibrating(false);
      vibrationTimeoutRef.current = null;
    }, SHAKE_DURATION_MS);
  };

  const changeCount = (newCount: number) => {
    if (value === undefined) {
      setInternalCount(newCount);
    }
    onChange?.(newCount);
  };

  const handleIncrement = () => {
    if (peopleCount < maxTeamSize) {
      changeCount(peopleCount + 1);
    } else {
      triggerVibration();
    }
  };

  const handleDecrement = () => {
    if (peopleCount > min) {
      changeCount(peopleCount - 1);
    } else {
      triggerVibration();
    }
  };

  const counterOffset =
    direction * (prefersReducedMotion ? 0 : COUNTER_DISTANCE);
  const memberLabel = peopleCount === 1 ? "member" : "members";

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center",
        className
      )}
    >
      <div className="w-full max-w-xs rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] dark:border-white/8 dark:bg-zinc-900/60">
        <fieldset>
          <legend className="mb-5 w-full font-medium text-[11px] text-zinc-400 uppercase tracking-[0.14em] dark:text-zinc-500">
            {label}
          </legend>

          {/* Only the selected avatars render, so the row stays centred; the
              others slide over (layout) as one enters or leaves. Under reduced
              motion the avatars fade without scaling or sliding. */}
          <MotionConfig reducedMotion="user">
            <div className="mb-7 flex min-h-11 justify-center">
              <div className="flex items-center">
                <AnimatePresence initial={false}>
                  {members.slice(0, peopleCount).map((member, index) => (
                    <motion.div
                      animate="visible"
                      className="flex items-center justify-center"
                      exit="hidden"
                      initial="hidden"
                      key={member.id}
                      layout
                      style={{
                        marginLeft: index === 0 ? 0 : -AVATAR_OVERLAP,
                        zIndex: maxTeamSize - index,
                      }}
                      transition={{ layout: { duration: 0.2, ease: EASE_OUT } }}
                      variants={animations.avatar}
                    >
                      <Image
                        alt={member.name}
                        className="size-11 rounded-full border-2 border-white bg-zinc-100 object-cover shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-black/5 dark:border-zinc-900 dark:bg-zinc-800 dark:ring-white/5"
                        height={88}
                        src={member.avatarUrl}
                        unoptimized
                        width={88}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </MotionConfig>

          <motion.div
            animate={isVibrating ? "shake" : "idle"}
            className="flex items-center justify-center gap-5"
            initial="idle"
            variants={animations.vibration}
          >
            {/* aria-disabled rather than disabled: focus stays on the button at
                the bound and the click still reaches the shake feedback. */}
            <button
              aria-disabled={peopleCount <= min}
              aria-label="Decrease team size"
              className={STEPPER_BUTTON_CLASS}
              onClick={handleDecrement}
              type="button"
            >
              <Minus aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </button>

            <output aria-live="polite" className="sr-only">
              {peopleCount} {memberLabel}
            </output>
            <div
              aria-hidden="true"
              className="flex min-w-16 flex-col items-center"
            >
              <div className="relative h-9 overflow-hidden">
                <AnimatePresence
                  custom={counterOffset}
                  initial={false}
                  mode="popLayout"
                >
                  <motion.span
                    animate="center"
                    className="block select-none font-semibold text-3xl text-zinc-900 tabular-nums dark:text-zinc-100"
                    custom={counterOffset}
                    exit="exit"
                    initial="enter"
                    key={peopleCount}
                    variants={animations.counter}
                  >
                    {peopleCount}
                  </motion.span>
                </AnimatePresence>
              </div>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {memberLabel}
              </span>
            </div>

            <button
              aria-disabled={peopleCount >= maxTeamSize}
              aria-label="Increase team size"
              className={STEPPER_BUTTON_CLASS}
              onClick={handleIncrement}
              type="button"
            >
              <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </button>
          </motion.div>
        </fieldset>
      </div>
    </div>
  );
}
