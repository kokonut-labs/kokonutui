"use client";

/**
 * @author: @kokonutui
 * @description: Energy Flow
 * @version: 1.0.0
 * @date: 2026-11-06
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  BatteryMedium,
  House,
  Moon,
  Pause,
  Play,
  Sun,
  UtilityPole,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface EnergyFlowProps {
  /** Peak solar output in kW. */
  solarPeak?: number;
  /** Battery size in kWh. */
  batteryCapacity?: number;
  /** Hour of the day to start on, 0 to 24. */
  defaultHour?: number;
  /** Demo: ms per quarter hour while playing. */
  quarterMs?: number;
  className?: string;
}

interface Slot {
  solar: number;
  home: number;
  soc: number;
  solarHome: number;
  solarBattery: number;
  solarGrid: number;
  batteryHome: number;
  gridHome: number;
}

const W = 360;
const H = 250;
const NODE_R = 22;
const NODES = {
  solar: { x: 180, y: 34 },
  grid: { x: 44, y: 125 },
  home: { x: 316, y: 125 },
  battery: { x: 180, y: 216 },
} as const;

type FlowKey =
  | "solarHome"
  | "solarBattery"
  | "solarGrid"
  | "gridHome"
  | "batteryHome";

const FLOWS: { key: FlowKey; d: string; tone: string; stroke: string }[] = [
  {
    key: "solarHome",
    d: "M180 56C180 108 228 125 294 125",
    tone: "fill-orange-500",
    stroke: "stroke-orange-400/50",
  },
  {
    key: "solarBattery",
    d: "M180 56V194",
    tone: "fill-orange-500",
    stroke: "stroke-orange-400/50",
  },
  {
    key: "solarGrid",
    d: "M180 56C180 108 132 125 66 125",
    tone: "fill-orange-500",
    stroke: "stroke-orange-400/50",
  },
  {
    key: "gridHome",
    d: "M66 125H294",
    tone: "fill-zinc-500 dark:fill-zinc-300",
    stroke: "stroke-zinc-400/60 dark:stroke-zinc-500/60",
  },
  {
    key: "batteryHome",
    d: "M180 194C180 142 228 125 294 125",
    tone: "fill-emerald-500",
    stroke: "stroke-emerald-500/50",
  },
];

const SLOTS_PER_DAY = 96;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const PARTICLE_SPEED = 80;
const PARTICLES_PER_KW = 3.2;
const POOL = 140;

/** Household use through a typical day, in kW. */
const homeLoad = (h: number) => {
  const morning = Math.exp(-((h - 7.5) ** 2) / 1.2) * 1.6;
  const evening = Math.exp(-((h - 19.5) ** 2) / 3) * 2.4;
  return 0.45 + morning + evening + (h > 9 && h < 17 ? 0.5 : 0);
};

/** A simulated day, a quarter hour at a time, the same on server and browser. */
const simulateDay = (solarPeak: number, capacity: number): Slot[] => {
  const slots: Slot[] = [];
  let stored = capacity * 0.45;
  const reserve = capacity * 0.1;
  const maxRate = 3.3;
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const h = i / 4;
    const solar =
      Math.max(0, Math.sin(((h - 6.2) / 12.4) * Math.PI)) * solarPeak;
    const home = homeLoad(h);
    const solarHome = Math.min(solar, home);
    const surplus = solar - solarHome;
    const solarBattery = Math.min(surplus, maxRate, (capacity - stored) * 4);
    const solarGrid = surplus - solarBattery;
    const need = home - solarHome;
    const batteryHome = Math.min(
      need,
      maxRate,
      Math.max(0, stored - reserve) * 4
    );
    const gridHome = need - batteryHome;
    stored += (solarBattery - batteryHome) / 4;
    const round = (n: number) => Math.round(n * 100) / 100;
    slots.push({
      solar: round(solar),
      home: round(home),
      soc: Math.round((stored / capacity) * 100),
      solarHome: round(solarHome),
      solarBattery: round(solarBattery),
      solarGrid: round(solarGrid),
      batteryHome: round(batteryHome),
      gridHome: round(gridHome),
    });
  }
  return slots;
};

