"use client";

/**
 * @author: @dorianbaffier
 * @description: Wheel Picker
 * @version: 1.0.0
 * @date: 2026-10-13
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type AnimationPlaybackControls,
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface WheelOption {
  value: string;
  label: string;
}

export interface WheelColumn {
  id: string;
  /** Accessible name of the column, e.g. "Hours". */
  label: string;
  options: WheelOption[];
  /** Wrap around from the last option to the first. */
  loop?: boolean;
  /** Tailwind width class for the column. */
  className?: string;
}

const range = (count: number, format: (i: number) => string) =>
  Array.from({ length: count }, (_, i) => ({
    value: String(i),
    label: format(i),
  }));

const DEFAULT_COLUMNS: WheelColumn[] = [
  {
    id: "hour",
    label: "Hours",
    loop: true,
    className: "w-16",
    options: range(12, (i) => String(i + 1)),
  },
  {
    id: "minute",
    label: "Minutes",
    loop: true,
    className: "w-16",
    options: range(60, (i) => String(i).padStart(2, "0")),
  },
  {
    id: "period",
    label: "AM or PM",
    className: "w-16",
    options: [
      { value: "am", label: "AM" },
      { value: "pm", label: "PM" },
    ],
  },
];

const DEFAULT_VALUE: Record<string, string> = {
  hour: "8",
  minute: "41",
  period: "am",
};

const ITEM_HEIGHT = 36;
// Each row sits this many degrees further round the drum.
const ITEM_ANGLE = 20;
// Drum radius that makes neighbouring rows touch exactly.
// Rounded so server and browser trig can't disagree in the markup.
const RADIUS =
  Math.round(
    (ITEM_HEIGHT / 2 / Math.tan((ITEM_ANGLE / 2) * (Math.PI / 180))) * 100
  ) / 100;
// Rows past ±90° face away; render a few either side of that and no more.
const WINDOW = Math.ceil(90 / ITEM_ANGLE);
const VIEW_HEIGHT = Math.round(RADIUS * 2) + ITEM_HEIGHT / 2;
// A non-looping wheel can be dragged this many rows past either end.
const MAX_OVERSCROLL = 1.2;
const VELOCITY_WINDOW_MS = 80;
const TAP_SLOP = 4;
// Seconds of travel a flick is worth: release speed × COAST = rows coasted.
const COAST = 0.32;

const mod = (n: number, m: number) => ((n % m) + m) % m;

function damp(distance: number, max: number) {
  return max * (1 - Math.exp(-distance / max));
}

function hapticTick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(1);
  }
}

export interface WheelPickerProps {
  columns?: WheelColumn[];
  /** Controlled selection, keyed by column id. */
  value?: Record<string, string>;
  /** Initial selection when uncontrolled. */
  defaultValue?: Record<string, string>;
  /** Called once a wheel comes to rest on a new option. */
  onValueChange?: (value: Record<string, string>) => void;
  /** Accessible name for the whole picker. */
  label?: string;
  className?: string;
}

/**
 * An iOS-style drum picker. Each column is a real 3D cylinder: rows are
 * placed round it with `rotateX() translateZ()` and the whole drum turns
 * with a single transform, so a frame costs one style write per column.
 *
 * The drum is drawn twice. The bottom copy is muted; the top copy is in full
 * color and clipped to the selection band. Text turns dark exactly as it
 * crosses the band's edge, the way the native picker does. Hairline ticks
 * mark the band's ends.
 */
