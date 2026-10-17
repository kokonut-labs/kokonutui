"use client";

/**
 * @author: @dorianbaffier
 * @description: Detent Dial
 * @version: 1.0.0
 * @date: 2026-10-13
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AnimatePresence,
  type AnimationPlaybackControls,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type Variants,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// The dial sweeps 270°, from 7:30 to 4:30 on a clock face.
const SWEEP = 270;
const START_ANGLE = -135;
// How far (deg) the knob can be wound past either end. The pull flattens
// out as it approaches this, so it slows down instead of hitting a wall.
const MAX_OVERSHOOT = 16;
// While dragging, the knob is pulled this much toward the nearest notch,
// which is what makes it feel like it clicks from one step to the next.
const DETENT_PULL = 0.65;
const MAX_TICKS = 56;
// The swell that follows the indicator round the ring: extra length (px)
// at its peak, and how many degrees it spreads either side.
const WAVE_HEIGHT = 9;
const WAVE_WIDTH = 12;
// Pointer movement this close to the centre gives wild angle jumps.
const DEAD_ZONE = 14;
// Below this speed (fraction of the range per second) a release just
// settles into the nearest notch instead of coasting.
const FLICK_THRESHOLD = 0.4;
const VELOCITY_WINDOW_MS = 80;
// Seconds of travel a flick is worth: release speed × COAST = distance coasted.
const COAST = 0.3;
const SETTLE_SPRING = { type: "spring", duration: 0.35, bounce: 0.2 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function damp(distance: number, max: number) {
  return max * (1 - Math.exp(-distance / max));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snap(value: number, min: number, step: number) {
  return Number((Math.round((value - min) / step) * step + min).toFixed(10));
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  // Rounded so the server and the browser, whose trig can differ in the
  // last digits, render identical markup.
  return {
    x: Math.round((cx + radius * Math.sin(rad)) * 100) / 100,
    y: Math.round((cy - radius * Math.cos(rad)) * 100) / 100,
  };
}

function pointerAngle(event: PointerEvent, rect: DOMRect) {
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  return {
    angle: (Math.atan2(dx, -dy) * 180) / Math.PI,
    distance: Math.hypot(dx, dy),
  };
}

// navigator.vibrate is a no-op where unsupported (iOS, desktop). On
// Android it gives each notch a faint tick under the finger.
function hapticTick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(1);
  }
}

export interface DetentDialProps {
  /** Accessible name, also shown inside the knob. */
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Initial value when uncontrolled. Double-clicking the knob returns here. */
  defaultValue?: number;
  /** Controlled value. */
  value?: number;
  onValueChange?: (value: number) => void;
  /** Formats the readout, the end labels and `aria-valuetext`. */
  formatValue?: (value: number) => string;
  /** Diameter in px. */
  size?: number;
  disabled?: boolean;
  className?: string;
}

