"use client";

/**
 * @author: @dorianbaffier
 * @description: Liquid Slider
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
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const WIDTH = 280;
const HEIGHT = 360;
// The glass is a cylinder seen from a little above: its rim and floor are
// ellipses RY tall, its walls run from LEFT to RIGHT.
const LEFT = 84;
const RIGHT = 196;
const CX = (LEFT + RIGHT) / 2;
const RADIUS = (RIGHT - LEFT) / 2;
const RY = 9;
const RIM_Y = 104;
const FLOOR_Y = 312;
// Where the surface sits when the glass is empty and when it is full.
const EMPTY_Y = FLOOR_Y;
const FULL_Y = RIM_Y + 16;

// The surface is a row of columns that each bob up and down and pull on
// their neighbours: a 1D wave. Heights in px, time in seconds.
const COLUMNS = 34;
const STEP = 1 / 120;
const SPREAD = 2600;
const TENSION = 30;
const DAMPING = 2.4;
// Neighbouring columns drag on each other's speed, which smooths out
// the short, jagged ripples and leaves the long sloshes.
const VISCOSITY = 22;
const MAX_WAVE = 16;
// While dragging, the surface under the finger is pulled towards it this
// hard, and the finger's sideways speed piles the liquid up ahead of it.
const GRAB = 900;
const GRAB_REACH = 2.6;
const GRAB_MAX = 14;
const STIR = 0.55;
// The level chases its target on a spring: fast, but not instant, so a quick
// drag leaves the liquid behind the finger for a moment.
const LEVEL_STIFFNESS = 220;
const LEVEL_DAMPING = 26;
const MAX_BUBBLES = 14;
const REST_EPSILON = 0.02;

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(4);
  }
}

// How far in front of / behind the centre line the surface ellipse reaches at
// each column, precomputed and rounded so server and browser markup match.
const COLUMN_X: number[] = [];
const DEPTH: number[] = [];
for (let i = 0; i < COLUMNS; i++) {
  const t = i / (COLUMNS - 1);
  const x = LEFT + t * (RIGHT - LEFT);
  COLUMN_X.push(Math.round(x * 100) / 100);
  const u = (x - CX) / RADIUS;
  DEPTH.push(Math.round(RY * Math.sqrt(Math.max(0, 1 - u * u)) * 100) / 100);
}

function levelToY(level: number) {
  return EMPTY_Y - level * (EMPTY_Y - FULL_Y);
}

function f(n: number) {
  return n.toFixed(2);
}

/** The top of the liquid: from the back edge across, then the front back. */
function surfacePath(levelY: number, heights: Float64Array) {
  let d = "";
  for (let i = 0; i < COLUMNS; i++) {
    const y = Math.min(levelY + heights[i] - DEPTH[i], FLOOR_Y);
    d += `${i === 0 ? "M" : "L"}${f(COLUMN_X[i])} ${f(y)}`;
  }
  for (let i = COLUMNS - 1; i >= 0; i--) {
    const y = Math.min(levelY + heights[i] + DEPTH[i], FLOOR_Y + DEPTH[i]);
    d += `L${f(COLUMN_X[i])} ${f(y)}`;
  }
  return `${d}Z`;
}

/** The body: the front edge of the surface, down the wall, along the floor. */
function bodyPath(levelY: number, heights: Float64Array) {
  let d = "";
  for (let i = 0; i < COLUMNS; i++) {
    const y = Math.min(levelY + heights[i] + DEPTH[i], FLOOR_Y + DEPTH[i]);
    d += `${i === 0 ? "M" : "L"}${f(COLUMN_X[i])} ${f(y)}`;
  }
  d += `L${RIGHT} ${FLOOR_Y} A${RADIUS} ${RY} 0 0 1 ${LEFT} ${FLOOR_Y}Z`;
  return d;
}

/** A thin line along the front lip, where light catches the surface. */
function lipPath(levelY: number, heights: Float64Array) {
  let d = "";
  for (let i = 1; i < COLUMNS - 1; i++) {
    const y = Math.min(levelY + heights[i] + DEPTH[i], FLOOR_Y + DEPTH[i]);
    d += `${i === 1 ? "M" : "L"}${f(COLUMN_X[i])} ${f(y)}`;
  }
  return d;
}

