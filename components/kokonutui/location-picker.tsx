"use client";

/**
 * @author: @dorianbaffier
 * @description: Location Picker
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Footprints, LocateFixed } from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
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

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const GLIDE = { type: "spring", stiffness: 260, damping: 32 } as const;
/** The drawn town, in px. */
const W = 1200;
const H = 1080;
/** Map pixels walked in a minute. */
const WALK = 70;
/** A pickup this close to a crossing is named by the crossing. */
const CORNER = 30;
const KEY_STEP = 64;
/** The town is drawn at this scale, so a few blocks fit around the pin. */
const ZOOM = 0.62;

interface Street {
  name: string;
  width: number;
  from: [number, number];
  to: [number, number];
}

const AVENUES = [
  "Mercer Ave",
  "Hudson Ave",
  "Grand Ave",
  "Orchard Ave",
  "Bowery",
];
const AVENUE_X = [180, 380, 580, 780, 980];
const CROSS_Y = [120, 280, 440, 600, 760, 920];

const STREETS: Street[] = [
  ...AVENUES.map(
    (name, i): Street => ({
      name,
      width: 12,
      from: [AVENUE_X[i], 0],
      to: [AVENUE_X[i], H],
    })
  ),
  ...CROSS_Y.map(
    (y, i): Street => ({
      name: `${["1st", "2nd", "3rd", "4th", "5th", "6th"][i]} St`,
      width: 8,
      from: [0, y],
      to: [W, y],
    })
  ),
  { name: "Broadway", width: 12, from: [120, 1020], to: [1140, 60] },
];

/** No pickups in the river or the park. */
const RIVER_X = 112;
const PARK = { x: 598, y: 456, w: 166, h: 128 };
const YOU: [number, number] = [470, 660];

const inPark = (x: number, y: number) =>
  x > PARK.x - 4 &&
  x < PARK.x + PARK.w + 4 &&
  y > PARK.y - 4 &&
  y < PARK.y + PARK.h + 4;

/** Points along every street where a car can stop. */
const STOPS = STREETS.flatMap((street, s) => {
  const [x0, y0] = street.from;
  const [x1, y1] = street.to;
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6);
  const out: { x: number; y: number; s: number; t: number }[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (x > RIVER_X + 14 && !inPark(x, y) && y > 20 && y < H - 20) {
      out.push({ x, y, s, t });
    }
  }
  return out;
});

function nearestStop(x: number, y: number) {
  let best = STOPS[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const stop of STOPS) {
    const d = (stop.x - x) ** 2 + (stop.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = stop;
    }
  }
  return best;
}

const distanceTo = (street: Street, x: number, y: number) => {
  const [x0, y0] = street.from;
  const [x1, y1] = street.to;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = Math.max(
    0,
    Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy))
  );
  return Math.hypot(x0 + dx * t - x, y0 + dy * t - y);
};

/** "Grand Ave & 3rd St" at a corner, "214 Grand Ave" along the block. */
function addressFor(stop: (typeof STOPS)[number]) {
  const street = STREETS[stop.s];
  const corner = STREETS.find(
    (other, i) => i !== stop.s && distanceTo(other, stop.x, stop.y) < CORNER
  );
  if (corner) {
    return `${street.name} & ${corner.name}`;
  }
  const number = 100 + Math.round(stop.t * 220) * 2;
  return `${number} ${street.name}`;
}

interface Lot {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Split a block into lots and leave a few empty, like a real one. */
function lotsIn(block: Lot, rand: () => number, out: Lot[]) {
  const cols = block.w > 120 ? 3 : 2;
  const rows = block.h > 100 ? 2 : 1;
  const gap = 8;
  const lw = (block.w - gap * (cols - 1)) / cols;
  const lh = (block.h - gap * (rows - 1)) / rows;
  for (let a = 0; a < cols; a++) {
    for (let b = 0; b < rows; b++) {
      const shrink = rand() * 0.25;
      if (rand() > 0.25) {
        out.push({
          x: block.x + a * (lw + gap),
          y: block.y + b * (lh + gap),
          w: lw * (1 - shrink),
          h: lh * (1 - shrink * 0.6),
        });
      }
    }
  }
}

/** A seeded town of buildings, so every block has a little texture. */
function buildings() {
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49_297) % 233_280;
    return seed / 233_280;
  };
  const xs = [RIVER_X + 14, ...AVENUE_X, W];
  const ys = [0, ...CROSS_Y, H];
  const out: Lot[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const block = {
        x: xs[i] + 14,
        y: ys[j] + 12,
        w: xs[i + 1] - xs[i] - 28,
        h: ys[j + 1] - ys[j] - 24,
      };
      const open = inPark(block.x + block.w / 2, block.y + block.h / 2);
      if (block.w >= 20 && block.h >= 20 && !open) {
        lotsIn(block, rand, out);
      }
    }
  }
  return out;
}

