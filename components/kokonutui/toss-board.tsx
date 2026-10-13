"use client";

/**
 * @author: @dorianbaffier
 * @description: Toss Board
 * @version: 1.0.0
 * @date: 2026-10-13
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { LayoutGrid } from "lucide-react";
import {
  animate,
  cancelFrame,
  type FrameData,
  frame,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface TossItem {
  id: string;
  /** Accessible name for the card. */
  label: string;
  content: ReactNode;
  width: number;
  height: number;
  /** Starting position, 0–1 across and down the board. */
  x: number;
  y: number;
  /** Starting rotation in degrees. */
  rotate?: number;
}

// Sliding friction: velocity falls by e^(-FRICTION·t). Higher stops sooner.
const FRICTION = 3.6;
const SPIN_FRICTION = 4.5;
// Share of speed kept when a card hits the edge of the board.
const RESTITUTION = 0.45;
// How much an off-centre throw turns into spin (deg/s per px²/s).
const TORQUE = 0.0022;
// How far a held card swings with horizontal speed, and its limit.
const SWING = 0.012;
const MAX_SWING = 10;
const REST_SPEED = 6;
const NUDGE = 12;
const NUDGE_FAST = 48;

interface Body {
  x: MotionValue<number>;
  y: MotionValue<number>;
  rotate: MotionValue<number>;
}

export interface TossBoardProps {
  items?: TossItem[];
  /** Board height in px. */
  height?: number;
  className?: string;
}

