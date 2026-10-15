"use client";

/**
 * @author: @dorianbaffier
 * @description: Punch Card
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const CARD_W = 340;
const CARD_H = 228;
// Room under the card where the punched-out bits land.
const FLOOR = 76;
const HOLE = 22;
// The die presses for this long before it cuts, in ms.
const PRESS = 90;
// Chads, in px and seconds.
const GRAVITY = 2200;
const AIR = 2.6;
const FLUTTER = 260;
const LIE = 78;
// The card's recoil spring.
const RECOIL_STIFFNESS = 520;
const RECOIL_DAMPING = 2 * Math.sqrt(RECOIL_STIFFNESS) * 0.32;
const REST_EPSILON = 0.01;

const SHAPES = {
  circle: "M12 1a11 11 0 1 0 0 22a11 11 0 1 0 0-22z",
  star: "M12.00 1.10L15.06 8.39L22.94 9.05L16.95 14.21L18.76 21.90L12.00 17.80L5.24 21.90L7.05 14.21L1.06 9.05L8.94 8.39Z",
  heart:
    "M12 21.5C5 16.5 1 12.6 1 8.1C1 4.6 3.7 2 7 2c2.2 0 4 1.2 5 3c1-1.8 2.8-3 5-3c3.3 0 6 2.6 6 6.1c0 4.5-4 8.4-11 13.4z",
} as const;

export type PunchShape = keyof typeof SHAPES;

export interface PunchCardProps {
  brand?: string;
  /** The offer, printed on the card. */
  offer?: string;
  /** Printed once every stamp is punched. */
  reward?: string;
  total?: number;
  defaultPunched?: number;
  shape?: PunchShape;
  onPunch?: (count: number) => void;
  onComplete?: () => void;
  onRedeem?: () => void;
  className?: string;
}

interface Spot {
  x: number;
  y: number;
}

interface Chad {
  id: number;
  label: string;
  free: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  spinSpeed: number;
  tilt: number;
  tiltSpeed: number;
  tumble: number;
  tumbleSpeed: number;
  flutter: number;
  age: number;
  landed: boolean;
}

/** Stamp positions on the card: one row up to five, otherwise two. */
function spotLayout(total: number): Spot[] {
  const rows = total > 5 ? 2 : 1;
  const cols = Math.ceil(total / rows);
  const left = 44;
  const gap = cols > 1 ? (CARD_W - left * 2) / (cols - 1) : 0;
  const ys = rows === 2 ? [114, 164] : [138];
  return Array.from({ length: total }, (_, i) => ({
    x: cols > 1 ? left + (i % cols) * gap : CARD_W / 2,
    y: ys[Math.floor(i / cols)],
  }));
}

