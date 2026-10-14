"use client";

/**
 * @author: @dorianbaffier
 * @description: Signature Pad
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

// The pen tip trails the pointer on a spring, which irons out the jitter of
// a hand on a trackpad and gives strokes the swing of real ink. Units are
// px and seconds; the simulation runs at a fixed step.
const STEP = 1 / 240;
const TIP_STIFFNESS = 2600;
const TIP_DAMPING = 78;
// Line width follows speed, like a nib: slow is heavy, fast is light.
const MAX_WIDTH = 3.6;
const MIN_WIDTH = 1.1;
const SPEED_FOR_MIN = 1800;
const WIDTH_EASE = 0.08;
// A new point is laid down once the tip has moved this far.
const MIN_GAP = 0.6;
// Strokes start and end thin, over this many points.
const TAPER = 7;
const CLEAR_MS = 420;
// Ballpoint blue. In dark mode the canvas is inverted and hue-rotated, which
// keeps it blue and makes it light.
const INK = "#1e3a8a";

interface Point {
  x: number;
  y: number;
  w: number;
}

type Stroke = Point[];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Width at point i of a stroke, thinned at both ends. */
function taperedWidth(stroke: Stroke, i: number, open: boolean) {
  const n = stroke.length;
  const start = Math.min(1, (i + 1) / TAPER);
  const end = open ? 1 : Math.min(1, (n - i) / TAPER);
  return stroke[i].w * (0.35 + 0.65 * Math.min(start, end));
}

/** Adds a quad to the path, wound the same way as `arc`, so one fill unions them. */
function quad(ctx: CanvasRenderingContext2D, pts: number[]) {
  let area = 0;
  for (let k = 0; k < 8; k += 2) {
    const j = (k + 2) % 8;
    area += pts[k] * pts[j + 1] - pts[j] * pts[k + 1];
  }
  const order = area >= 0 ? [0, 2, 4, 6] : [6, 4, 2, 0];
  ctx.moveTo(pts[order[0]], pts[order[0] + 1]);
  for (let k = 1; k < 4; k++) {
    ctx.lineTo(pts[order[k]], pts[order[k] + 1]);
  }
  ctx.closePath();
}

/**
 * Draws points [from, to) of a stroke as rounded segments, filled as one
 * shape so the joins don't show seams.
 */