const BUILDINGS = buildings();

function Town() {
  return (
    <>
      <rect className="fill-zinc-100 dark:fill-zinc-900" height={H} width={W} />
      {BUILDINGS.map((b) => (
        <rect
          className="fill-zinc-200 dark:fill-zinc-800"
          height={b.h}
          key={`${b.x.toFixed(1)}-${b.y.toFixed(1)}`}
          rx={3}
          width={b.w}
          x={b.x}
          y={b.y}
        />
      ))}
      {/* Roads: a casing, then the tarmac on top. */}
      {STREETS.map((s) => (
        <line
          className="stroke-zinc-200 dark:stroke-zinc-950"
          key={`casing-${s.name}`}
          strokeLinecap="round"
          strokeWidth={s.width + 3}
          x1={s.from[0]}
          x2={s.to[0]}
          y1={s.from[1]}
          y2={s.to[1]}
        />
      ))}
      {STREETS.map((s) => (
        <line
          className="stroke-white dark:stroke-zinc-700"
          key={`road-${s.name}`}
          strokeLinecap="round"
          strokeWidth={s.width}
          x1={s.from[0]}
          x2={s.to[0]}
          y1={s.from[1]}
          y2={s.to[1]}
        />
      ))}
      <rect
        className="fill-emerald-100 stroke-emerald-200 dark:fill-emerald-950 dark:stroke-emerald-900"
        height={PARK.h}
        rx={12}
        width={PARK.w}
        x={PARK.x}
        y={PARK.y}
      />
      <ellipse
        className="fill-sky-200 dark:fill-sky-900"
        cx={PARK.x + 112}
        cy={PARK.y + 82}
        rx={30}
        ry={18}
      />
      <text
        className="fill-emerald-700 font-medium text-[15px] dark:fill-emerald-400"
        x={PARK.x + 14}
        y={PARK.y + 26}
      >
        Linden Park
      </text>
      <path
        className="fill-sky-100 dark:fill-sky-950"
        d={`M0 0 H${RIVER_X - 6} C${RIVER_X + 10} 200 ${RIVER_X - 20} 380 ${RIVER_X} 560 S ${RIVER_X - 10} 900 ${RIVER_X + 4} ${H} H0 Z`}
      />
      <text
        className="fill-sky-600 text-[15px] italic dark:fill-sky-400"
        transform={"translate(60 640) rotate(-90)"}
      >
        Mill River
      </text>
      {AVENUES.map((name, i) =>
        [200, 680].map((y) => (
          <text
            className="fill-zinc-400 font-medium text-[14px] dark:fill-zinc-500"
            key={`${name}-${y}`}
            transform={`translate(${AVENUE_X[i] + 12} ${y}) rotate(90)`}
          >
            {name}
          </text>
        ))
      )}
      {CROSS_Y.map((y, i) => (
        <text
          className="fill-zinc-400 font-medium text-[14px] dark:fill-zinc-500"
          key={y}
          x={AVENUE_X[i % 2 === 0 ? 0 : 3] + 30}
          y={y - 9}
        >
          {STREETS[AVENUES.length + i].name}
        </text>
      ))}
    </>
  );
}

