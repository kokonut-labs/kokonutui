"use client";

/**
 * @author: @dorianbaffier
 * @description: Widget Grid
 * @version: 3.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  Activity,
  GripVertical,
  HardDrive,
  History,
  NotebookPen,
  TrendingUp,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type WidgetSize = "s" | "m" | "l";

export interface WidgetGridItem {
  id: string;
  title: string;
  icon?: ReactNode;
  /** Renders the widget body for the size its column span maps to. */
  render: (size: WidgetSize) => ReactNode;
  /** Span used when no layout is given. Defaults to 2. */
  defaultSpan?: number;
}

export interface WidgetLayoutItem {
  id: string;
  /** Width in columns of the 6-column grid (2 to 6). */
  span: number;
}

export interface WidgetGridProps {
  items?: WidgetGridItem[];
  /** Controlled order and spans. */
  layout?: WidgetLayoutItem[];
  /** Uncontrolled starting order and spans. */
  defaultLayout?: WidgetLayoutItem[];
  /** Called on every reorder or resize, including live moves while dragging. */
  onLayoutChange?: (layout: WidgetLayoutItem[]) => void;
  className?: string;
  /** Height of one row in pixels. */
  rowHeight?: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DragState {
  id: string;
  mode: "pointer" | "keyboard";
  /** The pointer holding the cell; other fingers are ignored. */
  pointerId: number;
  grabX: number;
  grabY: number;
  lastX: number;
  lastY: number;
  lastT: number;
  skipId: string | null;
  snapshot: WidgetLayoutItem[];
}

interface PressState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  timer: number;
}

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const COLUMNS = 6;
const NARROW_COLUMNS = 2;
const MIN_SPAN = 2;
const GAP = 12;
/** Matches the `@xl/wg` container query (36rem). */
const NARROW_BELOW = 576;
const LONG_PRESS_MS = 350;
const PRESS_SLOP = 8;
const LIFT_Z = 18;
const MAX_TILT = 7;
const SIZE_LABEL: Record<WidgetSize, string> = {
  s: "small",
  m: "medium",
  l: "large",
};

/** Maps a column span to the widget layout it shows. */
export function sizeForSpan(span: number, narrow = false): WidgetSize {
  if (narrow) {
    return span <= MIN_SPAN ? "s" : "m";
  }
  if (span <= 2) {
    return "s";
  }
  return span <= 4 ? "m" : "l";
}

function clampSpan(span: number) {
  return Math.min(COLUMNS, Math.max(MIN_SPAN, Math.round(span)));
}

/** In the 2-column layout, small widgets take one column, the rest both. */
function narrowSpan(span: number) {
  return span <= MIN_SPAN ? 1 : 2;
}

