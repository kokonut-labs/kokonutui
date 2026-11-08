"use client";

/**
 * @author: @kokonutui
 * @description: Energy Aurora
 * @version: 1.0.0
 * @date: 2026-11-07
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { BatteryMedium, Sun, UtilityPole } from "lucide-react";
import {
  AnimatePresence,
  animate,
  MotionConfig,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface EnergyMoment {
  label: string;
  time: string;
  headline: string;
  /** What the house is using, in kW. */
  usage: number;
  battery: number;
  /** Share of the house's power from each source, adding up to 100. */
  mix: { solar: number; battery: number; grid: number };
  /** Three colors for the sky behind the numbers. */
  sky: [string, string, string];
}

export interface EnergyAuroraProps {
  moments?: EnergyMoment[];
  /** Demo: ms per moment while it plays on its own. 0 turns autoplay off. */
  autoplayMs?: number;
  className?: string;
}

const DEMO_MOMENTS: EnergyMoment[] = [
  {
    label: "Sunrise",
    time: "07:10",
    headline: "Waking up with the sun",
    usage: 1.6,
    battery: 38,
    mix: { solar: 55, battery: 45, grid: 0 },
    sky: ["#fb7185", "#fb923c", "#a78bfa"],
  },
  {
    label: "Noon",
    time: "13:00",
    headline: "Sending 3.2 kW back to the grid",
    usage: 1.1,
    battery: 100,
    mix: { solar: 100, battery: 0, grid: 0 },
    sky: ["#f97316", "#ec4899", "#fb7185"],
  },
  {
    label: "Evening",
    time: "19:30",
    headline: "Running on the battery",
    usage: 2.6,
    battery: 71,
    mix: { solar: 8, battery: 87, grid: 5 },
    sky: ["#34d399", "#2dd4bf", "#8b5cf6"],
  },
  {
    label: "Night",
    time: "01:45",
    headline: "Cheap night power from the grid",
    usage: 0.5,
    battery: 22,
    mix: { solar: 0, battery: 20, grid: 80 },
    sky: ["#6366f1", "#38bdf8", "#7c3aed"],
  },
];

const SOURCES = [
  {
    key: "solar",
    name: "Sun",
    icon: Sun,
    gradient: "linear-gradient(90deg, #fb923c, #f472b6)",
  },
  {
    key: "battery",
    name: "Battery",
    icon: BatteryMedium,
    gradient: "linear-gradient(90deg, #10b981, #2dd4bf)",
  },
  {
    key: "grid",
    name: "Grid",
    icon: UtilityPole,
    gradient: "linear-gradient(90deg, #38bdf8, #6366f1)",
  },
] as const;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
// Half the space between two slices of the bar, in percent.
const GAP = 0.6;

/** One soft sweep of the moment's colors, painted once. Only its opacity animates. */
const skyFor = ([a, b, c]: [string, string, string]) =>
  `linear-gradient(to top, rgba(0,0,0,0.22), transparent 60%), radial-gradient(90% 80% at 100% 0%, ${b}, transparent 70%), linear-gradient(150deg, ${a}, ${c})`;

/** Where each source's slice of the bar starts and ends, in percent. */
const slices = (mix: EnergyMoment["mix"]) => {
  let start = 0;
  return SOURCES.map((source) => {
    const end = start + mix[source.key];
    const left = start > 0 ? start + GAP : 0;
    const right = end < 100 ? 100 - end + GAP : 0;
    const clip = `inset(0% ${Math.min(right, 100)}% 0% ${Math.min(left, 100)}% round 999px)`;
    start = end;
    return { key: source.key, clip };
  });
};

export default function EnergyAurora({
  moments = DEMO_MOMENTS,
  autoplayMs = 4200,
  className,
}: EnergyAuroraProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-80px" });
  const [index, setIndex] = useState(1);
  const [auto, setAuto] = useState(autoplayMs > 0);
  const moment = moments[index];

  useEffect(() => {
    if (!(auto && inView)) {
      return;
    }
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % moments.length);
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [auto, inView, autoplayMs, moments.length]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-sm overflow-hidden rounded-[28px] border border-zinc-200 bg-white p-2 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
        ref={rootRef}
      >
        <div className="relative isolate h-60 overflow-hidden rounded-[22px] bg-zinc-950 text-white">
          {/* Each moment's sky fades over the last. */}
          {moments.map((m, i) => (
            <motion.div
              animate={{ opacity: i === index ? 1 : 0 }}
              aria-hidden="true"
              className="absolute inset-0"
              initial={false}
              key={m.label}
              style={{ background: skyFor(m.sky) }}
              transition={{ duration: 0.8, ease: EASE_IN_OUT }}
            />
          ))}
          {/* Fine grain keeps the colors from banding. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          <div className="relative flex h-full flex-col justify-between p-5">
            <div className="flex items-center justify-between text-[12px] text-white/80">
              <span>Home energy</span>
              <span className="font-mono tabular-nums">{moment.time}</span>
            </div>
            <div>
              <p className="flex items-baseline gap-1.5">
                <span className="font-semibold text-[52px] tabular-nums leading-none tracking-tight">
                  <Count value={moment.usage} />
                </span>
                <span className="text-[16px] text-white/80">kW in use</span>
              </p>
              <div className="relative mt-2 h-6 overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.p
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    className="text-[14px] text-white/90"
                    exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
                    initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                    key={moment.headline}
                    transition={{ duration: 0.35, ease: EASE_OUT }}
                  >
                    {moment.headline}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 pt-4">
          {/* Each slice is clipped out of a full-width bar, so nothing reflows. */}
          <div className="relative h-2.5">
            {slices(moment.mix).map((slice, i) => (
              <motion.div
                animate={{ clipPath: slice.clip }}
                className="absolute inset-0"
                initial={false}
                key={slice.key}
                style={{ background: SOURCES[i].gradient }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SOURCES.map((source) => (
              <Legend
                icon={<source.icon aria-hidden="true" className="size-3.5" />}
                key={source.key}
                label={
                  source.key === "battery"
                    ? `Battery ${moment.battery}%`
                    : source.name
                }
                muted={moment.mix[source.key] === 0}
                value={moment.mix[source.key]}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-1 rounded-[20px] bg-zinc-100 p-1 dark:bg-zinc-900">
          {moments.map((m, i) => (
            <button
              aria-pressed={i === index}
              className={cn(
                "relative h-9 flex-1 rounded-2xl text-[12.5px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
                i === index
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              )}
              key={m.label}
              onClick={() => {
                setAuto(false);
                setIndex(i);
              }}
              type="button"
            >
              {i === index && (
                <motion.span
                  className="absolute inset-0 rounded-2xl bg-white shadow-xs dark:bg-zinc-800"
                  layoutId={`${uid}-moment`}
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>
      </div>
    </MotionConfig>
  );
}

function Legend({
  icon,
  label,
  value,
  muted,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  muted: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 transition-opacity duration-300",
        muted && "opacity-40"
      )}
    >
      <span className="flex items-center gap-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
        {icon}
        {label}
      </span>
      <span className="font-medium text-[15px] tabular-nums">
        <Count decimals={0} value={value} />%
      </span>
    </div>
  );
}

function Count({ value, decimals = 1 }: { value: number; decimals?: number }) {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, (v) => v.toFixed(decimals));
  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.5,
      ease: EASE_OUT,
    });
    return () => controls.stop();
  }, [motionValue, value]);
  return <motion.span>{text}</motion.span>;
}