const clock = (slot: number) => {
  const h = Math.floor(slot / 4);
  const m = (slot % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const kw = (n: number) => `${n.toFixed(1)} kW`;

const batteryValue = (s: Slot) => {
  if (s.solarBattery > 0.05) {
    return `+${kw(s.solarBattery)}`;
  }
  if (s.batteryHome > 0.05) {
    return `−${kw(s.batteryHome)}`;
  }
  return s.soc >= 99 ? "Full" : "Idle";
};

const headline = (s: Slot) => {
  if (s.solarGrid > 0.2) {
    return `Sending ${kw(s.solarGrid)} back to the grid`;
  }
  if (s.solarBattery > 0.2) {
    return "Charging the battery from the sun";
  }
  if (s.solar > 0.2 && s.gridHome < 0.1 && s.batteryHome < 0.1) {
    return "Running on sunshine";
  }
  if (s.batteryHome > 0.1 && s.gridHome < 0.1) {
    return "Running on the battery";
  }
  return `Drawing ${kw(s.gridHome)} from the grid`;
};

interface Particle {
  on: boolean;
  flow: number;
  d: number;
  offset: number;
}

export default function EnergyFlow({
  solarPeak = 6,
  batteryCapacity = 13.5,
  defaultHour = 11,
  quarterMs = 320,
  className,
}: EnergyFlowProps) {
  const [day] = useState(() => simulateDay(solarPeak, batteryCapacity));
  const [slot, setSlot] = useState(Math.round(defaultHour * 4));
  const [playing, setPlaying] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const now = day[slot];
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    if (!playing || scrubbing) {
      return;
    }
    const id = window.setInterval(() => {
      setSlot((s) => (s + 1) % SLOTS_PER_DAY);
    }, quarterMs);
    return () => window.clearInterval(id);
  }, [playing, scrubbing, quarterMs]);

  // Energy is drawn straight to the DOM; nothing re-renders per frame.
  useEffect(() => {
    const paths = pathRefs.current;
    if (paths.some((p) => !p)) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const lengths = paths.map((p) => p?.getTotalLength() ?? 0);
    const particles: Particle[] = Array.from({ length: POOL }, () => ({
      on: false,
      flow: 0,
      d: 0,
      offset: 0,
    }));
    const pending = FLOWS.map(() => 0);
    let frame = 0;
    let last = performance.now();
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      FLOWS.forEach((flow, f) => {
        pending[f] += nowRef.current[flow.key] * PARTICLES_PER_KW * dt;
        while (pending[f] >= 1) {
          pending[f] -= 1;
          const free = particles.find((p) => !p.on);
          if (free) {
            free.on = true;
            free.flow = f;
            free.d = 0;
            free.offset = Math.random() * 2.4 - 1.2;
          }
        }
      });
      particles.forEach((p, i) => {
        const el = dotRefs.current[i];
        if (!el) {
          return;
        }
        if (!p.on) {
          el.setAttribute("opacity", "0");
          return;
        }
        p.d += PARTICLE_SPEED * dt;
        const length = lengths[p.flow];
        if (p.d >= length) {
          p.on = false;
          el.setAttribute("opacity", "0");
          return;
        }
        const point = paths[p.flow]?.getPointAtLength(p.d);
        if (!point) {
          return;
        }
        const fade = Math.min(1, p.d / 10, (length - p.d) / 10);
        el.setAttribute("cx", (point.x + p.offset).toFixed(1));
        el.setAttribute("cy", (point.y + p.offset).toFixed(1));
        el.setAttribute("opacity", fade.toFixed(2));
        el.setAttribute("class", FLOWS[p.flow].tone);
      });
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const scrubTo = (clientX: number) => {
    const box = chartRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    const ratio = Math.min(
      0.999,
      Math.max(0, (clientX - box.left) / box.width)
    );
    setSlot(Math.floor(ratio * SLOTS_PER_DAY));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 4 : 1;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      setPlaying(false);
      const dir = event.key === "ArrowRight" ? step : -step;
      setSlot((s) => (s + dir + SLOTS_PER_DAY) % SLOTS_PER_DAY);
    }
  };

  const night = now.solar < 0.05;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex items-baseline gap-2 px-4 pt-4">
          <span className="font-medium text-[14px]">Energy</span>
          <span className="font-mono text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
            {clock(slot)}
          </span>
          <span className="relative ml-auto min-w-0 flex-1 overflow-hidden text-right text-[12px] text-zinc-500 dark:text-zinc-400">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, y: 0 }}
                className="block truncate"
                exit={{ opacity: 0, y: -6 }}
                initial={{ opacity: 0, y: 6 }}
                key={headline(now)}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                {headline(now)}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        <div className="relative mx-auto w-full max-w-[380px] px-2 pt-5 pb-11">
          <div className="relative">
            <svg
              aria-label={`At ${clock(slot)}: solar ${kw(now.solar)}, home ${kw(now.home)}, battery ${now.soc}%`}
              className="block h-auto w-full"
              role="img"
              viewBox={`0 0 ${W} ${H}`}
            >
              {FLOWS.map((flow, f) => {
                const active = now[flow.key] > 0.05;
                return (
                  <g key={flow.key}>
                    <path
                      className="fill-none stroke-zinc-100 dark:stroke-zinc-900"
                      d={flow.d}
                      strokeLinecap="round"
                      strokeWidth={6}
                    />
                    <path
                      className={cn(
                        "fill-none transition-opacity duration-500",
                        flow.stroke,
                        active ? "opacity-100" : "opacity-0"
                      )}
                      d={flow.d}
                      ref={(el) => {
                        pathRefs.current[f] = el;
                      }}
                      strokeDasharray="1 4"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}

              {Array.from({ length: POOL }, (_, i) => (
                <circle
                  className="fill-orange-500"
                  cx={0}
                  cy={0}
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed pool, drawn by position
                  key={i}
                  opacity={0}
                  r={2.1}
                  ref={(el) => {
                    dotRefs.current[i] = el;
                  }}
                />
              ))}

              <BatteryRing soc={now.soc} />
            </svg>

            <Node
              icon={
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ opacity: 1, rotate: 0 }}
                    className="flex"
                    exit={{ opacity: 0, rotate: 90 }}
                    initial={{ opacity: 0, rotate: -90 }}
                    key={night ? "moon" : "sun"}
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                  >
                    {night ? (
                      <Moon aria-hidden="true" className="size-4" />
                    ) : (
                      <Sun aria-hidden="true" className="size-4" />
                    )}
                  </motion.span>
                </AnimatePresence>
              }
              label="Solar"
              live={!night}
              position={NODES.solar}
              tone="orange"
              value={kw(now.solar)}
            />
            <Node
              icon={<UtilityPole aria-hidden="true" className="size-4" />}
              label={now.solarGrid > 0.05 ? "Exporting" : "Grid"}
              live={now.gridHome > 0.05 || now.solarGrid > 0.05}
              position={NODES.grid}
              tone="zinc"
              value={kw(now.solarGrid > 0.05 ? now.solarGrid : now.gridHome)}
            />
            <Node
              icon={<House aria-hidden="true" className="size-4" />}
              label="Home"
              live
              position={NODES.home}
              tone="zinc"
              value={kw(now.home)}
            />
            <Node
              below
              icon={<BatteryMedium aria-hidden="true" className="size-4" />}
              label={`Battery ${now.soc}%`}
              live={now.solarBattery > 0.05 || now.batteryHome > 0.05}
              position={NODES.battery}
              tone="emerald"
              value={batteryValue(now)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-zinc-100 border-t px-3 py-3 dark:border-zinc-800/80">
          <button
            aria-label={playing ? "Pause the day" : "Play the day"}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-600 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={() => setPlaying((p) => !p)}
            type="button"
          >
            {playing ? (
              <Pause aria-hidden="true" className="size-4" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
          </button>
          <div
            aria-label="Time of day"
            aria-valuemax={SLOTS_PER_DAY - 1}
            aria-valuemin={0}
            aria-valuenow={slot}
            aria-valuetext={clock(slot)}
            className="relative h-12 flex-1 cursor-ew-resize touch-none select-none rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50"
            onKeyDown={onKeyDown}
            onPointerCancel={() => setScrubbing(false)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setScrubbing(true);
              scrubTo(event.clientX);
            }}
            onPointerMove={(event) => {
              if (scrubbing) {
                scrubTo(event.clientX);
              }
            }}
            onPointerUp={() => setScrubbing(false)}
            ref={chartRef}
            role="slider"
            tabIndex={0}
          >
            <DayChart day={day} peak={Math.max(solarPeak, 4)} slot={slot} />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

function Node({
  position,
  icon,
  label,
  value,
  tone,
  live,
  below = false,
}: {
  position: { x: number; y: number };
  icon: ReactNode;
  label: string;
  value: string;
  tone: "orange" | "emerald" | "zinc";
  live: boolean;
  below?: boolean;
}) {
  const toneClass = {
    orange: "text-orange-500 border-orange-200 dark:border-orange-400/30",
    emerald:
      "text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-400/30",
    zinc: "text-zinc-700 border-zinc-200 dark:text-zinc-200 dark:border-zinc-700",
  }[tone];
  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{
        left: `${(position.x / W) * 100}%`,
        top: `${(position.y / H) * 100}%`,
      }}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full border bg-white transition-colors duration-300 dark:bg-zinc-950",
          live
            ? toneClass
            : "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "absolute flex flex-col items-center whitespace-nowrap text-[11px] leading-tight",
          below ? "top-full mt-1.5" : "bottom-full mb-1.5"
        )}
      >
        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="font-medium text-[12px] text-zinc-900 tabular-nums dark:text-zinc-100">
          {value}
        </span>
      </span>
    </div>
  );
}

