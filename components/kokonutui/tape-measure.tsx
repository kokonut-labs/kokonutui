"use client";

/**
 * @author: @dorianbaffier
 * @description: Tape Measure
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Drawn in px: the SVG is as wide as its container, 1 unit to 1 px.
const HEIGHT = 128;
const CASE = { x: 2, y: 34, size: 84, radius: 22 };
const MOUTH_X = CASE.x + CASE.size - 4;
const BLADE_Y = 100;
const BLADE_HALF = 10;
const HOOK_W = 5;
// The hook rests just outside the mouth, not inside it.
const HOOK_REST = 5;
const END_GAP = 18;
// The grab area around the hook, mostly on the blade side.
const GRIP = { w: 52, h: 56, left: 34 };
// The spring in the case: a constant pull plus more the further it's out
// (px/s²), capped so a long tape doesn't come back like a bullet.
const PULL = 2600;
const PULL_PER_PX = 7;
const MAX_RETRACT = 2400;
// When the hook hits the case it bounces back out this share of its speed.
const HOOK_BOUNCE = 0.16;
const CASE_KICK = 0.012;
// The blade is a sprung strip: bend it and it twangs back.
const BEND_STIFFNESS = 520;
const BEND_DAMPING = 9;
const MAX_BEND = 26;
const SAMPLES = 28;

type Unit = "cm" | "in";

const UNITS = {
  cm: { max: 100, step: 1, ticks: [1, 5, 10], labels: [10, 20, 50] },
  in: { max: 36, step: 0.125, ticks: [0.125, 0.5, 1], labels: [1, 2, 5] },
} as const;

function format(value: number, unit: Unit) {
  if (unit === "cm") {
    return `${Math.round(value)} cm`;
  }
  const whole = Math.floor(value + 1e-6);
  const eighths = Math.round((value - whole) * 8);
  if (eighths === 0) {
    return `${whole} in`;
  }
  // 2/8 reads as 1/4, and so on.
  let num = eighths;
  let den = 8;
  while (num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  return whole ? `${whole} ${num}/${den} in` : `${num}/${den} in`;
}

function isSettled(s: {
  phase: string;
  bend: number;
  bendSpeed: number;
  caseX: number;
  caseSpeed: number;
  flutter: number;
}) {
  return (
    s.phase === "idle" &&
    Math.abs(s.bend) < 0.05 &&
    Math.abs(s.bendSpeed) < 0.5 &&
    Math.abs(s.caseX) < 0.02 &&
    Math.abs(s.caseSpeed) < 0.2 &&
    s.flutter < 0.05
  );
}

export interface TapeMeasureProps {
  unit?: Unit;
  /** Longest the tape goes, in `unit`s. */
  max?: number;
  /** Smallest step the value snaps to, in `unit`s. */
  step?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** Starts with the lock on, so the tape stays where you leave it. */
  defaultLocked?: boolean;
  className?: string;
}

