"use client";

/**
 * @author: @dorianbaffier
 * @description: Peel Sticker
 * @version: 1.0.0
 * @date: 2026-10-13
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Copy, RotateCcw } from "lucide-react";
import {
  AnimatePresence,
  animate,
  frame,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
}

// The corner that sits slightly lifted at rest, inviting a peel.
const REST_CORNER = "br";
// How far (px, along the diagonal) the resting corner is curled, and how far
// it lifts when hovered.
const REST_CURL = 46;
const HOVER_CURL = 66;
// Past this share of the diagonal, letting go finishes the peel.
const PEEL_THRESHOLD = 0.5;
// A quick flick (px/s, away from the corner) finishes it whatever the
// distance.
const FLICK_VELOCITY = 900;
const SETTLE = { type: "spring", duration: 0.45, bounce: 0.25 } as const;
const PEEL_OFF = { type: "spring", duration: 0.6, bounce: 0 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type Corner = "tl" | "tr" | "br" | "bl";

const round = (n: number) => Math.round(n * 100) / 100;

function cornerPoint(corner: Corner, size: number): Point {
  return {
    x: corner === "tr" || corner === "br" ? size : 0,
    y: corner === "bl" || corner === "br" ? size : 0,
  };
}

function nearestCorner(point: Point, size: number): Corner {
  const right = point.x > size / 2;
  const bottom = point.y > size / 2;
  if (bottom) {
    return right ? "br" : "bl";
  }
  return right ? "tr" : "tl";
}

function restPoint(corner: Corner, size: number, curl: number): Point {
  const c = cornerPoint(corner, size);
  const towardCenter = curl / Math.SQRT2;
  return {
    x: c.x + (c.x === 0 ? towardCenter : -towardCenter),
    y: c.y + (c.y === 0 ? towardCenter : -towardCenter),
  };
}

/**
 * A flat paper fold. Every point closer to the grabbed corner C than to the
 * pointer P is folded over: the fold line is the perpendicular bisector of
 * C→P. The sticker keeps the far side; the flap is the near side mirrored
 * across the fold line, showing the sticker's back.
 */
