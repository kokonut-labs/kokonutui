"use client";

/**
 * @author: @dorianbaffier
 * @description: Event Timeline
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Markers closer than this, in pixels, fold into one counted cluster.
const MERGE_PX = 18;
// The narrowest window you can zoom to.
const MIN_SPAN = 2 * HOUR;
const ZOOM_MS = 380;
const TICK_PX = 64;
const TICK_STEPS = [
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
];
const DRAG_PX = 4;

export type TimelineKind = "deploy" | "config" | "incident" | "release";

export interface TimelineEvent {
  id: string;
  /** Milliseconds since the epoch. */
  at: number;
  kind: TimelineKind;
  title: string;
  actor: string;
  detail?: string;
}

export interface EventTimelineProps {
  title?: string;
  subtitle?: string;
  events?: TimelineEvent[];
  /** The window's start and end, in ms. Defaults to the events' span. */
  from?: number;
  to?: number;
  className?: string;
}

const KIND: Record<TimelineKind, { label: string; dot: string; text: string }> =
  {
    deploy: {
      label: "Deploy",
      dot: "bg-zinc-900 dark:bg-zinc-100",
      text: "text-zinc-500 dark:text-zinc-400",
    },
    config: {
      label: "Config",
      dot: "bg-violet-500 dark:bg-violet-400",
      text: "text-violet-600 dark:text-violet-400",
    },
    incident: {
      label: "Incident",
      dot: "bg-rose-500 dark:bg-rose-400",
      text: "text-rose-600 dark:text-rose-400",
    },
    release: {
      label: "Release",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      text: "text-emerald-600 dark:text-emerald-400",
    },
  };

const START = Date.parse("2026-10-08T00:00:00Z");

const PEOPLE = ["Maya", "Leo", "Sana", "Tom", "Inès", "deploy-bot"];
const COMMITS = [
  "fix: retry webhook signatures",
  "feat: bulk export for invoices",
  "chore: bump node to 22.11",
  "fix: race in session refresh",
  "perf: cache plan lookups",
  "feat: SSO for workspace admins",
  "fix: timezone in digest emails",
  "refactor: split billing worker",
];
const CONFIGS = [
  "RATE_LIMIT 100 → 250",
  "Enabled flag new-checkout for 10%",
  "Rotated STRIPE_WEBHOOK_SECRET",
  "Scaled api to 6 instances",
  "Enabled flag new-checkout for 50%",
];

// Seeded, so server and browser draw the same history: steady deploys,
// a release day with a burst of them, and one incident with its fixes.
function demoEvents(): TimelineEvent[] {
  let seed = 3;
  const random = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return seed / 2_147_483_647;
  };
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  const out: TimelineEvent[] = [];
  const add = (
    at: number,
    kind: TimelineKind,
    title: string,
    detail?: string
  ) => {
    out.push({
      id: `e${out.length}`,
      at: Math.round(at / 60_000) * 60_000,
      kind,
      title,
      actor:
        kind === "deploy" && random() < 0.3
          ? "deploy-bot"
          : pick(PEOPLE.slice(0, 5)),
      detail,
    });
  };
  for (let d = 0; d < 14; d++) {
    const day = START + d * DAY;
    const weekend = d % 7 === 4 || d % 7 === 5;
    const deploys = weekend ? 1 : 2 + Math.floor(random() * 3);
    for (let k = 0; k < deploys; k++) {
      add(day + (9 + random() * 9) * HOUR, "deploy", "", pick(COMMITS));
    }
  }
  // Release day: a train of deploys inside three hours, then the tag.
  const release = START + 6 * DAY + 13 * HOUR;
  for (let k = 0; k < 7; k++) {
    add(
      release + k * 22 * 60_000 + random() * 8 * 60_000,
      "deploy",
      "",
      pick(COMMITS)
    );
  }
  add(
    release + 3 * HOUR,
    "release",
    "Released v2.14.0",
    "SSO, bulk export, faster billing pages."
  );
  add(
    START + 9 * DAY + 11 * HOUR,
    "config",
    CONFIGS[1],
    "Rolled out by flag, watching checkout errors."
  );
  // The incident: errors, a config change, a fix, and the follow-up.
  const incident = START + 10 * DAY + 15 * HOUR + 20 * 60_000;
  add(
    incident - 40 * 60_000,
    "config",
    CONFIGS[4],
    "Raised the new checkout to half of traffic."
  );
  add(
    incident,
    "incident",
    "Elevated 5xx on /api/checkout",
    "Error rate peaked at 4.2% for 26 minutes."
  );
  add(
    incident + 9 * 60_000,
    "config",
    "Disabled flag new-checkout",
    "Rolled back while we look."
  );
  add(
    incident + 31 * 60_000,
    "deploy",
    "",
    "fix: null plan on legacy accounts"
  );
  add(
    incident + 2.5 * HOUR,
    "incident",
    "Resolved: checkout errors",
    "Root cause: legacy plans had no price id."
  );
  add(
    START + 2 * DAY + 10 * HOUR,
    "config",
    CONFIGS[0],
    "For the public API, per key."
  );
  add(START + 4 * DAY + 16 * HOUR, "config", CONFIGS[2], "Scheduled rotation.");
  add(
    START + 12 * DAY + 9 * HOUR,
    "config",
    CONFIGS[3],
    "Ahead of the newsletter send."
  );
  add(
    START + 1 * DAY + 14 * HOUR,
    "release",
    "Released v2.13.2",
    "Patch: digest email time zones."
  );
  out.sort((a, b) => a.at - b.at);
  // Build numbers count up in time.
  let build = 4790;
  for (const e of out) {
    if (e.kind === "deploy") {
      build += 1;
      e.title = `Deploy #${build}`;
    }
  }
  return out;
}