export default function TapeMeasure({
  unit = "cm",
  max = UNITS[unit].max,
  step = UNITS[unit].step,
  defaultValue = unit === "cm" ? 42 : 16,
  onChange,
  defaultLocked = true,
  className,
}: TapeMeasureProps) {
  const [width, setWidth] = useState(520);
  const [value, setValue] = useState(defaultValue);
  const [locked, setLocked] = useState(defaultLocked);
  const [dragging, setDragging] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const bladeRef = useRef<SVGPathElement>(null);
  const ticksRef = useRef<SVGPathElement>(null);
  const hookRef = useRef<SVGGElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const caseRef = useRef<SVGGElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(SVGTextElement | null)[]>([]);

  const span = Math.max(80, width - MOUTH_X - HOOK_REST - END_GAP);
  const ppu = span / max;
  const minorEvery = UNITS[unit].ticks.find((t) => t * ppu >= 4) ?? 1;
  const labelEvery =
    UNITS[unit].labels.find((l) => l * ppu >= 30) ?? UNITS[unit].labels[2];
  const labelCount = Math.floor(max / labelEvery);

  const sim = useRef({
    phase: "idle" as "idle" | "drag" | "retract" | "snap",
    length: defaultValue * ppu,
    speed: 0,
    target: 0,
    bend: 0,
    bendSpeed: 0,
    flutter: 0,
    time: 0,
    caseX: 0,
    caseSpeed: 0,
    grab: 0,
    grabY: 0,
    pointerId: -1,
    raf: 0,
    last: 0,
    reduceMotion: false,
    value: defaultValue,
  });
  const mid = UNITS[unit].ticks[1];
  const layout = useRef({ ppu, minorEvery, labelEvery, span, mid });
  const callbacks = useRef({ onChange, locked, step, max });
  callbacks.current = { onChange, locked, step, max };

  const emit = useCallback((raw: number) => {
    const { step: st, max: mx, onChange: change } = callbacks.current;
    const next = Math.min(mx, Math.max(0, Math.round(raw / st) * st));
    const s = sim.current;
    if (Math.abs(next - s.value) > 1e-6) {
      s.value = next;
      setValue(next);
      change?.(next);
    }
  }, []);

  const draw = useCallback(() => {
    const s = sim.current;
    const {
      ppu: k,
      minorEvery: minor,
      labelEvery: every,
      mid,
    } = layout.current;
    const len = Math.max(0, s.length);
    const tipX = MOUTH_X + HOOK_REST + len;
    // Tangent is flat at the mouth, so the blade bends like a cantilever.
    const flutterAmp = s.flutter;
    const yAt = (x: number) => {
      const t = (x - MOUTH_X) / (len + HOOK_REST);
      const wave =
        flutterAmp * Math.sin((x - MOUTH_X) * 0.045 + s.time * 38) * t;
      return BLADE_Y + s.bend * t * t + wave;
    };

    let top = "";
    let bottom = "";
    const startX = MOUTH_X - 12;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = startX + ((tipX - startX) * i) / SAMPLES;
      const y = yAt(Math.max(x, MOUTH_X));
      top += `${i ? "L" : "M"}${x.toFixed(1)} ${(y - BLADE_HALF).toFixed(1)}`;
      bottom = `L${x.toFixed(1)} ${(y + BLADE_HALF).toFixed(1)}${bottom}`;
    }
    bladeRef.current?.setAttribute("d", `${top}${bottom}Z`);

    // Zero is at the hook, so the numbers read off the tape at the case.
    let ticks = "";
    const count = Math.floor(len / k / minor + 1e-6);
    for (let i = 1; i <= count; i++) {
      const d = i * minor;
      const x = tipX - d * k;
      if (x < MOUTH_X - 4) {
        break;
      }
      const on = (n: number) => Math.abs(d / n - Math.round(d / n)) < 1e-6;
      let h = 4;
      if (on(every)) {
        h = 9;
      } else if (on(mid)) {
        h = 6.5;
      }
      const y = yAt(x) - BLADE_HALF;
      ticks += `M${x.toFixed(1)} ${y.toFixed(1)}v${h}`;
    }
    ticksRef.current?.setAttribute("d", ticks);

    labelRefs.current.forEach((label, i) => {
      if (!label) {
        return;
      }
      const d = (i + 1) * every;
      const x = tipX - d * k;
      const visible = x - 15 > MOUTH_X;
      label.style.opacity = visible ? "1" : "0";
      if (visible) {
        const y = yAt(x) + 5;
        label.setAttribute("transform", `translate(${x - 2.5} ${y})`);
      }
    });

    const tipY = yAt(tipX);
    hookRef.current?.setAttribute(
      "transform",
      `translate(${tipX.toFixed(1)} ${(tipY - BLADE_Y).toFixed(1)})`
    );
    if (handleRef.current) {
      handleRef.current.style.transform = `translate(${(tipX - GRIP.left).toFixed(1)}px, ${(tipY - GRIP.h / 2).toFixed(1)}px)`;
    }
    caseRef.current?.setAttribute(
      "transform",
      `translate(${s.caseX.toFixed(2)} 0) rotate(${(s.caseX * 0.7).toFixed(2)} ${CASE.x + CASE.size / 2} ${CASE.y + CASE.size})`
    );
    if (readoutRef.current) {
      readoutRef.current.style.transform = `translate(${(tipX + HOOK_W / 2).toFixed(1)}px, ${(tipY - BLADE_Y).toFixed(1)}px) translateX(-50%)`;
      // Tucked away as the hook reaches the case, where it would cover it.
      readoutRef.current.style.opacity = Math.min(
        1,
        Math.max(0, (len - 24) / 28)
      ).toFixed(2);
    }
  }, []);

  // The spring in the case reels the blade in until the hook hits.
  const stepRetract = useCallback(
    (dt: number) => {
      const s = sim.current;
      s.speed = Math.max(
        -MAX_RETRACT,
        s.speed - (PULL + s.length * PULL_PER_PX) * dt
      );
      s.length += s.speed * dt;
      // A fast blade shakes as it runs in.
      s.flutter = Math.min(5, Math.abs(s.speed) / 450);
      if (s.length <= 0) {
        const hit = -s.speed;
        s.length = 0;
        s.caseSpeed -= hit * CASE_KICK * 60;
        if (hit > 120) {
          s.speed = hit * HOOK_BOUNCE;
        } else {
          s.speed = 0;
          s.phase = "idle";
        }
      }
      emit(s.length / layout.current.ppu);
    },
    [emit]
  );

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const dt = s.last ? Math.min((now - s.last) / 1000, 0.032) : 1 / 60;
      s.last = now;
      s.time += dt;

      if (s.phase === "retract") {
        stepRetract(dt);
      } else if (s.phase === "snap") {
        s.length += (s.target - s.length) * (1 - Math.exp(-dt * 22));
        if (Math.abs(s.target - s.length) < 0.1) {
          s.length = s.target;
          s.phase = "idle";
        }
      }

      if (s.phase !== "retract") {
        s.flutter *= Math.exp(-dt * 10);
      }
      if (s.phase !== "drag") {
        s.bendSpeed +=
          (-s.bend * BEND_STIFFNESS - s.bendSpeed * BEND_DAMPING) * dt;
        s.bend += s.bendSpeed * dt;
      }
      s.caseSpeed += (-s.caseX * 700 - s.caseSpeed * 20) * dt;
      s.caseX += s.caseSpeed * dt;

      draw();
      const settled = isSettled(s);
      if (settled) {
        s.bend = 0;
        s.caseX = 0;
        s.flutter = 0;
        s.last = 0;
        draw();
        return;
      }
      if (s.phase !== "drag" || Math.abs(s.caseX) > 0.02) {
        s.raf = requestAnimationFrame(tick);
      }
    },
    [draw, stepRetract]
  );

  const run = useCallback(() => {
    const s = sim.current;
    if (!s.raf) {
      s.last = 0;
      s.raf = requestAnimationFrame(tick);
    }
  }, [tick]);

  const release = useCallback(() => {
    const s = sim.current;
    const { ppu: k } = layout.current;
    const { locked: isLocked, step: st, max: mx } = callbacks.current;
    if (!isLocked) {
      if (s.reduceMotion) {
        s.length = 0;
        s.phase = "idle";
        emit(0);
        draw();
        return;
      }
      s.phase = "retract";
      s.speed = Math.min(0, s.speed);
      run();
      return;
    }
    const v = Math.min(mx, Math.max(0, Math.round(s.length / k / st) * st));
    emit(v);
    s.target = v * k;
    s.phase = s.reduceMotion ? "idle" : "snap";
    if (s.reduceMotion) {
      s.length = s.target;
      s.bend = 0;
      draw();
      return;
    }
    run();
  }, [draw, emit, run]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keeps the reading when the width (and so the scale) changes.
  useLayoutEffect(() => {
    const s = sim.current;
    const old = layout.current.ppu;
    layout.current = { ppu, minorEvery, labelEvery, span, mid };
    if (old !== ppu && s.phase !== "drag") {
      s.length = (s.length / old) * ppu;
      s.target = (s.target / old) * ppu;
    }
    draw();
  }, [ppu, minorEvery, labelEvery, span, mid, draw]);

  useEffect(() => {
    const s = sim.current;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.reduceMotion = query.matches;
    const onMotion = () => {
      s.reduceMotion = query.matches;
    };
    query.addEventListener("change", onMotion);
    return () => {
      query.removeEventListener("change", onMotion);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.pointerId !== -1) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = wrapRef.current?.getBoundingClientRect();
    const x = event.clientX - (rect?.left ?? 0);
    const y = event.clientY - (rect?.top ?? 0);
    s.pointerId = event.pointerId;
    s.phase = "drag";
    // Catching a tape mid-retract stops it dead, like a thumb on the blade.
    s.speed = 0;
    s.grab = x - (MOUTH_X + HOOK_REST + s.length);
    s.grabY = y - s.bend;
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (event.pointerId !== s.pointerId) {
      return;
    }
    const rect = wrapRef.current?.getBoundingClientRect();
    const x = event.clientX - (rect?.left ?? 0);
    const y = event.clientY - (rect?.top ?? 0);
    const { ppu: k } = layout.current;
    const limit = callbacks.current.max * k;
    let len = x - s.grab - MOUTH_X - HOOK_REST;
    // Past the end the tape is out of blade: it gives a little, then stops.
    if (len > limit) {
      len = limit + 14 * (1 - Math.exp(-(len - limit) / 14));
    }
    const prev = s.length;
    s.length = Math.max(0, len);
    s.speed = (s.length - prev) * 60;
    const lift = y - s.grabY;
    s.bend = MAX_BEND * Math.tanh(lift / MAX_BEND);
    s.bendSpeed = 0;
    emit(Math.min(s.length, limit) / k);
    draw();
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (event.pointerId !== s.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    s.pointerId = -1;
    setDragging(false);
    if (s.reduceMotion) {
      s.bend = 0;
    }
    s.phase = "idle";
    release();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const s = sim.current;
    const { ppu: k } = layout.current;
    const big = event.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      next = s.value + step * big;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      next = s.value - step * big;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = max;
    }
    if (next === null) {
      return;
    }
    event.preventDefault();
    next = Math.min(max, Math.max(0, next));
    emit(next);
    // Keys move it straight there: no animation for something repeated.
    s.phase = "idle";
    s.length = next * k;
    s.target = s.length;
    draw();
  };

  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    callbacks.current.locked = next;
    const s = sim.current;
    if (!next && s.phase !== "drag" && s.length > 0) {
      release();
    }
  };

  const labels = Array.from(
    { length: labelCount },
    (_, i) => (i + 1) * labelEvery
  );

  return (
    <div
      className={cn("relative w-full max-w-xl select-none", className)}
      ref={wrapRef}
      style={{ height: HEIGHT }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 overflow-visible"
        height={HEIGHT}
        width={width}
      >
        {/* The blade, its ticks and numbers. */}
        <path
          className="fill-amber-300 stroke-amber-500/50 dark:fill-amber-400 dark:stroke-amber-600/60"
          ref={bladeRef}
          strokeWidth={1}
        />
        <path
          className="fill-none stroke-zinc-900"
          ref={ticksRef}
          strokeWidth={1}
        />
        {labels.map((n, i) => (
          <text
            className="fill-zinc-900 font-medium tabular-nums"
            fontSize={9}
            key={n}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            textAnchor="end"
          >
            {n}
          </text>
        ))}

        {/* The hook. */}
        <g ref={hookRef}>
          <rect
            className="fill-zinc-400 stroke-zinc-500 dark:fill-zinc-500 dark:stroke-zinc-400"
            height={BLADE_HALF * 2 + 16}
            rx={2}
            strokeWidth={1.5}
            width={HOOK_W}
            x={0}
            y={BLADE_Y - BLADE_HALF - 4}
          />
          <circle
            className="fill-zinc-500 dark:fill-zinc-400"
            cx={-5}
            cy={BLADE_Y}
            r={1.5}
          />
        </g>

        {/* The case. */}
        <g ref={caseRef}>
          <rect
            className="fill-zinc-900 dark:fill-zinc-800 dark:stroke-zinc-700"
            height={CASE.size}
            rx={CASE.radius}
            strokeWidth={1}
            width={CASE.size}
            x={CASE.x}
            y={CASE.y}
          />
          <circle
            className="fill-none stroke-zinc-700 dark:stroke-zinc-600"
            cx={CASE.x + CASE.size / 2 - 2}
            cy={CASE.y + CASE.size / 2 + 2}
            r={25}
            strokeWidth={1.5}
          />
          <circle
            className="fill-zinc-700 dark:fill-zinc-600"
            cx={CASE.x + CASE.size / 2 - 2}
            cy={CASE.y + CASE.size / 2 + 2}
            r={4}
          />
          {/* The mouth the blade runs into. */}
          <rect
            className="fill-zinc-800 dark:fill-zinc-700"
            height={BLADE_HALF * 2 + 8}
            rx={3}
            width={10}
            x={MOUTH_X - 6}
            y={BLADE_Y - BLADE_HALF - 4}
          />
        </g>
      </svg>

      {/* The handle: a generous grip around the hook, wider than the hook itself. */}
      <div
        aria-label="Tape length"
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={value}
        aria-valuetext={format(value, unit)}
        className={cn(
          "absolute top-0 left-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
          dragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={handleRef}
        role="slider"
        style={{ width: GRIP.w, height: GRIP.h, touchAction: "none" }}
        tabIndex={0}
      />

      <button
        aria-label="Lock tape"
        aria-pressed={locked}
        className="group/lock absolute flex h-5 w-9 items-start justify-center rounded-full bg-zinc-700 pt-0.5 outline-none transition-colors duration-150 ease-out hover:bg-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:bg-zinc-600 dark:ring-offset-zinc-950 dark:hover:bg-zinc-500"
        onClick={toggleLock}
        style={{ left: CASE.x + 38, top: CASE.y - 8 }}
        type="button"
      >
        <span
          className={cn(
            "h-3 w-5 rounded-full transition-[translate,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
            locked
              ? "translate-y-1 bg-amber-300 dark:bg-amber-400"
              : "translate-y-0 bg-zinc-300 dark:bg-zinc-400"
          )}
        />
      </button>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[54px] left-0 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 font-medium text-white text-xs tabular-nums will-change-transform dark:bg-zinc-100 dark:text-zinc-900"
        ref={readoutRef}
      >
        {format(value, unit)}
      </div>
    </div>
  );
}