export default function TossBoard({
  items = DEFAULT_ITEMS,
  height = 440,
  className,
}: TossBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const bodies = useRef(new Map<string, Body>());
  const [order, setOrder] = useState(() => items.map((item) => item.id));
  const reduceMotion = useReducedMotion();

  const bringToFront = (id: string) => {
    setOrder((prev) =>
      prev.at(-1) === id ? prev : [...prev.filter((x) => x !== id), id]
    );
  };

  // Lay the cards out in a neat, centred grid, one after another.
  const tidy = () => {
    const board = boardRef.current;
    if (!board) {
      return;
    }
    const W = board.clientWidth;
    const H = board.clientHeight;
    const gap = 16;
    const columns = Math.max(
      1,
      Math.floor((W - gap) / (Math.max(...items.map((i) => i.width)) + gap))
    );
    const rows: TossItem[][] = [];
    items.forEach((item, i) => {
      const row = Math.floor(i / columns);
      rows[row] = [...(rows[row] ?? []), item];
    });
    const rowHeights = rows.map((row) => Math.max(...row.map((i) => i.height)));
    const totalHeight =
      rowHeights.reduce((a, b) => a + b, 0) + gap * (rows.length - 1);
    let top = Math.max(gap, (H - totalHeight) / 2);
    let delay = 0;
    rows.forEach((row, r) => {
      const rowWidth =
        row.reduce((sum, i) => sum + i.width, 0) + gap * (row.length - 1);
      let left = (W - rowWidth) / 2;
      for (const item of row) {
        const body = bodies.current.get(item.id);
        if (body) {
          const baseLeft = (W - item.width) * item.x;
          const baseTop = (H - item.height) * item.y;
          const transition = reduceMotion
            ? { duration: 0 }
            : { type: "spring" as const, duration: 0.5, bounce: 0.15, delay };
          animate(body.x, left - baseLeft, transition);
          animate(
            body.y,
            top + (rowHeights[r] - item.height) / 2 - baseTop,
            transition
          );
          animate(body.rotate, 0, transition);
        }
        left += item.width + gap;
        delay += 0.04;
      }
      top += rowHeights[r] + gap;
    });
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40",
        className
      )}
      ref={boardRef}
      style={{ height }}
    >
      {items.map((item) => (
        <TossCard
          boardRef={boardRef}
          bodies={bodies}
          item={item}
          key={item.id}
          onGrab={() => bringToFront(item.id)}
          z={order.indexOf(item.id) + 1}
        />
      ))}

      <button
        className="absolute top-3 right-3 z-[100] flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-600 transition-colors duration-150 hover:border-zinc-300 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
        onClick={tidy}
        type="button"
      >
        <LayoutGrid className="size-3.5" />
        Tidy up
      </button>
    </div>
  );
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function TossCard({
  item,
  z,
  boardRef,
  bodies,
  onGrab,
}: {
  item: TossItem;
  z: number;
  boardRef: RefObject<HTMLDivElement | null>;
  bodies: RefObject<Map<string, Body>>;
  onGrab: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(item.rotate ?? 0);
  // The swing while held, on a spring so it lags and settles like paper
  // hanging from your fingers.
  const swingTarget = useMotionValue(0);
  const swing = useSpring(swingTarget, { stiffness: 260, damping: 16 });
  const angle = useTransform(() => rotate.get() + swing.get());

  const [held, setHeld] = useState(false);
  const flight = useRef<((data: FrameData) => void) | null>(null);
  const drag = useRef<{
    id: number;
    // Measured once on grab; reading the board's size on every move would
    // force layout after each frame's writes.
    bounds: Bounds;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    grabX: number;
    grabY: number;
  } | null>(null);

  useEffect(() => {
    const map = bodies.current;
    map.set(item.id, { x, y, rotate });
    return () => {
      map.delete(item.id);
    };
  }, [bodies, item.id, x, y, rotate]);

  useEffect(
    () => () => {
      if (flight.current) {
        cancelFrame(flight.current);
      }
    },
    []
  );

  // Where the card may travel: its CSS position plus x/y must stay inside
  // the board.
  const bounds = (): Bounds => {
    const board = boardRef.current;
    const W = board?.clientWidth ?? 0;
    const H = board?.clientHeight ?? 0;
    const baseLeft = (W - item.width) * item.x;
    const baseTop = (H - item.height) * item.y;
    return {
      minX: -baseLeft,
      maxX: W - item.width - baseLeft,
      minY: -baseTop,
      maxY: H - item.height - baseTop,
    };
  };

  const stopFlight = () => {
    if (flight.current) {
      cancelFrame(flight.current);
      flight.current = null;
    }
  };

  // A tiny integrator: slide with friction, spin down, bounce off the edges.
  // It runs in Motion's frame loop, in the update step just before the
  // render step, so each position is drawn in the frame it was computed.
  const fly = (vx0: number, vy0: number, spin0: number, b: Bounds) => {
    stopFlight();
    let vx = vx0;
    let vy = vy0;
    let spin = spin0;
    const step = ({ delta }: FrameData) => {
      const dt = Math.min(delta / 1000, 1 / 30);
      let nx = x.get() + vx * dt;
      let ny = y.get() + vy * dt;
      if (nx < b.minX || nx > b.maxX) {
        nx = Math.min(Math.max(nx, b.minX), b.maxX);
        vx = -vx * RESTITUTION;
        // Hitting an edge off-centre knocks a little spin into it.
        spin += vy * 0.04;
      }
      if (ny < b.minY || ny > b.maxY) {
        ny = Math.min(Math.max(ny, b.minY), b.maxY);
        vy = -vy * RESTITUTION;
        spin -= vx * 0.04;
      }
      x.set(nx);
      y.set(ny);
      rotate.set(rotate.get() + spin * dt);
      const slide = Math.exp(-FRICTION * dt);
      vx *= slide;
      vy *= slide;
      spin *= Math.exp(-SPIN_FRICTION * dt);
      if (Math.hypot(vx, vy) < REST_SPEED && Math.abs(spin) < REST_SPEED) {
        stopFlight();
      }
    };
    flight.current = step;
    frame.update(step, true);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    stopFlight();
    // Catching a card mid-slide stops it under your finger.
    x.stop();
    y.stop();
    rotate.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      id: event.pointerId,
      bounds: bounds(),
      startX: event.clientX,
      startY: event.clientY,
      originX: x.get(),
      originY: y.get(),
      // Where on the card it was grabbed, from its centre.
      grabX: event.clientX - (rect.left + rect.width / 2),
      grabY: event.clientY - (rect.top + rect.height / 2),
    };
    setHeld(true);
    onGrab();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    const b = current.bounds;
    const nx = current.originX + event.clientX - current.startX;
    const ny = current.originY + event.clientY - current.startY;
    x.set(Math.min(Math.max(nx, b.minX), b.maxX));
    y.set(Math.min(Math.max(ny, b.minY), b.maxY));
    if (!reduceMotion) {
      const vx = x.getVelocity();
      swingTarget.set(Math.max(-MAX_SWING, Math.min(MAX_SWING, vx * SWING)));
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    drag.current = null;
    setHeld(false);
    // Bake the swing into the card's rotation so letting go doesn't snap it
    // straight.
    rotate.set(rotate.get() + swing.get());
    swingTarget.jump(0);
    swing.jump(0);
    if (reduceMotion) {
      return;
    }
    const vx = x.getVelocity();
    const vy = y.getVelocity();
    // Throwing a card by its corner spins it; by its centre, it just slides.
    const spin = (current.grabX * vy - current.grabY * vx) * TORQUE;
    fly(vx, vy, spin, current.bounds);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const distance = event.shiftKey ? NUDGE_FAST : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-distance, 0],
      ArrowRight: [distance, 0],
      ArrowUp: [0, -distance],
      ArrowDown: [0, distance],
    };
    const move = moves[event.key];
    if (!move) {
      return;
    }
    event.preventDefault();
    stopFlight();
    onGrab();
    const b = bounds();
    // Keyboard nudges are instant: they repeat, and easing each one would
    // make the card trail behind the key.
    x.jump(Math.min(Math.max(x.get() + move[0], b.minX), b.maxX));
    y.jump(Math.min(Math.max(y.get() + move[1], b.minY), b.maxY));
  };

  return (
    <motion.div
      aria-label={`${item.label}. Drag or use arrow keys to move.`}
      aria-roledescription="movable card"
      className={cn(
        "absolute touch-none select-none rounded-xl shadow-[0_1px_2px_rgb(0_0_0/0.08),0_6px_16px_-6px_rgb(0_0_0/0.2)] outline-none",
        "focus-visible:ring-2 focus-visible:ring-zinc-400",
        held ? "cursor-grabbing" : "cursor-grab"
      )}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="group"
      style={{
        width: item.width,
        height: item.height,
        left: `calc((100% - ${item.width}px) * ${item.x})`,
        top: `calc((100% - ${item.height}px) * ${item.y})`,
        x,
        y,
        rotate: angle,
        zIndex: z,
      }}
      tabIndex={0}
    >
      {/* The lifted shadow is drawn once on its own layer and faded in, so
          picking a card up animates opacity instead of repainting a large
          blurred box-shadow every frame. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl shadow-[0_2px_4px_rgb(0_0_0/0.08),0_24px_48px_-12px_rgb(0_0_0/0.35)] transition-opacity duration-200 ease-out",
          held ? "opacity-100" : "opacity-0"
        )}
      />
      {item.content}
    </motion.div>
  );
}

function PhotoCard() {
  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-2.5 pb-0 dark:bg-zinc-100">
      <svg
        aria-hidden="true"
        className="w-full flex-1 rounded-[3px]"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 160 130"
      >
        <rect fill="#dbe7f3" height="130" width="160" />
        <circle cx="112" cy="46" fill="#ff6b2c" r="16" />
        <path
          d="M0 98 L44 58 L78 90 L104 70 L160 104 L160 130 L0 130 Z"
          fill="#3f4f6b"
        />
        <path
          d="M0 112 L36 92 L70 110 L118 88 L160 116 L160 130 L0 130 Z"
          fill="#1f2a3d"
        />
      </svg>
      <p className="py-2.5 text-center font-serif text-[13px] text-zinc-600 italic">
        Lisbon, 06:12
      </p>
    </div>
  );
}

function SwatchCard() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white dark:bg-zinc-100">
      <div className="flex-1 bg-[#ff6b2c]" />
      <div className="px-3 py-2.5">
        <p className="font-medium text-xs text-zinc-900">Kokonut Orange</p>
        <p className="font-mono text-[11px] text-zinc-500">#FF6B2C</p>
      </div>
    </div>
  );
}

function TicketCard() {
  return (
    <div className="flex h-full rounded-xl bg-zinc-900 text-zinc-100">
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <p className="text-[10px] text-zinc-400 uppercase tracking-[0.18em]">
          Admit one
        </p>
        <p className="font-medium text-sm leading-tight">
          Design Systems
          <br />
          Night
        </p>
        <p className="font-mono text-[11px] text-zinc-400">Row C · Seat 12</p>
      </div>
      <div className="flex w-10 items-center justify-center border-zinc-700 border-l border-dashed">
        <span className="rotate-90 font-mono text-[10px] text-zinc-500">
          No.0042
        </span>
      </div>
    </div>
  );
}

function NoteCard() {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl bg-[#fdf1c7] p-3.5 text-[#5b4a12]">
      <p className="font-serif text-[15px] italic leading-snug">
        ship the dial on friday, then sleep.
      </p>
      <p className="text-[11px] opacity-60">— note to self</p>
    </div>
  );
}

function StatCard() {
  const bars = [32, 48, 40, 64, 52, 78, 70];
  return (
    <div className="flex h-full flex-col justify-between rounded-xl bg-white p-3.5 dark:bg-zinc-100">
      <div>
        <p className="text-[11px] text-zinc-500">Weekly visits</p>
        <p className="font-medium text-lg text-zinc-900 tabular-nums">
          12.4k <span className="text-emerald-600 text-xs">+18%</span>
        </p>
      </div>
      <div className="flex h-12 items-end gap-1">
        {bars.map((h, i) => (
          <span
            className={cn(
              "flex-1 rounded-[2px]",
              i === bars.length - 2 ? "bg-zinc-900" : "bg-zinc-200"
            )}
            // biome-ignore lint/suspicious/noArrayIndexKey: static bars.
            key={i}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

const DEFAULT_ITEMS: TossItem[] = [
  {
    id: "photo",
    label: "Photo, Lisbon at sunrise",
    content: <PhotoCard />,
    width: 168,
    height: 190,
    x: 0.08,
    y: 0.14,
    rotate: -6,
  },
  {
    id: "swatch",
    label: "Color swatch, Kokonut Orange",
    content: <SwatchCard />,
    width: 132,
    height: 156,
    x: 0.42,
    y: 0.08,
    rotate: 4,
  },
  {
    id: "ticket",
    label: "Ticket, Design Systems Night",
    content: <TicketCard />,
    width: 196,
    height: 112,
    x: 0.86,
    y: 0.2,
    rotate: -3,
  },
  {
    id: "note",
    label: "Note, ship the dial on friday",
    content: <NoteCard />,
    width: 160,
    height: 132,
    x: 0.26,
    y: 0.86,
    rotate: 5,
  },
  {
    id: "stat",
    label: "Weekly visits, 12.4 thousand",
    content: <StatCard />,
    width: 168,
    height: 128,
    x: 0.7,
    y: 0.8,
    rotate: -4,
  },
];