/** An alpha mask for the card: opaque paper, clear where it's punched. */
function maskFor(punched: boolean[], spots: Spot[], shape: PunchShape) {
  const scale = HOLE / 24;
  const holes = spots
    .map((spot, i) =>
      punched[i]
        ? `<path d="${SHAPES[shape]}" transform="translate(${spot.x - HOLE / 2} ${spot.y - HOLE / 2}) scale(${scale})"/>`
        : ""
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}"><mask id="m"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${holes}</g></mask><rect width="100%" height="100%" mask="url(#m)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const nearest = (angle: number, step: number, offset = 0) =>
  Math.round((angle - offset) / step) * step + offset;

export default function PunchCard({
  brand = "Kokonut Coffee",
  offer = "Buy nine, the tenth is on us",
  reward = "Your next one is on us",
  total = 10,
  defaultPunched = 6,
  shape = "circle",
  onPunch,
  onComplete,
  onRedeem,
  className,
}: PunchCardProps) {
  const uid = useId().replace(/:/g, "");
  const spots = useMemo(() => spotLayout(total), [total]);
  const [punched, setPunched] = useState(() =>
    Array.from({ length: total }, (_, i) => i < defaultPunched)
  );
  const [pressing, setPressing] = useState(-1);
  const [chads, setChads] = useState<
    { id: number; label: string; free: boolean }[]
  >([]);
  const [phase, setPhase] = useState<"idle" | "leaving" | "entering">("idle");
  const [cardNumber, setCardNumber] = useState(427);

  const punchedRef = useRef(punched);
  punchedRef.current = punched;
  const count = punched.filter(Boolean).length;
  const complete = count === total;
  const mask = useMemo(
    () => maskFor(punched, spots, shape),
    [punched, spots, shape]
  );
  const ring = Math.min(
    40,
    spots.length > 1 ? spots[1].x - spots[0].x - 14 : 40
  );

  const [fit, setFit] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const chadRefs = useRef(new Map<number, HTMLDivElement>());
  const timers = useRef<number[]>([]);
  const sim = useRef({
    y: 0,
    vy: 0,
    rot: 0,
    vrot: 0,
    chads: [] as Chad[],
    nextId: 0,
    raf: 0,
    last: 0,
    reduceMotion: false,
  });
  const callbacks = useRef({ onPunch, onComplete });
  callbacks.current = { onPunch, onComplete };

  const render = useCallback(() => {
    const s = sim.current;
    if (cardRef.current) {
      cardRef.current.style.transform = `translate3d(0, ${s.y.toFixed(2)}px, 0) rotate(${s.rot.toFixed(3)}deg)`;
    }
    for (const chad of s.chads) {
      const node = chadRefs.current.get(chad.id);
      if (node) {
        node.style.transform = `translate3d(${(chad.x - HOLE / 2).toFixed(2)}px, ${(chad.y - HOLE / 2).toFixed(2)}px, 0) rotateX(${chad.tilt.toFixed(1)}deg) rotateY(${chad.tumble.toFixed(1)}deg) rotateZ(${chad.spin.toFixed(1)}deg)`;
      }
    }
  }, []);

  const step = useCallback((dt: number) => {
    const s = sim.current;
    let energy = 0;
    // The card rings out after each punch.
    s.vy += (-s.y * RECOIL_STIFFNESS - s.vy * RECOIL_DAMPING) * dt;
    s.y += s.vy * dt;
    s.vrot += (-s.rot * RECOIL_STIFFNESS - s.vrot * RECOIL_DAMPING) * dt;
    s.rot += s.vrot * dt;
    energy = Math.max(
      energy,
      Math.abs(s.y),
      Math.abs(s.vy) * 0.05,
      Math.abs(s.rot),
      Math.abs(s.vrot) * 0.05
    );

    const floor = CARD_H + FLOOR - 6;
    for (const chad of s.chads) {
      if (chad.landed) {
        // Lying down: tip flat, face up or down, and stop.
        const tilt = nearest(chad.tilt, 180, LIE);
        const tumble = nearest(chad.tumble, 180);
        const k = 1 - Math.exp(-dt * 22);
        chad.tilt += (tilt - chad.tilt) * k;
        chad.tumble += (tumble - chad.tumble) * k;
        chad.vx *= Math.exp(-dt * 16);
        chad.x += chad.vx * dt;
        energy = Math.max(
          energy,
          Math.abs(tilt - chad.tilt) * 0.05,
          Math.abs(tumble - chad.tumble) * 0.05,
          Math.abs(chad.vx) * 0.05
        );
        continue;
      }
      chad.age += dt;
      // Paper falls slowly and flutters side to side.
      chad.vy += (GRAVITY - chad.vy * AIR) * dt;
      chad.vx += Math.sin(chad.age * 13 + chad.flutter) * FLUTTER * dt;
      chad.vx *= Math.exp(-dt * 1.5);
      chad.x += chad.vx * dt;
      chad.y += chad.vy * dt;
      chad.spin += chad.spinSpeed * dt;
      chad.tilt += chad.tiltSpeed * dt;
      chad.tumble += chad.tumbleSpeed * dt;
      if (chad.y >= floor) {
        chad.y = floor;
        if (chad.vy > 180) {
          chad.vy *= -0.24;
          chad.tiltSpeed *= 0.4;
          chad.tumbleSpeed *= 0.4;
        } else {
          chad.landed = true;
        }
      }
      energy = 1;
    }
    return energy;
  }, []);

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const dt = s.last ? Math.min((now - s.last) / 1000, 1 / 30) : 1 / 60;
      s.last = now;
      const energy = step(dt);
      render();
      if (energy > REST_EPSILON) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.last = 0;
      }
    },
    [render, step]
  );

  const wake = useCallback(() => {
    const s = sim.current;
    if (!s.raf) {
      s.raf = requestAnimationFrame(tick);
    }
  }, [tick]);

  useEffect(() => {
    const s = sim.current;
    s.reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const pending = timers.current;
    const root = rootRef.current;
    const resize = new ResizeObserver(([entry]) => {
      setFit(Math.min(1, entry.contentRect.width / CARD_W) || 1);
    });
    if (root) {
      resize.observe(root);
    }
    return () => {
      resize.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      for (const t of pending) {
        window.clearTimeout(t);
      }
    };
  }, []);

  const punch = useCallback(
    (index: number) => {
      const s = sim.current;
      setPressing(-1);
      const prev = punchedRef.current;
      if (prev[index]) {
        return;
      }
      const updated = prev.map((v, i) => v || i === index);
      const next = updated.filter(Boolean).length;
      punchedRef.current = updated;
      setPunched(updated);
      callbacks.current.onPunch?.(next);
      if (next === total) {
        callbacks.current.onComplete?.();
      }
      if (s.reduceMotion) {
        return;
      }
      const spot = spots[index];
      // The die drives the card down; off-centre punches twist it.
      s.vy += 120;
      s.vrot += ((spot.x - CARD_W / 2) / CARD_W) * 70;
      const id = s.nextId++;
      const side = spot.x < CARD_W / 2 ? -1 : 1;
      s.chads.push({
        id,
        label: index === total - 1 ? "FREE" : `${index + 1}`,
        free: index === total - 1,
        x: spot.x,
        y: spot.y,
        vx: side * (20 + Math.random() * 50),
        vy: 160 + Math.random() * 80,
        spin: 0,
        spinSpeed: (Math.random() - 0.5) * 720,
        tilt: 0,
        tiltSpeed: (Math.random() < 0.5 ? -1 : 1) * (380 + Math.random() * 520),
        tumble: 0,
        tumbleSpeed: (Math.random() - 0.5) * 900,
        flutter: Math.random() * Math.PI * 2,
        age: 0,
        landed: false,
      });
      setChads((list) => [
        ...list,
        {
          id,
          label: index === total - 1 ? "FREE" : `${index + 1}`,
          free: index === total - 1,
        },
      ]);
      wake();
    },
    [spots, total, wake]
  );

  const press = (index: number, event: PointerEvent<HTMLButtonElement>) => {
    if (
      punched[index] ||
      pressing >= 0 ||
      phase !== "idle" ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }
    setPressing(index);
    timers.current.push(window.setTimeout(() => punch(index), PRESS));
  };

  const redeem = () => {
    setPhase("leaving");
    onRedeem?.();
    const s = sim.current;
    const leave = s.reduceMotion ? 0 : 220;
    timers.current.push(
      window.setTimeout(() => {
        s.chads = [];
        chadRefs.current.clear();
        setChads([]);
        const fresh = Array.from({ length: total }, () => false);
        punchedRef.current = fresh;
        setPunched(fresh);
        setCardNumber((n) => n + 1);
        setPhase("entering");
        // Two frames: one to place the new card off to the side, one to
        // let it slide in.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setPhase("idle"))
        );
      }, leave)
    );
  };

  let shift = "translate-x-0 opacity-100 duration-[260ms]";
  if (phase === "leaving") {
    shift = "-translate-x-8 opacity-0 duration-[200ms]";
  } else if (phase === "entering") {
    shift = "translate-x-8 opacity-0 duration-0";
  }

  return (
    <div
      className={cn(
        "relative w-full select-none text-stone-900 dark:text-zinc-100",
        "[--punch-back:#e7e3da] [--punch-edge:rgb(0_0_0/0.14)] [--punch-paper:#f6f4ef]",
        "dark:[--punch-back:#202023] dark:[--punch-edge:rgb(0_0_0/0.6)] dark:[--punch-paper:#27272a]",
        className
      )}
      ref={rootRef}
      style={{ maxWidth: CARD_W, height: (CARD_H + FLOOR) * fit }}
    >
      {/* Drawn at a fixed size, then fitted to narrow containers. */}
      <div
        className="absolute top-0 left-0 origin-top-left [perspective:700px]"
        style={{
          width: CARD_W,
          height: CARD_H + FLOOR,
          transform: fit === 1 ? undefined : `scale(${fit})`,
        }}
      >
        {/* Punched-out bits drop out of the back of the card, so they sit
            behind it until they fall clear, then lie where they land. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-200 ease-out [transform-style:preserve-3d]",
            phase === "leaving" ? "opacity-0" : "opacity-100"
          )}
        >
          {chads.map((chad) => (
            <div
              className="absolute top-0 left-0 [transform-style:preserve-3d]"
              key={chad.id}
              ref={(node) => {
                if (node) {
                  chadRefs.current.set(chad.id, node);
                  render();
                } else {
                  chadRefs.current.delete(chad.id);
                }
              }}
              style={{ width: HOLE, height: HOLE }}
            >
              <svg
                aria-hidden="true"
                className="absolute inset-0 [backface-visibility:hidden]"
                height={HOLE}
                viewBox="0 0 24 24"
                width={HOLE}
              >
                <defs>
                  <clipPath id={`${uid}-chad-${chad.id}`}>
                    <path d={SHAPES[shape]} />
                  </clipPath>
                </defs>
                <path
                  d={SHAPES[shape]}
                  fill="var(--punch-paper)"
                  stroke="var(--punch-edge)"
                  strokeWidth={1}
                />
                <g clipPath={`url(#${uid}-chad-${chad.id})`}>
                  <text
                    className={cn(
                      chad.free
                        ? "fill-stone-900 dark:fill-zinc-100"
                        : "fill-stone-500 dark:fill-zinc-400"
                    )}
                    dominantBaseline="central"
                    fontSize={chad.free ? 8.7 : 13}
                    fontWeight={chad.free ? 600 : 400}
                    textAnchor="middle"
                    x={12}
                    y={12.5}
                  >
                    {chad.label}
                  </text>
                </g>
              </svg>
              <svg
                aria-hidden="true"
                className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                height={HOLE}
                viewBox="0 0 24 24"
                width={HOLE}
              >
                <path
                  d={SHAPES[shape]}
                  fill="var(--punch-back)"
                  stroke="var(--punch-edge)"
                  strokeWidth={1}
                />
              </svg>
            </div>
          ))}
        </div>
        <div
          className={cn(
            "relative transition-[translate,opacity] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:translate-x-0",
            shift
          )}
        >
          <div
            className="[filter:drop-shadow(0_1px_1px_rgb(0_0_0/0.08))_drop-shadow(0_10px_18px_rgb(0_0_0/0.10))] dark:[filter:drop-shadow(0_1px_1px_rgb(0_0_0/0.5))_drop-shadow(0_10px_18px_rgb(0_0_0/0.5))]"
            ref={cardRef}
            style={{ transformOrigin: "50% 40%" }}
          >
            <section
              aria-label={`${brand} stamp card, ${count} of ${total} stamps`}
              className="relative overflow-hidden rounded-2xl bg-[var(--punch-paper)]"
              style={{
                width: CARD_W,
                height: CARD_H,
                maskImage: mask,
                WebkitMaskImage: mask,
                maskSize: "100% 100%",
                WebkitMaskSize: "100% 100%",
              }}
            >
              <div className="flex items-baseline justify-between px-5 pt-4">
                <p className="font-semibold text-sm tracking-tight">{brand}</p>
                <p className="text-[11px] text-stone-400 tabular-nums dark:text-zinc-500">
                  No. {String(cardNumber).padStart(4, "0")}
                </p>
              </div>
              <p
                aria-live="polite"
                className="px-5 pt-1 text-[13px] text-stone-500 dark:text-zinc-400"
              >
                {complete ? reward : offer}
              </p>

              {spots.map((spot, i) => {
                const done = punched[i];
                const last = i === total - 1;
                return (
                  <button
                    aria-label={
                      done
                        ? `Stamp ${i + 1}, punched`
                        : `Punch stamp ${i + 1}${last ? ", the free one" : ""}`
                    }
                    className={cn(
                      "absolute flex items-center justify-center rounded-full border outline-none transition-[border-color,box-shadow,background-color] duration-100 ease-out focus-visible:ring-2 focus-visible:ring-stone-400 dark:focus-visible:ring-zinc-500",
                      last
                        ? "border-stone-900 border-dashed dark:border-zinc-200"
                        : "border-stone-300 dark:border-zinc-600",
                      !done &&
                        "cursor-pointer hover:border-stone-500 dark:hover:border-zinc-400",
                      pressing === i &&
                        "border-stone-700 bg-stone-900/[0.04] shadow-[inset_0_1px_3px_rgb(0_0_0/0.18)] dark:border-zinc-300 dark:bg-white/[0.04]"
                    )}
                    disabled={done || phase !== "idle"}
                    key={`${spot.x}-${spot.y}`}
                    onClick={(event) => {
                      // Keyboard presses arrive as clicks with no pointer.
                      if (event.detail === 0 && !done) {
                        punch(i);
                      }
                    }}
                    onPointerDown={(event) => press(i, event)}
                    style={{
                      left: spot.x - ring / 2,
                      top: spot.y - ring / 2,
                      width: ring,
                      height: ring,
                    }}
                    type="button"
                  >
                    <span
                      className={cn(
                        "tabular-nums",
                        last
                          ? "font-semibold text-[8px]"
                          : "text-[12px] text-stone-500 dark:text-zinc-400"
                      )}
                    >
                      {last ? "FREE" : i + 1}
                    </span>
                  </button>
                );
              })}

              {/* The cut edge of each hole, where you see the card's thickness. */}
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                height={CARD_H}
                width={CARD_W}
              >
                {spots.map((spot, i) =>
                  punched[i] ? (
                    <path
                      d={SHAPES[shape]}
                      fill="none"
                      key={`${spot.x}-${spot.y}`}
                      stroke="var(--punch-edge)"
                      strokeWidth={1.6}
                      transform={`translate(${spot.x - HOLE / 2} ${spot.y - HOLE / 2 + 0.6}) scale(${HOLE / 24})`}
                    />
                  ) : null
                )}
              </svg>

              <div className="absolute inset-x-5 bottom-3 flex h-6 items-center justify-between">
                <p className="text-[11px] text-stone-500 tabular-nums dark:text-zinc-400">
                  {count} of {total} stamps
                </p>
                <button
                  className={cn(
                    "h-6 rounded-full bg-stone-900 px-3 font-medium text-[11px] text-white leading-none outline-none transition-[opacity,background-color] duration-200 ease-out hover:bg-stone-700 focus-visible:ring-2 focus-visible:ring-stone-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
                    complete && phase === "idle"
                      ? "opacity-100"
                      : "pointer-events-none opacity-0"
                  )}
                  onClick={redeem}
                  tabIndex={complete && phase === "idle" ? 0 : -1}
                  type="button"
                >
                  Redeem
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
