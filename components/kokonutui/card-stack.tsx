"use client";

/**
 * @author: @dorianbaffier
 * @description: Throw Deck
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface DeckSpec {
  label: string;
  value: string;
}

export interface DeckCard {
  id: string;
  title: string;
  subtitle: string;
  /** Artwork shown edge to edge on the card. Inline SVG keeps it portable. */
  art: ReactNode;
  description: string;
  specs: DeckSpec[];
  price?: string;
}

export interface CardStackProps {
  cards?: DeckCard[];
  /** The one accent color, used by the artwork and the primary action. */
  accent?: string;
  /** Label of the primary action in the details view. */
  actionLabel?: string;
  onAction?: (card: DeckCard) => void;
  /** Called with the new top card after the deck cycles. */
  onChange?: (card: DeckCard) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------

// Resting pose of each slot. The top card sits straight; the ones beneath
// keep a fixed tilt, like a pile squared up by hand.
const TILTS = [0, -2, 1.5, -1];
const SLOT_Y = 9;
const SLOT_SCALE = 0.035;
const MAX_SLOT = TILTS.length - 1;

// Dragging rotates the card up to this many degrees across its own width.
const MAX_DRAG_ROTATION = 18;
// A release throws the card when it is this fast (px/ms) or this far (share
// of the card's width). Anything less springs home.
const THROW_VELOCITY = 0.5;
const THROW_DISTANCE = 0.35;
// Taps that move less than this open the card instead of dragging it.
const TAP_SLOP = 5;
// Release velocity is measured over the last stretch of the gesture only.
const VELOCITY_WINDOW = 90;

// Springs as stiffness / damping (per second). Home is slightly underdamped
// so a hard release visibly carries through; the flight is looser so a faster
// flick travels further before it turns around.
const HOME = { k: 420, c: 30 };
const FLIGHT = { k: 150, c: 15 };
const RETURN = { k: 240, c: 26 };

const TOP_Z = 1000;

type Phase = "rest" | "drag" | "out" | "return";

interface Pose {
  x: number;
  y: number;
  r: number;
  s: number;
}

interface Body extends Pose {
  vx: number;
  vy: number;
  vr: number;
  vs: number;
  phase: Phase;
  /** Where a thrown card is headed before it turns around. */
  out: Pose;
  /** Unit direction of the throw. */
  dx: number;
  dy: number;
  /** Z-index override while in flight. */
  z: number | null;
  /** Z-index to take at the top of the arc. */
  apexZ: number | null;
}

interface Drag {
  pointerId: number;
  index: number;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  width: number;
  /** +1 when grabbed in the top half, −1 in the bottom half. */
  lever: number;
  moved: boolean;
  samples: { t: number; x: number; y: number }[];
}

function slotPose(depth: number): Pose {
  const d = Math.min(depth, MAX_SLOT);
  return { x: 0, y: d * SLOT_Y, r: TILTS[d] ?? 0, s: 1 - d * SLOT_SCALE };
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    r: a.r + (b.r - a.r) * t,
    s: a.s + (b.s - a.s) * t,
  };
}

function poseTransform({ x, y, r, s }: Pose) {
  return `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`;
}

function makeBody(depth: number): Body {
  const pose = slotPose(depth);
  return {
    ...pose,
    vx: 0,
    vy: 0,
    vr: 0,
    vs: 0,
    phase: "rest",
    out: pose,
    dx: 1,
    dy: 0,
    z: null,
    apexZ: null,
  };
}

function springAxis(
  value: number,
  velocity: number,
  target: number,
  spring: { k: number; c: number },
  dt: number
) {
  const accel = -spring.k * (value - target) - spring.c * velocity;
  const v = velocity + accel * dt;
  return [value + v * dt, v] as const;
}

