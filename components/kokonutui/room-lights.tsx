"use client";

/**
 * @author: @kokonutui
 * @description: Room Lights
 * @version: 1.0.0
 * @date: 2026-11-06
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Lightbulb } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the lamp hangs, in plan units. */
  lamp: { x: number; y: number };
  /** Rooms you walk into from this one, for scenes that spread from the door. */
  next?: string[];
}

export interface LightScene {
  name: string;
  /** Brightness per room id, 0 to 100. Rooms left out turn off. */
  levels: Record<string, number>;
}

export interface RoomLightsProps {
  rooms?: Room[];
  scenes?: LightScene[];
  /** The room scenes start from. */
  entrance?: string;
  defaultLevels?: Record<string, number>;
  onChange?: (levels: Record<string, number>) => void;
  className?: string;
}

const W = 400;
const H = 260;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SPREAD_MS = 150;

const DEMO_ROOMS: Room[] = [
  {
    id: "living",
    name: "Living",
    x: 8,
    y: 8,
    w: 216,
    h: 148,
    lamp: { x: 120, y: 64 },
    next: ["hall"],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    x: 224,
    y: 8,
    w: 168,
    h: 96,
    lamp: { x: 298, y: 65 },
    next: ["hall"],
  },
  {
    id: "hall",
    name: "Hall",
    x: 224,
    y: 104,
    w: 168,
    h: 52,
    lamp: { x: 350, y: 130 },
    next: ["living", "kitchen", "office", "bath"],
  },
  {
    id: "bedroom",
    name: "Bedroom",
    x: 8,
    y: 156,
    w: 152,
    h: 96,
    lamp: { x: 46, y: 212 },
    next: ["bath"],
  },
  {
    id: "bath",
    name: "Bath",
    x: 160,
    y: 156,
    w: 96,
    h: 96,
    lamp: { x: 212, y: 194 },
    next: ["hall", "bedroom"],
  },
  {
    id: "office",
    name: "Office",
    x: 256,
    y: 156,
    w: 136,
    h: 96,
    lamp: { x: 300, y: 206 },
    next: ["hall"],
  },
];

// Walls of the demo plan, with gaps left for doors.
const WALLS = [
  "M224 8V118M224 146V156",
  "M224 104H240M270 104H392",
  "M8 156H228M250 156H300M326 156H392",
  "M160 156V200M160 226V252",
  "M256 156V252",
];
const OUTER = "M392 116V8H8V252H392V144";
// A few pieces of furniture, so the rooms read at a glance.
const FURNITURE = [
  "M28 104h96a6 6 0 0 1 6 6v26h-108v-26a6 6 0 0 1 6-6z",
  "M48 70h52v22h-52z",
  "M206 40v64",
  "M366 40h16v56h-16z",
  "M268 54h60v22h-60z",
  "M84 184h62v62h-62zM90 190h22v11h-22zM118 190h22v11h-22z",
  "M170 216h40v28a6 6 0 0 1-6 6h-28a6 6 0 0 1-6-6z",
  "M240 176a8 8 0 1 0 0.01 0",
  "M338 228h46v18h-46z",
  "M361 206a8 8 0 1 0 0.01 0",
];
const DOOR_SWING = "M392 144A28 28 0 0 0 364 116";

const DEMO_SCENES: LightScene[] = [
  {
    name: "Morning",
    levels: { kitchen: 100, bath: 80, hall: 60, bedroom: 45 },
  },
  {
    name: "Evening",
    levels: { living: 70, kitchen: 45, hall: 30, bedroom: 25 },
  },
  { name: "Movie", levels: { living: 12, hall: 10 } },
  { name: "All off", levels: {} },
];

/** Steps from the entrance to every room, walking through doors. */
const distances = (rooms: Room[], entrance: string) => {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const steps: Record<string, number> = { [entrance]: 0 };
  const queue = [entrance];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const next of byId.get(id)?.next ?? []) {
      if (!(next in steps)) {
        steps[next] = steps[id] + 1;
        queue.push(next);
      }
    }
  }
  return steps;
};

const sameLevels = (
  a: Record<string, number>,
  b: Record<string, number>,
  rooms: Room[]
) => rooms.every((r) => (a[r.id] ?? 0) === (b[r.id] ?? 0));