function Pin({ lifted, spring }: { lifted: boolean; spring: object }) {
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2">
      {/* The shadow stays on the street while the pin lifts away from it. */}
      <motion.span
        animate={{
          opacity: lifted ? 0.18 : 0.38,
          scaleX: lifted ? 0.6 : 1,
        }}
        className="absolute -top-[3px] -left-[8px] block h-[6px] w-4 rounded-[50%] bg-black blur-[1px]"
        initial={false}
        transition={spring}
      />
      <motion.div
        animate={{ y: lifted ? -14 : 0 }}
        className="absolute bottom-0 left-0 -translate-x-1/2"
        initial={false}
        transition={spring}
      >
        <svg
          aria-hidden="true"
          className="block drop-shadow-[0_2px_3px_rgb(0_0_0/0.25)]"
          height="38"
          viewBox="0 0 28 38"
          width="28"
        >
          <path
            className="fill-zinc-900 dark:fill-zinc-50"
            d="M14 37 L8.5 23.5 A12.5 12.5 0 1 1 19.5 23.5 Z"
          />
          <circle
            className="fill-white dark:fill-zinc-900"
            cx="14"
            cy="13"
            r="4.5"
          />
        </svg>
      </motion.div>
    </div>
  );
}

type Status = "moving" | "locating" | "ready";