function stepBody(body: Body, target: Pose, dt: number) {
  let spring = HOME;
  if (body.phase === "out") {
    spring = FLIGHT;
  } else if (body.phase === "return") {
    spring = RETURN;
  }
  // Sub-step so a stiff spring stays stable on a slow frame.
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    [body.x, body.vx] = springAxis(body.x, body.vx, target.x, spring, h);
    [body.y, body.vy] = springAxis(body.y, body.vy, target.y, spring, h);
    [body.r, body.vr] = springAxis(body.r, body.vr, target.r, spring, h);
    [body.s, body.vs] = springAxis(body.s, body.vs, target.s, spring, h);
  }
}

function isSettled(body: Body, target: Pose) {
  return (
    Math.abs(body.x - target.x) < 0.1 &&
    Math.abs(body.y - target.y) < 0.1 &&
    Math.abs(body.r - target.r) < 0.02 &&
    Math.abs(body.s - target.s) < 0.0005 &&
    Math.abs(body.vx) + Math.abs(body.vy) < 2 &&
    Math.abs(body.vr) < 1 &&
    Math.abs(body.vs) < 0.01
  );
}

/** Distance along (ux, uy) at which a w×h card no longer covers the deck. */
function clearance(w: number, h: number, ux: number, uy: number) {
  const along = Math.min(
    ux === 0 ? Number.POSITIVE_INFINITY : w / Math.abs(ux),
    uy === 0 ? Number.POSITIVE_INFINITY : h / Math.abs(uy)
  );
  return along + 24;
}

