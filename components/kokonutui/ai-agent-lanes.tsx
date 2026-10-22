"use client";

/**
 * @author: @kokonutui
 * @description: AI Agent Lanes
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Pause, Play, RotateCcw } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ToolKind = "think" | "search" | "read" | "write";

export interface AgentStep {
  tool: ToolKind;
  label: string;
  /** Seconds from the start of the run. */
  start: number;
  end: number;
  /** What came back, shown once the step is done. */
  result?: string;
}

export interface AgentLane {
  id: string;
  name: string;
  steps: AgentStep[];
  /** One line the sub-agent hands back to the lead. */
  summary?: string;
}

export interface AIAgentLanesProps {
  task?: string;
  /** The first lane is the lead; the others are sub-agents it starts. */
  lanes?: AgentLane[];
  /** The lead's final answer, revealed as its last step runs. */
  answer?: string;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LANE_H = 36;
const TICK = 2;

const DEMO_LANES: AgentLane[] = [
  {
    id: "lead",
    name: "Lead",
    steps: [
      {
        tool: "think",
        label: "Split the question",
        start: 0,
        end: 1.4,
        result: "Three parts: getting there, where to meet, and the weather.",
      },
      {
        tool: "write",
        label: "Write the answer",
        start: 10.4,
        end: 13.6,
      },
    ],
  },
  {
    id: "flights",
    name: "Flights",
    summary: "Lisbon and Valencia have the most direct routes",
    steps: [
      {
        tool: "search",
        label: "Direct flights from 11 offices",
        start: 1.6,
        end: 3.3,
        result: "142 routes across 6 cities",
      },
      {
        tool: "read",
        label: "airline route maps",
        start: 3.3,
        end: 5.5,
        result: "Lisbon 10/11, Valencia 9/11, Porto 7/11",
      },
      {
        tool: "think",
        label: "Rank by direct routes",
        start: 5.5,
        end: 6.8,
      },
    ],
  },
  {
    id: "venues",
    name: "Venues",
    summary: "3 venues under €90 a head",
    steps: [
      {
        tool: "search",
        label: "Offsite venues for 30 people",
        start: 1.7,
        end: 2.9,
        result: "24 venues",
      },
      {
        tool: "read",
        label: "Lisbon venue pages",
        start: 2.9,
        end: 4.5,
        result: "Palácio Chiado, LX Factory loft",
      },
      {
        tool: "read",
        label: "Valencia venue pages",
        start: 4.5,
        end: 6.2,
        result: "Veles e Vents",
      },
      {
        tool: "think",
        label: "Compare price per head",
        start: 6.2,
        end: 9.6,
      },
    ],
  },
  {
    id: "weather",
    name: "Weather",
    summary: "18–21°C and little rain in May",
    steps: [
      {
        tool: "search",
        label: "Average May temperature",
        start: 1.8,
        end: 2.8,
        result: "6 cities",
      },
      {
        tool: "read",
        label: "climate tables",
        start: 2.8,
        end: 4.6,
        result: "Lisbon 21°C, Valencia 22°C",
      },
      {
        tool: "think",
        label: "Check rainy days",
        start: 4.6,
        end: 5.4,
      },
    ],
  },
];

const DEMO_ANSWER =
  "Go with Lisbon. Ten of your eleven offices fly there direct, Palácio Chiado fits 30 people at €84 a head, and late May averages 21°C with little rain. Valencia is a close second if you want the beach.";

const TOOL_STYLE: Record<ToolKind, string> = {
  think:
    "bg-[repeating-linear-gradient(135deg,rgb(113_113_122/0.35)_0_2px,transparent_2px_5px)] ring-1 ring-inset ring-zinc-400/50 dark:ring-zinc-500/50",
  search: "bg-teal-600 dark:bg-teal-500",
  read: "bg-stone-400 dark:bg-stone-500",
  write: "bg-zinc-900 dark:bg-zinc-100",
};

const TOOL_NAME: Record<ToolKind, string> = {
  think: "Thinking",
  search: "Search",
  read: "Read",
  write: "Write",
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const formatTime = (s: number) => `${s.toFixed(1)}s`;

export default function AIAgentLanes({
  task = "Where should our 30-person team meet for a May offsite?",
  lanes = DEMO_LANES,
  answer = DEMO_ANSWER,
  className,
}: AIAgentLanesProps) {
  const reduceMotion = useReducedMotion();
  const total = Math.max(...lanes.flatMap((l) => l.steps.map((s) => s.end)));
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(lanes[0]?.id ?? "");
  const [hover, setHover] = useState<{ lane: number; step: number } | null>(
    null
  );
  const nowRef = useRef(0);
  nowRef.current = now;

  // Start once on mount; reduced motion shows the finished run.
  useEffect(() => {
    if (reduceMotion) {
      setNow(total);
      return;
    }
    const id = setTimeout(() => setPlaying(true), 500);
    return () => clearTimeout(id);
  }, [reduceMotion, total]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const next = Math.min(total, nowRef.current + (t - last) / 1000);
      last = t;
      setNow(next);
      if (next >= total) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, total]);

  const done = now >= total;
  const lead = lanes[0];
  const subs = lanes.slice(1);
  const running = subs.filter(
    (l) => now >= (l.steps[0]?.start ?? 0) && now < laneEnd(l)
  ).length;
  const x = (t: number) => `${(t / total) * 100}%`;
  const hoverStep = hover ? lanes[hover.lane]?.steps[hover.step] : undefined;

  const toggle = () => {
    if (done) {
      setNow(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  return (
    <div
      className={cn(
        "w-full max-w-2xl rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
        className
      )}
    >
      <header className="flex items-start justify-between gap-4 border-black/[0.06] border-b px-4 py-3 dark:border-white/[0.08]">
        <div className="min-w-0">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {statusLine(done, running, now, total)}
          </p>
          <h3 className="mt-0.5 font-medium text-sm text-zinc-900 leading-snug dark:text-zinc-100">
            {task}
          </h3>
        </div>
        <button
          aria-label={playButtonLabel(done, playing)}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 ring-1 ring-black/10 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:text-zinc-300 dark:ring-white/15 dark:hover:bg-white/[0.07] dark:hover:text-white"
          onClick={toggle}
          type="button"
        >
          <PlayIcon done={done} playing={playing} />
        </button>
      </header>

      <div className="px-4 pt-4">
        <div className="flex">
          <ul className="w-[84px] shrink-0 sm:w-28">
            {lanes.map((lane, i) => (
              <li key={lane.id} style={{ height: LANE_H }}>
                <LaneLabel
                  active={selected === lane.id}
                  finished={i > 0 && now >= laneEnd(lane)}
                  lane={lane}
                  lead={i === 0}
                  onSelect={() => setSelected(lane.id)}
                  started={now >= (lane.steps[0]?.start ?? 0)}
                />
              </li>
            ))}
          </ul>

          <div className="relative min-w-0 flex-1">
            <Connectors lead={lead} now={now} subs={subs} total={total} />
            {lanes.map((lane, li) => (
              <div
                className="relative border-black/[0.05] border-b border-dashed last:border-b-0 dark:border-white/[0.06]"
                key={lane.id}
                style={{ height: LANE_H }}
              >
                {lane.steps.map((step, si) => (
                  <StepBar
                    key={`${step.label}-${step.start}`}
                    left={x(step.start)}
                    now={now}
                    onHover={(on) =>
                      setHover(on ? { lane: li, step: si } : null)
                    }
                    onSelect={() => setSelected(lane.id)}
                    step={step}
                    width={x(step.end - step.start)}
                  />
                ))}
              </div>
            ))}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-px bg-zinc-900/70 dark:bg-white/70"
              style={{ left: x(now) }}
            />
            <AnimatePresence>
              {/* A bar scrubbed out of existence never fires pointerleave. */}
              {hoverStep && hover && now > hoverStep.start && (
                <StepTip
                  key={`${hover.lane}-${hover.step}`}
                  now={now}
                  step={hoverStep}
                  top={hover.lane * LANE_H}
                  total={total}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center">
          <span className="w-[84px] shrink-0 sm:w-28" />
          <Scrubber
            now={now}
            onScrub={(t) => {
              setPlaying(false);
              setNow(t);
            }}
            total={total}
          />
        </div>
      </div>

      <Transcript
        answer={answer}
        lane={lanes.find((l) => l.id === selected) ?? lead}
        lead={selected === lead.id}
        now={now}
      />
    </div>
  );
}

const laneEnd = (lane: AgentLane) => lane.steps.at(-1)?.end ?? 0;

const statusLine = (
  done: boolean,
  running: number,
  now: number,
  total: number
) => {
  if (done) {
    return `Done in ${formatTime(total)}`;
  }
  if (running > 0) {
    return `${running} ${running === 1 ? "agent" : "agents"} working · ${formatTime(now)}`;
  }
  return now === 0 ? "Ready" : `Lead agent · ${formatTime(now)}`;
};

const playButtonLabel = (done: boolean, playing: boolean) => {
  if (done) {
    return "Replay run";
  }
  return playing ? "Pause" : "Play";
};

function PlayIcon({ done, playing }: { done: boolean; playing: boolean }) {
  if (done) {
    return <RotateCcw className="size-3.5" />;
  }
  return playing ? (
    <Pause className="size-3.5" />
  ) : (
    <Play className="size-3.5" />
  );
}

function LaneLabel({
  lane,
  lead,
  active,
  started,
  finished,
  onSelect,
}: {
  lane: AgentLane;
  lead: boolean;
  active: boolean;
  started: boolean;
  finished: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "-ml-1.5 flex h-7 max-w-full items-center gap-1.5 rounded-md px-1.5 text-left text-[12px] transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:focus-visible:ring-white/30",
        active
          ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-white/[0.08] dark:text-zinc-100"
          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
        !started && "opacity-50"
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
        <AnimatePresence initial={false} mode="popLayout">
          {finished ? (
            <motion.span
              animate={{ opacity: 1, scale: 1 }}
              className="flex size-3.5 items-center justify-center rounded-full bg-teal-600 text-white dark:bg-teal-500"
              initial={{ opacity: 0, scale: 0.5 }}
              key="done"
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              <Check className="size-2.5" strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.span
              className={cn(
                "size-2 rounded-full",
                lead
                  ? "bg-zinc-900 dark:bg-zinc-100"
                  : "ring-[1.5px] ring-zinc-400 ring-inset dark:ring-zinc-500"
              )}
              exit={{ opacity: 0 }}
              key="dot"
            />
          )}
        </AnimatePresence>
      </span>
      <span className="truncate">{lane.name}</span>
    </button>
  );
}

function StepBar({
  step,
  now,
  left,
  width,
  onHover,
  onSelect,
}: {
  step: AgentStep;
  now: number;
  left: string;
  width: string;
  onHover: (on: boolean) => void;
  onSelect: () => void;
}) {
  const progress = clamp01((now - step.start) / (step.end - step.start));
  if (progress <= 0) {
    return null;
  }
  const style: CSSProperties = { left, width };
  return (
    <button
      aria-label={`${TOOL_NAME[step.tool]}: ${step.label}`}
      className="absolute top-1/2 h-4 -translate-y-1/2 rounded-[4px] px-px outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900/40 dark:focus-visible:ring-white/40"
      onBlur={() => onHover(false)}
      onClick={onSelect}
      onFocus={() => onHover(true)}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      style={style}
      type="button"
    >
      <span
        className={cn(
          "block h-full origin-left rounded-[3px]",
          TOOL_STYLE[step.tool]
        )}
        style={{ width: `${progress * 100}%` }}
      />
    </button>
  );
}

function StepTip({
  step,
  now,
  top,
  total,
}: {
  step: AgentStep;
  now: number;
  top: number;
  total: number;
}) {
  const mid = (step.start + step.end) / 2 / total;
  const finished = now >= step.end;
  const anchor: CSSProperties =
    mid > 0.6
      ? { right: `${(1 - step.end / total) * 100}%` }
      : { left: `${(step.start / total) * 100}%` };
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-none absolute z-20 w-56 -translate-y-full rounded-lg bg-zinc-900 px-3 py-2 text-[12px] text-zinc-300 shadow-lg dark:bg-zinc-800 dark:ring-1 dark:ring-white/10"
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
      initial={{ opacity: 0, y: 3 }}
      style={{ ...anchor, top: top + 4 }}
      transition={{ duration: 0.14, ease: EASE_OUT }}
    >
      <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
        <span>{TOOL_NAME[step.tool]}</span>
        <span className="font-mono tabular-nums">
          {formatTime(Math.min(now, step.end) - step.start)}
        </span>
      </p>
      <p className="mt-0.5 font-medium text-white">{step.label}</p>
      {step.result && (
        <p className="mt-1 text-zinc-400">
          {finished ? step.result : "Waiting for results…"}
        </p>
      )}
    </motion.div>
  );
}

/** Lines from the lead out to each sub-agent, and back when they report. */
function Connectors({
  lead,
  subs,
  now,
  total,
}: {
  lead: AgentLane;
  subs: AgentLane[];
  now: number;
  total: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    // clientWidth on an <svg> reads 0 in some engines; the observed box does not.
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fork = lead.steps[0]?.end ?? 0;
  const join = lead.steps.at(-1)?.start ?? total;
  const xAt = (t: number) => (t / total) * width;
  const yAt = (lane: number) => lane * LANE_H + LANE_H / 2;
  const reach = (from: number, to: number) =>
    clamp01((now - from) / (to - from));
  const top = yAt(0);
  const fx = xAt(fork);
  const jx = xAt(join);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      ref={ref}
    >
      {width > 0 && (
        <>
          {/* The lead waits on its sub-agents between handing off and writing. */}
          <line
            className="stroke-zinc-300 dark:stroke-zinc-600"
            strokeDasharray="2 3"
            x1={fx}
            x2={xAt(Math.min(Math.max(now, fork), join))}
            y1={top}
            y2={top}
          />
          {subs.map((lane, i) => {
            const y = yAt(i + 1);
            const sx = xAt(lane.steps[0]?.start ?? fork);
            const ex = xAt(laneEnd(lane));
            const out = `M ${fx} ${top} C ${fx + 6} ${top} ${fx + 2} ${y} ${sx} ${y}`;
            const back = `M ${ex} ${y} C ${jx - 18} ${y} ${jx - 12} ${top} ${jx} ${top}`;
            return (
              <g
                className="fill-none stroke-zinc-400 dark:stroke-zinc-500"
                key={lane.id}
              >
                <path
                  d={out}
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - reach(fork, fork + 0.2)}
                />
                <path
                  d={back}
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - reach(join - 0.35, join)}
                />
              </g>
            );
          })}
        </>
      )}
    </svg>
  );
}

function Scrubber({
  now,
  total,
  onScrub,
}: {
  now: number;
  total: number;
  onScrub: (t: number) => void;
}) {
  const ticks = Array.from(
    { length: Math.floor(total / TICK) + 1 },
    (_, i) => i * TICK
  );
  return (
    <div className="relative min-w-0 flex-1 pt-1 pb-3">
      <div className="relative h-4 text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500">
        {ticks.map((t) => (
          <span
            className="absolute -translate-x-1/2 font-mono first:translate-x-0"
            key={t}
            style={{ left: `${(t / total) * 100}%` }}
          >
            {t}s
          </span>
        ))}
      </div>
      <input
        aria-label="Run time"
        aria-valuetext={formatTime(now)}
        className="peer absolute inset-x-0 -top-1 h-6 w-full cursor-ew-resize opacity-0"
        max={total}
        min={0}
        onChange={(e) => onScrub(Number(e.target.value))}
        step={0.1}
        type="range"
        value={now}
      />
      {/* The range input is invisible, so its focus ring lives on the knob. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[3px] h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900/30 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white dark:bg-white dark:peer-focus-visible:ring-white/40 dark:peer-focus-visible:ring-offset-zinc-900"
        style={{ left: `${(now / total) * 100}%` }}
      />
    </div>
  );
}

function Legend() {
  return (
    <ul className="hidden shrink-0 items-center gap-3 text-[10px] text-zinc-500 sm:flex dark:text-zinc-400">
      {(["search", "read", "think", "write"] as const).map((tool) => (
        <li className="flex items-center gap-1" key={tool}>
          <span className={cn("h-2 w-3 rounded-[2px]", TOOL_STYLE[tool])} />
          {TOOL_NAME[tool]}
        </li>
      ))}
    </ul>
  );
}

function Transcript({
  lane,
  lead,
  now,
  answer,
}: {
  lane: AgentLane;
  lead: boolean;
  now: number;
  answer: string;
}) {
  const steps = lane.steps.filter((s) => now >= s.start);
  const writing = lead ? lane.steps.at(-1) : undefined;
  const written =
    writing && now >= writing.start
      ? answer.slice(
          0,
          Math.round(
            answer.length *
              clamp01((now - writing.start) / (writing.end - writing.start))
          )
        )
      : "";

  return (
    <div className="min-h-[148px] border-black/[0.06] border-t px-4 py-3 dark:border-white/[0.08]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {lane.name}
          {lane.summary && now >= laneEnd(lane) && (
            <span className="text-zinc-900 dark:text-zinc-100">
              {" "}
              · {lane.summary}
            </span>
          )}
        </p>
        <Legend />
      </div>
      {written ? (
        <p className="text-[13px] text-zinc-800 leading-relaxed dark:text-zinc-200">
          {written}
          {now < (writing?.end ?? 0) && (
            <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-[2px] rounded-[2px] bg-zinc-800 dark:bg-zinc-200" />
          )}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {steps.length === 0 && (
            <li className="text-[12px] text-zinc-400 dark:text-zinc-500">
              Not started yet
            </li>
          )}
          {steps.map((step) => {
            const finished = now >= step.end;
            return (
              <li
                className="flex items-baseline gap-2 text-[12px]"
                key={`${step.label}-${step.start}`}
              >
                <span
                  className={cn(
                    "mt-px size-1.5 shrink-0 translate-y-[-1px] rounded-full",
                    finished
                      ? "bg-zinc-300 dark:bg-zinc-600"
                      : "animate-pulse bg-teal-600 motion-reduce:animate-none dark:bg-teal-400"
                  )}
                />
                <span className="w-14 shrink-0 text-zinc-400 dark:text-zinc-500">
                  {TOOL_NAME[step.tool]}
                </span>
                <span className="min-w-0 text-zinc-700 dark:text-zinc-300">
                  {step.label}
                  {finished && step.result && (
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {" "}
                      → {step.result}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