function AddressLine({
  status,
  address,
  minutes,
  reduceMotion,
}: {
  status: Status;
  address: string;
  minutes: number;
  reduceMotion: boolean;
}) {
  let line = address;
  if (status === "moving") {
    line = "Move the map to set your pickup";
  } else if (status === "locating") {
    line = "Finding the curb…";
  }
  return (
    <div className="relative h-10 min-w-0 flex-1 overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-0 flex flex-col justify-center leading-tight"
          exit={{ opacity: 0, y: -8 }}
          initial={{ opacity: 0, y: 8 }}
          key={line}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT }}
        >
          <p
            className={cn(
              "truncate text-sm",
              status === "ready"
                ? "font-medium text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400"
            )}
          >
            {line}
          </p>
          {status === "ready" && (
            <p className="flex items-center gap-1 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
              <Footprints aria-hidden className="size-3" />
              {minutes < 1 ? "Right where you are" : `${minutes} min walk`}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export interface LocationPickerProps {
  /** Called with the street address when the pickup is confirmed. */
  onConfirm?: (pickup: { address: string; x: number; y: number }) => void;
  className?: string;
}

/**
 * Setting a pickup point the way ride apps do. Drag the map under a fixed
 * pin: the pin lifts off its shadow while you move, the map glides so it
 * lands on the nearest curb, and the pin drops and the street rolls in.
 * The river and the park won't take a pickup.
 */
export default function LocationPicker({
  onConfirm,
  className,
}: LocationPickerProps) {
  const start = nearestStop(YOU[0] + 110, YOU[1] + 40);
  const mapRef = useRef<HTMLButtonElement>(null);
  const cx = useMotionValue(start.x);
  const cy = useMotionValue(start.y);
  const [view, setView] = useState({ w: 360, h: 300 });
  const [lifted, setLifted] = useState(false);
  const [status, setStatus] = useState<Status>("ready");
  const [stop, setStop] = useState(start);
  const [confirmed, setConfirmed] = useState(false);
  const drag = useRef({ x: 0, y: 0, cx: 0, cy: 0, moved: false, on: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduceMotion = Boolean(useReducedMotion());

  const tx = useTransform(cx, (v) => -v * ZOOM);
  const ty = useTransform(cy, (v) => -v * ZOOM);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) {
      return;
    }
    const measure = () => setView({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer.current);
    };
  }, []);

  const clampX = (v: number) =>
    Math.min(W - view.w / 2 / ZOOM, Math.max(view.w / 2 / ZOOM, v));
  const clampY = (v: number) =>
    Math.min(H - view.h / 2 / ZOOM, Math.max(view.h / 2 / ZOOM, v));

  /** Glide to the curb nearest (x, y), then put the pin down there. */
  const settle = (x: number, y: number) => {
    const next = nearestStop(x, y);
    setLifted(true);
    setStatus("locating");
    setConfirmed(false);
    clearTimeout(timer.current);
    const land = () => {
      setLifted(false);
      // A beat to "look up" the street, like a real geocoder would.
      timer.current = setTimeout(
        () => {
          setStop(next);
          setStatus("ready");
        },
        reduceMotion ? 0 : 260
      );
    };
    if (reduceMotion) {
      cx.set(next.x);
      cy.set(next.y);
      land();
      return;
    }
    animate(cx, next.x, GLIDE);
    animate(cy, next.y, { ...GLIDE, onComplete: land });
  };

  const onDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    cx.stop();
    cy.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      cx: cx.get(),
      cy: cy.get(),
      moved: false,
      on: true,
    };
  };

  const onMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d.on) {
      return;
    }
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      clearTimeout(timer.current);
      setLifted(true);
      setStatus("moving");
      setConfirmed(false);
    }
    if (d.moved) {
      cx.set(clampX(d.cx - dx / ZOOM));
      cy.set(clampY(d.cy - dy / ZOOM));
    }
  };

  const onUp = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d.on) {
      return;
    }
    d.on = false;
    if (d.moved) {
      settle(cx.get(), cy.get());
      return;
    }
    // A tap moves the pickup to where you tapped.
    const rect = event.currentTarget.getBoundingClientRect();
    settle(
      clampX(cx.get() + (event.clientX - rect.left - view.w / 2) / ZOOM),
      clampY(cy.get() + (event.clientY - rect.top - view.h / 2) / ZOOM)
    );
  };

  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      settle(clampX(cx.get() + move[0]), clampY(cy.get() + move[1]));
    }
  };

  const address = addressFor(stop);
  const minutes = Math.round(
    Math.hypot(stop.x - YOU[0], stop.y - YOU[1]) / WALK
  );
  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.42, bounce: 0.35 };

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="relative">
        <button
          aria-label={`Pickup map. ${status === "ready" ? `Pickup at ${address}.` : ""} Drag or use arrow keys to move it.`}
          className="relative block h-72 w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:cursor-grabbing"
          onKeyDown={onKey}
          onPointerCancel={onUp}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          ref={mapRef}
          type="button"
        >
          <motion.svg
            aria-hidden="true"
            className="absolute"
            height={H * ZOOM}
            style={{ x: tx, y: ty, left: view.w / 2, top: view.h / 2 }}
            viewBox={`0 0 ${W} ${H}`}
            width={W * ZOOM}
          >
            <Town />
            {/* The walk from you to the pickup. */}
            <motion.line
              animate={{ opacity: status === "ready" ? 1 : 0 }}
              className="stroke-sky-500"
              initial={false}
              strokeDasharray="0 7"
              strokeLinecap="round"
              strokeWidth={3}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              x1={YOU[0]}
              x2={stop.x}
              y1={YOU[1]}
              y2={stop.y}
            />
            <circle
              className="fill-sky-500/15"
              cx={YOU[0]}
              cy={YOU[1]}
              r={22}
            />
            <circle
              className="fill-sky-500 stroke-white dark:stroke-zinc-900"
              cx={YOU[0]}
              cy={YOU[1]}
              r={7}
              strokeWidth={3}
            />
          </motion.svg>
          <Pin lifted={lifted} spring={spring} />
        </button>
        <button
          aria-label="Back to my location"
          className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-white text-zinc-700 shadow-[0_1px_3px_rgb(0_0_0/0.15),0_0_0_1px_rgb(0_0_0/0.04)] outline-none transition-colors duration-150 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:text-white"
          onClick={() => settle(YOU[0], YOU[1])}
          type="button"
        >
          <LocateFixed aria-hidden className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 px-3 pt-3 pb-1">
        <AddressLine
          address={address}
          minutes={minutes}
          reduceMotion={reduceMotion}
          status={status}
        />
      </div>
      <div className="p-1">
        <button
          className={cn(
            "flex h-11 w-full items-center justify-center gap-2 rounded-xl font-medium text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:opacity-40 dark:focus-visible:ring-offset-zinc-950",
            confirmed
              ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
              : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          )}
          disabled={status !== "ready"}
          onClick={() => {
            onConfirm?.({ address, x: stop.x, y: stop.y });
            setConfirmed(true);
          }}
          type="button"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2"
              exit={{ opacity: 0, y: -8 }}
              initial={{ opacity: 0, y: 8 }}
              key={confirmed ? "done" : "confirm"}
              transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT }}
            >
              {confirmed ? (
                <>
                  <Check aria-hidden className="size-4" strokeWidth={2.5} />
                  Driver on the way
                </>
              ) : (
                "Confirm pickup"
              )}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}