export default function DetentDial({
  label = "Temperature",
  min = 16,
  max = 30,
  step = 0.5,
  defaultValue = 21,
  value: valueProp,
  onValueChange,
  formatValue = (v) => `${v.toFixed(1)}°`,
  size = 240,
  disabled = false,
  className,
}: DetentDialProps) {
  const labelId = useId();
  const knobRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(SVGLineElement | null)[]>([]);
  // The length last written to each tick, so a frame only touches the few
  // ticks the swell is actually passing over.
  const tickLengths = useRef<number[]>([]);
  const reduceMotion = useReducedMotion();
  const range = max - min;

  const initial = clamp(valueProp ?? defaultValue, min, max);
  const [value, setValue] = useState(initial);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [grabbing, setGrabbing] = useState(false);
  const committed = useRef(initial);
  const pointerType = useRef("mouse");

  // The raw, unsnapped position in value units. It can run past min/max
  // while winding; everything visual is derived from it.
  const raw = useMotionValue(initial);
  const animation = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{
    id: number;
    // Measured once on grab: reading layout on every move forces the
    // browser to recalculate it after each frame's writes.
    rect: DOMRect;
    lastAngle: number;
    samples: { t: number; v: number }[];
  } | null>(null);

  const rotation = useTransform(raw, (r) => {
    const degPerUnit = range === 0 ? 0 : SWEEP / range;
    if (r < min) {
      return START_ANGLE - damp((min - r) * degPerUnit, MAX_OVERSHOOT);
    }
    if (r > max) {
      return START_ANGLE + SWEEP + damp((r - max) * degPerUnit, MAX_OVERSHOOT);
    }
    const notch = snap(r, min, step);
    const pulled = notch + (r - notch) * (1 - DETENT_PULL);
    return START_ANGLE + (pulled - min) * degPerUnit;
  });

  // Only re-render when the dial crosses into a new notch, not per frame.
  useMotionValueEvent(raw, "change", (r) => {
    const next = clamp(snap(r, min, step), min, max);
    if (next === committed.current) {
      return;
    }
    setDirection(next > committed.current ? 1 : -1);
    committed.current = next;
    setValue(next);
    onValueChange?.(next);
    if (pointerType.current === "touch") {
      hapticTick();
    }
  });

  // Follow a controlled value when the parent changes it.
  useEffect(() => {
    if (valueProp === undefined || drag.current) {
      return;
    }
    const next = clamp(valueProp, min, max);
    if (next !== committed.current) {
      animation.current?.stop();
      committed.current = next;
      setValue(next);
      raw.jump(next);
    }
  }, [valueProp, min, max, raw]);

  useEffect(() => () => animation.current?.stop(), []);

  const settleTo = (target: number) => {
    animation.current?.stop();
    animation.current = animate(
      raw,
      target,
      reduceMotion ? { duration: 0 } : SETTLE_SPRING
    );
  };

  // Keyboard and wheel steps jump straight to the value. They repeat fast,
  // and an animation on each would trail behind the input.
  const stepBy = (delta: number) => {
    animation.current?.stop();
    const target = clamp(snap(committed.current + delta, min, step), min, max);
    pointerType.current = "keyboard";
    raw.jump(target);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || drag.current) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const { angle } = pointerAngle(event, rect);
    animation.current?.stop();
    pointerType.current = event.pointerType;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      rect,
      lastAngle: angle,
      samples: [{ t: event.timeStamp, v: raw.get() }],
    };
    setGrabbing(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    const { angle, distance } = pointerAngle(event, current.rect);
    if (distance < DEAD_ZONE) {
      current.lastAngle = angle;
      return;
    }
    // Unwrap so crossing 6 o'clock doesn't read as a 360° jump.
    let delta = angle - current.lastAngle;
    if (delta > 180) {
      delta -= 360;
    } else if (delta < -180) {
      delta += 360;
    }
    current.lastAngle = angle;
    const next = raw.get() + (delta / SWEEP) * range;
    raw.set(next);
    current.samples.push({ t: event.timeStamp, v: next });
    while (
      current.samples.length > 2 &&
      event.timeStamp - current.samples[0].t > VELOCITY_WINDOW_MS
    ) {
      current.samples.shift();
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    drag.current = null;
    setGrabbing(false);

    const first = current.samples[0];
    const last = current.samples.at(-1) ?? first;
    const elapsed = (last.t - first.t) / 1000;
    // Holding still before letting go is a placement, not a flick.
    const paused = event.timeStamp - last.t > VELOCITY_WINDOW_MS;
    const velocity = elapsed > 0 && !paused ? (last.v - first.v) / elapsed : 0;
    const position = raw.get();
    const inBounds = position >= min && position <= max;

    if (
      reduceMotion ||
      !inBounds ||
      Math.abs(velocity) < range * FLICK_THRESHOLD
    ) {
      settleTo(clamp(snap(position, min, step), min, max));
      return;
    }
    // A flick coasts, slows down, and lands on a notch. If it runs out of
    // room it bounces off the end instead of stopping dead.
    animation.current?.stop();
    // Project where the flick would coast to, land that on a notch, then
    // spring there carrying the release velocity. If the projection runs
    // past an end, the spring overshoots it a little and settles back.
    const target = clamp(
      snap(position + velocity * COAST, min, step),
      min,
      max
    );
    animation.current = animate(raw, target, {
      type: "spring",
      velocity,
      stiffness: 140,
      damping: 24,
      restDelta: 0.005,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    const big = Math.max(step, snap(range / 10, 0, step));
    const keySteps: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: big,
      PageDown: -big,
      Home: min - committed.current,
      End: max - committed.current,
    };
    if (!(event.key in keySteps)) {
      return;
    }
    event.preventDefault();
    stepBy(keySteps[event.key]);
  };

  // The wheel only turns the dial once it has focus, so scrolling the page
  // past it never changes the value by accident. The listener is attached
  // once and reads the latest props through a ref.
  const wheelStep = useRef({ disabled, step, stepBy });
  wheelStep.current = { disabled, step, stepBy };
  useEffect(() => {
    const knob = knobRef.current;
    if (!knob) {
      return;
    }
    let accumulated = 0;
    const onWheel = (event: WheelEvent) => {
      const latest = wheelStep.current;
      if (latest.disabled || document.activeElement !== knob) {
        return;
      }
      event.preventDefault();
      accumulated += event.deltaY;
      // Trackpads send many tiny deltas; one notch per ~40px of scroll.
      while (Math.abs(accumulated) >= 40) {
        const sign = Math.sign(accumulated);
        accumulated -= sign * 40;
        latest.stepBy(-sign * latest.step);
      }
    };
    knob.addEventListener("wheel", onWheel, { passive: false });
    return () => knob.removeEventListener("wheel", onWheel);
  }, []);

  const center = size / 2;
  const tickCount = Math.max(1, Math.min(Math.round(range / step), MAX_TICKS));
  const valueFraction = range === 0 ? 0 : (value - min) / range;
  const activeTick = Math.round(valueFraction * tickCount);
  const knobSize = size * 0.64;
  const outer = size / 2 - 6;

  // Ticks swell as the indicator passes them, following its exact angle
  // (not the snapped value), so a wave travels round the ring as you turn.
  function tickLength(i: number, indicatorAngle: number) {
    const angle = START_ANGLE + (i / tickCount) * SWEEP;
    // Min, mid and max read as the scale's anchors, like a ruler's inch marks.
    const anchor = i === 0 || i === tickCount || i * 2 === tickCount;
    const major = i % 5 === 0;
    let base = 6;
    if (anchor) {
      base = 14;
    } else if (major) {
      base = 10;
    }
    const distance = (angle - indicatorAngle) / WAVE_WIDTH;
    // Rounded to a tenth of a pixel: finer changes aren't visible, and
    // skipping them leaves most ticks untouched on any given frame.
    return (
      Math.round((base + WAVE_HEIGHT * Math.exp(-distance * distance)) * 10) /
      10
    );
  }

  function tickGeometry(i: number, length: number) {
    const angle = START_ANGLE + (i / tickCount) * SWEEP;
    return {
      a: polar(center, center, outer - length, angle),
      b: polar(center, center, outer, angle),
    };
  }

  // Written straight to the lines each frame; no re-render while turning.
  useMotionValueEvent(rotation, "change", (indicatorAngle) => {
    for (let i = 0; i <= tickCount; i++) {
      const line = tickRefs.current[i];
      const length = tickLength(i, indicatorAngle);
      if (!line || tickLengths.current[i] === length) {
        continue;
      }
      tickLengths.current[i] = length;
      const { a } = tickGeometry(i, length);
      line.setAttribute("x1", String(a.x));
      line.setAttribute("y1", String(a.y));
    }
  });
  const minLabel = polar(center, center, outer + 2, START_ANGLE - 12);
  const maxLabel = polar(center, center, outer + 2, START_ANGLE + SWEEP + 12);

  return (
    <div
      className={cn(
        "relative select-none",
        disabled && "opacity-50",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        {Array.from({ length: tickCount + 1 }, (_, i) => {
          const lit = i <= activeTick;
          const current = i === activeTick;
          const length = tickLength(i, rotation.get());
          tickLengths.current[i] = length;
          const { a, b } = tickGeometry(i, length);
          return (
            <line
              className={cn(
                "transition-[stroke] duration-150",
                current && "stroke-orange-600 dark:stroke-orange-400",
                !current &&
                  (lit
                    ? "stroke-zinc-900 dark:stroke-zinc-100"
                    : "stroke-zinc-300 dark:stroke-zinc-700")
              )}
              // biome-ignore lint/suspicious/noArrayIndexKey: ticks are positional.
              key={i}
              ref={(node) => {
                tickRefs.current[i] = node;
              }}
              strokeLinecap="round"
              strokeWidth={current ? 2 : 1.5}
              x1={a.x}
              x2={b.x}
              y1={a.y}
              y2={b.y}
            />
          );
        })}
      </svg>

      <span
        aria-hidden="true"
        className="absolute -translate-x-1/2 text-[11px] text-zinc-400 tabular-nums"
        style={{ left: minLabel.x, top: minLabel.y }}
      >
        {formatValue(min)}
      </span>
      <span
        aria-hidden="true"
        className="absolute -translate-x-1/2 text-[11px] text-zinc-400 tabular-nums"
        style={{ left: maxLabel.x, top: maxLabel.y }}
      >
        {formatValue(max)}
      </span>

      <div
        aria-disabled={disabled || undefined}
        aria-labelledby={labelId}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        aria-valuetext={formatValue(value)}
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full outline-none",
          "border border-zinc-200 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-12px_rgb(0_0_0/0.25)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_12px_32px_-12px_rgb(0_0_0/0.8)]",
          "transition-[border-color] duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
          grabbing
            ? "cursor-grabbing border-zinc-300 dark:border-zinc-700"
            : "cursor-grab",
          disabled && "cursor-not-allowed"
        )}
        onDoubleClick={() => {
          if (!disabled) {
            pointerType.current = "mouse";
            settleTo(clamp(defaultValue, min, max));
          }
        }}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={knobRef}
        role="slider"
        style={{ width: knobSize, height: knobSize }}
        tabIndex={disabled ? -1 : 0}
      >
        {/* Only the indicator turns; the readout stays upright. */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ rotate: rotation }}
        >
          <span className="absolute top-2.5 left-1/2 h-3 w-[3px] -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
        </motion.div>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-xs text-zinc-500 dark:text-zinc-400"
            id={labelId}
          >
            {label}
          </span>
          <RollingValue
            direction={direction}
            reduceMotion={Boolean(reduceMotion)}
            text={formatValue(value)}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Each character rolls on its own, so going from 21.5 to 22.0 only moves
 * the digits that changed. A touch of blur hides the overlap between the
 * outgoing and incoming glyph.
 */
// `custom` is the signed offset of the latest change. AnimatePresence hands
// the current value to the leaving glyph too, so it always exits opposite to
// the one coming in.
const rollVariants: Variants = {
  // A full transform string rather than `y`, so Motion can hand the roll to
  // the compositor instead of stepping it on the main thread.
  enter: (offset: number) => ({
    opacity: 0,
    transform: `translateY(${offset}px)`,
    filter: offset === 0 ? "blur(0px)" : "blur(2px)",
  }),
  center: { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
  exit: (offset: number) => ({
    opacity: 0,
    transform: `translateY(${-offset}px)`,
    filter: offset === 0 ? "blur(0px)" : "blur(2px)",
  }),
};

function RollingValue({
  text,
  direction,
  reduceMotion,
}: {
  text: string;
  direction: 1 | -1;
  reduceMotion: boolean;
}) {
  const offset = reduceMotion ? 0 : direction * 10;
  return (
    <span
      aria-hidden="true"
      className="relative flex font-medium text-3xl text-zinc-900 tabular-nums tracking-tight dark:text-zinc-100"
    >
      {text.split("").map((char, index) => (
        <span
          className="relative inline-flex overflow-hidden"
          // Position is the identity: the same slot keeps its node.
          // biome-ignore lint/suspicious/noArrayIndexKey: characters are positional.
          key={index}
        >
          <AnimatePresence custom={offset} initial={false} mode="popLayout">
            <motion.span
              animate="center"
              custom={offset}
              exit="exit"
              initial="enter"
              key={char}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              variants={rollVariants}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
