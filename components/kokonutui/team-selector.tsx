"use client";

/**
 * @author: @dorianbaffier
 * @description: Team Selector
 * @version: 4.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Minus, Plus } from "lucide-react";
import {
  AnimatePresence,
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  type Variants,
} from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/** Horizontal pixels of drag per step when scrubbing the number. */
const SCRUB_STEP_PX = 24;
/** Furthest the number stretches past a bound, however far you pull. */
const RUBBER_BAND_PX = 14;
/** Avatars shown before the stack collapses into a "+N" chip. */
const VISIBLE_AVATARS = 5;
const AVATAR_OVERLAP = 8;
const ROLL_DISTANCE = 10;
const SHAKE_DURATION_MS = 280;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SNAP_BACK = { type: "spring", stiffness: 600, damping: 32 } as const;

export interface TeamMember {
  id: string;
  name: string;
  /** Optional photo. Without it the avatar shows the member's initials. */
  avatarUrl?: string;
}

const DEFAULT_MEMBERS: TeamMember[] = [
  { id: "member-1", name: "Alex Rivera" },
  { id: "member-2", name: "Blair Kim" },
  { id: "member-3", name: "Casey Lin" },
  { id: "member-4", name: "Devon Marsh" },
];

interface Seat extends TeamMember {
  isOpen: boolean;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

/** Stable hue per name, so the same person always gets the same tint. */
const getHue = (name: string) => {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 3_600_000;
  }
  return hash % 360;
};

