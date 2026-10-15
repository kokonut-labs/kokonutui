"use client";

/**
 * @author: @dorianbaffier
 * @description: Rotary Dial
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Delete } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Drawn in a 240 × 240 box. Angles are degrees clockwise from 12 o'clock,
// which is also the way SVG's rotate() turns, since y points down.
const SIZE = 240;
const C = SIZE / 2;
const PLATE_R = 119;
const WHEEL_R = 112;
const WHEEL_INNER_R = 52;
const RING_R = 84;
const HOLE_R = 17;
// Finger holes sit 30° apart. Hole 1 is closest to the stop and 0 is the
// farthest, so a 0 winds the wheel almost all the way round.
const SPACING = 30;
const FIRST_HOLE = 60;
const FINGER_STOP = FIRST_HOLE + 60;
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
// The governor lets the wheel run home at one steady speed (deg/s), after a
// short spin-up, which is what gives dialing its rhythm.
const GOVERNOR = 400;
const SPIN_UP = 0.07;
// Typed digits wind the wheel themselves, and run home faster.
const WIND_SPEED = 260;
const KEYBOARD_PACE = 1.8;
// Close enough to the stop to count as dialed (deg).
const STOP_SLACK = 2;
// The wheel knocks against its rest and comes back this share of its speed.
const REBOUND = 0.07;
const SETTLE_STIFFNESS = 900;
const SETTLE_DAMPING = 38;
// Pointer movement this close to the centre gives wild angle jumps.
const DEAD_ZONE = 22;
const DIGIT_KEY = /^[0-9]$/;

type Phase = "idle" | "drag" | "wind" | "return" | "settle";

const round = (n: number) => Math.round(n * 100) / 100;

function polar(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: round(C + radius * Math.sin(rad)),
    y: round(C - radius * Math.cos(rad)),
  };
}

function slotTone(done: boolean, current: boolean, filled: boolean) {
  if (done) {
    return "border-emerald-500/60 text-emerald-600 dark:border-emerald-400/50 dark:text-emerald-400";
  }
  // Pulses counting up in the current slot show grey until they land.
  const text = filled
    ? "text-zinc-900 dark:text-zinc-100"
    : "text-zinc-400 dark:text-zinc-500";
  const border = current
    ? "border-zinc-900 dark:border-zinc-100"
    : "border-zinc-200 dark:border-zinc-800";
  return `${border} ${text}`;
}

const holeAngle = (hole: number) => FIRST_HOLE - hole * SPACING;
// How far a hole turns before the finger meets the stop.
const travelOf = (hole: number) => FINGER_STOP - holeAngle(hole);

function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

const HOLES = DIGITS.map((digit, hole) => ({
  digit,
  hole,
  ...polar(holeAngle(hole), RING_R),
}));

// One path, filled even-odd, so the holes and the centre are cut out.
const WHEEL_PATH = [
  circle(C, C, WHEEL_R),
  circle(C, C, WHEEL_INNER_R),
  ...HOLES.map((h) => circle(h.x, h.y, HOLE_R)),
].join("");

// Direction the stop gets knocked: along the wheel's turn at the stop.
const KNOCK = {
  x: round(Math.cos((FINGER_STOP * Math.PI) / 180) * 1.6),
  y: round(Math.sin((FINGER_STOP * Math.PI) / 180) * 1.6),
};

export interface RotaryDialProps {
  /** How many digits make a full code. */
  length?: number;
  /** Called with the code so far, after every digit and deletion. */
  onChange?: (code: string) => void;
  /** Called once the last digit is dialed. */
  onComplete?: (code: string) => void;
  /** Read out with the dial, for screen readers. */
  label?: string;
  className?: string;
}