function paint(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  from: number,
  to: number,
  open: boolean
) {
  ctx.beginPath();
  for (let i = Math.max(from, 0); i < to; i++) {
    const p = stroke[i];
    // A lone dot gets a little more ink than a taper would give it.
    const w =
      stroke.length === 1 && !open ? p.w * 0.8 : taperedWidth(stroke, i, open);
    if (i > 0) {
      const q = stroke[i - 1];
      const qw = taperedWidth(stroke, i - 1, open);
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      quad(ctx, [
        q.x + (nx * qw) / 2,
        q.y + (ny * qw) / 2,
        p.x + (nx * w) / 2,
        p.y + (ny * w) / 2,
        p.x - (nx * w) / 2,
        p.y - (ny * w) / 2,
        q.x - (nx * qw) / 2,
        q.y - (ny * qw) / 2,
      ]);
    }
    ctx.moveTo(p.x + w / 2, p.y);
    ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** The signature as standalone SVG, one filled outline per stroke. */
function toSvg(strokes: Stroke[], width: number, height: number) {
  const paths = strokes
    .map((stroke) => {
      if (stroke.length === 1) {
        const [p] = stroke;
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(p.w * 0.4).toFixed(2)}"/>`;
      }
      const left: string[] = [];
      const right: string[] = [];
      for (let i = 0; i < stroke.length; i++) {
        const p = stroke[i];
        const q = stroke[Math.max(i - 1, 0)];
        const r = stroke[Math.min(i + 1, stroke.length - 1)];
        const dx = r.x - q.x;
        const dy = r.y - q.y;
        const len = Math.hypot(dx, dy) || 1;
        const w = taperedWidth(stroke, i, false) / 2;
        left.push(
          `${(p.x - (dy / len) * w).toFixed(1)} ${(p.y + (dx / len) * w).toFixed(1)}`
        );
        right.push(
          `${(p.x + (dy / len) * w).toFixed(1)} ${(p.y - (dx / len) * w).toFixed(1)}`
        );
      }
      return `<path d="M${left.join("L")}L${right.reverse().join("L")}Z"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" fill="${INK}">${paths}</svg>`;
}

export interface SignaturePadProps {
  /** Called after each stroke, undo or clear, with the signature as SVG, or null once it's empty. */
  onChange?: (svg: string | null) => void;
  /** Accessible name of the drawing area. */
  label?: string;
  className?: string;
}

export default function SignaturePad({
  onChange,
  label = "Signature",
  className,
}: SignaturePadProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const sim = useRef({
    strokes: [] as Stroke[],
    // Points of the current stroke already on the canvas.
    painted: 0,
    held: false,
    pressure: 0.5,
    usesPressure: false,
    targetX: 0,
    targetY: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    width: MAX_WIDTH,
    raf: 0,
    last: 0,
    carry: 0,
    reduceMotion: false,
    size: { width: 0, height: 0 },
  });

  const latest = useRef({ onChange });
  latest.current = { onChange };

  const context = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = INK;
    }
    return ctx ?? null;
  }, []);

  /** Repaints every stroke, or only the first `fraction` of all the ink. */
  const redraw = useCallback(
    (fraction = 1) => {
      const ctx = context();
      const s = sim.current;
      if (!ctx) {
        return;
      }
      ctx.clearRect(0, 0, s.size.width, s.size.height);
      const total = s.strokes.reduce((sum, st) => sum + st.length, 0);
      let budget = Math.round(total * fraction);
      for (let k = 0; k < s.strokes.length && budget > 0; k++) {
        const stroke = s.strokes[k];
        const open = s.held && k === s.strokes.length - 1;
        paint(ctx, stroke, 0, Math.min(stroke.length, budget), open);
        budget -= stroke.length;
      }
    },
    [context]
  );

  const emit = useCallback(() => {
    const s = sim.current;
    setCount(s.strokes.length);
    latest.current.onChange?.(
      s.strokes.length ? toSvg(s.strokes, s.size.width, s.size.height) : null
    );
  }, []);

  // Size the canvas to its box at the screen's pixel density.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!(wrap && canvas)) {
      return;
    }
    const s = sim.current;
    const fitCanvas = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      s.size = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };
    fitCanvas();
    const observer = new ResizeObserver(fitCanvas);
    observer.observe(wrap);
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.reduceMotion = query.matches;
    const onMotion = () => {
      s.reduceMotion = query.matches;
    };
    query.addEventListener("change", onMotion);
    return () => {
      observer.disconnect();
      query.removeEventListener("change", onMotion);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [redraw]);

  // One step of the pen: the tip springs towards the pointer, and lays down
  // a point when it has travelled far enough, sized by its speed.
  const stepPen = useCallback(() => {
    const s = sim.current;
    const ax = (s.targetX - s.x) * TIP_STIFFNESS - s.vx * TIP_DAMPING;
    const ay = (s.targetY - s.y) * TIP_STIFFNESS - s.vy * TIP_DAMPING;
    s.vx += ax * STEP;
    s.vy += ay * STEP;
    s.x += s.vx * STEP;
    s.y += s.vy * STEP;
    const speed = Math.hypot(s.vx, s.vy);
    const pressure = s.usesPressure ? 0.45 + s.pressure * 0.9 : 1;
    const goal =
      (MAX_WIDTH -
        (MAX_WIDTH - MIN_WIDTH) * clamp(speed / SPEED_FOR_MIN, 0, 1)) *
      pressure;
    s.width += (goal - s.width) * WIDTH_EASE;
    const stroke = s.strokes.at(-1);
    const prev = stroke?.at(-1);
    if (stroke && prev && Math.hypot(s.x - prev.x, s.y - prev.y) >= MIN_GAP) {
      stroke.push({ x: s.x, y: s.y, w: s.width });
    }
    return speed;
  }, []);

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const elapsed = s.last ? Math.min((now - s.last) / 1000, 0.05) : STEP;
      s.last = now;
      s.carry += elapsed;
      let speed = 0;
      while (s.carry >= STEP) {
        speed = stepPen();
        s.carry -= STEP;
      }
      const ctx = context();
      const stroke = s.strokes.at(-1);
      if (ctx && stroke) {
        // Only the new ink; the point before it is repainted to join up.
        paint(ctx, stroke, s.painted - 1, stroke.length, true);
        s.painted = stroke.length;
      }
      const caughtUp =
        Math.hypot(s.targetX - s.x, s.targetY - s.y) < 0.3 && speed < 5;
      if (s.held || !caughtUp) {
        s.raf = requestAnimationFrame(tick);
        return;
      }
      // The pen has lifted and caught up: close the stroke with its tail
      // taper, and report the signature.
      s.last = 0;
      redraw();
      emit();
    },
    [context, emit, redraw, stepPen]
  );

  const localPoint = (event: PointerEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    return rect
      ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
      : { x: 0, y: 0 };
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const s = sim.current;
    if (clearing || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (s.raf) {
      // Still settling the last stroke: finish it at once.
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.last = 0;
      emit();
    }
    const p = localPoint(event);
    s.held = true;
    s.usesPressure = event.pointerType === "pen";
    s.pressure = event.pressure || 0.5;
    s.x = p.x;
    s.y = p.y;
    s.targetX = p.x;
    s.targetY = p.y;
    s.vx = 0;
    s.vy = 0;
    s.width = MAX_WIDTH;
    s.strokes.push([{ x: p.x, y: p.y, w: MAX_WIDTH }]);
    s.painted = 0;
    redraw();
    setDrawing(true);
    s.raf = requestAnimationFrame(tick);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const s = sim.current;
    if (!s.held) {
      return;
    }
    const p = localPoint(event);
    s.targetX = p.x;
    s.targetY = p.y;
    if (s.usesPressure) {
      s.pressure = event.pressure;
    }
    if (s.reduceMotion) {
      // No trailing tip: the ink goes exactly where the pointer is.
      s.x = p.x;
      s.y = p.y;
      s.vx = 0;
      s.vy = 0;
    }
  };

  const handlePointerUp = () => {
    const s = sim.current;
    if (!s.held) {
      return;
    }
    s.held = false;
    setDrawing(false);
    if (!s.raf) {
      s.raf = requestAnimationFrame(tick);
    }
  };

  const undo = useCallback(() => {
    const s = sim.current;
    if (s.held || !s.strokes.length) {
      return;
    }
    s.strokes.pop();
    redraw();
    emit();
  }, [emit, redraw]);

  // The ink lifts off in the reverse of the order it went down.
  const clear = useCallback(() => {
    const s = sim.current;
    if (s.held || !s.strokes.length) {
      return;
    }
    const done = () => {
      s.strokes = [];
      redraw();
      setClearing(false);
      emit();
    };
    if (s.reduceMotion) {
      done();
      return;
    }
    setClearing(true);
    const start = performance.now();
    const frame = (now: number) => {
      const t = clamp((now - start) / CLEAR_MS, 0, 1);
      // ease-in-out, so the last strokes don't snap away.
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      redraw(1 - eased);
      if (t < 1) {
        s.raf = requestAnimationFrame(frame);
      } else {
        s.raf = 0;
        done();
      }
    };
    s.raf = requestAnimationFrame(frame);
  }, [emit, redraw]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "z" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      undo();
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      clear();
    }
  };

  const empty = count === 0 && !drawing;

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: keyboard shortcuts for undo and clear while the pad has focus
    // biome-ignore lint/a11y/noStaticElementInteractions: as above
    <div
      className={cn(
        "w-full max-w-[380px] select-none overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      onKeyDown={handleKeyDown}
    >
      <div className="relative h-[200px]" ref={wrapRef}>
        {/* The line to sign on. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-12 flex items-end gap-2 border-zinc-300 border-b pb-1.5 dark:border-zinc-700"
        >
          <span className="text-lg text-zinc-400 leading-none dark:text-zinc-600">
            ×
          </span>
          <span
            className={cn(
              "text-sm text-zinc-400 transition-[opacity,filter] duration-200 ease-out dark:text-zinc-600",
              empty ? "opacity-100 blur-0" : "opacity-0 blur-[2px]"
            )}
          >
            Sign here
          </span>
        </div>
        <canvas
          aria-label={`${label}${count ? `, ${count} stroke${count === 1 ? "" : "s"}` : ", empty"}`}
          className={cn(
            "absolute inset-0 h-full w-full touch-none dark:hue-rotate-180 dark:invert",
            "cursor-crosshair"
          )}
          onLostPointerCapture={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={canvasRef}
          role="img"
          tabIndex={0}
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-zinc-200 border-t px-4 py-2.5 dark:border-zinc-800">
        <p aria-live="polite" className="truncate text-sm text-zinc-500">
          {count ? "Signed" : "Draw your signature"}
        </p>
        <div className="flex shrink-0 gap-1">
          <button
            className="rounded-md px-2.5 py-1 text-sm text-zinc-600 transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-zinc-400 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            disabled={!count || clearing}
            onClick={undo}
            type="button"
          >
            Undo
          </button>
          <button
            className="rounded-md px-2.5 py-1 text-sm text-zinc-600 transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-zinc-400 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            disabled={!count || clearing}
            onClick={clear}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