function normalizeLayout(
  layout: WidgetLayoutItem[],
  items: WidgetGridItem[]
): WidgetLayoutItem[] {
  const known = new Set(items.map((item) => item.id));
  const seen = new Set<string>();
  const out: WidgetLayoutItem[] = [];
  for (const entry of layout) {
    if (known.has(entry.id) && !seen.has(entry.id)) {
      seen.add(entry.id);
      out.push({ id: entry.id, span: clampSpan(entry.span) });
    }
  }
  for (const item of items) {
    if (!seen.has(item.id)) {
      out.push({ id: item.id, span: clampSpan(item.defaultSpan ?? MIN_SPAN) });
    }
  }
  return out;
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function contains(rect: Rect, x: number, y: number) {
  return (
    x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  );
}

/* -------------------------------------------------------------------------- */
/*                               Spring physics                               */
/* -------------------------------------------------------------------------- */

interface SpringConfig {
  k: number;
  c: number;
}

const spring = (k: number, zeta: number): SpringConfig => ({
  k,
  c: 2 * Math.sqrt(k) * zeta,
});

const MOVE_SPRING = spring(420, 0.76);
const LIFT_SPRING = spring(520, 0.82);
const TILT_SPRING = spring(260, 0.6);
const STEP = 1 / 120;

interface Body {
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  sx: number;
  sy: number;
  vsx: number;
  vsy: number;
  lift: number;
  vlift: number;
  liftTarget: number;
  rx: number;
  ry: number;
  vrx: number;
  vry: number;
  /** Smoothed pointer velocity (px/ms) while pinned to the pointer. */
  pvx: number;
  pvy: number;
  /** Seconds to wait before springing home (distance stagger). */
  hold: number;
  /** Follows the pointer directly instead of springing home. */
  pinned: boolean;
}

function createBody(): Body {
  return {
    ox: 0,
    oy: 0,
    vx: 0,
    vy: 0,
    sx: 1,
    sy: 1,
    vsx: 0,
    vsy: 0,
    lift: 0,
    vlift: 0,
    liftTarget: 0,
    rx: 0,
    ry: 0,
    vrx: 0,
    vry: 0,
    pvx: 0,
    pvy: 0,
    hold: 0,
    pinned: false,
  };
}

/** One semi-implicit Euler step; returns [position, velocity]. */
function integrate(
  x: number,
  v: number,
  target: number,
  cfg: SpringConfig,
  dt: number
): [number, number] {
  const a = -cfg.k * (x - target) - cfg.c * v;
  const nv = v + a * dt;
  return [x + nv * dt, nv];
}

const clampTilt = (v: number) => Math.max(-MAX_TILT, Math.min(MAX_TILT, v));

function stepBody(b: Body, dt: number) {
  // Lean toward the drag direction: right edge dips when moving right.
  const tiltY = b.pinned ? clampTilt(b.pvx * 9) : 0;
  const tiltX = b.pinned ? clampTilt(-b.pvy * 9) : 0;
  [b.ry, b.vry] = integrate(b.ry, b.vry, tiltY, TILT_SPRING, dt);
  [b.rx, b.vrx] = integrate(b.rx, b.vrx, tiltX, TILT_SPRING, dt);
  [b.lift, b.vlift] = integrate(b.lift, b.vlift, b.liftTarget, LIFT_SPRING, dt);
  // Pointer velocity decays when the pointer rests, so the tilt settles.
  b.pvx *= Math.exp(-dt * 10);
  b.pvy *= Math.exp(-dt * 10);
  if (b.hold > 0) {
    b.hold -= dt;
    return;
  }
  if (!b.pinned) {
    [b.ox, b.vx] = integrate(b.ox, b.vx, 0, MOVE_SPRING, dt);
    [b.oy, b.vy] = integrate(b.oy, b.vy, 0, MOVE_SPRING, dt);
  }
  [b.sx, b.vsx] = integrate(b.sx, b.vsx, 1, MOVE_SPRING, dt);
  [b.sy, b.vsy] = integrate(b.sy, b.vsy, 1, MOVE_SPRING, dt);
}

const near = (x: number, v: number, target: number, eps: number) =>
  Math.abs(x - target) < eps && Math.abs(v) < eps * 10;

function isSettled(b: Body) {
  if (b.pinned || b.hold > 0) {
    return false;
  }
  return (
    near(b.ox, b.vx, 0, 0.2) &&
    near(b.oy, b.vy, 0, 0.2) &&
    near(b.sx, b.vsx, 1, 0.001) &&
    near(b.sy, b.vsy, 1, 0.001) &&
    near(b.lift, b.vlift, b.liftTarget, 0.002) &&
    near(b.rx, b.vrx, 0, 0.02) &&
    near(b.ry, b.vry, 0, 0.02)
  );
}

function snapBody(b: Body) {
  if (!b.pinned) {
    b.ox = 0;
    b.oy = 0;
  }
  b.vx = 0;
  b.vy = 0;
  b.sx = 1;
  b.sy = 1;
  b.vsx = 0;
  b.vsy = 0;
  b.lift = b.liftTarget;
  b.vlift = 0;
  b.rx = 0;
  b.ry = 0;
  b.vrx = 0;
  b.vry = 0;
  b.hold = 0;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Owns every cell's spring state and writes transforms straight to the DOM,
 * so React never re-renders per frame. The loop sleeps once all is settled.
 */
class GridEngine {
  bodies = new Map<string, Body>();
  els = new Map<string, HTMLElement>();
  reduced = false;
  private raf = 0;
  private last = 0;

  body(id: string) {
    let b = this.bodies.get(id);
    if (!b) {
      b = createBody();
      this.bodies.set(id, b);
    }
    return b;
  }

  kick() {
    if (this.raf || typeof window === "undefined") {
      return;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  write(id: string, b: Body) {
    const el = this.els.get(id);
    if (!el) {
      return;
    }
    const surface = el.firstElementChild as HTMLElement | null;
    const shadow = surface?.firstElementChild as HTMLElement | null;
    const atRest =
      b.ox === 0 && b.oy === 0 && b.lift === 0 && b.rx === 0 && b.ry === 0;
    el.style.transform = atRest
      ? ""
      : `translate3d(${r2(b.ox)}px, ${r2(b.oy)}px, ${r2(b.lift * LIFT_Z)}px) rotateX(${r2(b.rx)}deg) rotateY(${r2(b.ry)}deg)`;
    if (surface) {
      surface.style.transform =
        b.sx === 1 && b.sy === 1 ? "" : `scale(${r3(b.sx)}, ${r3(b.sy)})`;
    }
    if (shadow) {
      shadow.style.opacity = String(r2(Math.max(0, Math.min(1, b.lift))));
    }
  }

  private advance(b: Body, elapsed: number) {
    if (this.reduced) {
      snapBody(b);
      return false;
    }
    let t = elapsed;
    while (t > 0) {
      const dt = Math.min(STEP, t);
      stepBody(b, dt);
      t -= dt;
    }
    if (isSettled(b)) {
      snapBody(b);
      return false;
    }
    return true;
  }

  private readonly tick = (now: number) => {
    const elapsed = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    let active = false;
    for (const [id, b] of this.bodies) {
      active = this.advance(b, elapsed) || active;
      this.write(id, b);
    }
    this.raf = active ? requestAnimationFrame(this.tick) : 0;
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Demo widgets                               */
/* -------------------------------------------------------------------------- */

const VALUE =
  "font-semibold text-zinc-900 tabular-nums tracking-tight dark:text-zinc-50";
const MUTED = "text-zinc-500 dark:text-zinc-400";
const ACCENT_TEXT = "font-medium text-(--wg-accent)";

const REVENUE_SERIES = [
  31, 34, 33, 36, 35, 39, 38, 41, 40, 43, 42, 45, 44, 48,
] as const;
const SPARK_POINTS = REVENUE_SERIES.map((v, i) => {
  const x = Math.round((i / (REVENUE_SERIES.length - 1)) * 1000) / 10;
  const y = Math.round((1 - (v - 30) / 19) * 300) / 10 + 1;
  return `${x},${y}`;
}).join(" ");

function Sparkline() {
  return (
    <svg
      aria-hidden="true"
      className="h-10 w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 100 32"
    >
      <polyline
        fill="none"
        points={SPARK_POINTS}
        stroke="var(--wg-accent)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const REVENUE_ROWS = [
  ["New", "$6,140"],
  ["Expansion", "$2,380"],
  ["Churned", "−$1,190"],
] as const;

function RevenueWidget({ size }: { size: WidgetSize }) {
  const head = (
    <div>
      <p className={cn(VALUE, size === "s" ? "text-2xl" : "text-3xl")}>
        $48,210
      </p>
      <p className="mt-1 text-xs">
        <span className={ACCENT_TEXT}>+12.4%</span>
        <span className={MUTED}> vs last month</span>
      </p>
    </div>
  );
  if (size === "s") {
    return <div className="flex h-full flex-col justify-end">{head}</div>;
  }
  if (size === "m") {
    return (
      <div className="flex h-full flex-col justify-between gap-2">
        {head}
        <Sparkline />
      </div>
    );
  }
  return (
    <div className="grid h-full grid-cols-[1.4fr_1fr] gap-6">
      <div className="flex min-w-0 flex-col justify-between gap-2">
        {head}
        <Sparkline />
      </div>
      <dl className="flex flex-col justify-end gap-1.5 text-xs">
        {REVENUE_ROWS.map(([label, value]) => (
          <div
            className="flex items-baseline justify-between border-zinc-100 border-b pb-1.5 last:border-0 last:pb-0 dark:border-zinc-800"
            key={label}
          >
            <dt className={MUTED}>{label}</dt>
            <dd className="font-medium text-zinc-800 tabular-nums dark:text-zinc-200">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const USERS_SERIES = [
  1820, 1960, 2010, 1890, 2240, 1450, 1380, 2120, 2380, 2290, 2510, 2640, 1720,
  2841,
] as const;
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const BAR_KEYS = USERS_SERIES.map((_, i) => `d${i}`);

function Bars({
  values,
  labels,
}: {
  values: readonly number[];
  labels: readonly string[];
}) {
  const max = Math.max(...values);
  const keys = BAR_KEYS.slice(-values.length);
  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      <div className="flex min-h-0 flex-1 items-end gap-1">
        {values.map((v, i) => (
          <div
            className={cn(
              "flex-1 rounded-[3px]",
              i === values.length - 1
                ? "bg-(--wg-accent)"
                : "bg-zinc-200 dark:bg-zinc-800"
            )}
            key={keys[i]}
            style={{ height: `${Math.round((v / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="flex gap-1">
        {labels.map((label, i) => (
          <span
            className={cn(MUTED, "flex-1 text-center text-[10px] leading-3")}
            key={keys[i]}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function UsersWidget({ size }: { size: WidgetSize }) {
  if (size === "s") {
    return (
      <div className="flex h-full flex-col justify-end gap-1">
        <p className={cn(VALUE, "text-2xl")}>2,841</p>
        <p className="text-xs">
          <span className={ACCENT_TEXT}>+6.2%</span>
          <span className={MUTED}> today</span>
        </p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <p className={cn(VALUE, "text-2xl")}>2,841</p>
        <p className="text-xs">
          <span className={ACCENT_TEXT}>+6.2%</span>
          <span className={MUTED}> active today</span>
        </p>
      </div>
      <div className="min-h-0 flex-1">
        {size === "m" ? (
          <Bars labels={DAY_LABELS} values={USERS_SERIES.slice(-7)} />
        ) : (
          <Bars labels={[...DAY_LABELS, ...DAY_LABELS]} values={USERS_SERIES} />
        )}
      </div>
    </div>
  );
}

const EVENTS = [
  { time: "09:41", text: "Release 4.2 promoted to production" },
  { time: "09:12", text: "Invoice 2041 paid" },
  { time: "08:55", text: "New teammate joined Design" },
  { time: "Mon", text: "Nightly backup verified" },
] as const;

const EVENT_COUNT: Record<WidgetSize, number> = { s: 1, m: 3, l: 4 };

function TimelineWidget({ size }: { size: WidgetSize }) {
  const count = EVENT_COUNT[size];
  return (
    <ol className="flex h-full flex-col justify-end">
      {EVENTS.slice(0, count).map((event, i) => (
        <li className="relative flex gap-3 pb-2 last:pb-0" key={event.text}>
          <span className="relative flex w-2 shrink-0 justify-center pt-1.5">
            <span
              className={cn(
                "size-2 rounded-full",
                i === 0
                  ? "bg-(--wg-accent)"
                  : "border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
              )}
            />
            {i < count - 1 ? (
              <span className="absolute top-4 bottom-[-6px] w-px bg-zinc-200 dark:bg-zinc-800" />
            ) : null}
          </span>
          <span className="min-w-0 flex-1 text-xs leading-5">
            <span className="block truncate text-zinc-800 dark:text-zinc-200">
              {event.text}
            </span>
            {size === "s" ? (
              <span className={MUTED}>Today, {event.time}</span>
            ) : null}
          </span>
          {size === "s" ? null : (
            <span
              className={cn(MUTED, "shrink-0 text-xs tabular-nums leading-5")}
            >
              {event.time}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

const NOTES = [
  { text: "Draft Q4 roadmap", done: true },
  { text: "Review onboarding copy", done: true },
  { text: "Pick pricing experiment", done: true },
  { text: "Book design review", done: false },
  { text: "Share hiring plan", done: false },
] as const;
const NOTES_DONE = NOTES.filter((note) => note.done).length;

function Check({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        "flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border",
        done
          ? "border-(--wg-accent) bg-(--wg-accent) text-white dark:text-zinc-950"
          : "border-zinc-300 dark:border-zinc-600"
      )}
    >
      {done ? (
        <svg
          aria-hidden="true"
          className="size-2.5"
          fill="none"
          viewBox="0 0 10 10"
        >
          <path
            d="M2 5.2 4.1 7.2 8 3"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.6}
          />
        </svg>
      ) : null}
    </span>
  );
}

function NotesWidget({ size }: { size: WidgetSize }) {
  if (size === "s") {
    return (
      <div className="flex h-full flex-col justify-end gap-2">
        <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
          Q4 planning
        </p>
        <p className={cn(MUTED, "text-xs")}>
          {NOTES_DONE} of {NOTES.length} done
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-(--wg-accent)"
            style={{ width: `${(NOTES_DONE / NOTES.length) * 100}%` }}
          />
        </div>
      </div>
    );
  }
  const list = size === "m" ? NOTES.slice(2) : NOTES;
  return (
    <ul
      className={cn(
        "grid h-full content-end gap-x-6 gap-y-2 text-xs",
        size === "l" && "grid-cols-2"
      )}
    >
      {list.map((note) => (
        <li className="flex min-w-0 items-center gap-2" key={note.text}>
          <Check done={note.done} />
          <span
            className={cn(
              "truncate",
              note.done
                ? "text-zinc-400 line-through dark:text-zinc-500"
                : "text-zinc-800 dark:text-zinc-200"
            )}
          >
            {note.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

const UPTIME_INCIDENT_AGO = 18;
const TICK_KEYS = Array.from({ length: 45 }, (_, i) => `t${i}`);

function UptimeWidget({ size }: { size: WidgetSize }) {
  const ticks = size === "l" ? 45 : 30;
  return (
    <div className="flex h-full flex-col justify-end gap-3">
      <div className="flex items-baseline gap-2">
        <p className={cn(VALUE, "text-2xl")}>99.98%</p>
        {size === "s" ? null : (
          <p className={cn(MUTED, "text-xs")}>last {ticks} days</p>
        )}
      </div>
      {size === "s" ? (
        <p className={cn(MUTED, "text-xs")}>All systems normal</p>
      ) : (
        <div className="flex h-7 gap-[3px]">
          {TICK_KEYS.slice(0, ticks).map((key, i) => (
            <span
              className={cn(
                "flex-1 rounded-[2px]",
                i === ticks - UPTIME_INCIDENT_AGO
                  ? "bg-(--wg-accent)"
                  : "bg-zinc-200 dark:bg-zinc-800"
              )}
              key={key}
            />
          ))}
        </div>
      )}
      {size === "l" ? (
        <p className={cn(MUTED, "text-xs")}>
          One incident {UPTIME_INCIDENT_AGO} days ago: slower API responses for
          4 minutes.
        </p>
      ) : null}
    </div>
  );
}

const STORAGE = [
  { label: "Media", gb: 182, tone: "bg-(--wg-accent)" },
  { label: "Documents", gb: 96, tone: "bg-zinc-500 dark:bg-zinc-400" },
  { label: "Backups", gb: 64, tone: "bg-zinc-300 dark:bg-zinc-600" },
] as const;
const STORAGE_TOTAL = 500;
const STORAGE_USED = STORAGE.reduce((sum, s) => sum + s.gb, 0);

function StorageWidget({ size }: { size: WidgetSize }) {
  const segments =
    size === "s"
      ? [{ label: "Used", gb: STORAGE_USED, tone: "bg-(--wg-accent)" }]
      : STORAGE;
  return (
    <div className="flex h-full flex-col justify-end gap-2.5">
      <p className="flex items-baseline gap-1.5">
        <span className={cn(VALUE, "text-2xl")}>{STORAGE_USED} GB</span>
        <span className={cn(MUTED, "text-xs")}>of {STORAGE_TOTAL}</span>
      </p>
      <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {segments.map((s) => (
          <span
            className={cn("h-full", s.tone)}
            key={s.label}
            style={{ width: `${(s.gb / STORAGE_TOTAL) * 100}%` }}
          />
        ))}
      </div>
      {size === "s" ? null : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STORAGE.map((s) => (
            <li className="flex items-center gap-1.5" key={s.label}>
              <span className={cn("size-2 rounded-full", s.tone)} />
              <span className={MUTED}>{s.label}</span>
              {size === "l" ? (
                <span className="text-zinc-800 tabular-nums dark:text-zinc-200">
                  {s.gb} GB
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ICON = "size-3.5";

export const DEMO_WIDGETS: WidgetGridItem[] = [
  {
    id: "revenue",
    title: "Revenue",
    icon: <TrendingUp className={ICON} />,
    defaultSpan: 2,
    render: (size) => <RevenueWidget size={size} />,
  },
  {
    id: "users",
    title: "Active users",
    icon: <Users className={ICON} />,
    defaultSpan: 4,
    render: (size) => <UsersWidget size={size} />,
  },
  {
    id: "activity",
    title: "Activity",
    icon: <History className={ICON} />,
    defaultSpan: 3,
    render: (size) => <TimelineWidget size={size} />,
  },
  {
    id: "notes",
    title: "Notes",
    icon: <NotebookPen className={ICON} />,
    defaultSpan: 3,
    render: (size) => <NotesWidget size={size} />,
  },
  {
    id: "uptime",
    title: "Uptime",
    icon: <Activity className={ICON} />,
    defaultSpan: 4,
    render: (size) => <UptimeWidget size={size} />,
  },
  {
    id: "storage",
    title: "Storage",
    icon: <HardDrive className={ICON} />,
    defaultSpan: 2,
    render: (size) => <StorageWidget size={size} />,
  },
];

/* -------------------------------------------------------------------------- */
/*                                    Cell                                    */
/* -------------------------------------------------------------------------- */

interface CellProps {
  item: WidgetGridItem;
  span: number;
  narrow: boolean;
  lifted: boolean;
  dimmed: boolean;
  instructionsId: string;
  cellRef: (el: HTMLDivElement | null) => void;
  gripRef: (el: HTMLButtonElement | null) => void;
  onPressStart: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onGripPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onGripKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onGripBlur: () => void;
  onResizePointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onHover: (on: boolean) => void;
  onFocusChange: (on: boolean) => void;
}

function WidgetCell({
  item,
  span,
  narrow,
  lifted,
  dimmed,
  instructionsId,
  cellRef,
  gripRef,
  onPressStart,
  onGripPointerDown,
  onGripKeyDown,
  onGripBlur,
  onResizePointerDown,
  onResizeKeyDown,
  onHover,
  onFocusChange,
}: CellProps) {
  const size = sizeForSpan(span, narrow);
  const columns = narrow ? NARROW_COLUMNS : COLUMNS;
  const shownSpan = narrow ? narrowSpan(span) : span;

  const handleFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (e.target.matches(":focus-visible")) {
      onFocusChange(true);
    }
  };
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      onFocusChange(false);
    }
  };
  // Long-pressing with a finger would otherwise open the system menu.
  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    const native = e.nativeEvent as globalThis.PointerEvent;
    if (lifted || native.pointerType === "touch") {
      e.preventDefault();
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: long press is a pointer shortcut; the grip button is the accessible control.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: long press is a pointer shortcut; the grip button is the accessible control.
    <div
      className={cn(
        "group/cell relative @xl/wg:col-span-(--span) col-span-(--span-n) select-none [-webkit-touch-callout:none]",
        "transition-opacity duration-200 ease-out",
        dimmed && "opacity-45",
        lifted && "z-20"
      )}
      data-lifted={lifted || undefined}
      onBlur={handleBlur}
      onContextMenu={handleContextMenu}
      onFocus={handleFocus}
      onPointerDown={onPressStart}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && onHover(false)}
      ref={cellRef}
      style={{ "--span": span, "--span-n": narrowSpan(span) } as CSSProperties}
    >
      {/* Surface: scaled by the engine while a resize settles. */}
      <div className="pointer-events-none absolute inset-0 origin-top-left rounded-2xl border border-zinc-200 bg-white transition-colors duration-200 group-data-lifted/cell:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:group-data-lifted/cell:border-zinc-700">
        {/* Lift shadow, faded in by the engine. */}
        <div className="absolute inset-0 rounded-2xl opacity-0 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.22),0_8px_16px_-8px_rgb(0_0_0/0.12)] dark:shadow-[0_24px_48px_-12px_rgb(0_0_0/0.7),0_8px_16px_-8px_rgb(0_0_0/0.5)]" />
      </div>

      <div className="relative flex h-full flex-col p-4 pt-3">
        <div className="mb-2 flex h-7 shrink-0 items-center gap-2">
          <span aria-hidden className="text-zinc-400 dark:text-zinc-500">
            {item.icon}
          </span>
          <span className="truncate font-medium text-[13px] text-zinc-600 dark:text-zinc-400">
            {item.title}
          </span>
          <button
            aria-describedby={instructionsId}
            aria-label={`Move ${item.title} (${SIZE_LABEL[size]})`}
            aria-pressed={lifted}
            className={cn(
              "-mr-2 ml-auto flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-zinc-400 outline-none",
              "transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
              "focus-visible:ring-(--wg-accent) focus-visible:ring-2",
              lifted &&
                "cursor-grabbing bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            )}
            data-no-press
            onBlur={onGripBlur}
            onKeyDown={onGripKeyDown}
            onPointerDown={onGripPointerDown}
            ref={gripRef}
            type="button"
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <AnimatePresence initial={false}>
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key={size}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              {item.render(size)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <button
        aria-label={`Resize ${item.title}, ${shownSpan} of ${columns} columns`}
        className={cn(
          "absolute right-0 bottom-0 flex size-7 cursor-ew-resize touch-none items-end justify-end rounded-br-2xl p-1.5 text-zinc-400 outline-none dark:text-zinc-500",
          "opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover/cell:opacity-100 [@media(hover:none)]:opacity-70",
          "hover:text-zinc-700 focus-visible:text-(--wg-accent) dark:hover:text-zinc-200"
        )}
        data-no-press
        onKeyDown={onResizeKeyDown}
        onPointerDown={onResizePointerDown}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="size-2.5"
          fill="none"
          viewBox="0 0 10 10"
        >
          <path
            d="M9 3 3 9M9 6.5 6.5 9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={1.5}
          />
        </svg>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Widget Grid                                */
/* -------------------------------------------------------------------------- */

export default function WidgetGrid({
  items = DEMO_WIDGETS,
  layout,
  defaultLayout,
  onLayoutChange,
  className,
  rowHeight = 176,
}: WidgetGridProps) {
  const instructionsId = useId();
  const [innerLayout, setInnerLayout] = useState<WidgetLayoutItem[]>(() =>
    normalizeLayout(defaultLayout ?? [], items)
  );
  const current = useMemo(
    () => normalizeLayout(layout ?? innerLayout, items),
    [layout, innerLayout, items]
  );
  const layoutKey = current.map((c) => `${c.id}:${c.span}`).join("|");
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );

  const [narrow, setNarrow] = useState(false);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  // Last cell hovered or keyboard-focused; it stays lit while others dim.
  const [pointedId, setPointedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GridEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new GridEngine();
  }
  const engine = engineRef.current;
  const rectsRef = useRef(new Map<string, Rect>());
  const gripsRef = useRef(new Map<string, HTMLButtonElement>());
  const pendingFlipRef = useRef<{
    prev: Map<string, Rect>;
    movedId: string;
  } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pressRef = useRef<PressState | null>(null);
  const resizeIdRef = useRef<string | null>(null);
  const resizeStartRef = useRef<{ x: number; span: number } | null>(null);
  const reorderingRef = useRef(false);
  const narrowRef = useRef(false);
  const layoutRef = useRef(current);
  layoutRef.current = current;
  const latest = useRef({ layout, onLayoutChange, itemsById });
  latest.current = { layout, onLayoutChange, itemsById };
  // Stable handles to handlers that are declared further down.
  const cancelPressRef = useRef<() => void>(() => undefined);
  const endDragRef = useRef<(cancel: boolean) => void>(() => undefined);

  const titleOf = useCallback(
    (id: string) => latest.current.itemsById.get(id)?.title ?? id,
    []
  );

  const announce = useCallback((text: string) => {
    // A trailing space makes a repeated message read again.
    setMessage((prev) => (prev === text ? `${text} ` : text));
  }, []);

  const positionText = useCallback((id: string) => {
    const list = layoutRef.current;
    const index = list.findIndex((c) => c.id === id);
    return `position ${index + 1} of ${list.length}`;
  }, []);

  const commit = useCallback((next: WidgetLayoutItem[], movedId: string) => {
    pendingFlipRef.current = { prev: new Map(rectsRef.current), movedId };
    layoutRef.current = next;
    if (latest.current.layout === undefined) {
      setInnerLayout(next);
    }
    latest.current.onLayoutChange?.(next);
  }, []);

  /* ------------------------------ measuring ------------------------------ */

  // offset* ignore transforms, so these are the cells' resting slots.
  const measure = useCallback(() => {
    const next = new Map<string, Rect>();
    for (const [id, el] of engine.els) {
      next.set(id, {
        x: el.offsetLeft,
        y: el.offsetTop,
        w: el.offsetWidth,
        h: el.offsetHeight,
      });
    }
    rectsRef.current = next;
    return next;
  }, [engine]);

  const toGrid = useCallback((clientX: number, clientY: number) => {
    const box = gridRef.current?.getBoundingClientRect();
    return { x: clientX - (box?.left ?? 0), y: clientY - (box?.top ?? 0) };
  }, []);

  /** Keeps a pointer-held cell under the pointer, even after its slot moved. */
  const placeDragged = useCallback(() => {
    const drag = dragRef.current;
    const rect = drag ? rectsRef.current.get(drag.id) : undefined;
    if (!(drag && rect) || drag.mode !== "pointer") {
      return;
    }
    const p = toGrid(drag.lastX, drag.lastY);
    const b = engine.body(drag.id);
    b.ox = p.x - drag.grabX - rect.x;
    b.oy = p.y - drag.grabY - rect.y;
    engine.write(drag.id, b);
    engine.kick();
  }, [engine, toGrid]);

  /** FLIP: start every moved cell where it was drawn, then spring it home. */
  const flip = useCallback(
    (prev: Map<string, Rect>, next: Map<string, Rect>, movedId: string) => {
      const origin = next.get(movedId);
      const cx = origin ? origin.x + origin.w / 2 : 0;
      const cy = origin ? origin.y + origin.h / 2 : 0;
      const pinnedId =
        dragRef.current?.mode === "pointer" ? dragRef.current.id : null;
      for (const [id, n] of next) {
        const p = prev.get(id);
        if (!p || id === pinnedId) {
          continue;
        }
        const b = engine.body(id);
        const moved =
          Math.abs(p.x - n.x) > 0.5 || Math.abs(p.y - n.y) > 0.5 || p.w !== n.w;
        b.ox += p.x - n.x;
        b.oy += p.y - n.y;
        b.sx = (p.w * b.sx) / n.w;
        b.sy = (p.h * b.sy) / n.h;
        if (moved && id !== movedId) {
          // Nearer neighbours leave first, so the shuffle ripples outward.
          const dist = Math.hypot(n.x + n.w / 2 - cx, n.y + n.h / 2 - cy);
          b.hold = Math.min(0.1, dist * 0.000_16);
        }
        engine.write(id, b);
      }
      engine.kick();
    },
    [engine]
  );

  // After every layout change: measure, FLIP neighbours, re-seat the held cell.
  // biome-ignore lint/correctness/useExhaustiveDependencies: layoutKey and narrow are the triggers.
  useLayoutEffect(() => {
    const next = measure();
    const pending = pendingFlipRef.current;
    pendingFlipRef.current = null;
    if (pending) {
      flip(pending.prev, next, pending.movedId);
    }
    placeDragged();
    const drag = dragRef.current;
    if (drag?.mode === "keyboard") {
      // React may move the focused node when it reorders; keep focus on it.
      const grip = gripsRef.current.get(drag.id);
      if (grip && document.activeElement !== grip) {
        grip.focus({ preventScroll: true });
      }
    }
    reorderingRef.current = false;
  }, [layoutKey, narrow, measure, flip, placeDragged]);

  // Container width decides the 2- or 6-column layout; re-measure on resize.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const ro = new ResizeObserver(() => {
      const isNarrow = wrap.clientWidth < NARROW_BELOW;
      narrowRef.current = isNarrow;
      setNarrow(isNarrow);
      measure();
      placeDragged();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [measure, placeDragged]);

  // Reduced motion is read after mount, so it never changes the first render.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      engine.reduced = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [engine]);

  /* ------------------------------ pointer drag ---------------------------- */

  const hitTest = useCallback(
    (x: number, y: number) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      // Ignore the cell just swapped with until the pointer leaves it, so
      // cells of different widths don't flip back and forth.
      if (drag.skipId) {
        const skipRect = rectsRef.current.get(drag.skipId);
        if (skipRect && contains(skipRect, x, y)) {
          return;
        }
        drag.skipId = null;
      }
      const list = layoutRef.current;
      const from = list.findIndex((c) => c.id === drag.id);
      const to = list.findIndex((c) => {
        const rect = rectsRef.current.get(c.id);
        return c.id !== drag.id && rect !== undefined && contains(rect, x, y);
      });
      if (to < 0) {
        return;
      }
      drag.skipId = list[to].id;
      commit(moveItem(list, from, to), drag.id);
      announce(
        `${titleOf(drag.id)} moved to position ${to + 1} of ${list.length}.`
      );
    },
    [announce, commit, titleOf]
  );

  const onDragMove = useCallback(
    (e: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.mode !== "pointer" || e.pointerId !== drag.pointerId) {
        return;
      }
      const now = performance.now();
      const dt = Math.max(1, now - drag.lastT);
      const b = engine.body(drag.id);
      b.pvx += ((e.clientX - drag.lastX) / dt - b.pvx) * 0.35;
      b.pvy += ((e.clientY - drag.lastY) / dt - b.pvy) * 0.35;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastT = now;
      placeDragged();
      const p = toGrid(e.clientX, e.clientY);
      hitTest(p.x, p.y);
    },
    [engine, hitTest, placeDragged, toGrid]
  );

  const onDragUp = useCallback((e: globalThis.PointerEvent) => {
    if (e.pointerId === dragRef.current?.pointerId) {
      endDragRef.current(false);
    }
  }, []);
  const onDragKey = useCallback((e: globalThis.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      endDragRef.current(true);
    }
  }, []);

  const removeDragListeners = useCallback(() => {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragUp);
    window.removeEventListener("pointercancel", onDragUp);
    window.removeEventListener("keydown", onDragKey);
  }, [onDragKey, onDragMove, onDragUp]);

  const endDrag = useCallback(
    (cancel: boolean) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      removeDragListeners();
      const b = engine.body(drag.id);
      if (drag.mode === "pointer") {
        // Carry some of the throw into the settle spring.
        b.vx = b.pvx * 400;
        b.vy = b.pvy * 400;
      }
      b.pinned = false;
      b.liftTarget = 0;
      dragRef.current = null;
      if (cancel) {
        commit(drag.snapshot, drag.id);
      }
      engine.kick();
      setLiftedId(null);
      const title = titleOf(drag.id);
      if (cancel) {
        const index = drag.snapshot.findIndex((c) => c.id === drag.id);
        announce(
          `Move cancelled. ${title} returned to position ${index + 1} of ${drag.snapshot.length}.`
        );
      } else {
        announce(`${title} dropped at ${positionText(drag.id)}.`);
      }
    },
    [announce, commit, engine, positionText, removeDragListeners, titleOf]
  );
  endDragRef.current = endDrag;

  const liftPointer = useCallback(
    (id: string, pointerId: number, clientX: number, clientY: number) => {
      const rect = rectsRef.current.get(id);
      if (!rect || dragRef.current) {
        return;
      }
      const b = engine.body(id);
      const p = toGrid(clientX, clientY);
      dragRef.current = {
        id,
        mode: "pointer",
        pointerId,
        grabX: p.x - (rect.x + b.ox),
        grabY: p.y - (rect.y + b.oy),
        lastX: clientX,
        lastY: clientY,
        lastT: performance.now(),
        skipId: null,
        snapshot: layoutRef.current,
      };
      Object.assign(b, { pinned: true, hold: 0, vx: 0, vy: 0, pvx: 0, pvy: 0 });
      b.liftTarget = 1;
      engine.kick();
      setLiftedId(id);
      announce(`${titleOf(id)} lifted, ${positionText(id)}.`);
      navigator.vibrate?.(8);
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", onDragUp);
      window.addEventListener("pointercancel", onDragUp);
      window.addEventListener("keydown", onDragKey);
    },
    [
      announce,
      engine,
      onDragKey,
      onDragMove,
      onDragUp,
      positionText,
      titleOf,
      toGrid,
    ]
  );

  /* ------------------------------ long press ------------------------------ */

  const onPressMove = useCallback((e: globalThis.PointerEvent) => {
    const press = pressRef.current;
    if (!press || e.pointerId !== press.pointerId) {
      return;
    }
    press.x = e.clientX;
    press.y = e.clientY;
    // Moving first means scrolling (touch) or selecting (mouse), not lifting.
    if (
      Math.hypot(e.clientX - press.startX, e.clientY - press.startY) >
      PRESS_SLOP
    ) {
      cancelPressRef.current();
    }
  }, []);

  const cancelPress = useCallback(() => {
    const press = pressRef.current;
    if (press) {
      window.clearTimeout(press.timer);
    }
    pressRef.current = null;
    window.removeEventListener("pointermove", onPressMove);
    window.removeEventListener("pointerup", cancelPressRef.current);
    window.removeEventListener("pointercancel", cancelPressRef.current);
  }, [onPressMove]);
  cancelPressRef.current = cancelPress;

  const startPress = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
      const target = e.target as HTMLElement;
      if (
        dragRef.current ||
        resizeIdRef.current ||
        e.button !== 0 ||
        target.closest("[data-no-press]")
      ) {
        return;
      }
      cancelPress();
      pressRef.current = {
        id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(() => {
          const press = pressRef.current;
          cancelPressRef.current();
          if (press) {
            liftPointer(press.id, press.pointerId, press.x, press.y);
          }
        }, LONG_PRESS_MS),
      };
      window.addEventListener("pointermove", onPressMove);
      window.addEventListener("pointerup", cancelPress);
      window.addEventListener("pointercancel", cancelPress);
    },
    [cancelPress, liftPointer, onPressMove]
  );

  // A non-passive touchmove listener stops the page scrolling while a cell is
  // held. Until the long press fires, touch scrolling is left alone.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }
    const block = (e: TouchEvent) => {
      if (dragRef.current?.mode === "pointer" || resizeIdRef.current) {
        e.preventDefault();
      }
    };
    grid.addEventListener("touchmove", block, { passive: false });
    return () => grid.removeEventListener("touchmove", block);
  }, []);

  /* -------------------------------- resize -------------------------------- */

  const spanText = useCallback((span: number) => {
    const isNarrow = narrowRef.current;
    const shown = isNarrow ? narrowSpan(span) : span;
    const cols = isNarrow ? NARROW_COLUMNS : COLUMNS;
    return `${shown} of ${cols} columns, ${SIZE_LABEL[sizeForSpan(span, isNarrow)]}`;
  }, []);

  const applySpan = useCallback(
    (id: string, span: number) => {
      const list = layoutRef.current;
      const entry = list.find((c) => c.id === id);
      if (!entry || entry.span === span) {
        return;
      }
      commit(
        list.map((c) => (c.id === id ? { ...c, span } : c)),
        id
      );
      announce(`${titleOf(id)} resized to ${spanText(span)}.`);
    },
    [announce, commit, spanText, titleOf]
  );

  /**
   * Whole-column span from how far the handle moved since the press. Using the
   * delta (not the cell's left edge) keeps it stable when the cell wraps rows.
   * Narrow grids only toggle between half and full width.
   */
  const spanFromPointer = useCallback((clientX: number) => {
    const start = resizeStartRef.current;
    const grid = gridRef.current;
    if (!(start && grid)) {
      return null;
    }
    const isNarrow = narrowRef.current;
    const cols = isNarrow ? NARROW_COLUMNS : COLUMNS;
    const colW = (grid.clientWidth + GAP) / cols;
    const steps = Math.round((clientX - start.x) / colW);
    if (!isNarrow) {
      return clampSpan(start.span + steps);
    }
    const n = Math.max(1, Math.min(2, narrowSpan(start.span) + steps));
    if (n === 1) {
      return MIN_SPAN;
    }
    return Math.max(3, start.span);
  }, []);

  const onResizeMove = useCallback(
    (e: globalThis.PointerEvent) => {
      const id = resizeIdRef.current;
      const span = spanFromPointer(e.clientX);
      if (id && span !== null) {
        applySpan(id, span);
      }
    },
    [applySpan, spanFromPointer]
  );

  const onResizeUp = useCallback(() => {
    resizeIdRef.current = null;
    setResizingId(null);
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeUp);
    window.removeEventListener("pointercancel", onResizeUp);
  }, [onResizeMove]);

  const startResize = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
      if (dragRef.current || e.button !== 0) {
        return;
      }
      e.preventDefault();
      cancelPress();
      resizeIdRef.current = id;
      resizeStartRef.current = {
        x: e.clientX,
        span: layoutRef.current.find((c) => c.id === id)?.span ?? MIN_SPAN,
      };
      setResizingId(id);
      window.addEventListener("pointermove", onResizeMove);
      window.addEventListener("pointerup", onResizeUp);
      window.addEventListener("pointercancel", onResizeUp);
    },
    [cancelPress, onResizeMove, onResizeUp]
  );

  const onResizeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
      const entry = layoutRef.current.find((c) => c.id === id);
      let delta = 0;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        delta = 1;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        delta = -1;
      }
      if (!entry || delta === 0) {
        return;
      }
      e.preventDefault();
      let span = clampSpan(entry.span + delta);
      if (narrowRef.current) {
        span = delta > 0 ? Math.max(3, entry.span) : MIN_SPAN;
      }
      applySpan(id, span);
    },
    [applySpan]
  );

  /* ------------------------------- keyboard ------------------------------- */

  /** Index of the closest cell in the row above or below. */
  const verticalNeighbor = useCallback((id: string, up: boolean) => {
    const list = layoutRef.current;
    const rects = rectsRef.current;
    const cur = rects.get(id);
    let best = -1;
    let bestDy = Number.POSITIVE_INFINITY;
    let bestDx = Number.POSITIVE_INFINITY;
    if (!cur) {
      return best;
    }
    const cx = cur.x + cur.w / 2;
    for (const [i, c] of list.entries()) {
      const r = rects.get(c.id);
      const inRow =
        r !== undefined &&
        (up ? r.y + r.h <= cur.y + 1 : r.y >= cur.y + cur.h - 1);
      if (r && inRow) {
        const dy = Math.abs(r.y - cur.y);
        const dx = Math.abs(r.x + r.w / 2 - cx);
        if (dy < bestDy - 1 || (Math.abs(dy - bestDy) <= 1 && dx < bestDx)) {
          best = i;
          bestDy = dy;
          bestDx = dx;
        }
      }
    }
    return best;
  }, []);

  const neighborIndex = useCallback(
    (id: string, key: string) => {
      const list = layoutRef.current;
      const index = list.findIndex((c) => c.id === id);
      if (key === "ArrowLeft") {
        return Math.max(0, index - 1);
      }
      if (key === "ArrowRight") {
        return Math.min(list.length - 1, index + 1);
      }
      if (key === "ArrowUp" || key === "ArrowDown") {
        const found = verticalNeighbor(id, key === "ArrowUp");
        return found < 0 ? index : found;
      }
      return null;
    },
    [verticalNeighbor]
  );

  const liftKeyboard = useCallback(
    (id: string) => {
      dragRef.current = {
        id,
        mode: "keyboard",
        pointerId: -1,
        grabX: 0,
        grabY: 0,
        lastX: 0,
        lastY: 0,
        lastT: 0,
        skipId: null,
        snapshot: layoutRef.current,
      };
      engine.body(id).liftTarget = 1;
      engine.kick();
      setLiftedId(id);
      announce(
        `${titleOf(id)} lifted, ${positionText(id)}. Arrow keys move it, Space drops it, Escape cancels.`
      );
    },
    [announce, engine, positionText, titleOf]
  );

  const moveByKey = useCallback(
    (id: string, key: string) => {
      const to = neighborIndex(id, key);
      if (to === null) {
        return false;
      }
      const list = layoutRef.current;
      const from = list.findIndex((c) => c.id === id);
      if (to === from) {
        announce(`${titleOf(id)} is at ${positionText(id)}.`);
        return true;
      }
      reorderingRef.current = true;
      commit(moveItem(list, from, to), id);
      announce(`${titleOf(id)} moved to position ${to + 1} of ${list.length}.`);
      return true;
    },
    [announce, commit, neighborIndex, positionText, titleOf]
  );

  const onGripKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
      const drag = dragRef.current;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (drag?.id === id) {
          endDrag(false);
        } else if (!drag) {
          liftKeyboard(id);
        }
        return;
      }
      if (drag?.id !== id || drag.mode !== "keyboard") {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        reorderingRef.current = true;
        endDrag(true);
        return;
      }
      if (moveByKey(id, e.key)) {
        e.preventDefault();
      }
    },
    [endDrag, liftKeyboard, moveByKey]
  );

  const onGripBlur = useCallback(
    (id: string) => {
      const drag = dragRef.current;
      if (
        drag?.mode === "keyboard" &&
        drag.id === id &&
        !reorderingRef.current
      ) {
        endDrag(false);
      }
    },
    [endDrag]
  );

  // Clean up timers, listeners and the loop on unmount.
  useEffect(
    () => () => {
      cancelPressRef.current();
      removeDragListeners();
      onResizeUp();
      engine.stop();
    },
    [engine, onResizeUp, removeDragListeners]
  );

  const activeId = liftedId ?? resizingId ?? pointedId;

  return (
    <div
      className={cn(
        "@container/wg w-full max-w-4xl [--wg-accent:var(--color-blue-600)] dark:[--wg-accent:var(--color-blue-400)]",
        className
      )}
      ref={wrapRef}
    >
      <div
        className="relative grid @xl/wg:grid-flow-row grid-flow-row-dense @xl/wg:grid-cols-6 grid-cols-2 [perspective:1400px]"
        ref={gridRef}
        style={{ gap: GAP, gridAutoRows: rowHeight }}
      >
        {current.map((entry) => {
          const item = itemsById.get(entry.id);
          if (!item) {
            return null;
          }
          const id = entry.id;
          return (
            <WidgetCell
              cellRef={(el) => {
                if (el) {
                  engine.els.set(id, el);
                } else {
                  engine.els.delete(id);
                }
              }}
              dimmed={activeId !== null && activeId !== id}
              gripRef={(el) => {
                if (el) {
                  gripsRef.current.set(id, el);
                } else {
                  gripsRef.current.delete(id);
                }
              }}
              instructionsId={instructionsId}
              item={item}
              key={id}
              lifted={liftedId === id}
              narrow={narrow}
              onFocusChange={(on) =>
                setPointedId((prev) => {
                  if (on) {
                    return id;
                  }
                  return prev === id ? null : prev;
                })
              }
              onGripBlur={() => onGripBlur(id)}
              onGripKeyDown={(e) => onGripKeyDown(e, id)}
              onGripPointerDown={(e) => {
                if (e.button === 0) {
                  e.preventDefault();
                  cancelPress();
                  liftPointer(id, e.pointerId, e.clientX, e.clientY);
                }
              }}
              onHover={(on) =>
                setPointedId((prev) => {
                  if (on) {
                    return id;
                  }
                  return prev === id ? null : prev;
                })
              }
              onPressStart={(e) => startPress(e, id)}
              onResizeKeyDown={(e) => onResizeKeyDown(e, id)}
              onResizePointerDown={(e) => startResize(e, id)}
              span={entry.span}
            />
          );
        })}
      </div>
      <p className="sr-only" id={instructionsId}>
        Press Space to pick up. Use the arrow keys to move, Space to drop and
        Escape to cancel. With a pointer, press and hold a widget, then drag it.
      </p>
      <p aria-live="assertive" className="sr-only">
        {message}
      </p>
    </div>
  );
}