export default function RotaryDial({
  length = 4,
  onChange,
  onComplete,
  label = "Code",
  className,
}: RotaryDialProps) {
  const [code, setCode] = useState("");
  // Pulses counted so far while the wheel runs home.
  const [pulses, setPulses] = useState(0);
  const [activeHole, setActiveHole] = useState(-1);
  const [hint, setHint] = useState(false);
  const done = code.length >= length;

  const svgRef = useRef<SVGSVGElement>(null);
  const wheelRef = useRef<SVGGElement>(null);
  const stopRef = useRef<SVGGElement>(null);
  const hintTimer = useRef(0);
  const callbacks = useRef({ onChange, onComplete, length });
  callbacks.current = { onChange, onComplete, length };

  const sim = useRef({
    phase: "idle" as Phase,
    rot: 0,
    speed: 0,
    hole: -1,
    armed: false,
    lastAngle: 0,
    pointerId: -1,
    fromKeyboard: false,
    queue: [] as number[],
    pulses: 0,
    raf: 0,
    last: 0,
    reduceMotion: false,
  });

  const slots = useMemo(
    () => Array.from({ length }, (_, i) => `slot-${i + 1}`),
    [length]
  );

  const draw = useCallback(() => {
    wheelRef.current?.setAttribute(
      "transform",
      `rotate(${sim.current.rot.toFixed(2)} ${C} ${C})`
    );
  }, []);

  const knock = useCallback(() => {
    stopRef.current?.animate?.(
      [
        { transform: "translate(0px, 0px)" },
        { transform: `translate(${KNOCK.x}px, ${KNOCK.y}px)` },
        { transform: "translate(0px, 0px)" },
      ],
      { duration: 140, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );
  }, []);

  const codeRef = useRef("");
  const update = useCallback((next: string) => {
    const {
      length: max,
      onChange: change,
      onComplete: complete,
    } = callbacks.current;
    if (next === codeRef.current) {
      return;
    }
    codeRef.current = next;
    setCode(next);
    change?.(next);
    if (next.length === max) {
      complete?.(next);
    }
  }, []);

  const commit = useCallback(
    (hole: number) => {
      const prev = codeRef.current;
      // A finished code clears when the next digit comes in.
      update(
        (prev.length >= callbacks.current.length ? "" : prev) + DIGITS[hole]
      );
    },
    [update]
  );

  // Starting a new code once the last one is complete.
  const clearIfDone = useCallback(() => {
    if (codeRef.current.length >= callbacks.current.length) {
      update("");
    }
  }, [update]);

  const setPulseCount = useCallback((count: number) => {
    const s = sim.current;
    if (s.pulses !== count) {
      s.pulses = count;
      setPulses(count);
    }
  }, []);

  const startNext = useRef<() => void>(() => undefined);

  // Typed digits: the wheel winds itself, easing into the stop like a
  // finger slowing as it gets there.
  const stepWind = useCallback(
    (dt: number) => {
      const s = sim.current;
      const travel = travelOf(s.hole);
      const left = travel - s.rot;
      s.rot = Math.min(travel, s.rot + Math.max(WIND_SPEED, left * 16) * dt);
      if (s.rot >= travel) {
        s.armed = true;
        knock();
        s.phase = "return";
        s.speed = 0;
      }
    },
    [knock]
  );

  const stepReturn = useCallback(
    (dt: number) => {
      const s = sim.current;
      const travel = travelOf(s.hole);
      const top = GOVERNOR * (s.fromKeyboard ? KEYBOARD_PACE : 1);
      s.speed = Math.min(top, s.speed + (top / SPIN_UP) * dt);
      s.rot -= s.speed * dt;
      if (s.armed) {
        // One pulse for every 30° run home, 10 for a zero.
        const count = Math.min(
          s.hole + 1,
          Math.floor((travel - Math.max(s.rot, 0)) / SPACING)
        );
        setPulseCount(count);
      }
      if (s.rot > 0) {
        return;
      }
      s.rot = 0;
      if (s.armed) {
        commit(s.hole);
      }
      s.armed = false;
      setPulseCount(0);
      setActiveHole(-1);
      s.phase = "settle";
      s.speed *= REBOUND;
    },
    [commit, setPulseCount]
  );

  const stepSettle = useCallback((dt: number) => {
    const s = sim.current;
    s.speed += (-s.rot * SETTLE_STIFFNESS - s.speed * SETTLE_DAMPING) * dt;
    s.rot += s.speed * dt;
    if (Math.abs(s.rot) < 0.02 && Math.abs(s.speed) < 0.5) {
      s.rot = 0;
      s.speed = 0;
      s.phase = "idle";
    }
  }, []);

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const dt = s.last ? Math.min((now - s.last) / 1000, 0.04) : 1 / 60;
      s.last = now;
      if (s.phase === "wind") {
        stepWind(dt);
      } else if (s.phase === "return") {
        stepReturn(dt);
      } else if (s.phase === "settle") {
        stepSettle(dt);
      }
      draw();
      if (s.phase === "idle") {
        s.last = 0;
        startNext.current();
        return;
      }
      if (s.phase !== "drag") {
        s.raf = requestAnimationFrame(tick);
      }
    },
    [draw, stepReturn, stepSettle, stepWind]
  );

  const run = useCallback(() => {
    const s = sim.current;
    if (!s.raf) {
      s.last = 0;
      s.raf = requestAnimationFrame(tick);
    }
  }, [tick]);

  startNext.current = () => {
    const s = sim.current;
    const hole = s.queue.shift();
    if (hole === undefined) {
      return;
    }
    s.hole = hole;
    s.armed = false;
    s.fromKeyboard = true;
    s.phase = "wind";
    clearIfDone();
    setActiveHole(hole);
    run();
  };

  useEffect(() => {
    const s = sim.current;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.reduceMotion = query.matches;
    const onChange = () => {
      s.reduceMotion = query.matches;
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      window.clearTimeout(hintTimer.current);
    };
  }, []);

  const toLocal = (event: PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: C, y: C };
    }
    return {
      x: ((event.clientX - rect.left) * SIZE) / rect.width,
      y: ((event.clientY - rect.top) * SIZE) / rect.height,
    };
  };

  const angleOf = (p: { x: number; y: number }) =>
    (Math.atan2(p.x - C, C - p.y) * 180) / Math.PI;

  const holeAt = (p: { x: number; y: number }) => {
    const rot = sim.current.rot;
    for (const h of HOLES) {
      const at = polar(holeAngle(h.hole) + rot, RING_R);
      if (Math.hypot(p.x - at.x, p.y - at.y) <= HOLE_R + 5) {
        return h.hole;
      }
    }
    return -1;
  };

  const showHint = () => {
    setHint(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), 1800);
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const s = sim.current;
    // A wheel that's still running home can't be caught, same as a real one.
    if (s.phase !== "idle" && s.phase !== "settle") {
      return;
    }
    const p = toLocal(event);
    const hole = holeAt(p);
    if (hole < 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    cancelAnimationFrame(s.raf);
    s.raf = 0;
    s.phase = "drag";
    s.hole = hole;
    s.armed = false;
    s.fromKeyboard = false;
    s.rot = Math.max(0, s.rot);
    s.speed = 0;
    s.pointerId = event.pointerId;
    s.lastAngle = angleOf(p);
    clearIfDone();
    setActiveHole(hole);
    setHint(false);
  };

  // A grab cursor over the holes, so it's clear where to put a finger.
  const showGrab = (
    event: PointerEvent<SVGSVGElement>,
    p: { x: number; y: number }
  ) => {
    if (sim.current.phase === "idle" && event.pointerType === "mouse") {
      event.currentTarget.style.cursor = holeAt(p) >= 0 ? "grab" : "";
    }
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const s = sim.current;
    const p = toLocal(event);
    if (s.phase !== "drag" || event.pointerId !== s.pointerId) {
      showGrab(event, p);
      return;
    }
    if (Math.hypot(p.x - C, p.y - C) < DEAD_ZONE) {
      return;
    }
    const angle = angleOf(p);
    // Unwrapped, so crossing 6 o'clock doesn't jump a whole turn.
    const delta = ((angle - s.lastAngle + 540) % 360) - 180;
    s.lastAngle = angle;
    const travel = travelOf(s.hole);
    // Only clockwise, and only as far as the stop.
    s.rot = Math.min(travel, Math.max(0, s.rot + delta));
    if (!s.armed && s.rot >= travel - STOP_SLACK) {
      s.armed = true;
      knock();
    } else if (s.armed && s.rot < travel - 12) {
      s.armed = false;
    }
    draw();
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const s = sim.current;
    if (s.phase !== "drag" || event.pointerId !== s.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    s.pointerId = -1;
    if (!s.armed && s.rot > 20) {
      showHint();
    }
    if (s.reduceMotion) {
      if (s.armed) {
        commit(s.hole);
      }
      s.rot = 0;
      s.armed = false;
      s.phase = "idle";
      setActiveHole(-1);
      draw();
      return;
    }
    s.phase = "return";
    s.speed = 0;
    run();
  };

  const deleteLast = () => {
    update(codeRef.current.slice(0, -1));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (DIGIT_KEY.test(event.key)) {
      event.preventDefault();
      const hole = event.key === "0" ? 9 : Number(event.key) - 1;
      if (s.reduceMotion) {
        commit(hole);
        return;
      }
      s.queue.push(hole);
      if (s.phase === "idle" || s.phase === "settle") {
        s.phase = "idle";
        startNext.current();
      }
    } else if (event.key === "Backspace") {
      event.preventDefault();
      deleteLast();
    } else if (event.key === "Escape" && code) {
      event.preventDefault();
      update("");
    }
  };

  const pulseChar = pulses === 10 ? "0" : String(pulses);
  const dialing = !done && pulses > 0;

  return (
    <div
      className={cn("flex w-60 select-none flex-col items-center", className)}
    >
      <output
        aria-label={`${label}, ${code.length} of ${length} digits`}
        aria-live="polite"
        className="flex gap-2"
      >
        {slots.map((id, i) => {
          const char =
            code[i] ?? (i === code.length && dialing ? pulseChar : "");
          const current = i === code.length && !done;
          return (
            <span
              aria-hidden="true"
              className={cn(
                "flex h-12 w-10 items-center justify-center rounded-lg border bg-white font-medium text-lg tabular-nums transition-colors duration-200 ease-out dark:bg-zinc-950",
                slotTone(done, current, i < code.length)
              )}
              key={id}
            >
              {char}
            </span>
          );
        })}
      </output>

      <p
        aria-live="polite"
        className={cn(
          "mt-2 h-4 text-xs text-zinc-500 transition-opacity duration-200 ease-out dark:text-zinc-400",
          hint ? "opacity-100" : "opacity-0"
        )}
      >
        {hint ? "Turn all the way to the stop" : ""}
      </p>

      {/* biome-ignore lint/a11y/useSemanticElements: a focusable dial that takes typed digits, not a form group */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: digits dial and Backspace deletes while it has focus */}
      <div
        aria-label={`${label} dial. Type digits to dial, Backspace to delete.`}
        aria-roledescription="rotary dial"
        className="relative mt-3 aspect-square w-full rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
        onKeyDown={handleKeyDown}
        role="group"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the dial takes typed digits while focused
        tabIndex={0}
      >
        <svg
          aria-hidden="true"
          className="block size-full touch-none"
          onLostPointerCapture={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
        >
          {/* The plate, with the digits you see through the holes. */}
          <circle
            className="fill-zinc-100 stroke-zinc-200 dark:fill-zinc-800 dark:stroke-zinc-700"
            cx={C}
            cy={C}
            r={PLATE_R}
            strokeWidth={1}
          />
          {HOLES.map((h) => (
            <text
              className="fill-zinc-900 font-medium dark:fill-zinc-100"
              dominantBaseline="central"
              fontSize={17}
              key={h.digit}
              textAnchor="middle"
              x={h.x}
              y={h.y}
            >
              {h.digit}
            </text>
          ))}

          {/* The finger wheel. */}
          <g ref={wheelRef}>
            <path
              className="fill-zinc-900 dark:fill-zinc-950"
              d={WHEEL_PATH}
              fillRule="evenodd"
            />
            <circle
              className="fill-none stroke-white/10"
              cx={C}
              cy={C}
              r={WHEEL_R - 0.75}
              strokeWidth={1.5}
            />
            {HOLES.map((h) => (
              <circle
                className={cn(
                  "fill-none transition-[stroke] duration-150 ease-out",
                  activeHole === h.hole
                    ? "stroke-zinc-400 dark:stroke-zinc-500"
                    : "stroke-zinc-700 dark:stroke-zinc-800"
                )}
                cx={h.x}
                cy={h.y}
                key={h.digit}
                r={HOLE_R - 0.75}
                strokeWidth={1.5}
              />
            ))}
          </g>

          {/* The finger stop. */}
          <g ref={stopRef}>
            <g transform={`rotate(${FINGER_STOP} ${C} ${C})`}>
              <rect
                className="fill-zinc-300 stroke-zinc-400 dark:fill-zinc-400 dark:stroke-zinc-500"
                height={30}
                rx={5}
                strokeWidth={1}
                width={10}
                x={C - 5}
                y={C - PLATE_R + 1}
              />
              <circle
                className="fill-zinc-400 dark:fill-zinc-500"
                cx={C}
                cy={C - PLATE_R + 7}
                r={2}
              />
            </g>
          </g>

          {/* The centre card. */}
          <circle
            className="fill-zinc-100 dark:fill-zinc-800"
            cx={C}
            cy={C}
            r={WHEEL_INNER_R - 1}
          />
        </svg>

        <button
          aria-label="Delete last digit"
          className="absolute top-1/2 left-1/2 flex size-[36.6%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 outline-none transition-colors duration-150 ease-out hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 active:bg-zinc-50 disabled:text-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:disabled:text-zinc-600 dark:active:bg-zinc-800 dark:hover:text-zinc-100"
          disabled={!code}
          onClick={deleteLast}
          tabIndex={-1}
          type="button"
        >
          <Delete className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