function BatteryRing({ soc }: { soc: number }) {
  const r = NODE_R + 4;
  const length = 2 * Math.PI * r;
  return (
    <circle
      className="fill-none stroke-emerald-500 transition-[stroke-dashoffset] duration-300 ease-out"
      cx={NODES.battery.x}
      cy={NODES.battery.y}
      r={r}
      strokeDasharray={length}
      strokeDashoffset={length * (1 - soc / 100)}
      strokeLinecap="round"
      strokeWidth={2}
      transform={`rotate(-90 ${NODES.battery.x} ${NODES.battery.y})`}
    />
  );
}

function DayChart({
  day,
  slot,
  peak,
}: {
  day: Slot[];
  slot: number;
  peak: number;
}) {
  const cw = 300;
  const ch = 48;
  const x = (i: number) =>
    Math.round((i / (SLOTS_PER_DAY - 1)) * cw * 100) / 100;
  const y = (v: number) =>
    Math.round((ch - 4 - (v / peak) * (ch - 10)) * 100) / 100;
  const solar = `M0 ${ch}${day.map((s, i) => `L${x(i)} ${y(s.solar)}`).join("")}L${cw} ${ch}Z`;
  const home = day
    .map((s, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(s.home)}`)
    .join("");
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox={`0 0 ${cw} ${ch}`}
    >
      <path className="fill-orange-100 dark:fill-orange-400/15" d={solar} />
      <path
        className="fill-none stroke-zinc-400 dark:stroke-zinc-500"
        d={home}
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
      <line
        className="stroke-zinc-900 dark:stroke-zinc-100"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        x1={x(slot)}
        x2={x(slot)}
        y1={0}
        y2={ch}
      />
    </svg>
  );
}