const animations = {
  avatar: {
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring", stiffness: 380, damping: 28, mass: 0.6 },
    },
    hidden: {
      opacity: 0,
      scale: 0.85,
      transition: { duration: 0.16, ease: EASE_OUT },
    },
  } satisfies Variants,
  vibration: {
    idle: { x: 0 },
    shake: {
      x: [-3, 3, -2, 2, 0] as const,
      transition: { duration: SHAKE_DURATION_MS / 1000, ease: EASE_OUT },
    },
  } satisfies Variants,
  // `custom` is the signed offset of the latest change. AnimatePresence hands
  // the current value to leaving digits too, so they always exit opposite to
  // the ones coming in.
  roll: {
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

const LEADING_SYMBOLS = /^[^\d]+/;

/**
 * Rolls each character on its own, keyed by its place from the right, so
 * 12 → 13 only moves the last digit and 9 → 10 grows a new tens column.
 */
function RollingText({
  text,
  offset,
  className,
}: {
  text: string;
  offset: number;
  className?: string;
}) {
  // A currency sign stays put; only the digits after it roll, so $96 → $108
  // grows a column instead of rolling the "$" into a digit.
  const prefix = text.match(LEADING_SYMBOLS)?.[0] ?? "";
  const columns = [...text.slice(prefix.length)].map((char, index, all) => ({
    char,
    place: all.length - index,
  }));

  return (
    <span className={cn("inline-flex tabular-nums", className)}>
      {prefix}
      <AnimatePresence custom={offset} initial={false} mode="popLayout">
        {columns.map(({ char, place }) => (
          <motion.span
            animate="center"
            className="relative inline-flex overflow-hidden"
            custom={offset}
            exit="exit"
            initial="enter"
            key={`place-${place}`}
            variants={animations.roll}
          >
            <AnimatePresence custom={offset} initial={false} mode="popLayout">
              <motion.span
                animate="center"
                className="inline-block"
                custom={offset}
                exit="exit"
                initial="enter"
                key={char}
                variants={animations.roll}
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

function SeatAvatar({ seat, index }: { seat: Seat; index: number }) {
  const base =
    "flex size-10 items-center justify-center overflow-hidden rounded-full ring-2 ring-white dark:ring-zinc-900";

  if (seat.avatarUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: plain <img> keeps the component framework-agnostic and works with any avatar host.
      <img
        alt=""
        className={cn(base, "bg-zinc-100 object-cover dark:bg-zinc-800")}
        draggable={false}
        height={40}
        src={seat.avatarUrl}
        width={40}
      />
    );
  }

  if (seat.isOpen) {
    return (
      <span
        className={cn(
          base,
          "bg-white font-medium text-[11px] text-zinc-400 tabular-nums outline-dashed outline-1 outline-zinc-300 -outline-offset-3 dark:bg-zinc-900 dark:text-zinc-500 dark:outline-zinc-700"
        )}
      >
        {index + 1}
      </span>
    );
  }

  return (
    <span
      className={cn(
        base,
        "bg-[oklch(0.94_0.025_var(--hue))] font-medium text-[12px] text-[oklch(0.42_0.05_var(--hue))] dark:bg-[oklch(0.32_0.03_var(--hue))] dark:text-[oklch(0.86_0.04_var(--hue))]"
      )}
      style={{ "--hue": getHue(seat.name) } as CSSProperties}
    >
      {getInitials(seat.name)}
    </span>
  );
}

const STEPPER_BUTTON_CLASS =
  "flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-500 transition-[color,background-color,border-color,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2 active:bg-zinc-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-zinc-200/80 aria-disabled:hover:bg-white aria-disabled:hover:text-zinc-500 dark:border-white/8 dark:bg-zinc-900 dark:text-zinc-400 dark:active:bg-zinc-800 dark:focus-visible:ring-zinc-500/40 dark:focus-visible:ring-offset-zinc-900 dark:hover:border-white/16 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100 dark:aria-disabled:hover:border-white/8 dark:aria-disabled:hover:bg-zinc-900 dark:aria-disabled:hover:text-zinc-400";

interface TeamSelectorProps {
  /** Known people. Seats beyond this list show as open, numbered slots. */
  members?: TeamMember[];
  defaultValue?: number;
  /** Controlled seat count. Pair it with `onChange`. */
  value?: number;
  /** Smallest allowed seat count. Defaults to 1. */
  min?: number;
  /** Largest allowed seat count, independent of `members`. Defaults to 12. */
  max?: number;
  onChange?: (size: number) => void;
  label?: string;
  /** When set, shows the per-seat price and the monthly total. */
  pricePerSeat?: number;
  /** ISO 4217 code for the price line. Defaults to "USD". */
  currency?: string;
  className?: string;
}

export default function TeamSelector({
  members = DEFAULT_MEMBERS,
  defaultValue = 3,
  value,
  min = 1,
  max = 12,
  onChange,
  label = "Team size",
  pricePerSeat,
  currency = "USD",
  className,
}: TeamSelectorProps) {
  const labelId = useId();
  const upperBound = Math.max(min, max);
  const clampCount = (count: number) =>
    Math.min(Math.max(count, min), upperBound);
  const [internalCount, setInternalCount] = useState(() =>
    clampCount(defaultValue)
  );
  const count = clampCount(value ?? internalCount);
  const [direction, setDirection] = useState<1 | -1>(1);
  // Direction follows every change, including a controlled `value` set from
  // outside (state adjusted during render, as React recommends).
  const [previousCount, setPreviousCount] = useState(count);
  if (count !== previousCount) {
    setPreviousCount(count);
    setDirection(count > previousCount ? 1 : -1);
  }

  const [isVibrating, setIsVibrating] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const vibrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const scrubRef = useRef<{
    id: number;
    startX: number;
    startCount: number;
  } | null>(null);
  const stretchX = useMotionValue(0);
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

  const changeCount = (next: number) => {
    const clamped = clampCount(next);
    if (clamped === count) {
      return;
    }
    if (value === undefined) {
      setInternalCount(clamped);
    }
    onChange?.(clamped);
  };

  /** Steps by `delta`, or shakes when the step would cross a bound. */
  const step = (delta: number) => {
    const next = count + delta;
    if (next < min || next > upperBound) {
      triggerVibration();
      return;
    }
    changeCount(next);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // A second finger mid-scrub is ignored rather than jumping the count.
    if (event.button !== 0 || scrubRef.current) {
      return;
    }
    // No preventDefault: the mousedown that follows focuses the spinbutton
    // (without a focus-visible ring), so the arrow keys work after a drag.
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startCount: count,
    };
    setIsScrubbing(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const scrub = scrubRef.current;
    if (!scrub || scrub.id !== event.pointerId) {
      return;
    }
    const travel = event.clientX - scrub.startX;
    const raw = scrub.startCount + travel / SCRUB_STEP_PX;
    changeCount(Math.round(raw));

    // Past a bound the number keeps following the pointer, but with
    // exponentially growing resistance, so it never travels more than
    // RUBBER_BAND_PX however far you pull.
    let overshoot = 0;
    if (raw < min) {
      overshoot = (raw - min) * SCRUB_STEP_PX;
    } else if (raw > upperBound) {
      overshoot = (raw - upperBound) * SCRUB_STEP_PX;
    }
    const stretch =
      Math.sign(overshoot) *
      RUBBER_BAND_PX *
      (1 - Math.exp(-Math.abs(overshoot) / (RUBBER_BAND_PX * 4)));
    stretchX.set(stretch);
  };

  const endScrub = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubRef.current?.id !== event.pointerId) {
      return;
    }
    scrubRef.current = null;
    setIsScrubbing(false);
    if (prefersReducedMotion) {
      stretchX.set(0);
    } else {
      animate(stretchX, 0, SNAP_BACK);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
        step(1);
        break;
      case "ArrowDown":
      case "ArrowLeft":
        step(-1);
        break;
      case "PageUp":
        changeCount(count + 5);
        break;
      case "PageDown":
        changeCount(count - 5);
        break;
      case "Home":
        changeCount(min);
        break;
      case "End":
        changeCount(upperBound);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const rollOffset = direction * (prefersReducedMotion ? 0 : ROLL_DISTANCE);
  const unit = count === 1 ? "seat" : "seats";

  const seats: Seat[] = Array.from({ length: count }, (_, index) => {
    const member = members.at(index);
    return member
      ? { ...member, isOpen: false }
      : {
          id: `open-seat-${index + 1}`,
          name: `Seat ${index + 1}`,
          isOpen: true,
        };
  });
  const overflowCount =
    count > VISIBLE_AVATARS ? count - (VISIBLE_AVATARS - 1) : 0;
  const visibleSeats = overflowCount
    ? seats.slice(0, VISIBLE_AVATARS - 1)
    : seats;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(pricePerSeat) ? 0 : 2,
    }).format(amount);

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center",
        className
      )}
    >
      <div className="w-full max-w-xs rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] dark:border-white/8 dark:bg-zinc-900">
        <span
          className="block font-medium text-[13px] text-zinc-500 dark:text-zinc-400"
          id={labelId}
        >
          {label}
        </span>

        <MotionConfig reducedMotion="user">
          {/* Decorative: the spinbutton below carries the value. Only the
              selected seats render, so the row stays centred; the others
              slide over (layout) as one enters or leaves. */}
          <div
            aria-hidden="true"
            className="mt-4 mb-6 flex h-10 items-center justify-center"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visibleSeats.map((seat, index) => (
                <motion.div
                  animate="visible"
                  exit="hidden"
                  initial="hidden"
                  key={seat.id}
                  layout="position"
                  style={{
                    marginLeft: index === 0 ? 0 : -AVATAR_OVERLAP,
                    zIndex: VISIBLE_AVATARS - index,
                  }}
                  title={seat.name}
                  transition={{ layout: { duration: 0.2, ease: EASE_OUT } }}
                  variants={animations.avatar}
                >
                  <SeatAvatar index={index} seat={seat} />
                </motion.div>
              ))}
              {overflowCount > 0 && (
                <motion.div
                  animate="visible"
                  className="flex h-10 min-w-10 items-center justify-center rounded-full bg-zinc-100 px-2 font-medium text-[12px] text-zinc-600 ring-2 ring-white dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-900"
                  exit="hidden"
                  initial="hidden"
                  key="overflow"
                  layout="position"
                  style={{ marginLeft: -AVATAR_OVERLAP, zIndex: 0 }}
                  transition={{ layout: { duration: 0.2, ease: EASE_OUT } }}
                  variants={animations.avatar}
                >
                  +
                  <RollingText
                    offset={rollOffset}
                    text={String(overflowCount)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            animate={isVibrating ? "shake" : "idle"}
            className="flex items-center justify-center gap-4"
            initial="idle"
            variants={animations.vibration}
          >
            {/* aria-disabled rather than disabled: focus stays on the button at
                the bound and the click still reaches the shake feedback. */}
            <button
              aria-disabled={count <= min}
              aria-label="Remove a seat"
              className={STEPPER_BUTTON_CLASS}
              onClick={() => step(-1)}
              type="button"
            >
              <Minus aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </button>

            {/* Scrub: drag sideways on the number, like a design tool's
                number field. Pointer capture keeps the drag alive outside. */}
            <motion.div
              aria-labelledby={labelId}
              aria-valuemax={upperBound}
              aria-valuemin={min}
              aria-valuenow={count}
              aria-valuetext={`${count} ${unit}`}
              className={cn(
                "flex min-w-20 touch-pan-y select-none flex-col items-center rounded-xl px-2 py-1 outline-hidden transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400/40 dark:focus-visible:ring-zinc-500/40 dark:hover:bg-zinc-800/60 [@media(pointer:fine)]:cursor-ew-resize",
                isScrubbing && "bg-zinc-100 dark:bg-zinc-800"
              )}
              onKeyDown={handleKeyDown}
              onLostPointerCapture={endScrub}
              onPointerCancel={endScrub}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endScrub}
              role="spinbutton"
              style={{ x: stretchX }}
              tabIndex={0}
            >
              <RollingText
                className="h-9 font-semibold text-3xl text-zinc-900 leading-9 dark:text-zinc-100"
                offset={rollOffset}
                text={String(count)}
              />
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {unit}
              </span>
            </motion.div>

            <button
              aria-disabled={count >= upperBound}
              aria-label="Add a seat"
              className={STEPPER_BUTTON_CLASS}
              onClick={() => step(1)}
              type="button"
            >
              <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </button>
          </motion.div>

          {pricePerSeat !== undefined && (
            <p className="mt-5 flex items-center justify-center gap-1.5 border-zinc-100 border-t pt-4 text-[13px] text-zinc-500 tabular-nums dark:border-white/6 dark:text-zinc-400">
              <span>{formatPrice(pricePerSeat)} / seat</span>
              <span
                aria-hidden="true"
                className="text-zinc-300 dark:text-zinc-600"
              >
                ·
              </span>
              <span className="inline-flex items-center gap-1">
                <RollingText
                  className="font-medium text-zinc-900 dark:text-zinc-100"
                  offset={rollOffset}
                  text={formatPrice(pricePerSeat * count)}
                />
                / month
              </span>
            </p>
          )}
        </MotionConfig>

        {/* Announces changes made with the buttons or the drag; the
            spinbutton itself only speaks while focused. */}
        <output aria-live="polite" className="sr-only">
          {count} {unit}
          {pricePerSeat === undefined
            ? ""
            : `, ${formatPrice(pricePerSeat * count)} per month`}
        </output>
      </div>
    </div>
  );
}