function foldGeometry(corner: Point, pointer: Point, size: number) {
  const dx = pointer.x - corner.x;
  const dy = pointer.y - corner.y;
  const length = Math.hypot(dx, dy);
  const square = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
  if (length < 0.5) {
    return { base: square, flap: [] as Point[], matrix: "none" };
  }
  const n = { x: dx / length, y: dy / length };
  const mid = { x: (corner.x + pointer.x) / 2, y: (corner.y + pointer.y) / 2 };
  const side = (p: Point) => (p.x - mid.x) * n.x + (p.y - mid.y) * n.y;

  // Sutherland-Hodgman against a single edge: the fold line.
  const clip = (keep: (d: number) => boolean) => {
    const out: Point[] = [];
    for (let i = 0; i < square.length; i++) {
      const a = square[i];
      const b = square[(i + 1) % square.length];
      const da = side(a);
      const db = side(b);
      if (keep(da)) {
        out.push(a);
      }
      if (keep(da) !== keep(db)) {
        const t = da / (da - db);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return out;
  };

  // Mirror across the fold line through `mid` with direction (dirX, dirY).
  const dirX = -n.y;
  const dirY = n.x;
  const a = dirX * dirX - dirY * dirY;
  const b = 2 * dirX * dirY;
  const d = -a;
  const e = mid.x - (a * mid.x + b * mid.y);
  const f = mid.y - (b * mid.x + d * mid.y);

  return {
    base: clip((dist) => dist >= 0),
    flap: clip((dist) => dist < 0),
    matrix: `matrix(${round(a)}, ${round(b)}, ${round(b)}, ${round(d)}, ${round(e)}, ${round(f)})`,
  };
}

function toPolygon(points: Point[]) {
  if (points.length < 3) {
    return "polygon(0 0, 0 0, 0 0)";
  }
  return `polygon(${points.map((p) => `${round(p.x)}px ${round(p.y)}px`).join(", ")})`;
}

export interface PeelStickerProps {
  /** The sticker's face. */
  children?: ReactNode;
  /** What the sticker hides, shown once it is peeled off. */
  reveal?: ReactNode;
  /** Side of the square sticker, in px. */
  size?: number;
  /** Called when the sticker comes off. */
  onPeel?: () => void;
  className?: string;
}

export default function PeelSticker({
  children,
  reveal,
  size = 240,
  onPeel,
  className,
}: PeelStickerProps) {
  const reduceMotion = useReducedMotion();
  const baseRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const flapInnerRef = useRef<HTMLDivElement>(null);
  const animations = useRef<{ stop: () => void }[]>([]);

  const [peeled, setPeeled] = useState(false);
  const [dragging, setDragging] = useState(false);
  const corner = useRef<Corner>(REST_CORNER);
  const rest = restPoint(REST_CORNER, size, REST_CURL);
  const px = useMotionValue(rest.x);
  const py = useMotionValue(rest.y);
  const drag = useRef<{ id: number; offset: Point; rect: DOMRect } | null>(
    null
  );
  const paintQueued = useRef(false);

  // Clip paths and the flap's mirror transform are written straight to the
  // DOM on every frame of the pointer or spring; nothing re-renders.
  const paint = () => {
    paintQueued.current = false;
    const geometry = foldGeometry(
      cornerPoint(corner.current, size),
      { x: px.get(), y: py.get() },
      size
    );
    if (baseRef.current) {
      baseRef.current.style.clipPath = toPolygon(geometry.base);
    }
    if (flapRef.current && flapInnerRef.current) {
      flapRef.current.style.transform = geometry.matrix;
      flapInnerRef.current.style.clipPath = toPolygon(geometry.flap);
    }
  };
  // x and y both change on every frame; fold once per frame, not once each.
  const schedulePaint = () => {
    if (!paintQueued.current) {
      paintQueued.current = true;
      frame.render(paint);
    }
  };
  useMotionValueEvent(px, "change", schedulePaint);
  useMotionValueEvent(py, "change", schedulePaint);

  const initial = foldGeometry(cornerPoint(REST_CORNER, size), rest, size);

  const stopAll = () => {
    for (const a of animations.current) {
      a.stop();
    }
    animations.current = [];
  };
  useEffect(
    () => () => {
      for (const a of animations.current) {
        a.stop();
      }
    },
    []
  );

  const springTo = (target: Point, transition: object, onDone?: () => void) => {
    stopAll();
    const ax = animate(px, target.x, {
      ...transition,
      velocity: px.getVelocity(),
    });
    const ay = animate(py, target.y, {
      ...transition,
      velocity: py.getVelocity(),
    });
    const pair = [ax, ay];
    animations.current = pair;
    if (onDone) {
      Promise.all(pair).then(() => {
        // An interrupted spring can still resolve; only the latest one
        // gets to finish.
        if (animations.current === pair) {
          onDone();
        }
      });
    }
  };

  const finishPeel = () => {
    if (reduceMotion) {
      setPeeled(true);
      onPeel?.();
      return;
    }
    // Pull the corner past the opposite one, so the fold line clears the
    // sticker and the whole thing turns over and comes away.
    const c = cornerPoint(corner.current, size);
    const far = { x: size - c.x, y: size - c.y };
    const target = {
      x: c.x + (far.x - c.x) * 2.3,
      y: c.y + (far.y - c.y) * 2.3,
    };
    springTo(target, PEEL_OFF, () => {
      setPeeled(true);
      onPeel?.();
    });
  };

  const settleBack = (curl = REST_CURL) => {
    const target =
      corner.current === REST_CORNER
        ? restPoint(REST_CORNER, size, curl)
        : cornerPoint(corner.current, size);
    springTo(target, reduceMotion ? { duration: 0 } : SETTLE, () => {
      if (corner.current !== REST_CORNER) {
        // Hand the curl back to the resting corner without a visible jump:
        // the other corner is flat again at this point.
        corner.current = REST_CORNER;
        const r = restPoint(REST_CORNER, size, REST_CURL);
        px.jump(r.x);
        py.jump(r.y);
      }
    });
  };

  const localPoint = (
    event: PointerEvent<HTMLDivElement>,
    rect: DOMRect
  ): Point => ({ x: event.clientX - rect.left, y: event.clientY - rect.top });

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (peeled || drag.current) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    stopAll();
    // Measured once on grab rather than on every move.
    const rect = event.currentTarget.getBoundingClientRect();
    const down = localPoint(event, rect);
    const grabbed = nearestCorner(down, size);
    if (grabbed !== corner.current) {
      corner.current = grabbed;
      const c = cornerPoint(grabbed, size);
      px.jump(c.x);
      py.jump(c.y);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    // Keep the curl where it is and move it by the pointer's travel, so
    // grabbing never makes the corner jump to the finger.
    drag.current = {
      id: event.pointerId,
      offset: { x: px.get() - down.x, y: py.get() - down.y },
      rect,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    const p = localPoint(event, current.rect);
    px.set(p.x + current.offset.x);
    py.set(p.y + current.offset.y);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    drag.current = null;
    setDragging(false);

    const c = cornerPoint(corner.current, size);
    const away = { x: px.get() - c.x, y: py.get() - c.y };
    const distance = Math.hypot(away.x, away.y);
    // Speed in the direction the corner is being pulled.
    const speed =
      distance > 0
        ? (px.getVelocity() * away.x + py.getVelocity() * away.y) / distance
        : 0;
    if (
      distance > size * Math.SQRT2 * PEEL_THRESHOLD ||
      speed > FLICK_VELOCITY
    ) {
      finishPeel();
    } else {
      settleBack();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      corner.current = REST_CORNER;
      finishPeel();
    }
  };

  const reset = () => {
    stopAll();
    corner.current = REST_CORNER;
    const r = restPoint(REST_CORNER, size, REST_CURL);
    px.jump(r.x);
    py.jump(r.y);
    setPeeled(false);
  };

  return (
    <div
      className={cn("relative select-none", className)}
      style={{ width: size, height: size }}
    >
      {/* What's underneath: the backing paper and the hidden content. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[28px] border border-zinc-300 border-dashed bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
        {reveal ?? <DefaultReveal />}
        {peeled && (
          <button
            className="absolute bottom-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors duration-150 hover:bg-zinc-200/60 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={reset}
            type="button"
          >
            <RotateCcw className="size-3" />
            Stick it back
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!peeled && (
          <motion.div
            animate={{ opacity: 1 }}
            aria-label="Peel the sticker"
            className={cn(
              "absolute inset-0 touch-none rounded-[28px] outline-none",
              "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
              dragging ? "cursor-grabbing" : "cursor-grab"
            )}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            initial={{ opacity: 0 }}
            onKeyDown={handleKeyDown}
            onLostPointerCapture={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerDown={handlePointerDown}
            onPointerEnter={(event) => {
              // Lift the corner a little more on hover, as a hint. Touch
              // screens fire this on tap, so mouse only.
              if (
                event.pointerType === "mouse" &&
                !drag.current &&
                corner.current === REST_CORNER
              ) {
                settleBack(HOVER_CURL);
              }
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse" && !drag.current) {
                settleBack(REST_CURL);
              }
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            role="button"
            tabIndex={0}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            {/* The sticker's face, minus the folded-over part. The shadow
                is a filter on a wrapper: a box-shadow would be clipped off. */}
            <div className="absolute inset-0 drop-shadow-[0_6px_12px_rgb(0_0_0/0.18)]">
              <div
                className="absolute inset-0 overflow-hidden rounded-[28px]"
                ref={baseRef}
                style={{ clipPath: toPolygon(initial.base) }}
              >
                {children ?? <DefaultFace />}
              </div>
            </div>

            {/* The flap: the sticker's back, mirrored across the fold. The
                shadow sits on the wrapper so it follows the clipped shape. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 drop-shadow-[0_6px_8px_rgb(0_0_0/0.22)]"
              ref={flapRef}
              style={{
                width: size,
                height: size,
                transform: initial.matrix,
                transformOrigin: "0 0",
              }}
            >
              <div
                className="absolute inset-0 rounded-[28px] bg-zinc-100 dark:bg-zinc-300"
                ref={flapInnerRef}
                style={{ clipPath: toPolygon(initial.flap) }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DefaultFace() {
  return (
    <div className="flex h-full w-full flex-col justify-between rounded-[28px] bg-zinc-950 p-6 text-white ring-[6px] ring-white ring-inset dark:ring-zinc-200">
      <div className="flex items-center justify-between text-[11px] text-white/50 uppercase tracking-[0.2em]">
        <span>No. 026</span>
        <span>Limited</span>
      </div>
      <div>
        <p className="font-semibold text-[44px] leading-[0.9] tracking-tight">
          kokonut
          <br />
          <span className="text-[#ff6b2c]">ui</span>
        </p>
      </div>
      <p className="text-white/60 text-xs">Peel from any corner</p>
    </div>
  );
}

function DefaultReveal() {
  const [copied, setCopied] = useState(false);
  const code = "KOKONUT-26";

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">You found it</p>
      <button
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 transition-colors duration-150 hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-700"
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => setCopied(true));
        }}
        type="button"
      >
        {code}
        <span className="relative size-3.5">
          <Copy
            className={cn(
              "absolute inset-0 size-3.5 transition-[opacity,filter] duration-200",
              copied ? "opacity-0 blur-[2px]" : "opacity-60"
            )}
          />
          <Check
            className={cn(
              "absolute inset-0 size-3.5 transition-[opacity,filter] duration-200",
              copied ? "opacity-100" : "opacity-0 blur-[2px]"
            )}
          />
        </span>
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Code copied" : ""}
      </span>
    </>
  );
}