function releaseVelocity(samples: Drag["samples"]) {
  const last = samples.at(-1);
  const first = samples.find(
    (sample) => last && last.t - sample.t <= VELOCITY_WINDOW
  );
  if (!(first && last) || last.t - first.t < 8) {
    return { vx: 0, vy: 0 };
  }
  const dt = last.t - first.t;
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

function cardState(phase: Phase) {
  if (phase === "drag") {
    return "drag";
  }
  return phase === "rest" ? "rest" : "fly";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CardStack({
  cards = DEFAULT_CARDS,
  accent = "#f97316",
  actionLabel = "Add to cart",
  onAction,
  onChange,
  className,
}: CardStackProps) {
  const count = cards.length;
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [openId, setOpenId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const orderRef = useRef(order);
  const bodies = useRef<Body[]>(cards.map((_, i) => makeBody(i)));
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  // 0–1: how close the current drag is to a throw. The card beneath rises
  // to meet it.
  const progress = useRef(0);
  const raf = useRef(0);
  const last = useRef(0);
  const reduced = useRef(false);
  const suppressClick = useRef(false);
  const focusTop = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  reduced.current = reduceMotion === true;

  const write = useCallback((index: number, depth: number) => {
    const node = nodes.current[index];
    const body = bodies.current[index];
    if (!(node && body)) {
      return;
    }
    node.style.transform = poseTransform(body);
    node.style.zIndex = String(body.z ?? orderRef.current.length - depth);
    const state = cardState(body.phase);
    if (node.dataset.state !== state) {
      node.dataset.state = state;
    }
  }, []);

  const targetFor = useCallback((body: Body, depth: number): Pose => {
    if (body.phase === "out") {
      return body.out;
    }
    const pose = slotPose(depth);
    if (depth > 0 && progress.current > 0) {
      return lerpPose(pose, slotPose(depth - 1), progress.current * 0.6);
    }
    return pose;
  }, []);

  const advance = useCallback(
    (index: number, depth: number, dt: number) => {
      const body = bodies.current[index];
      if (!body) {
        return false;
      }
      if (body.phase === "drag") {
        write(index, depth);
        return true;
      }
      if (reduced.current && body.phase === "out") {
        body.phase = "rest";
        body.z = null;
      }
      const target = targetFor(body, depth);
      if (reduced.current) {
        Object.assign(body, target, { vx: 0, vy: 0, vr: 0, vs: 0 });
      } else {
        stepBody(body, target, dt);
      }
      // Top of the arc: the card stops travelling outward, swaps to its new
      // layer while it is clear of the deck, and heads home.
      if (body.phase === "out" && body.vx * body.dx + body.vy * body.dy <= 0) {
        body.phase = "return";
        body.z = body.apexZ;
      }
      const settled = isSettled(body, target);
      if (settled && body.phase !== "out") {
        body.phase = "rest";
        body.z = null;
      }
      write(index, depth);
      return !settled;
    },
    [targetFor, write]
  );

  const tick = useCallback(
    (now: number) => {
      const dt = Math.min((now - last.current) / 1000, 1 / 30);
      last.current = now;
      let active = false;
      orderRef.current.forEach((index, depth) => {
        if (advance(index, depth, dt)) {
          active = true;
        }
      });
      raf.current = active ? requestAnimationFrame(tick) : 0;
    },
    [advance]
  );

  // The loop sleeps whenever every card has settled; anything that moves a
  // card wakes it.
  const kick = useCallback(() => {
    if (raf.current) {
      return;
    }
    last.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // A new set of cards (a different count) starts a fresh, squared-up pile.
  useEffect(() => {
    if (orderRef.current.length === count) {
      return;
    }
    const next = Array.from({ length: count }, (_, i) => i);
    bodies.current = next.map((i) => makeBody(i));
    orderRef.current = next;
    setOrder(next);
    setOpenId(null);
    kick();
  }, [count, kick]);

  const commitOrder = useCallback(
    (next: number[]) => {
      orderRef.current = next;
      setOrder(next);
      const top = cards[next[0] ?? 0];
      if (top) {
        onChangeRef.current?.(top);
      }
      kick();
    },
    [cards, kick]
  );

  // Send the top card flying along (vx, vy) px/ms; it comes back under the
  // pile. (fx, fy) is the direction to use when there is no real velocity.
  const throwTop = useCallback(
    (vx: number, vy: number, fx: number, fy: number) => {
      const current = orderRef.current;
      const index = current[0];
      if (index === undefined || current.length < 2) {
        return;
      }
      const body = bodies.current[index];
      const node = nodes.current[index];
      if (!body) {
        return;
      }
      const speed = Math.hypot(vx, vy);
      const rawX = speed > 0.05 ? vx : fx;
      const rawY = speed > 0.05 ? vy : fy;
      const norm = Math.hypot(rawX, rawY) || 1;
      const ux = rawX / norm;
      const uy = rawY / norm;
      const w = node?.offsetWidth ?? 256;
      const h = node?.offsetHeight ?? 320;
      const distance = clearance(w, h, ux, uy) + Math.min(speed * 50, 90);
      // Keep some speed so a slow but far drag still leaves with intent.
      const launch = Math.max(speed, 0.9) * 1000;
      body.phase = "out";
      body.dx = ux;
      body.dy = uy;
      body.out = {
        x: ux * distance,
        y: uy * distance,
        r: Math.max(-40, Math.min(40, body.r + ux * 26)),
        s: 1,
      };
      body.vx = ux * launch;
      body.vy = uy * launch;
      body.vr += ux * launch * 0.05;
      body.z = TOP_Z;
      body.apexZ = null;
      commitOrder([...current.slice(1), index]);
    },
    [commitOrder]
  );

  // The bottom card slips out to the left, swaps on top at its apex and lands
  // as the new top card.
  const bringBack = useCallback(() => {
    const current = orderRef.current;
    const index = current.at(-1);
    if (index === undefined || current.length < 2) {
      return;
    }
    const body = bodies.current[index];
    const node = nodes.current[index];
    if (!body) {
      return;
    }
    const ux = -0.97;
    const uy = -0.24;
    const w = node?.offsetWidth ?? 256;
    const h = node?.offsetHeight ?? 320;
    const distance = clearance(w, h, ux, uy) + 20;
    body.phase = "out";
    body.dx = ux;
    body.dy = uy;
    body.out = { x: ux * distance, y: uy * distance, r: -16, s: 1 };
    body.vx = ux * 1100;
    body.vy = uy * 1100;
    body.z = 0;
    body.apexZ = TOP_Z - 1;
    commitOrder([index, ...current.slice(0, -1)]);
  }, [commitOrder]);

  const cycle = useCallback(
    (direction: 1 | -1) => {
      if (direction === 1) {
        throwTop(1.3, -0.35, 1, 0);
      } else {
        bringBack();
      }
    },
    [throwTop, bringBack]
  );

  // Keep keyboard focus on whichever card is now on top.
  useEffect(() => {
    if (!focusTop.current || openId) {
      return;
    }
    focusTop.current = false;
    const topCard = order[0];
    if (topCard !== undefined) {
      nodes.current[topCard]?.focus({ preventScroll: true });
    }
  }, [order, openId]);

  const closeDetails = useCallback(() => {
    focusTop.current = true;
    setOpenId(null);
  }, []);

  useEffect(() => {
    if (!openId) {
      return;
    }
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetails();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, closeDetails]);

  const handlePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    index: number
  ) => {
    suppressClick.current = false;
    if (drag.current || orderRef.current[0] !== index) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    const body = bodies.current[index];
    if (!body) {
      return;
    }
    const node = event.currentTarget;
    const rect = node.getBoundingClientRect();
    node.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      index,
      startX: event.clientX,
      startY: event.clientY,
      baseX: body.x,
      baseY: body.y,
      width: node.offsetWidth,
      lever: event.clientY - rect.top < rect.height / 2 ? 1 : -1,
      moved: false,
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved) {
      if (Math.hypot(dx, dy) < TAP_SLOP) {
        return;
      }
      // Axis lock for touch: a mostly vertical swipe is a page scroll, so
      // let go of the card and leave it to the browser (touch-pan-y).
      if (event.pointerType !== "mouse" && Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }
    }
    const body = bodies.current[current.index];
    if (!body) {
      return;
    }
    current.moved = true;
    current.samples.push({
      t: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
    });
    if (current.samples.length > 24) {
      current.samples.shift();
    }
    body.phase = "drag";
    body.x = current.baseX + dx;
    body.y = current.baseY + dy;
    body.s = 1;
    // Pivot at the bottom edge: grabbing the top half swings the top out,
    // grabbing the bottom half swings it the other way.
    body.r =
      Math.max(-1, Math.min(1, body.x / current.width)) *
      MAX_DRAG_ROTATION *
      current.lever;
    body.vx = 0;
    body.vy = 0;
    body.vr = 0;
    body.vs = 0;
    progress.current = Math.min(
      Math.hypot(body.x, body.y) / (current.width * THROW_DISTANCE),
      1
    );
    kick();
  };

  const handlePointerUp = (
    event: PointerEvent<HTMLButtonElement>,
    cancelled = false
  ) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    drag.current = null;
    progress.current = 0;
    const body = bodies.current[current.index];
    if (!(body && current.moved)) {
      kick();
      return;
    }
    if (cancelled) {
      // The browser took the gesture (or capture was lost): no throw, no
      // click, just spring home.
      body.phase = "rest";
      kick();
      return;
    }
    suppressClick.current = true;
    const { vx, vy } = releaseVelocity(current.samples);
    const speed = Math.hypot(vx, vy);
    const distance = Math.hypot(body.x, body.y);
    // A flick back toward the deck is a change of mind, not a throw.
    const heading = distance > 0 ? (vx * body.x + vy * body.y) / distance : 0;
    const fast = speed > THROW_VELOCITY && heading > -0.2;
    const far = distance > current.width * THROW_DISTANCE && heading > -0.3;
    if (fast || far) {
      throwTop(vx, vy, body.x / (distance || 1), body.y / (distance || 1));
      return;
    }
    // Spring home, carrying the release velocity into the spring.
    body.phase = "rest";
    body.vx = vx * 1000;
    body.vy = vy * 1000;
    body.vr = ((vx * 1000) / current.width) * MAX_DRAG_ROTATION * current.lever;
    kick();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    // A drag that ended without its click must not swallow Enter or Space.
    suppressClick.current = false;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusTop.current = true;
      cycle(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusTop.current = true;
      cycle(-1);
    }
  };

  const topIndex = order[0] ?? 0;
  const top = cards[topIndex];
  const open = openId ? cards.find((card) => card.id === openId) : undefined;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "relative mx-auto flex min-h-[32rem] w-full max-w-md flex-col items-center justify-center py-8",
          className
        )}
        style={{ "--deck-accent": accent } as CSSProperties}
      >
        <section
          aria-label="Card deck. Drag a card away or use the arrow keys to cycle."
          className="relative aspect-[4/5] w-[min(16rem,calc(100%-5rem))]"
          // The details view is modal: nothing behind it takes focus.
          inert={Boolean(open)}
        >
          {cards.map((card, index) => {
            const depth = order.indexOf(index);
            const isTop = depth === 0;
            const isOpen = openId === card.id;
            return (
              <button
                aria-label={`${card.title}, ${card.subtitle}. Open details`}
                className={cn(
                  "group/deck-card absolute inset-0 origin-bottom touch-pan-y select-none rounded-2xl text-left outline-none will-change-transform",
                  "shadow-[0_1px_2px_rgb(0_0_0/0.05),0_4px_12px_-4px_rgb(0_0_0/0.12)] transition-shadow duration-200 ease-out dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_6px_16px_-6px_rgb(0_0_0/0.7)]",
                  "data-[state=drag]:shadow-[0_2px_4px_rgb(0_0_0/0.05),0_28px_48px_-16px_rgb(0_0_0/0.3)] data-[state=fly]:shadow-[0_2px_4px_rgb(0_0_0/0.05),0_28px_48px_-16px_rgb(0_0_0/0.3)]",
                  "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
                  isTop && "cursor-grab data-[state=drag]:cursor-grabbing",
                  isOpen && "shadow-none dark:shadow-none"
                )}
                data-state="rest"
                inert={!isTop}
                key={card.id}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  if (orderRef.current[0] === index) {
                    setOpenId(card.id);
                  }
                }}
                onKeyDown={handleKeyDown}
                onLostPointerCapture={(event) => handlePointerUp(event, true)}
                onPointerCancel={(event) => handlePointerUp(event, true)}
                onPointerDown={(event) => handlePointerDown(event, index)}
                onPointerMove={handlePointerMove}
                onPointerUp={(event) => handlePointerUp(event)}
                ref={(node) => {
                  nodes.current[index] = node;
                }}
                style={{
                  transform: poseTransform(slotPose(index)),
                  zIndex: count - index,
                }}
                tabIndex={isTop ? 0 : -1}
                type="button"
              >
                {!isOpen && (
                  <motion.span
                    className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"
                    layoutDependency={openId}
                    layoutId={`deck-${card.id}`}
                    transition={LAYOUT_SPRING}
                  >
                    <motion.span
                      className="relative block min-h-0 flex-1 overflow-hidden rounded-xl"
                      layoutDependency={openId}
                      layoutId={`deck-art-${card.id}`}
                      transition={LAYOUT_SPRING}
                    >
                      {card.art}
                    </motion.span>
                    <span className="flex items-end justify-between gap-3 px-1.5 pt-2.5 pb-1">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {card.title}
                        </span>
                        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {card.subtitle}
                        </span>
                      </span>
                      {card.price && (
                        <span className="shrink-0 text-sm text-zinc-900 tabular-nums dark:text-zinc-100">
                          {card.price}
                        </span>
                      )}
                    </span>
                  </motion.span>
                )}
              </button>
            );
          })}
        </section>

        <div
          className="mt-8 flex w-[min(16rem,calc(100%-5rem))] items-center justify-between gap-2"
          inert={Boolean(open)}
        >
          <button
            aria-label="Previous card"
            className={NAV_BUTTON}
            onClick={() => cycle(-1)}
            type="button"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p
            aria-live="polite"
            className="min-w-0 truncate text-center text-xs text-zinc-500 tabular-nums dark:text-zinc-400"
          >
            <span className="text-zinc-900 dark:text-zinc-100">
              {String(topIndex + 1).padStart(2, "0")}
            </span>
            {" / "}
            {String(count).padStart(2, "0")}
            <span className="sr-only">: {top?.title}</span>
          </p>
          <button
            aria-label="Next card"
            className={NAV_BUTTON}
            onClick={() => cycle(1)}
            type="button"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <DeckDetails
              actionLabel={actionLabel}
              card={open}
              closeRef={closeRef}
              key="details"
              onAction={onAction}
              onClose={closeDetails}
              openId={openId}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function DeckDetails({
  card,
  openId,
  actionLabel,
  onAction,
  onClose,
  closeRef,
}: {
  card: DeckCard;
  openId: string | null;
  actionLabel: string;
  onAction?: (card: DeckCard) => void;
  onClose: () => void;
  closeRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[2000] flex items-center justify-center bg-white/85 p-3 dark:bg-zinc-950/85"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      <motion.div
        aria-label={card.title}
        aria-modal="true"
        className="relative flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_24px_48px_-12px_rgb(0_0_0/0.25)] dark:border-zinc-800 dark:bg-zinc-900"
        layoutDependency={openId}
        layoutId={`deck-${card.id}`}
        role="dialog"
        transition={LAYOUT_SPRING}
      >
        <motion.div
          className="relative aspect-[2/1] w-full shrink-0 overflow-hidden rounded-xl"
          layoutDependency={openId}
          layoutId={`deck-art-${card.id}`}
          transition={LAYOUT_SPRING}
        >
          {card.art}
        </motion.div>
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="min-h-0 overflow-y-auto px-2 pt-3 pb-1"
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          initial={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.25, delay: 0.08, ease: EASE_OUT }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-medium text-base text-zinc-900 dark:text-zinc-100">
              {card.title}
            </h3>
            {card.price && (
              <span className="text-sm text-zinc-900 tabular-nums dark:text-zinc-100">
                {card.price}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {card.subtitle}
          </p>
          <p className="mt-2 text-sm text-zinc-600 leading-relaxed dark:text-zinc-300">
            {card.description}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
            {card.specs.map((spec) => (
              <div
                className="min-w-0 bg-white px-2.5 py-2 dark:bg-zinc-900"
                key={spec.label}
              >
                <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {spec.label}
                </dt>
                <dd className="truncate text-xs text-zinc-900 dark:text-zinc-100">
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
          <button
            className="mt-3 h-9 w-full rounded-lg bg-[var(--deck-accent)] font-medium text-sm text-white transition-[filter] duration-150 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 active:brightness-95 dark:focus-visible:ring-offset-zinc-900"
            onClick={() => onAction?.(card)}
            type="button"
          >
            {actionLabel}
          </button>
        </motion.div>
        <button
          aria-label="Close details"
          className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full bg-white text-zinc-600 transition-colors duration-150 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          onClick={onClose}
          ref={closeRef}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      </motion.div>
    </motion.div>
  );
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LAYOUT_SPRING = { type: "spring", duration: 0.45, bounce: 0 } as const;
const NAV_BUTTON =
  "flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:translate-y-px dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

// ---------------------------------------------------------------------------
// Demo artwork: flat zinc compositions with one accent, drawn inline so the
// component ships with no image files.
// ---------------------------------------------------------------------------

const BG = "fill-zinc-100 dark:fill-zinc-800";
const MID = "fill-zinc-300 dark:fill-zinc-700";
const INK = "fill-zinc-800 dark:fill-zinc-300";
const ACCENT = { fill: "var(--deck-accent)" };

function Art({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 320 320"
    >
      <rect
        className={dark ? "fill-zinc-900 dark:fill-zinc-950" : BG}
        height="320"
        width="320"
      />
      {children}
    </svg>
  );
}

const STRIPES = [0, 1, 2, 3, 4, 5, 6];

function LowSunArt() {
  return (
    <Art>
      <circle cx="160" cy="176" r="72" style={ACCENT} />
      <rect className={MID} height="144" width="320" y="176" />
      {STRIPES.map((i) => (
        <rect
          height={4 - i * 0.4}
          key={i}
          style={ACCENT}
          width={120 - i * 14}
          x={100 + i * 7}
          y={190 + i * 14}
        />
      ))}
    </Art>
  );
}

function RidgeArt() {
  return (
    <Art>
      <circle cx="232" cy="108" r="22" style={ACCENT} />
      <polygon
        className={MID}
        points="0,200 64,132 112,172 176,96 248,164 320,120 320,320 0,320"
      />
      <polygon
        className={INK}
        points="0,240 88,176 148,220 224,160 320,236 320,320 0,320"
      />
    </Art>
  );
}

const RINGS = [24, 48, 72, 96, 120, 144, 168, 192];

function TideArt() {
  return (
    <Art>
      {RINGS.map((r) => (
        <circle
          className="fill-none stroke-zinc-300 dark:stroke-zinc-700"
          cx="132"
          cy="188"
          key={r}
          r={r}
          strokeWidth="2"
        />
      ))}
      <circle cx="132" cy="188" r="14" style={ACCENT} />
      <circle className={INK} cx="244" cy="104" r="6" />
    </Art>
  );
}

const WINDOWS = Array.from({ length: 30 }, (_, i) => i);
const LIT = new Set([7, 16, 23]);

function NightArt() {
  return (
    <Art dark>
      {WINDOWS.map((i) => (
        <rect
          className={
            LIT.has(i) ? undefined : "fill-zinc-700 dark:fill-zinc-800"
          }
          height="30"
          key={i}
          rx="2"
          style={LIT.has(i) ? ACCENT : undefined}
          width="30"
          x={52 + (i % 5) * 46}
          y={52 + Math.floor(i / 5) * 40}
        />
      ))}
    </Art>
  );
}

function SaltArt() {
  return (
    <Art>
      <circle cx="96" cy="108" r="14" style={ACCENT} />
      <rect
        className="fill-zinc-200 dark:fill-zinc-700"
        height="148"
        width="320"
        y="172"
      />
      <polygon
        className="fill-zinc-300 dark:fill-zinc-600"
        points="214,172 40,196 40,200 218,173"
      />
      <rect className={INK} height="56" width="4" x="212" y="116" />
    </Art>
  );
}

const DEFAULT_CARDS: DeckCard[] = [
  {
    id: "low-sun",
    title: "Low Sun",
    subtitle: "Print 01 · Risograph",
    art: <LowSunArt />,
    description:
      "The last ten minutes of light over open water, pulled in two passes on warm cream stock.",
    specs: [
      { label: "Size", value: "A3" },
      { label: "Paper", value: "Cream 120g" },
      { label: "Edition", value: "of 50" },
    ],
    price: "$48",
  },
  {
    id: "ridge-line",
    title: "Ridge Line",
    subtitle: "Print 02 · Screen print",
    art: <RidgeArt />,
    description:
      "Two ranges, one sun. Hand-pulled in three layers, with a slight misregister on purpose.",
    specs: [
      { label: "Size", value: "50 × 70" },
      { label: "Paper", value: "Natural 300g" },
      { label: "Edition", value: "of 30" },
    ],
    price: "$72",
  },
  {
    id: "tide-pools",
    title: "Tide Pools",
    subtitle: "Print 03 · Risograph",
    art: <TideArt />,
    description:
      "Rings left by a single stone, printed as eight hairlines around one accent dot.",
    specs: [
      { label: "Size", value: "A3" },
      { label: "Paper", value: "White 120g" },
      { label: "Edition", value: "of 80" },
    ],
    price: "$40",
  },
  {
    id: "night-market",
    title: "Night Market",
    subtitle: "Print 04 · Giclée",
    art: <NightArt />,
    description:
      "A block of windows after closing time. Three are still lit; the rest have gone home.",
    specs: [
      { label: "Size", value: "40 × 50" },
      { label: "Paper", value: "Cotton 310g" },
      { label: "Edition", value: "Open" },
    ],
    price: "$56",
  },
  {
    id: "salt-flats",
    title: "Salt Flats",
    subtitle: "Print 05 · Screen print",
    art: <SaltArt />,
    description:
      "One marker post and its shadow across a dry lake bed. Mostly empty, which is the point.",
    specs: [
      { label: "Size", value: "50 × 70" },
      { label: "Paper", value: "Bright 300g" },
      { label: "Edition", value: "of 25" },
    ],
    price: "$64",
  },
];