const DEFAULT_EVENTS = demoEvents();

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

const ease = (t: number) => 1 - (1 - t) ** 3;

const fmt = (at: number, options: Intl.DateTimeFormatOptions) =>
  new Date(at).toLocaleString("en-US", { timeZone: "UTC", ...options });

const dayLabel = (at: number) => fmt(at, { month: "short", day: "numeric" });

const timeLabel = (at: number) =>
  fmt(at, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const stamp = (at: number) => `${dayLabel(at)}, ${timeLabel(at)}`;

interface View {
  start: number;
  end: number;
}

// Each kind rides a lane, so a quiet config change never hides inside a
// busy deploy day.
const LANES: { label: string; kinds: TimelineKind[] }[] = [
  { label: "Deploys", kinds: ["deploy"] },
  { label: "Changes", kinds: ["config", "release"] },
  { label: "Incidents", kinds: ["incident"] },
];
const LANE_H = 24;
const laneOf = (kind: TimelineKind) =>
  Math.max(
    0,
    LANES.findIndex((l) => l.kinds.includes(kind))
  );
const laneY = (lane: number) => 12 + lane * LANE_H;
// Three lanes, then the axis labels.
const TRACK_H = laneY(LANES.length - 1) + 12 + 24;

interface Cluster {
  ids: string[];
  lane: number;
  x: number;
  first: number;
  last: number;
}

/**
 * Walks each lane left to right and folds neighbours closer than MERGE_PX.
 * Gaps only depend on the zoom, so panning never regroups.
 */
function clusterize(events: TimelineEvent[], xOf: (at: number) => number) {
  const clusters: Cluster[] = [];
  for (const [lane] of LANES.entries()) {
    let current: Cluster | null = null;
    let sum = 0;
    let prevX = Number.NEGATIVE_INFINITY;
    for (const e of events) {
      if (laneOf(e.kind) !== lane) {
        continue;
      }
      const x = xOf(e.at);
      // Long chains break, so one cluster never covers a stretch of track.
      const fits =
        current &&
        x - prevX < MERGE_PX &&
        x - xOf(current.first) < MERGE_PX * 3;
      if (current && fits) {
        current.ids.push(e.id);
        current.last = e.at;
        sum += x;
        current.x = sum / current.ids.length;
      } else {
        current = { ids: [e.id], lane, x, first: e.at, last: e.at };
        sum = x;
        clusters.push(current);
      }
      prevX = x;
    }
  }
  return clusters;
}

/** The widest window in which these events all stand apart. */
function spanToSplit(events: TimelineEvent[], width: number) {
  let gap = Number.POSITIVE_INFINITY;
  for (let i = 1; i < events.length; i++) {
    gap = Math.min(gap, events[i].at - events[i - 1].at);
  }
  return (gap * width) / (MERGE_PX * 1.25);
}

function ticksFor(view: View, width: number) {
  const span = view.end - view.start;
  const step =
    TICK_STEPS.find((s) => (s / span) * width >= TICK_PX) ??
    TICK_STEPS.at(-1) ??
    DAY;
  const out: { at: number; label: string; strong: boolean }[] = [];
  for (
    let at = Math.ceil(view.start / step) * step;
    at <= view.end;
    at += step
  ) {
    const midnight = at % DAY === 0;
    out.push({
      at,
      label: step >= DAY || midnight ? dayLabel(at) : timeLabel(at),
      strong: midnight,
    });
  }
  return out;
}

const spanLabel = (span: number) => {
  if (span >= 2 * DAY) {
    return `${Math.round(span / DAY)} days`;
  }
  return `${Math.round(span / HOUR)} hours`;
};

export default function EventTimeline({
  title = "Production activity",
  subtitle = "Deploys, config changes and incidents",
  events = DEFAULT_EVENTS,
  from,
  to,
  className,
}: EventTimelineProps) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => a.at - b.at),
    [events]
  );
  const lo = from ?? (sorted[0]?.at ?? 0) - 6 * HOUR;
  const hi = to ?? (sorted.at(-1)?.at ?? 0) + 6 * HOUR;
  const [view, setView] = useState<View>({ start: lo, end: hi });
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const viewRef = useRef(view);
  const tween = useRef(0);
  const drag = useRef<{ x: number; view: View; moved: boolean } | null>(null);

  viewRef.current = view;

  /** Keeps a window inside the history and no narrower than MIN_SPAN. */
  const clampView = useCallback(
    (start: number, end: number): View => {
      const span = clamp(end - start, MIN_SPAN, hi - lo);
      const s = clamp(start, lo, hi - span);
      return { start: s, end: s + span };
    },
    [lo, hi]
  );

  const animateTo = useCallback((target: View) => {
    cancelAnimationFrame(tween.current);
    const from0 = viewRef.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setView(target);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = ease(Math.min(1, (now - t0) / ZOOM_MS));
      setView({
        start: from0.start + (target.start - from0.start) * t,
        end: from0.end + (target.end - from0.end) * t,
      });
      if (t < 1) {
        tween.current = requestAnimationFrame(step);
      }
    };
    tween.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => cancelAnimationFrame(tween.current), []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  /** Zooms by `factor` around the time under `x` pixels. */
  const zoomAt = useCallback(
    (factor: number, x: number, animate: boolean) => {
      const v = viewRef.current;
      const w = trackRef.current?.clientWidth || 1;
      const pivot = v.start + (x / w) * (v.end - v.start);
      const span = (v.end - v.start) * factor;
      const share = x / w;
      const next = clampView(pivot - span * share, pivot - span * share + span);
      if (animate) {
        animateTo(next);
      } else {
        cancelAnimationFrame(tween.current);
        setView(next);
      }
    },
    [clampView, animateTo]
  );

  // Pinch or Ctrl + wheel zooms; a sideways scroll pans. The plain wheel
  // stays with the page.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      const box = track.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        zoomAt(Math.exp(event.deltaY * 0.01), event.clientX - box.left, false);
      } else if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        const v = viewRef.current;
        const dt = (event.deltaX / box.width) * (v.end - v.start);
        cancelAnimationFrame(tween.current);
        setView(clampView(v.start + dt, v.end + dt));
      }
    };
    track.addEventListener("wheel", onWheel, { passive: false });
    return () => track.removeEventListener("wheel", onWheel);
  }, [zoomAt, clampView]);

  const span = view.end - view.start;
  const xOf = (at: number) => ((at - view.start) / span) * width;
  const clusters = width ? clusterize(sorted, xOf) : [];
  const clusterOf = new Map<string, Cluster>();
  for (const c of clusters) {
    for (const id of c.ids) {
      clusterOf.set(id, c);
    }
  }
  const ticks = width ? ticksFor(view, width) : [];
  const visible = sorted.filter((e) => e.at >= view.start && e.at <= view.end);
  const byId = new Map(sorted.map((e) => [e.id, e]));
  const picked = selected ? byId.get(selected) : undefined;

  /** Brings an event into view, and close enough to stand on its own. */
  /** Pans to an event and zooms in until it stands on its own. */
  const reveal = (e: TimelineEvent) => {
    const v = viewRef.current;
    const current = v.end - v.start;
    const c = clusterOf.get(e.id);
    let s = current;
    if (c && c.ids.length > 1) {
      const lane = sorted.filter((o) => laneOf(o.kind) === c.lane);
      const i = lane.findIndex((o) => o.id === e.id);
      s = Math.min(
        current,
        spanToSplit(lane.slice(Math.max(0, i - 1), i + 2), width)
      );
    }
    const inside =
      e.at > v.start + current * 0.1 && e.at < v.end - current * 0.1;
    if (inside && s === current) {
      return;
    }
    animateTo(clampView(e.at - s / 2, e.at + s / 2));
  };

  const choose = (id: string, scrollList: boolean) => {
    setSelected(id);
    if (scrollList) {
      requestAnimationFrame(() => {
        listRef.current
          ?.querySelector(`[data-id="${id}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
    }
  };

  /** What sits under a click on the track: a cluster or a single marker. */
  const hit = (x: number, y: number) => {
    const lane = clamp(
      Math.round((y - laneY(0)) / LANE_H),
      0,
      LANES.length - 1
    );
    let best: Cluster | null = null;
    let bestD = 12;
    for (const c of clusters) {
      const d = Math.abs(c.x - x);
      if (c.lane === lane && d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    cancelAnimationFrame(tween.current);
    drag.current = { x: event.clientX, view: viewRef.current, moved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const d = drag.current;
    if (!d) {
      const c = hit(event.clientX - box.left, event.clientY - box.top);
      setHovered(c ? c.ids[0] : null);
      return;
    }
    const dx = event.clientX - d.x;
    if (Math.abs(dx) > DRAG_PX) {
      d.moved = true;
    }
    if (d.moved) {
      const dt = (-dx / box.width) * (d.view.end - d.view.start);
      setView(clampView(d.view.start + dt, d.view.end + dt));
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const c = hit(event.clientX - box.left, event.clientY - box.top);
    if (!c) {
      return;
    }
    if (c.ids.length === 1) {
      choose(c.ids[0], true);
      return;
    }
    // A cluster opens by zooming until its members stand apart.
    const members = sorted.filter((e) => c.ids.includes(e.id));
    const s = Math.min(
      Math.max((c.last - c.first) * 1.6, MIN_SPAN),
      spanToSplit(members, width)
    );
    const mid = (c.first + c.last) / 2;
    animateTo(clampView(mid - s / 2, mid + s / 2));
  };

  const zoomButton =
    "flex size-7 items-center justify-center rounded-full text-zinc-500 outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";
  const atMin = span <= MIN_SPAN + 1;
  const atMax = span >= hi - lo - 1;

  return (
    <div
      className={cn(
        "w-full max-w-xl rounded-3xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 p-5 pb-3">
        <div className="min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="mr-1 text-zinc-500 tabular-nums dark:text-zinc-400">
            {spanLabel(span)}
          </span>
          <button
            aria-label="Zoom out"
            className={zoomButton}
            disabled={atMax}
            onClick={() =>
              zoomAt(2, (trackRef.current?.clientWidth ?? 0) / 2, true)
            }
            type="button"
          >
            <svg
              aria-hidden="true"
              className="size-3.5"
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="M3 8h10"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
          <button
            aria-label="Zoom in"
            className={zoomButton}
            disabled={atMin}
            onClick={() =>
              zoomAt(0.5, (trackRef.current?.clientWidth ?? 0) / 2, true)
            }
            type="button"
          >
            <svg
              aria-hidden="true"
              className="size-3.5"
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="M3 8h10M8 3v10"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
          <button
            className={cn(zoomButton, "w-auto px-2.5 font-medium")}
            disabled={atMax}
            onClick={() => animateTo({ start: lo, end: hi })}
            type="button"
          >
            All
          </button>
        </div>
      </div>

      <div className="flex px-5">
        <div
          aria-hidden
          className="relative w-16 shrink-0"
          style={{ height: TRACK_H }}
        >
          {LANES.map((lane, i) => (
            <span
              className="absolute left-0 -translate-y-1/2 text-[11px] text-zinc-400 dark:text-zinc-500"
              key={lane.label}
              style={{ top: laneY(i) }}
            >
              {lane.label}
            </span>
          ))}
        </div>
        <div
          aria-label={`Timeline, ${dayLabel(view.start)} to ${dayLabel(view.end)}. Drag to pan, pinch to zoom, click a cluster to open it.`}
          className="relative min-w-0 flex-1 cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing"
          onPointerCancel={() => {
            drag.current = null;
          }}
          onPointerDown={onPointerDown}
          onPointerLeave={() => setHovered(null)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          ref={trackRef}
          role="img"
          style={{ height: TRACK_H }}
        >
          {/* Ticks, with a firmer line at each midnight. */}
          {ticks.map((t) => (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-6 left-0"
              key={t.at}
              style={{ transform: `translateX(${xOf(t.at)}px)` }}
            >
              <div
                className={cn(
                  "h-full w-px",
                  t.strong
                    ? "bg-zinc-200 dark:bg-zinc-800"
                    : "bg-zinc-100 dark:bg-zinc-900"
                )}
              />
              <span className="absolute top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500">
                {t.label}
              </span>
            </div>
          ))}
          {LANES.map((lane, i) => (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 h-px bg-zinc-100 dark:bg-zinc-900"
              key={lane.label}
              style={{ top: laneY(i) }}
            />
          ))}

          {picked && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-6 left-0 w-px bg-zinc-900/25 dark:bg-zinc-100/25"
              style={{ transform: `translateX(${xOf(picked.at)}px)` }}
            />
          )}

          {/* Every marker sits at its own time. Folded ones slide into their
              cluster and fade, and slide back out when it opens. */}
          {width > 0 &&
            sorted.map((e) => {
              const c = clusterOf.get(e.id);
              const folded = !!c && c.ids.length > 1;
              const x = xOf(e.at);
              const isPicked = e.id === selected;
              const isHovered = !folded && hovered === e.id;
              return (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-0"
                  key={e.id}
                  style={{
                    top: laneY(laneOf(e.kind)),
                    transform: `translateX(${x}px)`,
                  }}
                >
                  <span
                    className={cn(
                      "absolute block size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-[opacity,transform,scale] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:ring-zinc-950",
                      KIND[e.kind].dot,
                      isPicked && "ring-4"
                    )}
                    style={{
                      transform: `translateX(${folded && c ? c.x - x : 0}px)`,
                      opacity: folded ? 0 : 1,
                      scale: isPicked || isHovered ? 1.35 : 1,
                    }}
                  />
                </span>
              );
            })}

          {clusters
            .filter((c) => c.ids.length > 1)
            .map((c) => (
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-0 flex h-[18px] min-w-[18px] starting:scale-75 items-center justify-center rounded-full border bg-white px-1 font-medium text-[10px] tabular-nums starting:opacity-0 transition-[opacity,scale] duration-200 ease-out dark:bg-zinc-950",
                  c.lane === LANES.length - 1
                    ? "border-rose-300 text-rose-600 dark:border-rose-800 dark:text-rose-400"
                    : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
                  hovered === c.ids[0] && "scale-110"
                )}
                key={`${c.ids[0]}-${c.ids.length}`}
                style={{
                  top: laneY(c.lane),
                  transform: `translateX(${c.x}px)`,
                  translate: "-50% -50%",
                }}
              >
                {c.ids.length}
              </span>
            ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-zinc-100 border-t px-5 pt-3 text-xs dark:border-zinc-900">
        <p className="text-zinc-500 tabular-nums dark:text-zinc-400">
          {visible.length} of {sorted.length} events · {stamp(view.start)} –{" "}
          {stamp(view.end)}
        </p>
      </div>

      <ul
        aria-label="Events in view, newest first"
        className="mt-1 max-h-56 overflow-y-auto overscroll-contain px-2 pb-2 [scrollbar-width:thin]"
        ref={listRef}
      >
        {visible.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Nothing happened in this window.
          </li>
        )}
        {[...visible].reverse().map((e) => {
          const isPicked = e.id === selected;
          return (
            <li data-id={e.id} key={e.id}>
              <button
                aria-pressed={isPicked}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400",
                  isPicked
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                )}
                onBlur={() => setHovered(null)}
                onClick={() => {
                  choose(e.id, true);
                  reveal(e);
                }}
                onFocus={() => setHovered(e.id)}
                onMouseEnter={() => setHovered(e.id)}
                onMouseLeave={() => setHovered(null)}
                type="button"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    KIND[e.kind].dot
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium text-sm">
                      {e.title}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
                      {stamp(e.at)}
                    </span>
                  </span>
                  {/* The note stays on one line until the event is picked. */}
                  <span
                    className={cn(
                      "mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400",
                      !isPicked && "truncate"
                    )}
                  >
                    <span className={KIND[e.kind].text}>
                      {KIND[e.kind].label}
                    </span>
                    {" · "}
                    {e.actor}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
