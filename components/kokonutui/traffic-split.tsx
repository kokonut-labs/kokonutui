"use client";

/**
 * @author: @kokonutui
 * @description: Traffic Split
 * @version: 1.0.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AnimatePresence,
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TrafficVersion {
  name: string;
  label: string;
  /** p95 latency in ms. Faster versions move their requests faster. */
  p95: number;
  /** Error rate in percent. */
  errorRate: number;
}

export interface TrafficSplitProps {
  service?: string;
  current?: TrafficVersion;
  canary?: TrafficVersion;
  /** Canary shares to step through, in percent. */
  steps?: number[];
  defaultShare?: number;
  /** Requests per second across both versions. */
  rps?: number;
  onShareChange?: (share: number) => void;
  className?: string;
}

const DEMO_CURRENT: TrafficVersion = {
  name: "v41",
  label: "Current",
  p95: 182,
  errorRate: 0.4,
};
const DEMO_CANARY: TrafficVersion = {
  name: "v42",
  label: "Canary",
  p95: 148,
  errorRate: 0.1,
};
const DEMO_STEPS = [0, 5, 25, 50, 100];

const W = 400;
const H = 180;
const SOURCE_X = 18;
const ROUTER_X = 138;
const MID = 90;
const LANE_Y = [44, 136] as const;
const END_X = 334;
const TRUNK = `M${SOURCE_X} ${MID}H${ROUTER_X}`;
const lanePath = (y: number) =>
  `M${ROUTER_X} ${MID}C${ROUTER_X + 54} ${MID} ${ROUTER_X + 46} ${y} ${ROUTER_X + 100} ${y}H${END_X}`;
const LANES = [lanePath(LANE_Y[0]), lanePath(LANE_Y[1])];

const MIN_WIDTH = 3;
const MAX_WIDTH = 15;
const laneWidth = (share: number) => MIN_WIDTH + (share / 100) * MAX_WIDTH;

const POOL = 96;
const BURSTS = 8;
const SPAWN_PER_SECOND = 26;
// Units per second for a 200ms p95; faster versions move faster.
const BASE_SPEED = 150;
// Errors are rare; the drawing shows them a few times more often.
const ERROR_VISIBILITY = 6;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const PARTICLE_CLASS = {
  trunk: "fill-zinc-400 dark:fill-zinc-500",
  current: "fill-zinc-500 dark:fill-zinc-300",
  canary: "fill-sky-500 dark:fill-sky-400",
  error: "fill-rose-500",
};

interface Particle {
  on: boolean;
  /** -1 on the way to the router, then 0 (current) or 1 (canary). */
  lane: -1 | 0 | 1;
  d: number;
  offset: number;
  error: boolean;
}

interface Burst {
  on: boolean;
  t: number;
  lane: 0 | 1;
}

interface FlowShape {
  trunk: SVGPathElement;
  lanes: SVGPathElement[];
  trunkLength: number;
  laneLengths: number[];
}

const format = (n: number) => Math.round(n).toLocaleString("en-US");