export default function WheelPicker({
  columns = DEFAULT_COLUMNS,
  value: valueProp,
  defaultValue = DEFAULT_VALUE,
  onValueChange,
  label = "Time",
  className,
}: WheelPickerProps) {
  const [internal, setInternal] = useState(defaultValue);
  const value = valueProp ?? internal;

  const select = (columnId: string, optionValue: string) => {
    if (value[columnId] === optionValue) {
      return;
    }
    const next = { ...value, [columnId]: optionValue };
    if (valueProp === undefined) {
      setInternal(next);
    }
    onValueChange?.(next);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would add a border and legend layout the picker doesn't want.
    <div
      aria-label={label}
      className={cn(
        "relative flex select-none justify-center rounded-2xl border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
      role="group"
    >
      {/* The selection band, shared by every column. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-lg bg-zinc-100 dark:bg-zinc-800/70"
        style={{ height: ITEM_HEIGHT }}
      />
      {/* Hairline ticks either side of the band, like a ruler's pointer. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-0.5 h-px w-1 -translate-y-1/2 bg-zinc-400 dark:bg-zinc-500"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-0.5 h-px w-1 -translate-y-1/2 bg-zinc-400 dark:bg-zinc-500"
      />
      {columns.map((column) => (
        <WheelColumnView
          column={column}
          key={column.id}
          onSelect={(optionValue) => select(column.id, optionValue)}
          selected={value[column.id]}
        />
      ))}
    </div>
  );
}

function WheelColumnView({
  column,
  selected,
  onSelect,
}: {
  column: WheelColumn;
  selected: string | undefined;
  onSelect: (value: string) => void;
}) {
  const { options, loop = false } = column;
  const count = options.length;
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === selected),
    0
  );
  const reduceMotion = useReducedMotion();

  // Position on the drum in rows. A looping wheel uses an unbounded
  // "virtual" index so it can spin forever; the option is index mod count.
  const position = useMotionValue(selectedIndex);
  const [center, setCenter] = useState(selectedIndex);
  const animation = useRef<AnimationPlaybackControls | null>(null);
  const pointerType = useRef("mouse");
  const drag = useRef<{
    id: number;
    startY: number;
    startPosition: number;
    moved: boolean;
    samples: { t: number; v: number }[];
  } | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  const drum = useTransform(
    position,
    (p) => `translateZ(${-RADIUS}px) rotateX(${p * ITEM_ANGLE}deg)`
  );

  const optionAt = (index: number) => options[mod(index, count)];

  useMotionValueEvent(position, "change", (p) => {
    const rounded = Math.round(p);
    if (rounded !== center) {
      setCenter(rounded);
      if (pointerType.current === "touch") {
        hapticTick();
      }
    }
  });

  // Follow the selection when it changes from outside (controlled value,
  // keyboard, another column re-rendering the parent).
  useEffect(() => {
    if (drag.current || animation.current) {
      return;
    }
    const current = mod(Math.round(position.get()), count);
    if (current === selectedIndex) {
      return;
    }
    // Take the short way round on a looping wheel.
    let delta = selectedIndex - current;
    if (loop && Math.abs(delta) > count / 2) {
      delta -= Math.sign(delta) * count;
    }
    position.jump(Math.round(position.get()) + delta);
  }, [selectedIndex, count, loop, position]);

  useEffect(() => () => animation.current?.stop(), []);

  const settle = () => {
    animation.current = null;
    onSelect(optionAt(Math.round(position.get())).value);
  };

  const clampIndex = (index: number) =>
    loop ? index : Math.min(Math.max(index, 0), count - 1);

  const goTo = (target: number) => {
    animation.current?.stop();
    animation.current = null;
    if (reduceMotion) {
      position.jump(target);
      settle();
      return;
    }
    animation.current = animate(position, target, {
      type: "spring",
      duration: 0.4,
      bounce: 0.15,
      restDelta: 0.001,
      onComplete: settle,
    });
  };

  // Past the ends of a non-looping wheel the drum keeps following the
  // finger, but less and less, then springs back on release.
  const withOverscroll = (raw: number) => {
    if (loop) {
      return raw;
    }
    if (raw < 0) {
      return -damp(-raw, MAX_OVERSCROLL);
    }
    if (raw > count - 1) {
      return count - 1 + damp(raw - (count - 1), MAX_OVERSCROLL);
    }
    return raw;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    animation.current?.stop();
    animation.current = null;
    pointerType.current = event.pointerType;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      startPosition: position.get(),
      moved: false,
      samples: [{ t: event.timeStamp, v: position.get() }],
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.abs(dy) < TAP_SLOP) {
      return;
    }
    current.moved = true;
    const raw = current.startPosition - dy / ITEM_HEIGHT;
    position.set(withOverscroll(raw));
    current.samples.push({ t: event.timeStamp, v: raw });
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

    if (!current.moved) {
      // A tap: turn to the row under the finger. asin undoes the drum's
      // foreshortening, so rows near the edges are hit accurately too.
      const rect = event.currentTarget.getBoundingClientRect();
      const offsetY = event.clientY - (rect.top + rect.height / 2);
      const ratio = Math.max(-1, Math.min(1, offsetY / RADIUS));
      const rows = Math.round((Math.asin(ratio) * 180) / Math.PI / ITEM_ANGLE);
      goTo(clampIndex(Math.round(position.get()) + rows));
      return;
    }

    const first = current.samples[0];
    const last = current.samples.at(-1) ?? first;
    const elapsed = (last.t - first.t) / 1000;
    // Holding still before letting go is a placement, not a flick.
    const paused = event.timeStamp - last.t > VELOCITY_WINDOW_MS;
    const velocity = elapsed > 0 && !paused ? (last.v - first.v) / elapsed : 0;
    const p = position.get();
    const outOfBounds = !loop && (p < 0 || p > count - 1);

    if (reduceMotion || outOfBounds || Math.abs(velocity) < 2) {
      goTo(clampIndex(Math.round(p)));
      return;
    }
    // A flick spins the drum, slows down, and lands exactly on a row. On a
    // non-looping wheel it bounces off the end if it runs out of options.
    animation.current?.stop();
    // Project where the flick would coast to, land that on a whole row,
    // then spring there carrying the release velocity. Critically damped, so
    // it decelerates smoothly; past a non-looping end it overshoots slightly
    // and settles back, which reads as a bounce.
    const target = clampIndex(Math.round(p + velocity * COAST));
    animation.current = animate(position, target, {
      type: "spring",
      velocity,
      stiffness: 140,
      damping: 24,
      restDelta: 0.005,
      onComplete: settle,
    });
  };

  // Keyboard steps are instant: they repeat quickly, and a spin per press
  // would always be a step behind.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = Math.round(position.get());
    const moves: Record<string, number> = {
      ArrowUp: 1,
      ArrowDown: -1,
      PageUp: 5,
      PageDown: -5,
    };
    let target: number;
    if (event.key === "Home") {
      target = index - mod(index, count);
    } else if (event.key === "End") {
      target = index - mod(index, count) + count - 1;
    } else if (event.key in moves) {
      target = clampIndex(index + moves[event.key]);
    } else {
      return;
    }
    event.preventDefault();
    animation.current?.stop();
    pointerType.current = "keyboard";
    position.jump(target);
    settle();
  };

  // Wheel and trackpad scrolling turn the drum, then it settles on the
  // nearest row once the scrolling stops. The listener is attached once and
  // reads the latest props through a ref, so a re-render mid-scroll (the
  // drum crossing a row) can't drop the pending settle.
  const wheel = useRef({ loop, count, goTo, clampIndex });
  wheel.current = { loop, count, goTo, clampIndex };
  useEffect(() => {
    const node = columnRef.current;
    if (!node) {
      return;
    }
    let timer: number | undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const latest = wheel.current;
      animation.current?.stop();
      animation.current = null;
      pointerType.current = "mouse";
      const raw = position.get() + (event.deltaY / ITEM_HEIGHT) * 0.4;
      position.set(
        latest.loop
          ? raw
          : Math.min(Math.max(raw, -0.4), latest.count - 1 + 0.4)
      );
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const settled = wheel.current;
        settled.goTo(settled.clampIndex(Math.round(position.get())));
      }, 120);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      window.clearTimeout(timer);
    };
  }, [position]);

  const rows: number[] = [];
  for (let i = center - WINDOW; i <= center + WINDOW; i++) {
    if (loop || (i >= 0 && i < count)) {
      rows.push(i);
    }
  }

  return (
    <div
      aria-label={column.label}
      aria-valuemax={count - 1}
      aria-valuemin={0}
      aria-valuenow={selectedIndex}
      aria-valuetext={options[selectedIndex]?.label}
      className={cn(
        "relative cursor-grab touch-none rounded-lg outline-none active:cursor-grabbing",
        "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset",
        column.className ?? "w-16"
      )}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={columnRef}
      role="spinbutton"
      style={{ height: VIEW_HEIGHT }}
      tabIndex={0}
    >
      {/* The fade sits on an inner layer so the focus ring stays crisp. */}
      <div
        className="absolute inset-0"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, #000 34%, #000 66%, transparent)",
        }}
      >
        <Drum
          drum={drum}
          optionAt={optionAt}
          rowClassName="text-zinc-400 dark:text-zinc-500"
          rows={rows}
        />
        <Drum
          clip
          drum={drum}
          optionAt={optionAt}
          rowClassName="font-medium text-zinc-900 dark:text-zinc-50"
          rows={rows}
        />
      </div>
    </div>
  );
}

function Drum({
  drum,
  rows,
  optionAt,
  rowClassName,
  clip = false,
}: {
  drum: MotionValue<string>;
  rows: number[];
  optionAt: (index: number) => WheelOption;
  rowClassName: string;
  clip?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        perspective: 1000,
        clipPath: clip
          ? `inset(calc(50% - ${ITEM_HEIGHT / 2}px) 0 calc(50% - ${ITEM_HEIGHT / 2}px) 0)`
          : undefined,
      }}
    >
      <motion.div
        className="absolute inset-x-0 top-1/2"
        style={{ transform: drum, transformStyle: "preserve-3d" }}
      >
        {rows.map((index) => (
          <div
            className={cn(
              "absolute inset-x-0 flex items-center justify-center text-xl tabular-nums [backface-visibility:hidden]",
              rowClassName
            )}
            key={index}
            style={{
              top: -ITEM_HEIGHT / 2,
              height: ITEM_HEIGHT,
              transform: `rotateX(${-index * ITEM_ANGLE}deg) translateZ(${RADIUS}px)`,
            }}
          >
            {optionAt(index).label}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