export default function RoomLights({
  rooms = DEMO_ROOMS,
  scenes = DEMO_SCENES,
  entrance = "hall",
  defaultLevels = DEMO_SCENES[1].levels,
  onChange,
  className,
}: RoomLightsProps) {
  const uid = useId();
  const planRef = useRef<HTMLDivElement>(null);
  const [levels, setLevels] = useState<Record<string, number>>(defaultLevels);
  const [selected, setSelected] = useState(rooms[0]?.id);
  // Where each room's light last spread from, and how long it waits.
  const [origins, setOrigins] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [delays, setDelays] = useState<Record<string, number>>({});
  const remembered = useRef<Record<string, number>>({});

  const update = (next: Record<string, number>) => {
    setLevels(next);
    onChange?.(next);
  };

  const toggle = (room: Room, event: { clientX: number; clientY: number }) => {
    const box = planRef.current?.getBoundingClientRect();
    if (box && event.clientX > 0) {
      setOrigins((o) => ({
        ...o,
        [room.id]: {
          x: ((event.clientX - box.left) / box.width) * W,
          y: ((event.clientY - box.top) / box.height) * H,
        },
      }));
    } else {
      setOrigins((o) => ({ ...o, [room.id]: room.lamp }));
    }
    setDelays((d) => ({ ...d, [room.id]: 0 }));
    setSelected(room.id);
    const level = levels[room.id] ?? 0;
    if (level > 0) {
      remembered.current[room.id] = level;
    }
    update({
      ...levels,
      [room.id]: level > 0 ? 0 : (remembered.current[room.id] ?? 80),
    });
  };

  const applyScene = (scene: LightScene) => {
    const steps = distances(rooms, entrance);
    setOrigins(Object.fromEntries(rooms.map((r) => [r.id, r.lamp])));
    setDelays(
      Object.fromEntries(
        rooms.map((r) => [r.id, (steps[r.id] ?? 0) * SPREAD_MS])
      )
    );
    update(
      Object.fromEntries(rooms.map((r) => [r.id, scene.levels[r.id] ?? 0]))
    );
  };

  const room = rooms.find((r) => r.id === selected);
  const onCount = rooms.filter((r) => (levels[r.id] ?? 0) > 0).length;
  const activeScene = scenes.find((s) => sameLevels(s.levels, levels, rooms));

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex items-center gap-2 px-4 pt-4 text-[13px]">
          <Lightbulb
            aria-hidden="true"
            className="size-4 text-zinc-500 dark:text-zinc-400"
          />
          <span className="font-medium">Lights</span>
          <span className="ml-auto text-zinc-500 tabular-nums dark:text-zinc-400">
            {onCount} of {rooms.length} on
          </span>
        </div>

        <div className="relative mx-4 mt-3" ref={planRef}>
          <svg
            aria-hidden="true"
            className="block h-auto w-full"
            viewBox={`0 0 ${W} ${H}`}
          >
            <defs>
              {rooms.map((r) => (
                <clipPath id={`${uid}-${r.id}-walls`} key={`${r.id}-walls`}>
                  <rect height={r.h} width={r.w} x={r.x} y={r.y} />
                </clipPath>
              ))}
              {rooms.map((r) => {
                const on = (levels[r.id] ?? 0) > 0;
                const from = origins[r.id] ?? r.lamp;
                // Far enough to cover the room from wherever it starts.
                const reach =
                  Math.hypot(
                    Math.max(from.x - r.x, r.x + r.w - from.x),
                    Math.max(from.y - r.y, r.y + r.h - from.y)
                  ) + 4;
                return (
                  <clipPath
                    // Light stays inside its own walls.
                    clipPath={`url(#${uid}-${r.id}-walls)`}
                    id={`${uid}-${r.id}`}
                    key={r.id}
                  >
                    <motion.circle
                      animate={{ r: on ? reach : 0 }}
                      cx={from.x}
                      cy={from.y}
                      initial={false}
                      transition={{
                        delay: (delays[r.id] ?? 0) / 1000,
                        duration: on ? 0.7 : 0.45,
                        ease: EASE_OUT,
                      }}
                    />
                  </clipPath>
                );
              })}
            </defs>

            {rooms.map((r) => {
              const level = levels[r.id] ?? 0;
              const on = level > 0;
              return (
                <g key={r.id}>
                  <rect
                    className="fill-zinc-50 dark:fill-zinc-900"
                    height={r.h}
                    width={r.w}
                    x={r.x}
                    y={r.y}
                  />
                  <g
                    className="transition-opacity duration-300"
                    clipPath={`url(#${uid}-${r.id})`}
                    style={{ opacity: 0.35 + (level / 100) * 0.65 }}
                  >
                    <rect
                      className="fill-orange-50 dark:fill-orange-300/10"
                      height={r.h}
                      width={r.w}
                      x={r.x}
                      y={r.y}
                    />
                    {/* Light falls off in steps around the lamp. */}
                    <circle
                      className="fill-orange-100 dark:fill-orange-300/10"
                      cx={r.lamp.x}
                      cy={r.lamp.y}
                      r={Math.min(r.w, r.h) * 0.62}
                    />
                    <circle
                      className="fill-orange-200/70 dark:fill-orange-300/10"
                      cx={r.lamp.x}
                      cy={r.lamp.y}
                      r={Math.min(r.w, r.h) * 0.32}
                    />
                  </g>
                  <rect
                    className={cn(
                      "fill-none transition-opacity duration-200",
                      "stroke-zinc-900 dark:stroke-zinc-100",
                      selected === r.id ? "opacity-100" : "opacity-0"
                    )}
                    height={r.h - 8}
                    rx={4}
                    strokeDasharray="3 3"
                    width={r.w - 8}
                    x={r.x + 4}
                    y={r.y + 4}
                  />
                  <circle
                    className={cn(
                      "transition-colors duration-300",
                      on
                        ? "fill-orange-400"
                        : "fill-zinc-300 dark:fill-zinc-700"
                    )}
                    cx={r.lamp.x}
                    cy={r.lamp.y}
                    r={3.5}
                  />
                  <text
                    className="fill-zinc-900 font-medium text-[11px] dark:fill-zinc-100"
                    x={r.x + 12}
                    y={r.y + 22}
                  >
                    {r.name}
                  </text>
                  <text
                    className={cn(
                      "text-[10px] tabular-nums transition-opacity duration-300",
                      on
                        ? "fill-orange-700 opacity-100 dark:fill-orange-300"
                        : "opacity-0"
                    )}
                    textAnchor="end"
                    x={r.x + r.w - 12}
                    y={r.y + 22}
                  >
                    {level}%
                  </text>
                </g>
              );
            })}

            <path
              className="fill-none stroke-zinc-300 dark:stroke-zinc-700"
              d={FURNITURE.join("")}
            />
            <path
              className="fill-none stroke-zinc-300 dark:stroke-zinc-700"
              d={DOOR_SWING}
              strokeDasharray="2 3"
            />
            <path
              className="fill-none stroke-zinc-800 dark:stroke-zinc-300"
              d={WALLS.join("")}
              strokeLinecap="round"
              strokeWidth={2.5}
            />
            <path
              className="fill-none stroke-zinc-800 dark:stroke-zinc-300"
              d={OUTER}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={4}
            />
          </svg>

          {rooms.map((r) => (
            <button
              aria-label={`${r.name} light`}
              aria-pressed={(levels[r.id] ?? 0) > 0}
              className="absolute rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-orange-400/60"
              key={r.id}
              onClick={(event) => toggle(r, event)}
              style={{
                left: `${(r.x / W) * 100}%`,
                top: `${(r.y / H) * 100}%`,
                width: `${(r.w / W) * 100}%`,
                height: `${(r.h / H) * 100}%`,
              }}
              type="button"
            />
          ))}
        </div>

        {room && (
          <div className="flex items-center gap-3 px-4 pt-4">
            <span className="w-16 shrink-0 text-[12.5px] text-zinc-500 dark:text-zinc-400">
              {room.name}
            </span>
            <Dimmer
              label={`${room.name} brightness`}
              onChange={(value) => {
                setDelays((d) => ({ ...d, [room.id]: 0 }));
                update({ ...levels, [room.id]: value });
              }}
              value={levels[room.id] ?? 0}
            />
          </div>
        )}

        <div className="mt-4 flex gap-1 border-zinc-100 border-t p-2 dark:border-zinc-800/80">
          {scenes.map((scene) => {
            const active = activeScene?.name === scene.name;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "relative h-8 flex-1 rounded-md text-[12.5px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
                  active
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
                key={scene.name}
                onClick={() => applyScene(scene)}
                type="button"
              >
                {active && (
                  <motion.span
                    className="absolute inset-0 rounded-md bg-zinc-100 dark:bg-zinc-800"
                    layoutId={`${uid}-scene`}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative">{scene.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </MotionConfig>
  );
}

function Dimmer({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const fromPointer = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    onChange(Math.round(ratio * 20) * 5);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: 5,
      ArrowUp: 5,
      ArrowLeft: -5,
      ArrowDown: -5,
    };
    if (event.key in keys) {
      event.preventDefault();
      onChange(Math.min(100, Math.max(0, value + keys[event.key])));
    }
  };

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      aria-valuetext={value === 0 ? "Off" : `${value}%`}
      className="relative h-8 flex-1 cursor-pointer touch-none select-none overflow-hidden rounded-lg bg-zinc-100 outline-hidden focus-visible:ring-2 focus-visible:ring-orange-400/60 dark:bg-zinc-900"
      onKeyDown={onKeyDown}
      onPointerCancel={() => setDragging(false)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        fromPointer(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging) {
          fromPointer(event.clientX);
        }
      }}
      onPointerUp={() => setDragging(false)}
      ref={trackRef}
      role="slider"
      tabIndex={0}
    >
      <motion.div
        animate={{ width: `${value}%` }}
        className="absolute inset-y-0 left-0 bg-orange-200 dark:bg-orange-300/25"
        initial={false}
        transition={
          dragging ? { duration: 0 } : { duration: 0.35, ease: EASE_OUT }
        }
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-zinc-600 tabular-nums dark:text-zinc-300">
        {value === 0 ? "Off" : `${value}%`}
      </span>
    </div>
  );
}
