"use client";

/**
 * @author: @dorianbaffier
 * @description: Liquid Gauge
 * @version: 1.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// The surface is a row of columns joined by springs. Each column bobs
// around the fill line and pulls on its neighbours, so a push travels.
const COLUMNS = 28;
// Simulation, in px and seconds, on a fixed step.
const STEP = 1 / 120;
const SPREAD = 2600;
const RESTORE = 18;
const SURFACE_DAMPING = 2.2;
// The fill line follows the value on an underdamped spring, so a big change
// overshoots a little and settles, like a poured glass.
const LEVEL_STIFFNESS = 90;
const LEVEL_DAMPING = 11;
// How hard a sideways drag rocks the liquid, and how hard the pointer
// stirs it when moving through it.
const SLOSH = 4.5;
const STIR = 20;
const MAX_WAVE = 26;
// The meniscus: a lighter band riding just above the surface.
const RIM = 3;
// Bubbles rise while the level is climbing.
const BUBBLES = 10;
const BUBBLE_RATE = 0.06;
const REST_EPSILON = 0.02;

export interface LiquidGaugeProps {
  /** Controlled fill, 0 to 100. */
  value?: number;
  /** Initial fill when uncontrolled. */
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Turns the gauge into a read-only display. */
  readOnly?: boolean;
  label?: string;
  /** Capacity shown in the subline, in `unit`. */
  total?: number;
  unit?: string;
  /** From this fill on, the liquid turns red. */
  warnAt?: number;
  className?: string;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
  alive: boolean;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(6);
  }
}

function surfacePolygon(
  heights: Float64Array,
  levelY: number,
  width: number,
  height: number,
  lift: number
) {
  let points = "";
  for (let i = 0; i < COLUMNS; i++) {
    const x = (i / (COLUMNS - 1)) * width;
    const y = clamp(levelY + heights[i] - lift, -40, height + 40);
    points += `${x.toFixed(1)}px ${y.toFixed(1)}px,`;
  }
  return `polygon(${points}${width}px ${height + 40}px,0px ${height + 40}px)`;
}

function flatPolygon(value: number, lift = 0) {
  const top = 100 - value;
  return `polygon(0% calc(${top}% - ${lift}px),100% calc(${top}% - ${lift}px),100% 100%,0% 100%)`;
}

function drawBubbles(
  bubbles: Bubble[],
  nodes: (HTMLSpanElement | null)[],
  time: number
) {
  bubbles.forEach((bubble, i) => {
    const node = nodes[i];
    if (!node) {
      return;
    }
    if (!bubble.alive) {
      node.style.opacity = "0";
      return;
    }
    const sway = Math.sin(time * 7 + bubble.phase) * 2.5;
    node.style.opacity = "1";
    node.style.transform = `translate3d(${(bubble.x + sway - bubble.r).toFixed(1)}px,${(bubble.y - bubble.r).toFixed(1)}px,0) scale(${(bubble.r / 4).toFixed(3)})`;
  });
}

function setText(nodes: (HTMLSpanElement | null)[], text: string) {
  for (const node of nodes) {
    if (node) {
      node.textContent = text;
    }
  }
}

function GaugeText({
  label,
  status,
  value,
  used,
  total,
  unit,
  percentRef,
  usedRef,
}: {
  label: string;
  status: string;
  value: number;
  used: string;
  total: number;
  unit: string;
  percentRef: (node: HTMLSpanElement | null) => void;
  usedRef: (node: HTMLSpanElement | null) => void;
}) {
  return (
    <>
      <div className="absolute inset-x-0 top-0 p-6">
        <p className="font-medium text-sm">{label}</p>
        <p className="mt-3 font-semibold text-6xl tabular-nums tracking-tight">
          <span ref={percentRef}>{Math.round(value)}</span>
          <span className="ml-0.5 font-medium text-3xl opacity-60">%</span>
        </p>
        <p className="mt-1 text-sm tabular-nums opacity-60">
          <span ref={usedRef}>{used}</span> of {total} {unit} used
        </p>
      </div>
      <p className="absolute bottom-6 left-6 font-medium text-sm">{status}</p>
      {/* Every ten percent, a short tick on the right wall. */}
      <div className="absolute inset-y-0 right-0 w-4">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((tick) => (
          <span
            className={cn(
              "absolute right-0 h-px bg-current opacity-30",
              tick === 50 ? "w-3" : "w-1.5"
            )}
            key={tick}
            style={{ top: `${100 - tick}%` }}
          />
        ))}
      </div>
    </>
  );
}

