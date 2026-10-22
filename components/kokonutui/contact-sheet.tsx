"use client";

/**
 * @author: @dorianbaffier
 * @description: Contact Sheet
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, ZoomIn } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/** How much the loupe magnifies, and its size in px. */
const ZOOM = 3;
const LOUPE = 136;
const DRAW_EASE = [0.6, 0, 0.3, 1] as const;

export interface ContactFrame {
  /** A 3:2 image. */
  src: string;
  alt: string;
  /** Where this frame sits in the shot, 0 to 1. Frames from one scene differ a little. */
  x?: number;
  y?: number;
  /** 1 shows the whole image. */
  zoom?: number;
}

type Mark = "pick" | "reject";

export interface ContactSheetProps {
  frames?: ContactFrame[];
  /** Frames per strip. */
  perStrip?: number;
  /** Printed on the film edge before each frame number. */
  firstFrame?: number;
  title?: string;
  defaultMarks?: Record<number, Mark>;
  onExport?: (picked: number[]) => void;
  className?: string;
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=900&h=600&fit=crop&auto=format&q=75`;

const LAKE = unsplash("1501785888041-af3ef285b470");
const RIDGE = unsplash("1506905925346-21bda4d32df4");
const FOG = unsplash("1470071459604-3b5ec3a7fe05");
const PINES = unsplash("1441974231531-c6227db76b6e");
const VALLEY = unsplash("1469474968028-56623f02e42e");
const PORTRAIT = unsplash("1534528741775-53994a69daeb");

const DEMO_FRAMES: ContactFrame[] = [
  { src: LAKE, alt: "Lake under mountains, wide", zoom: 1 },
  {
    src: LAKE,
    alt: "Lake under mountains, closer",
    zoom: 1.25,
    x: 0.4,
    y: 0.6,
  },
  { src: FOG, alt: "Hills in fog", zoom: 1 },
  { src: FOG, alt: "Hills in fog, tighter", zoom: 1.3, x: 0.7, y: 0.5 },
  { src: PORTRAIT, alt: "Portrait, head and shoulders", zoom: 1, y: 0.3 },
  { src: PORTRAIT, alt: "Portrait, eyes closed in", zoom: 1.5, x: 0.5, y: 0.3 },
  { src: RIDGE, alt: "Ridge line at dusk", zoom: 1 },
  { src: RIDGE, alt: "Ridge line, the far peaks", zoom: 1.35, x: 0.85, y: 0.4 },
  { src: PINES, alt: "Pine forest, looking up", zoom: 1 },
  {
    src: PINES,
    alt: "Pine forest, light through trunks",
    zoom: 1.3,
    x: 0.3,
    y: 0.7,
  },
  { src: VALLEY, alt: "Valley road", zoom: 1 },
  { src: VALLEY, alt: "Valley road, the bend", zoom: 1.4, x: 0.6, y: 0.75 },
];

/** A small seeded random, so every frame keeps its own wobble. */
const seeded = (seed: number) => {
  let s = seed * 9301 + 49_297;
  return () => {
    s = (s * 9301 + 49_297) % 233_280;
    return s / 233_280;
  };
};

/**
 * A china-marker loop: a lopsided ellipse that runs past where it started,
 * drawn in a 100 x 100 box stretched over the frame.
 */
function loopPath(seed: number) {
  const rand = seeded(seed + 1);
  const start = -2.2 + rand() * 0.6;
  const sweep = Math.PI * 2 + 0.35 + rand() * 0.3;
  const tilt = (rand() - 0.5) * 0.12;
  const steps = 56;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + sweep * t;
    // The hand drifts outward as it goes round, so the ends don't meet.
    const grow = 1 + t * 0.06;
    const wobble = 1 + Math.sin(a * 3 + seed) * 0.015;
    const rx = 52 * grow * wobble;
    const ry = 55 * grow * wobble;
    const x = 50 + Math.cos(a) * rx - Math.sin(a) * ry * tilt;
    const y = 50 + Math.sin(a) * ry + Math.cos(a) * rx * tilt;
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}

function MarkStroke({
  mark,
  index,
  reduceMotion,
}: {
  mark: Mark;
  index: number;
  reduceMotion: boolean;
}) {
  const draw = (delay: number) => ({
    initial: { pathLength: 0, opacity: 1 },
    animate: { pathLength: 1, opacity: 1 },
    transition: reduceMotion
      ? { duration: 0 }
      : {
          pathLength: { duration: 0.32, ease: DRAW_EASE, delay },
          opacity: { duration: 0 },
        },
  });
  const paths =
    mark === "pick"
      ? [loopPath(index)]
      : ["M14 16 Q 48 46 86 84", "M84 14 Q 54 50 16 86"];
  return (
    <motion.svg
      aria-hidden="true"
      className="pointer-events-none absolute -inset-1.5 z-10 h-[calc(100%+12px)] w-[calc(100%+12px)] overflow-visible text-red-600 dark:text-red-500"
      exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.15 } }}
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {paths.map((d, i) => (
        <motion.path
          d={d}
          fill="none"
          key={d}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
          {...draw(i * 0.2)}
        />
      ))}
    </motion.svg>
  );
}

/** Image layer for a frame: the shot, framed and zoomed. */
const frameStyle = (frame: ContactFrame): CSSProperties => ({
  backgroundImage: `url("${frame.src}")`,
  backgroundSize: `${(frame.zoom ?? 1) * 100}%`,
  backgroundPosition: `${(frame.x ?? 0.5) * 100}% ${(frame.y ?? 0.5) * 100}%`,
});

interface Lens {
  frame: ContactFrame;
  /** Loupe center, in the sheet's px. */
  left: number;
  top: number;
  /** Background for the loupe. */
  size: string;
  position: string;
}

/** What the loupe shows over `frame`, for a pointer at (px, py) in it. */
function lensFor(
  frame: ContactFrame,
  rect: DOMRect,
  px: number,
  py: number
): Pick<Lens, "size" | "position"> {
  const zoom = frame.zoom ?? 1;
  const w = rect.width * zoom;
  const h = rect.height * zoom;
  const ix = px - (rect.width - w) * (frame.x ?? 0.5);
  const iy = py - (rect.height - h) * (frame.y ?? 0.5);
  return {
    size: `${w * ZOOM}px ${h * ZOOM}px`,
    position: `${LOUPE / 2 - ix * ZOOM}px ${LOUPE / 2 - iy * ZOOM}px`,
  };
}

const nextMark = (mark: Mark | undefined): Mark | undefined => {
  if (!mark) {
    return "pick";
  }
  return mark === "pick" ? "reject" : undefined;
};

function Frame({
  frame,
  index,
  number,
  mark,
  loupe,
  reduceMotion,
  onMark,
  onLens,
  onLeave,
}: {
  frame: ContactFrame;
  index: number;
  number: number;
  mark: Mark | undefined;
  loupe: boolean;
  reduceMotion: boolean;
  onMark: (index: number, mark: Mark | undefined) => void;
  onLens: (event: PointerEvent<HTMLButtonElement>, frame: ContactFrame) => void;
  onLeave: () => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, Mark | undefined> = {
      p: mark === "pick" ? undefined : "pick",
      x: mark === "reject" ? undefined : "reject",
      Backspace: undefined,
    };
    if (event.key in keys) {
      event.preventDefault();
      onMark(index, keys[event.key]);
    }
  };
  let state = "";
  if (mark) {
    state = mark === "pick" ? ", picked" : ", struck";
  }
  return (
    <div className="relative">
      <button
        aria-label={`Frame ${number}: ${frame.alt}${state}`}
        className={cn(
          "relative block aspect-[3/2] w-full overflow-hidden bg-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
          loupe && "cursor-none"
        )}
        onClick={() => {
          // Lift the loupe so you see the mark go down.
          onLeave();
          onMark(index, nextMark(mark));
        }}
        onKeyDown={onKeyDown}
        onPointerLeave={onLeave}
        onPointerMove={(event) => onLens(event, frame)}
        type="button"
      >
        <span
          className={cn(
            "absolute inset-0 bg-no-repeat transition-opacity duration-200",
            mark === "reject" && "opacity-35"
          )}
          style={frameStyle(frame)}
        />
      </button>
      <AnimatePresence initial={false}>
        {mark && (
          <MarkStroke
            index={index}
            key={mark}
            mark={mark}
            reduceMotion={reduceMotion}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** A row of sprocket holes along the film edge. */
function Sprockets() {
  return (
    <div
      aria-hidden="true"
      className="mx-1 h-[5px]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to right, var(--paper) 0 7px, transparent 7px 14px)",
      }}
    />
  );
}

/**
 * A photographer's contact sheet, for picking from a shoot. Click a frame to
 * circle it in china marker, again to strike it out, and hover to look
 * through a loupe at the detail before you decide.
 */
export default function ContactSheet({
  frames = DEMO_FRAMES,
  perStrip = 4,
  firstFrame = 12,
  title = "Roll 14 · Lisbon",
  defaultMarks = { 1: "pick", 5: "reject", 8: "pick" },
  onExport,
  className,
}: ContactSheetProps) {
  const [marks, setMarks] = useState<Record<number, Mark>>(defaultMarks);
  const [lens, setLens] = useState<Lens | null>(null);
  const [loupe, setLoupe] = useState(true);
  const [exported, setExported] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const reduceMotion = Boolean(useReducedMotion());

  const strips: number[][] = [];
  for (let i = 0; i < frames.length; i += perStrip) {
    strips.push(frames.slice(i, i + perStrip).map((_, k) => i + k));
  }
  const picked = Object.keys(marks)
    .map(Number)
    .filter((i) => marks[i] === "pick")
    .sort((a, b) => a - b);
  const struck = Object.values(marks).filter((m) => m === "reject").length;

  const mark = (index: number, next: Mark | undefined) => {
    setExported(false);
    setMarks((current) => {
      const copy = { ...current };
      if (next) {
        copy[index] = next;
      } else {
        Reflect.deleteProperty(copy, index);
      }
      return copy;
    });
  };

  const onLens = (
    event: PointerEvent<HTMLButtonElement>,
    frame: ContactFrame
  ) => {
    const sheet = sheetRef.current?.getBoundingClientRect();
    if (!(loupe && sheet) || event.pointerType !== "mouse") {
      setLens(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    setLens({
      frame,
      left: event.clientX - sheet.left,
      top: event.clientY - sheet.top,
      ...lensFor(frame, rect, px, py),
    });
  };

  return (
    <div
      className={cn(
        "relative w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-4 [--paper:#ffffff] sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:[--paper:#18181b]",
        className
      )}
      ref={sheetRef}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="leading-tight">
          <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
            {title}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Click to circle a frame, again to strike it.
          </p>
        </div>
        <button
          aria-pressed={loupe}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 font-medium text-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400",
            loupe
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          )}
          onClick={() => setLoupe((on) => !on)}
          type="button"
        >
          <ZoomIn aria-hidden className="size-3.5" />
          Loupe
        </button>
      </div>

      <div className="mt-4 space-y-3 sm:space-y-4">
        {strips.map((strip, s) => (
          <div className="rounded-[3px] bg-zinc-950 py-1" key={strip[0]}>
            <Sprockets />
            <div
              className="mt-1 grid gap-1 px-1"
              style={{ gridTemplateColumns: `repeat(${perStrip}, 1fr)` }}
            >
              {strip.map((i) => (
                <Frame
                  frame={frames[i]}
                  index={i}
                  key={i}
                  loupe={loupe}
                  mark={marks[i]}
                  number={firstFrame + i}
                  onLeave={() => setLens(null)}
                  onLens={onLens}
                  onMark={mark}
                  reduceMotion={reduceMotion}
                />
              ))}
            </div>
            <div
              aria-hidden="true"
              className="mt-0.5 grid px-1 font-mono text-[8px] text-orange-300/70 leading-3 sm:text-[9px]"
              style={{ gridTemplateColumns: `repeat(${perStrip}, 1fr)` }}
            >
              {strip.map((i) => (
                <span className="flex justify-between px-1" key={i}>
                  <span>{firstFrame + i}</span>
                  <span>▸{firstFrame + i}A</span>
                </span>
              ))}
            </div>
            <Sprockets />
            <span className="sr-only">Strip {s + 1}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {picked.length} picked · {struck} struck
        </p>
        <div className="flex items-center gap-1.5">
          <button
            className="h-8 rounded-full px-3 font-medium text-xs text-zinc-600 outline-none transition-colors duration-150 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
            disabled={Object.keys(marks).length === 0}
            onClick={() => {
              setMarks({});
              setExported(false);
            }}
            type="button"
          >
            Clear
          </button>
          <button
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full px-3.5 font-medium text-xs tabular-nums outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:opacity-40 dark:focus-visible:ring-offset-zinc-900",
              exported
                ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
                : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            )}
            disabled={picked.length === 0}
            onClick={() => {
              onExport?.(picked);
              setExported(true);
            }}
            type="button"
          >
            {exported && (
              <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
            )}
            {exported ? "Sent to edit" : `Export ${picked.length}`}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {lens && (
          <motion.div
            animate={{ opacity: 1 }}
            aria-hidden="true"
            className="pointer-events-none absolute z-20 rounded-full bg-zinc-900 bg-no-repeat shadow-[0_8px_24px_rgb(0_0_0/0.35),0_0_0_1px_rgb(255_255_255/0.5),0_0_0_4px_rgb(24_24_27/0.9)]"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            style={{
              width: LOUPE,
              height: LOUPE,
              left: lens.left - LOUPE / 2,
              top: lens.top - LOUPE / 2,
              backgroundImage: `url("${lens.frame.src}")`,
              backgroundSize: lens.size,
              backgroundPosition: lens.position,
            }}
            transition={{ duration: reduceMotion ? 0 : 0.12 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