/** Surface height (px from the level) at an x, between two columns. */
function heightAt(heights: Float64Array, x: number) {
  const t = clamp((x - LEFT) / (RIGHT - LEFT), 0, 1) * (COLUMNS - 1);
  const i = Math.floor(t);
  const j = Math.min(i + 1, COLUMNS - 1);
  return heights[i] + (heights[j] - heights[i]) * (t - i);
}

const FLAT = new Float64Array(COLUMNS);

export interface LiquidSliderProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Shown after the number. */
  unit?: string;
  label?: string;
  /** Formats the readout and `aria-valuetext`. */
  formatValue?: (value: number) => string;
  className?: string;
}

const defaultFormat = (value: number) => value.toLocaleString("en-US");

export default function LiquidSlider({
  value: valueProp,
  defaultValue = 1250,
  onValueChange,
  min = 0,
  max = 2000,
  step = 50,
  unit = "ml",
  label = "Water today",
  formatValue = defaultFormat,
  className,
}: LiquidSliderProps) {
  const [internal, setInternal] = useState(defaultValue);
  const value = clamp(valueProp ?? internal, min, max);
  const [dragging, setDragging] = useState(false);
  const labelId = useId();

  const surfaceRef = useRef<SVGPathElement>(null);
  const bodyRef = useRef<SVGPathElement>(null);
  const lipRef = useRef<SVGPathElement>(null);
  const bubblesRef = useRef<(SVGCircleElement | null)[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const fraction = (max - min > 0 ? (value - min) / (max - min) : 0) || 0;
  const initialY = levelToY(fraction);

  const sim = useRef({
    heights: new Float64Array(COLUMNS),
    speeds: new Float64Array(COLUMNS),
    accels: new Float64Array(COLUMNS),
    level: fraction,
    levelSpeed: 0,
    target: fraction,
    bubbles: [] as Bubble[],
    raf: 0,
    last: 0,
    carry: 0,
    // Pointer, while held: where it is, in drawing units, and its sideways
    // speed.
    held: false,
    pointerId: -1,
    px: 0,
    py: 0,
    pvx: 0,
    lastPx: 0,
    lastT: 0,
    reduceMotion: false,
    seed: 1,
  });

  // Handlers outlive the render they came from; read the props here.
  const latest = useRef({ value, min, max, step, onValueChange });
  latest.current = { value, min, max, step, onValueChange };

  const commit = useCallback(
    (next: number) => {
      const { min: lo, max: hi, step: inc } = latest.current;
      const snapped = clamp(
        Number((Math.round((next - lo) / inc) * inc + lo).toFixed(10)),
        lo,
        hi
      );
      if (snapped === latest.current.value) {
        return;
      }
      // A light tick each time the level crosses a quarter.
      const quarter = (hi - lo) / 4;
      if (
        Math.floor((snapped - lo) / quarter) !==
        Math.floor((latest.current.value - lo) / quarter)
      ) {
        haptic();
      }
      latest.current.value = snapped;
      if (valueProp === undefined) {
        setInternal(snapped);
      }
      latest.current.onValueChange?.(snapped);
    },
    [valueProp]
  );

  const random = useCallback(() => {
    // Deterministic, so bubbles never depend on Math.random during render.
    const s = sim.current;
    s.seed = (s.seed * 16_807) % 2_147_483_647;
    return s.seed / 2_147_483_647;
  }, []);

  const draw = useCallback(() => {
    const s = sim.current;
    const y = levelToY(s.level);
    surfaceRef.current?.setAttribute("d", surfacePath(y, s.heights));
    bodyRef.current?.setAttribute("d", bodyPath(y, s.heights));
    lipRef.current?.setAttribute("d", lipPath(y, s.heights));
    for (let i = 0; i < MAX_BUBBLES; i++) {
      const el = bubblesRef.current[i];
      const b = s.bubbles[i];
      if (!el) {
        continue;
      }
      if (b) {
        const wobble = Math.sin(b.phase) * 1.6;
        el.setAttribute("cx", f(b.x + wobble));
        el.setAttribute("cy", f(b.y));
        el.setAttribute("r", f(b.r));
        el.style.opacity = "1";
      } else {
        el.style.opacity = "0";
      }
    }
  }, []);

  // The level rides a spring towards its target. When it rises fast, the
  // pour drags bubbles in from the floor.
  const stepLevel = useCallback(() => {
    const s = sim.current;
    const force =
      (s.target - s.level) * LEVEL_STIFFNESS - s.levelSpeed * LEVEL_DAMPING;
    s.levelSpeed += force * STEP;
    s.level += s.levelSpeed * STEP;
    if (
      s.levelSpeed > 0.5 &&
      s.bubbles.length < MAX_BUBBLES &&
      random() < s.levelSpeed * 0.05
    ) {
      s.bubbles.push({
        x: LEFT + 10 + random() * (RIGHT - LEFT - 20),
        y: FLOOR_Y + 2,
        r: 1.2 + random() * 2,
        speed: 40 + random() * 50,
        phase: random() * Math.PI * 2,
      });
    }
  }, [random]);

  // One step of the wave: each column accelerates towards its neighbours'
  // average and back to rest, then the volume is re-levelled so the waves
  // only move liquid around.
  const stepWaves = useCallback(() => {
    const s = sim.current;
    const { heights: h, speeds: v, accels: a } = s;
    const levelY = levelToY(s.level);
    let mean = 0;
    for (let i = 0; i < COLUMNS; i++) {
      const l = i === 0 ? 0 : i - 1;
      const r = i === COLUMNS - 1 ? i : i + 1;
      let accel =
        SPREAD * (h[l] + h[r] - 2 * h[i]) +
        VISCOSITY * (v[l] + v[r] - 2 * v[i]) -
        TENSION * h[i] -
        DAMPING * v[i];
      if (s.held) {
        const reach = (COLUMN_X[i] - s.px) / ((RIGHT - LEFT) / COLUMNS);
        const weight = Math.exp(-(reach * reach) / (GRAB_REACH * GRAB_REACH));
        const pull = clamp(s.py - (levelY + h[i]), -GRAB_MAX, GRAB_MAX);
        accel += GRAB * pull * weight * 0.05;
        accel -= STIR * s.pvx * ((i - (COLUMNS - 1) / 2) / COLUMNS) * 60;
      }
      a[i] = accel;
    }
    for (let i = 0; i < COLUMNS; i++) {
      v[i] += a[i] * STEP;
      h[i] = clamp(h[i] + v[i] * STEP, -MAX_WAVE, MAX_WAVE);
      mean += h[i];
    }
    mean /= COLUMNS;
    let energy = 0;
    for (let i = 0; i < COLUMNS; i++) {
      h[i] -= mean;
      energy += Math.abs(h[i]) + Math.abs(v[i]) * STEP;
    }
    return energy / COLUMNS;
  }, []);

  // Bubbles rise with a wobble and pop at the surface, leaving a ripple.
  const stepBubbles = useCallback(() => {
    const s = sim.current;
    const levelY = levelToY(s.level);
    for (let i = s.bubbles.length - 1; i >= 0; i--) {
      const b = s.bubbles[i];
      b.y -= b.speed * STEP;
      b.phase += STEP * 9;
      if (b.y <= levelY + heightAt(s.heights, b.x) + 1) {
        const col = Math.round(((b.x - LEFT) / (RIGHT - LEFT)) * (COLUMNS - 1));
        s.speeds[clamp(col, 0, COLUMNS - 1)] -= 30 * b.r;
        s.bubbles.splice(i, 1);
      }
    }
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
        stepLevel();
        energy = stepWaves();
        stepBubbles();
        s.carry -= STEP;
      }
      // The sideways speed fades when the pointer stops moving.
      s.pvx *= 0.85;
      draw();
      const settled =
        !s.held &&
        energy < REST_EPSILON &&
        Math.abs(s.target - s.level) < 0.0005 &&
        Math.abs(s.levelSpeed) < 0.001 &&
        s.bubbles.length === 0;
      if (settled) {
        s.level = s.target;
        s.heights.fill(0);
        s.speeds.fill(0);
        s.last = 0;
        draw();
        return;
      }
      s.raf = requestAnimationFrame(tick);
    },
    [draw, stepBubbles, stepLevel, stepWaves]
  );

  const wake = useCallback(() => {
    const s = sim.current;
    if (s.reduceMotion) {
      s.level = s.target;
      s.levelSpeed = 0;
      s.heights.fill(0);
      s.speeds.fill(0);
      s.bubbles.length = 0;
      draw();
      return;
    }
    if (!s.raf) {
      s.raf = requestAnimationFrame(tick);
    }
  }, [draw, tick]);

  useEffect(() => {
    const s = sim.current;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.reduceMotion = query.matches;
    const onChange = () => {
      s.reduceMotion = query.matches;
    };
    query.addEventListener("change", onChange);
    // Pause while the tab is hidden; the loop picks up again on return.
    const onVisibility = () => {
      if (document.hidden && s.raf) {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
        s.last = 0;
      } else if (!document.hidden) {
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      query.removeEventListener("change", onChange);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [wake]);

  // A value set from outside (a controlled prop, or a keypress) moves the
  // target; the liquid follows on its own.
  useEffect(() => {
    const s = sim.current;
    if (s.held) {
      return;
    }
    if (Math.abs(s.target - fraction) > 1e-6) {
      s.target = fraction;
      wake();
    }
  }, [fraction, wake]);

  const localPoint = (event: PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const follow = (event: PointerEvent) => {
    const s = sim.current;
    const point = localPoint(event);
    const now = event.timeStamp;
    if (s.lastT && now > s.lastT) {
      const vx = ((point.x - s.lastPx) / (now - s.lastT)) * 1000;
      s.pvx = s.pvx * 0.6 + clamp(vx, -900, 900) * 0.4;
    }
    s.lastPx = point.x;
    s.lastT = now;
    s.px = clamp(point.x, LEFT, RIGHT);
    s.py = clamp(point.y, FULL_Y, EMPTY_Y);
    const raw = clamp((EMPTY_Y - point.y) / (EMPTY_Y - FULL_Y), 0, 1);
    s.target = raw;
    const { min: lo, max: hi } = latest.current;
    commit(lo + raw * (hi - lo));
    wake();
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    const s = sim.current;
    // A second finger mid-drag is ignored rather than jumping the level.
    if (s.held) {
      return;
    }
    event.preventDefault();
    // Focus without scrolling, so the keyboard picks up where the hand left.
    (event.currentTarget.parentElement as HTMLElement | null)?.focus({
      preventScroll: true,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    s.held = true;
    s.pointerId = event.pointerId;
    s.lastT = 0;
    s.pvx = 0;
    setDragging(true);
    follow(event);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const s = sim.current;
    if (s.held && s.pointerId === event.pointerId) {
      follow(event);
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const s = sim.current;
    if (!s.held || s.pointerId !== event.pointerId) {
      return;
    }
    s.held = false;
    setDragging(false);
    // Settle on the step the readout shows.
    const { value: v, min: lo, max: hi } = latest.current;
    s.target = hi - lo > 0 ? (v - lo) / (hi - lo) : 0;
    wake();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { min: lo, max: hi, step: inc } = latest.current;
    const big = Math.max(inc, (hi - lo) / 10);
    const moves: Record<string, number> = {
      ArrowUp: value + inc,
      ArrowRight: value + inc,
      ArrowDown: value - inc,
      ArrowLeft: value - inc,
      PageUp: value + big,
      PageDown: value - big,
      Home: lo,
      End: hi,
    };
    const next = Object.hasOwn(moves, event.key) ? moves[event.key] : null;
    if (next === null) {
      return;
    }
    event.preventDefault();
    commit(next);
    // A drop in the middle, so the key gets a ripple too.
    const s = sim.current;
    if (!s.reduceMotion) {
      s.speeds[Math.floor(COLUMNS / 2)] += next > value ? -90 : 90;
      wake();
    }
  };

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const initialSurface = surfacePath(initialY, FLAT);
  const initialBody = bodyPath(initialY, FLAT);
  const initialLip = lipPath(initialY, FLAT);

  return (
    <div
      aria-labelledby={labelId}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      aria-valuetext={`${formatValue(value)} ${unit}`.trim()}
      className={cn(
        "relative select-none overflow-hidden rounded-3xl border border-zinc-200 bg-white text-zinc-900 outline-none focus-visible:outline-2 focus-visible:outline-zinc-400 focus-visible:outline-offset-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      onKeyDown={handleKeyDown}
      role="slider"
      style={{ width: WIDTH, height: HEIGHT }}
      tabIndex={0}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 p-6">
        <p className="text-sm text-zinc-500" id={labelId}>
          {label}
        </p>
        <p className="mt-0.5 font-medium text-2xl tabular-nums tracking-tight">
          {formatValue(value)}
          <span className="ml-1 text-base text-zinc-400">{unit}</span>
        </p>
      </div>

      <svg
        aria-hidden="true"
        className={cn(
          "absolute inset-0 touch-none",
          dragging ? "cursor-grabbing" : "cursor-grab"
        )}
        height={HEIGHT}
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
      >
        <defs>
          <clipPath id={`${labelId}-glass`}>
            <path
              d={`M${LEFT} ${RIM_Y} L${RIGHT} ${RIM_Y} L${RIGHT} ${FLOOR_Y} A${RADIUS} ${RY} 0 0 1 ${LEFT} ${FLOOR_Y} Z`}
            />
          </clipPath>
        </defs>

        {/* The back of the glass. */}
        <path
          className="fill-zinc-50 dark:fill-zinc-900/60"
          d={`M${LEFT} ${RIM_Y} A${RADIUS} ${RY} 0 0 1 ${RIGHT} ${RIM_Y} L${RIGHT} ${FLOOR_Y} A${RADIUS} ${RY} 0 0 1 ${LEFT} ${FLOOR_Y} Z`}
        />
        <path
          className="fill-none stroke-zinc-200 dark:stroke-zinc-800"
          d={`M${LEFT} ${FLOOR_Y} A${RADIUS} ${RY} 0 0 1 ${RIGHT} ${FLOOR_Y}`}
          strokeWidth={1}
        />

        <g clipPath={`url(#${labelId}-glass)`}>
          <path className="fill-sky-500" d={initialBody} ref={bodyRef} />
          {Array.from({ length: MAX_BUBBLES }, (_, i) => (
            <circle
              className="fill-white/25 stroke-white/70"
              cx={CX}
              cy={FLOOR_Y}
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed pool of circles reused by index
              key={i}
              r={1}
              ref={(el) => {
                bubblesRef.current[i] = el;
              }}
              strokeWidth={0.75}
              style={{ opacity: 0 }}
            />
          ))}
          <path
            className="fill-sky-300 dark:fill-sky-400"
            d={initialSurface}
            ref={surfaceRef}
          />
          <path
            className="fill-none stroke-white/60"
            d={initialLip}
            ref={lipRef}
            strokeLinecap="round"
            strokeWidth={1}
          />
        </g>

        {/* Graduations, printed on the front of the glass. */}
        {ticks.map((t) => {
          const y = Math.round(levelToY(t) + RY * 0.55);
          const tickValue = min + t * (max - min);
          return (
            <g key={t}>
              <line
                className="stroke-zinc-900/25 dark:stroke-white/30"
                strokeWidth={1}
                x1={RIGHT - 14}
                x2={RIGHT - 4}
                y1={y}
                y2={y}
              />
              <text
                className="fill-zinc-400 text-[10px] tabular-nums dark:fill-zinc-500"
                dominantBaseline="middle"
                x={RIGHT + 8}
                y={y}
              >
                {formatValue(tickValue)}
              </text>
            </g>
          );
        })}

        {/* The glass itself: rim, walls and the front of the floor. */}
        <ellipse
          className="fill-none stroke-zinc-300 dark:stroke-zinc-700"
          cx={CX}
          cy={RIM_Y}
          rx={RADIUS}
          ry={RY}
          strokeWidth={1.5}
        />
        <path
          className="fill-none stroke-zinc-300 dark:stroke-zinc-700"
          d={`M${LEFT} ${RIM_Y} L${LEFT} ${FLOOR_Y} A${RADIUS} ${RY} 0 0 0 ${RIGHT} ${FLOOR_Y} L${RIGHT} ${RIM_Y}`}
          strokeWidth={1.5}
        />
        {/* A strip of reflection down the left wall. */}
        <line
          className="stroke-white/50 dark:stroke-white/10"
          strokeLinecap="round"
          strokeWidth={3}
          x1={LEFT + 9}
          x2={LEFT + 9}
          y1={RIM_Y + 22}
          y2={FLOOR_Y - 14}
        />
      </svg>
    </div>
  );
}