export default function LiquidGauge({
  value: valueProp,
  defaultValue = 72,
  onValueChange,
  readOnly = false,
  label = "Storage",
  total = 128,
  unit = "GB",
  warnAt = 90,
  className,
}: LiquidGaugeProps) {
  const [internal, setInternal] = useState(defaultValue);
  const value = clamp(valueProp ?? internal, 0, 100);
  const [dragging, setDragging] = useState(false);
  // The level, its readout and the surface are written by the simulation;
  // React renders them once, from the first value, and leaves them alone.
  const [initial] = useState(value);

  const rootRef = useRef<HTMLDivElement>(null);
  const liquidRef = useRef<HTMLDivElement>(null);
  const rimRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const percentRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const usedRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const sim = useRef({
    heights: new Float64Array(COLUMNS),
    speeds: new Float64Array(COLUMNS),
    level: value,
    levelSpeed: 0,
    target: value,
    width: 0,
    height: 0,
    bubbles: Array.from(
      { length: BUBBLES },
      (): Bubble => ({ x: 0, y: 0, r: 0, speed: 0, phase: 0, alive: false })
    ),
    spawn: 0,
    shown: Math.round(value),
    raf: 0,
    last: 0,
    carry: 0,
    time: 0,
    pointerX: -1,
    pointerId: -1,
    visible: true,
    reduceMotion: false,
  });

  // Read inside the animation loop, which outlives the render it came from.
  const totalRef = useRef(total);

  const setValue = useCallback(
    (next: number) => {
      const rounded = Math.round(clamp(next, 0, 100));
      if (valueProp === undefined) {
        setInternal(rounded);
      }
      onValueChange?.(rounded);
    },
    [valueProp, onValueChange]
  );

  const draw = useCallback(() => {
    const s = sim.current;
    const { width, height } = s;
    if (!(width && height)) {
      return;
    }
    const levelY = height * (1 - s.level / 100);
    if (liquidRef.current) {
      liquidRef.current.style.clipPath = surfacePolygon(
        s.heights,
        levelY,
        width,
        height,
        0
      );
    }
    if (rimRef.current) {
      rimRef.current.style.clipPath = surfacePolygon(
        s.heights,
        levelY,
        width,
        height,
        RIM
      );
    }
    drawBubbles(s.bubbles, bubbleRefs.current, s.time);
    const shown = Math.round(clamp(s.level, 0, 100));
    if (shown !== s.shown) {
      s.shown = shown;
      const used = ((shown / 100) * totalRef.current).toFixed(1);
      setText(percentRefs.current, String(shown));
      setText(usedRefs.current, used);
    }
  }, []);

  const spawnBubbles = useCallback((dt: number) => {
    const s = sim.current;
    // Only a climbing level makes bubbles, more the faster it climbs.
    s.spawn += Math.max(0, s.levelSpeed) * BUBBLE_RATE * dt;
    while (s.spawn >= 1) {
      s.spawn -= 1;
      const free = s.bubbles.find((b) => !b.alive);
      if (!free) {
        s.spawn = 0;
        break;
      }
      free.alive = true;
      free.x = s.width * (0.12 + Math.random() * 0.76);
      free.y = s.height - 6;
      free.r = 1.5 + Math.random() * 2.5;
      free.speed = 70 + Math.random() * 80;
      free.phase = Math.random() * Math.PI * 2;
    }
  }, []);

  const advanceBubbles = useCallback((dt: number) => {
    const s = sim.current;
    const levelY = s.height * (1 - s.level / 100);
    const column = (x: number) =>
      clamp(Math.round((x / s.width) * (COLUMNS - 1)), 0, COLUMNS - 1);
    let alive = 0;
    for (const bubble of s.bubbles) {
      if (!bubble.alive) {
        continue;
      }
      bubble.y -= bubble.speed * dt;
      const i = column(bubble.x);
      // At the surface it pops, and leaves a tiny dimple behind.
      if (bubble.y - bubble.r <= levelY + s.heights[i]) {
        bubble.alive = false;
        s.speeds[i] += bubble.r * 6;
      } else {
        alive++;
      }
    }
    return alive;
  }, []);

  const step = useCallback(() => {
    const s = sim.current;
    const { heights, speeds } = s;
    // Fill line spring.
    const force =
      (s.target - s.level) * LEVEL_STIFFNESS - s.levelSpeed * LEVEL_DAMPING;
    s.levelSpeed += force * STEP;
    s.level += s.levelSpeed * STEP;
    // Surface springs, with walls that reflect.
    let energy = Math.abs(s.target - s.level) + Math.abs(s.levelSpeed) * 0.1;
    for (let i = 0; i < COLUMNS; i++) {
      const left = heights[i > 0 ? i - 1 : i];
      const right = heights[i < COLUMNS - 1 ? i + 1 : i];
      const accel =
        (left + right - 2 * heights[i]) * SPREAD -
        heights[i] * RESTORE -
        speeds[i] * SURFACE_DAMPING;
      speeds[i] += accel * STEP;
    }
    for (let i = 0; i < COLUMNS; i++) {
      heights[i] = clamp(heights[i] + speeds[i] * STEP, -MAX_WAVE, MAX_WAVE);
      energy = Math.max(
        energy,
        Math.abs(heights[i]),
        Math.abs(speeds[i]) * 0.1
      );
    }
    s.time += STEP;
    return energy;
  }, []);

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const elapsed = s.last ? Math.min((now - s.last) / 1000, 0.05) : STEP;
      s.last = now;
      s.carry += elapsed;
      let energy = 0;
      while (s.carry >= STEP) {
        energy = Math.max(energy, step());
        s.carry -= STEP;
      }
      spawnBubbles(elapsed);
      const bubbles = advanceBubbles(elapsed);
      draw();
      const busy = s.pointerId >= 0 || bubbles > 0 || energy > REST_EPSILON;
      if (busy && s.visible) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.last = 0;
        if (!busy) {
          // Settle exactly, so the resting surface is flat.
          s.level = s.target;
          s.levelSpeed = 0;
          s.heights.fill(0);
          s.speeds.fill(0);
          draw();
        }
      }
    },
    [advanceBubbles, draw, spawnBubbles, step]
  );

  const wake = useCallback(() => {
    const s = sim.current;
    if (!s.raf && s.visible) {
      s.raf = requestAnimationFrame(tick);
    }
  }, [tick]);

  // A new capacity rewrites the readout even when the level stays put.
  useEffect(() => {
    totalRef.current = total;
    sim.current.shown = -1;
    draw();
  }, [total, draw]);

  // A new value: the spring takes it from here.
  useEffect(() => {
    const s = sim.current;
    if (s.target === value) {
      return;
    }
    s.target = value;
    if (s.reduceMotion) {
      s.level = value;
      s.levelSpeed = 0;
      draw();
      return;
    }
    wake();
  }, [value, draw, wake]);

  useEffect(() => {
    const s = sim.current;
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.reduceMotion = motion.matches;
    const onMotion = () => {
      s.reduceMotion = motion.matches;
    };
    motion.addEventListener("change", onMotion);

    const resize = new ResizeObserver(([entry]) => {
      s.width = entry.contentRect.width;
      s.height = entry.contentRect.height;
      draw();
    });
    resize.observe(root);

    // Offscreen or in a background tab, the loop waits.
    const pause = () => {
      if (!s.visible && s.raf) {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
        s.last = 0;
      } else if (s.visible) {
        wake();
      }
    };
    let onScreen = true;
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      s.visible = onScreen && !document.hidden;
      pause();
    });
    intersection.observe(root);
    const onVisibility = () => {
      s.visible = onScreen && !document.hidden;
      pause();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      motion.removeEventListener("change", onMotion);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [draw, wake]);

  const valueAt = (clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) {
      return value;
    }
    return (1 - (clientY - rect.top) / rect.height) * 100;
  };

  // Push the columns around x by `amount`, fading out over a few columns.
  const disturb = (clientX: number, amount: number, reach = 3) => {
    const s = sim.current;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || s.reduceMotion) {
      return;
    }
    const center = ((clientX - rect.left) / rect.width) * (COLUMNS - 1);
    for (let i = 0; i < COLUMNS; i++) {
      const falloff = 1 - Math.abs(i - center) / reach;
      if (falloff > 0) {
        s.speeds[i] += amount * falloff;
      }
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (readOnly || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    const s = sim.current;
    event.currentTarget.setPointerCapture(event.pointerId);
    s.pointerId = event.pointerId;
    s.pointerX = event.clientX;
    setDragging(true);
    // The press itself lands like a drop.
    disturb(event.clientX, 260, 2.5);
    setValue(valueAt(event.clientY));
    wake();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    const dx = s.pointerX < 0 ? 0 : event.clientX - s.pointerX;
    s.pointerX = event.clientX;
    if (s.reduceMotion) {
      if (s.pointerId === event.pointerId) {
        setValue(valueAt(event.clientY));
      }
      return;
    }
    if (s.pointerId === event.pointerId) {
      // A sideways drag rocks the whole body: one side rises, the other
      // falls, and the springs carry it back and forth.
      for (let i = 0; i < COLUMNS; i++) {
        s.speeds[i] += ((i / (COLUMNS - 1)) * 2 - 1) * dx * SLOSH;
      }
      setValue(valueAt(event.clientY));
      wake();
      return;
    }
    // Hovering through the liquid stirs it, behind the cursor.
    const rect = rootRef.current?.getBoundingClientRect();
    if (event.pointerType !== "mouse" || !rect || dx === 0) {
      return;
    }
    const levelY = rect.height * (1 - s.level / 100);
    if (event.clientY - rect.top > levelY + 8) {
      disturb(event.clientX, Math.abs(dx) * STIR, 2);
      wake();
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.pointerId !== event.pointerId) {
      return;
    }
    s.pointerId = -1;
    setDragging(false);
    haptic();
    wake();
  };

  const handlePointerLeave = () => {
    if (sim.current.pointerId < 0) {
      sim.current.pointerX = -1;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) {
      return;
    }
    const steps: Record<string, number> = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 10,
      PageDown: -10,
    };
    let next: number | undefined;
    if (event.key in steps) {
      next = value + steps[event.key] * (event.shiftKey ? 10 : 1);
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = 100;
    }
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    // A keyed change still lands with a small ripple.
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      disturb(rect.left + rect.width / 2, next > value ? 120 : -120, 4);
    }
    setValue(next);
    wake();
  };

  const warn = value >= warnAt;
  const status = warn ? "Almost full" : `${100 - Math.round(value)}% free`;
  const used = ((Math.round(value) / 100) * total).toFixed(1);
  const textProps = {
    label,
    status,
    value: initial,
    used: ((Math.round(initial) / 100) * total).toFixed(1),
    total,
    unit,
  };

  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-readonly={readOnly || undefined}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(value)}%, ${used} of ${total} ${unit} used`}
      className={cn(
        "relative h-[22.5rem] w-72 touch-none select-none overflow-hidden rounded-3xl border border-zinc-200 bg-white text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
        !readOnly && (dragging ? "cursor-grabbing" : "cursor-ns-resize"),
        className
      )}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={rootRef}
      role="slider"
      tabIndex={readOnly ? -1 : 0}
    >
      <GaugeText
        {...textProps}
        percentRef={(node) => {
          percentRefs.current[0] = node;
        }}
        usedRef={(node) => {
          usedRefs.current[0] = node;
        }}
      />

      {/* The meniscus, a lighter band just above the liquid. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 transition-colors duration-300 ease-out",
          warn ? "bg-red-300 dark:bg-red-900" : "bg-zinc-300 dark:bg-zinc-600"
        )}
        ref={rimRef}
        style={{ clipPath: flatPolygon(initial, RIM) }}
      />

      {/* The liquid, with a second copy of the text in its own colour. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 transition-colors duration-300 ease-out",
          warn
            ? "bg-red-500 text-white"
            : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        )}
        ref={liquidRef}
        style={{ clipPath: flatPolygon(initial) }}
      >
        <GaugeText
          {...textProps}
          percentRef={(node) => {
            percentRefs.current[1] = node;
          }}
          usedRef={(node) => {
            usedRefs.current[1] = node;
          }}
        />
        {Array.from({ length: BUBBLES }, (_, i) => (
          <span
            className="absolute top-0 left-0 size-2 rounded-full border border-current bg-current/20 opacity-0"
            key={`bubble-${i.toString()}`}
            ref={(node) => {
              bubbleRefs.current[i] = node;
            }}
          />
        ))}
      </div>
    </div>
  );
}