export default function TrafficSplit({
  service = "checkout-api",
  current = DEMO_CURRENT,
  canary = DEMO_CANARY,
  steps = DEMO_STEPS,
  defaultShare = 5,
  rps = 1240,
  onShareChange,
  className,
}: TrafficSplitProps) {
  const [share, setShare] = useState(defaultShare);
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const trunkRef = useRef<SVGPathElement>(null);
  const laneRefs = useRef<(SVGPathElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const burstRefs = useRef<(SVGCircleElement | null)[]>([]);
  const shareRef = useRef(share);
  const versionsRef = useRef([current, canary]);

  shareRef.current = share;
  versionsRef.current = [current, canary];

  const choose = (next: number) => {
    setShare(next);
    onShareChange?.(next);
  };

  // Requests are drawn straight to the DOM; nothing re-renders per frame.
  useEffect(() => {
    const trunk = trunkRef.current;
    const [top, bottom] = laneRefs.current;
    const svg = svgRef.current;
    if (!(trunk && top && bottom && svg)) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const shape: FlowShape = {
      trunk,
      lanes: [top, bottom],
      trunkLength: trunk.getTotalLength(),
      laneLengths: [top.getTotalLength(), bottom.getTotalLength()],
    };
    const particles: Particle[] = Array.from({ length: POOL }, () => ({
      on: false,
      lane: -1,
      d: 0,
      offset: 0,
      error: false,
    }));
    const bursts: Burst[] = Array.from({ length: BURSTS }, () => ({
      on: false,
      t: 0,
      lane: 0,
    }));

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(svg);

    let frame = 0;
    let last = performance.now();
    let pending = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible) {
        return;
      }
      pending += dt * SPAWN_PER_SECOND;
      while (pending >= 1) {
        pending -= 1;
        spawn(particles);
      }
      const context = {
        dt,
        share: shareRef.current,
        versions: versionsRef.current,
        shape,
      };
      particles.forEach((p, i) => {
        const ended = advance(p, context);
        if (ended !== null) {
          startBurst(bursts, ended);
        }
        draw(dotRefs.current[i], p, context);
      });
      bursts.forEach((b, i) => {
        drawBurst(burstRefs.current[i], b, dt);
      });
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const total = rps;
  const rows = [
    { version: current, share: 100 - share, lane: 0 as const },
    { version: canary, share, lane: 1 as const },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex items-center gap-2.5 px-4 pt-4">
          <span className="font-medium text-[14px]">{service}</span>
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {format(total)} req/s
          </span>
          <span className="ml-auto text-[12px]">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, y: 0 }}
                className={cn("block", statusTone(share))}
                exit={{ opacity: 0, y: -6 }}
                initial={{ opacity: 0, y: 6 }}
                key={share}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                {statusText(share, canary.name)}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        <svg
          aria-label={`${100 - share}% of requests go to ${current.name}, ${share}% to ${canary.name}`}
          className="block h-auto w-full"
          ref={svgRef}
          role="img"
          viewBox={`0 0 ${W} ${H}`}
        >
          <path
            className="fill-none stroke-zinc-100 dark:stroke-zinc-900"
            d={TRUNK}
            strokeLinecap="round"
            strokeWidth={MIN_WIDTH + MAX_WIDTH}
          />
          <path
            className="fill-none stroke-zinc-300 dark:stroke-zinc-700"
            d={TRUNK}
            ref={trunkRef}
            strokeDasharray="1 4"
            strokeLinecap="round"
          />

          {rows.map(({ lane, share: laneShare }) => (
            <g
              className={cn(
                "transition-opacity duration-500",
                laneShare === 0 && "opacity-40"
              )}
              key={lane}
            >
              <path
                className={cn(
                  "fill-none transition-[stroke-width] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
                  lane === 1
                    ? "stroke-sky-500/15 dark:stroke-sky-400/15"
                    : "stroke-zinc-100 dark:stroke-zinc-900"
                )}
                d={LANES[lane]}
                strokeLinecap="round"
                style={{ strokeWidth: laneWidth(laneShare) }}
              />
              <path
                className={cn(
                  "fill-none",
                  lane === 1
                    ? "stroke-sky-500/50 dark:stroke-sky-400/50"
                    : "stroke-zinc-300 dark:stroke-zinc-700"
                )}
                d={LANES[lane]}
                ref={(el) => {
                  laneRefs.current[lane] = el;
                }}
                strokeDasharray="1 4"
                strokeLinecap="round"
              />
              <text
                className={cn(
                  "font-mono text-[10px] tabular-nums",
                  lane === 1
                    ? "fill-sky-600 dark:fill-sky-400"
                    : "fill-zinc-500 dark:fill-zinc-400"
                )}
                dominantBaseline="central"
                textAnchor="end"
                x={END_X}
                y={lane === 0 ? LANE_Y[0] - 18 : LANE_Y[1] + 18}
              >
                {laneShare}%
              </text>
            </g>
          ))}

          {Array.from({ length: POOL }, (_, i) => (
            <circle
              className={PARTICLE_CLASS.trunk}
              cx={SOURCE_X}
              cy={MID}
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed pool, drawn by position
              key={i}
              opacity={0}
              r={2.2}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
            />
          ))}
          {Array.from({ length: BURSTS }, (_, i) => (
            <circle
              className="fill-none stroke-rose-500"
              cx={END_X}
              cy={LANE_Y[0]}
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed pool, drawn by position
              key={i}
              opacity={0}
              r={3}
              ref={(el) => {
                burstRefs.current[i] = el;
              }}
            />
          ))}

          <circle
            className="fill-white stroke-zinc-300 dark:fill-zinc-950 dark:stroke-zinc-700"
            cx={SOURCE_X}
            cy={MID}
            r={5}
          />
          <text
            className="fill-zinc-400 font-mono text-[9.5px] dark:fill-zinc-500"
            x={SOURCE_X - 4}
            y={MID + 24}
          >
            edge
          </text>

          <g>
            <circle
              className="fill-white stroke-zinc-300 dark:fill-zinc-950 dark:stroke-zinc-700"
              cx={ROUTER_X}
              cy={MID}
              r={10}
            />
            {/* The router's needle leans toward the lane taking more traffic. */}
            <g transform={`translate(${ROUTER_X} ${MID})`}>
              <motion.line
                animate={{ rotate: (share / 100) * 56 - 28 }}
                className="stroke-zinc-500 dark:stroke-zinc-400"
                initial={false}
                strokeLinecap="round"
                strokeWidth={1.75}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                x1={-4.5}
                x2={4.5}
                y1={0}
                y2={0}
              />
            </g>
          </g>

          {rows.map(({ lane, version, share: laneShare }) => (
            <g key={`end-${lane}`}>
              <circle
                className={cn(
                  "transition-colors duration-500",
                  lane === 1 && laneShare > 0
                    ? "fill-sky-500 stroke-sky-500 dark:fill-sky-400 dark:stroke-sky-400"
                    : "fill-white stroke-zinc-300 dark:fill-zinc-950 dark:stroke-zinc-700"
                )}
                cx={END_X}
                cy={LANE_Y[lane]}
                r={4.5}
              />
              <text
                className="fill-zinc-800 font-mono text-[10.5px] dark:fill-zinc-200"
                dominantBaseline="central"
                x={END_X + 12}
                y={LANE_Y[lane]}
              >
                {version.name}
              </text>
            </g>
          ))}
        </svg>

        <div className="px-4">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-5 border-zinc-100 border-b pb-1.5 text-[11px] text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
            <span>Version</span>
            <span className="w-14 text-right">req/s</span>
            <span className="w-12 text-right">p95</span>
            <span className="w-11 text-right">errors</span>
          </div>
          {rows.map(({ version, share: laneShare, lane }) => (
            <div
              className={cn(
                "grid h-9 grid-cols-[1fr_auto_auto_auto] items-center gap-x-5 text-[12.5px] tabular-nums transition-opacity duration-300",
                laneShare === 0 && "opacity-45"
              )}
              key={version.name}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    lane === 1 ? "bg-sky-500" : "bg-zinc-400 dark:bg-zinc-500"
                  )}
                />
                <span className="font-mono text-[12px]">{version.name}</span>
                <span className="truncate text-zinc-500 dark:text-zinc-400">
                  {version.label}
                </span>
              </span>
              <span className="w-14 text-right">
                <Count value={(total * laneShare) / 100} />
              </span>
              <span
                className={cn(
                  "w-12 text-right",
                  lane === 1 &&
                    version.p95 < current.p95 &&
                    "text-sky-600 dark:text-sky-400"
                )}
              >
                {version.p95}ms
              </span>
              <span className="w-11 text-right text-zinc-600 dark:text-zinc-300">
                {version.errorRate}%
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3 border-zinc-100 border-t px-4 py-3 dark:border-zinc-800/80">
          <span className="shrink-0 text-[12px] text-zinc-500 dark:text-zinc-400">
            To {canary.name}
          </span>
          <div className="flex flex-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
            {steps.map((step) => (
              <button
                aria-pressed={share === step}
                className={cn(
                  "relative h-7 flex-1 rounded-md font-medium text-[12px] tabular-nums outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sky-500/40",
                  share === step
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
                key={step}
                onClick={() => choose(step)}
                type="button"
              >
                {share === step && (
                  <motion.span
                    className="absolute inset-0 rounded-md bg-white shadow-xs dark:bg-zinc-700"
                    layoutId={`${id}-step`}
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">{step}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

function Count({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, format);
  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.7,
      ease: EASE_OUT,
    });
    return () => controls.stop();
  }, [motionValue, value]);
  return <motion.span>{text}</motion.span>;
}

function statusText(share: number, canaryName: string) {
  if (share === 0) {
    return "All on current";
  }
  if (share === 100) {
    return `${canaryName} promoted`;
  }
  return `Canary at ${share}%`;
}

function statusTone(share: number) {
  if (share === 100) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (share === 0) {
    return "text-zinc-500 dark:text-zinc-400";
  }
  return "text-sky-600 dark:text-sky-400";
}

function spawn(particles: Particle[]) {
  const free = particles.find((p) => !p.on);
  if (!free) {
    return;
  }
  free.on = true;
  free.lane = -1;
  free.d = 0;
  free.offset = Math.random() * 2 - 1;
  free.error = false;
}

interface FlowContext {
  dt: number;
  share: number;
  versions: TrafficVersion[];
  shape: FlowShape;
}

const speedOf = (version: TrafficVersion) =>
  BASE_SPEED * Math.min(1.6, Math.max(0.6, 200 / version.p95));

/** Moves one request along; returns the lane it finished on, if it failed. */
function advance(p: Particle, { dt, share, versions, shape }: FlowContext) {
  if (!p.on) {
    return null;
  }
  if (p.lane === -1) {
    p.d += BASE_SPEED * dt;
    if (p.d < shape.trunkLength) {
      return null;
    }
    // The router decides at the split, with the share as it is right now.
    p.d -= shape.trunkLength;
    p.lane = Math.random() * 100 < share ? 1 : 0;
    p.error =
      Math.random() * 100 < versions[p.lane].errorRate * ERROR_VISIBILITY;
    return null;
  }
  p.d += speedOf(versions[p.lane]) * dt;
  if (p.d < shape.laneLengths[p.lane]) {
    return null;
  }
  p.on = false;
  return p.error ? p.lane : null;
}

function draw(
  el: SVGCircleElement | null | undefined,
  p: Particle,
  { share, shape }: FlowContext
) {
  if (!el) {
    return;
  }
  if (!p.on) {
    el.setAttribute("opacity", "0");
    return;
  }
  const onTrunk = p.lane === -1;
  const path = onTrunk ? shape.trunk : shape.lanes[p.lane];
  const length = onTrunk ? shape.trunkLength : shape.laneLengths[p.lane];
  const laneShare = p.lane === 1 ? share : 100 - share;
  const half =
    (onTrunk ? MIN_WIDTH + MAX_WIDTH : laneWidth(laneShare)) * 0.5 * 0.55;
  const point = path.getPointAtLength(p.d);
  const fadeIn = onTrunk ? Math.min(1, p.d / 14) : 1;
  const fadeOut = onTrunk ? 1 : Math.min(1, (length - p.d) / 22);
  el.setAttribute("cx", point.x.toFixed(1));
  el.setAttribute("cy", (point.y + p.offset * half).toFixed(1));
  el.setAttribute("opacity", Math.max(0, fadeIn * fadeOut).toFixed(2));
  el.setAttribute("class", particleClass(p, length));
}

function particleClass(p: Particle, length: number) {
  if (p.lane === -1) {
    return PARTICLE_CLASS.trunk;
  }
  // A failing request turns red on the last stretch of its lane.
  if (p.error && p.d > length * 0.6) {
    return PARTICLE_CLASS.error;
  }
  return p.lane === 1 ? PARTICLE_CLASS.canary : PARTICLE_CLASS.current;
}

function startBurst(bursts: Burst[], lane: number) {
  const free = bursts.find((b) => !b.on);
  if (!free) {
    return;
  }
  free.on = true;
  free.t = 0;
  free.lane = lane === 1 ? 1 : 0;
}

function drawBurst(
  el: SVGCircleElement | null | undefined,
  b: Burst,
  dt: number
) {
  if (!(el && b.on)) {
    return;
  }
  b.t += dt / 0.6;
  if (b.t >= 1) {
    b.on = false;
    el.setAttribute("opacity", "0");
    return;
  }
  const eased = 1 - (1 - b.t) ** 3;
  el.setAttribute("cy", String(LANE_Y[b.lane]));
  el.setAttribute("r", (4.5 + eased * 10).toFixed(1));
  el.setAttribute("opacity", (0.8 * (1 - b.t)).toFixed(2));
}
