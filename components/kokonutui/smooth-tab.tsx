"use client";

/**
 * @author: @dorianbaffier
 * @description: Swipe Tabs
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import type { LucideIcon } from "lucide-react";
import {
  type AnimationPlaybackControls,
  animate,
  useMotionValue,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface SwipeTabItem {
  id: string;
  title: string;
  /** Shown before the title in the tab. */
  icon?: LucideIcon;
  /** The panel shown for this tab. */
  content?: ReactNode;
}

export interface SmoothTabProps {
  items?: SwipeTabItem[];
  defaultTabId?: string;
  /** The selected tab id, for a controlled tab. Pair it with `onChange`. */
  value?: string;
  onChange?: (tabId: string) => void;
  className?: string;
  /** Background classes for the indicator: the one accent. */
  activeColor?: string;
  /** Text color classes for the label sitting on the indicator. */
  activeTextColor?: string;
  /** Accessible name for the tab list. */
  label?: string;
}

// Past the first or last tab the panel moves this fraction of the drag.
const RUBBER_BAND = 0.35;
// A release this fast (px per ms) changes tab however short the drag was.
const SWIPE_VELOCITY = 0.11;
// Movement before deciding between a horizontal swipe and a vertical scroll.
const AXIS_LOCK = 6;
// Release velocity is measured over the last stretch of the drag only.
const VELOCITY_WINDOW = 100;
// A panel one full width away sits at this opacity, so the neighbour reads
// as "next" while it slides in.
const NEIGHBOUR_OPACITY = 0.35;
// Just under critical damping: a firm settle, a hint of overshoot only after
// a fast flick.
const SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface TabRect {
  left: number;
  width: number;
  top: number;
  height: number;
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  startProgress: number;
  axis: "x" | "y" | null;
  width: number;
  samples: { x: number; t: number }[];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

/** The indicator rectangle at a fractional tab position. */
function indicatorRect(rects: TabRect[], progress: number): TabRect | null {
  const last = rects.length - 1;
  if (last < 0) {
    return null;
  }
  const p = clamp(progress, 0, last);
  const i = Math.min(Math.floor(p), Math.max(last - 1, 0));
  const a = rects[i];
  const b = rects[Math.min(i + 1, last)];
  const t = p - i;
  let left = lerp(a.left, b.left, t);
  let width = lerp(a.width, b.width, t);
  // Rubber-banding past an end: the pill presses against the wall and gives
  // on the far side instead of sliding out of the track.
  const over = progress < 0 ? -progress : progress - last;
  if (over > 0) {
    const squash = width * Math.min(over, 0.5) * 0.4;
    width -= squash;
    if (progress > last) {
      left += squash;
    }
  }
  return { left, width, top: a.top, height: a.height };
}

/** Rubber-bands a raw position that runs past the first or last tab. */
function rubberBand(raw: number, last: number): number {
  if (raw < 0) {
    return raw * RUBBER_BAND;
  }
  if (raw > last) {
    return last + (raw - last) * RUBBER_BAND;
  }
  return raw;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-100 px-3 py-2.5 dark:bg-zinc-900">
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-0.5 font-medium text-sm text-zinc-900 tabular-nums dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}

const BARS = [38, 52, 44, 61, 57, 72, 66, 80, 74, 88, 69, 92];

const ACTIVITY = [
  ["Deploy #418 promoted to production", "2m"],
  ["Preview built for fix/auth-redirect", "14m"],
  ["Environment variable rotated", "1h"],
  ["Domain app.example.com verified", "3h"],
];

const MEMBERS = [
  ["AL", "Avery Lane", "Owner"],
  ["JR", "Jordan Reyes", "Admin"],
  ["SK", "Sam Kato", "Developer"],
  ["RM", "Riley Moss", "Viewer"],
];

const DEFAULT_TABS: SwipeTabItem[] = [
  {
    id: "overview",
    title: "Overview",
    content: (
      <div className="flex h-full flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Requests" value="24.1k" />
          <Stat label="Errors" value="0.12%" />
          <Stat label="p95" value="182 ms" />
        </div>
        <div aria-hidden="true" className="flex h-24 items-end gap-1.5">
          {BARS.map((h, i) => (
            <span
              className={cn(
                "flex-1 rounded-sm",
                i === BARS.length - 1
                  ? "bg-zinc-900 dark:bg-zinc-100"
                  : "bg-zinc-200 dark:bg-zinc-800"
              )}
              key={`bar-${i.toString()}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "activity",
    title: "Activity",
    content: (
      <ol className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {ACTIVITY.map(([text, time]) => (
          <li
            className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
            key={text}
          >
            <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">
              {text}
            </span>
            <span className="shrink-0 text-xs text-zinc-400 tabular-nums">
              {time}
            </span>
          </li>
        ))}
      </ol>
    ),
  },
  {
    id: "members",
    title: "Members",
    content: (
      <ul className="flex flex-col gap-3">
        {MEMBERS.map(([initials, name, role]) => (
          <li className="flex items-center gap-3" key={name}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-medium text-[11px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              {initials}
            </span>
            <span className="flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
              {name}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {role}
            </span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: "billing",
    title: "Billing",
    content: (
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
            Pro plan
          </p>
          <p className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
            $20 / month
          </p>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Bandwidth</span>
            <span className="tabular-nums">64 / 100 GB</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
            <div className="h-full w-[64%] rounded-full bg-zinc-900 dark:bg-zinc-100" />
          </div>
        </div>
        <p className="mt-auto text-xs text-zinc-500 dark:text-zinc-400">
          Next invoice on Nov 1 · Card ending 4242
        </p>
      </div>
    ),
  },
];

export default function SmoothTab({
  items = DEFAULT_TABS,
  defaultTabId,
  value,
  onChange,
  className,
  activeColor = "bg-zinc-900 dark:bg-zinc-100",
  activeTextColor = "text-white dark:text-zinc-900",
  label = "Sections",
}: SmoothTabProps) {
  const count = items.length;
  const indexOf = (id: string | undefined) =>
    Math.max(
      items.findIndex((item) => item.id === id),
      0
    );

  const [uncontrolled, setUncontrolled] = useState(() => indexOf(defaultTabId));
  const selected = value === undefined ? uncontrolled : indexOf(value);
  // Captured once, so React never rewrites the imperatively painted styles.
  const [initial] = useState(selected);

  // Fractional tab position: 0 … count - 1, beyond while rubber-banding.
  // It drives the panel track, the indicator and the label clip directly,
  // so a drag never re-renders React.
  const progress = useMotionValue(selected);

  const baseId = useId();
  const tablistRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rects = useRef<TabRect[]>([]);
  const size = useRef({ width: 0, height: 0 });
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const target = useRef(selected);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const reducedMotion = useRef(false);
  const latest = useRef({ count, items, selected, onChange });
  latest.current = { count, items, selected, onChange };

  const paint = useCallback(
    (p: number) => {
      const track = trackRef.current;
      if (track) {
        track.style.transform = `translate3d(${(-p * 100) / count}%, 0, 0)`;
      }
      panelRefs.current.forEach((panel, i) => {
        if (panel) {
          const d = Math.min(Math.abs(p - i), 1);
          panel.style.opacity = String(1 - d * (1 - NEIGHBOUR_OPACITY));
        }
      });
      const overlay = overlayRef.current;
      const r = indicatorRect(rects.current, p);
      if (overlay && r) {
        const right = size.current.width - r.left - r.width;
        const bottom = size.current.height - r.top - r.height;
        overlay.style.clipPath = `inset(${r.top}px ${right}px ${bottom}px ${r.left}px round ${r.height / 2}px)`;
      }
    },
    [count]
  );

  // Measure the tabs before paint, and again on resize and font load.
  useLayoutEffect(() => {
    const tablist = tablistRef.current;
    if (!tablist) {
      return;
    }
    let alive = true;
    const measure = () => {
      if (!alive) {
        return;
      }
      // Sub-pixel rects, so the clip lines up with the labels exactly.
      // Divided by the list's scale in case an ancestor is transformed.
      const box = tablist.getBoundingClientRect();
      const ratio = box.width / (tablist.offsetWidth || 1);
      // offsetWidth is rounded: only a real transform counts as a scale.
      const scale = Math.abs(ratio - 1) < 0.01 ? 1 : ratio;
      size.current = { width: box.width / scale, height: box.height / scale };
      rects.current = tabRefs.current.slice(0, count).map((tab) => {
        const r = tab?.getBoundingClientRect();
        return r
          ? {
              left: (r.left - box.left) / scale,
              width: r.width / scale,
              top: (r.top - box.top) / scale,
              height: r.height / scale,
            }
          : { left: 0, width: 0, top: 0, height: 0 };
      });
      paint(progress.get());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tablist);
    document.fonts.ready.then(measure).catch(() => undefined);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [count, paint, progress]);

  useEffect(() => {
    const unsubscribe = progress.on("change", paint);
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedMotion.current = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => {
      unsubscribe();
      query.removeEventListener("change", sync);
      anim.current?.stop();
    };
  }, [paint, progress]);

  /** Moves the position to a tab. `velocity` is in tabs per second. */
  const settle = useCallback(
    (index: number, opts: { instant?: boolean; velocity?: number } = {}) => {
      target.current = index;
      anim.current?.stop();
      anim.current = null;
      if (opts.instant) {
        progress.jump(index);
        return;
      }
      anim.current = reducedMotion.current
        ? animate(progress, index, { duration: 0.15, ease: EASE_OUT })
        : animate(progress, index, { ...SPRING, velocity: opts.velocity ?? 0 });
    },
    [progress]
  );

  const select = useCallback(
    (index: number, opts?: { instant?: boolean; velocity?: number }) => {
      const { count: n, items: list, selected: current } = latest.current;
      const next = clamp(index, 0, n - 1);
      settle(next, opts);
      if (next !== current) {
        setUncontrolled(next);
        latest.current.onChange?.(list[next].id);
      }
    },
    [settle]
  );

  // A controlled `value` changed from outside: follow it.
  useEffect(() => {
    if (selected !== target.current && !drag.current) {
      settle(selected);
    }
  }, [selected, settle]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const keys: Record<string, number> = {
      ArrowRight: (i + 1) % count,
      ArrowLeft: (i - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    const next = keys[e.key];
    if (next === undefined) {
      return;
    }
    e.preventDefault();
    tabRefs.current[next]?.focus();
    // A held key repeats faster than any spring settles: jump instead.
    select(next, { instant: e.repeat });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (count < 2 || (e.pointerType === "mouse" && e.button !== 0)) {
      return;
    }
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startProgress: progress.get(),
      axis: null,
      width: e.currentTarget.clientWidth || 1,
      samples: [{ x: e.clientX, t: e.timeStamp }],
    };
  };

  const lockAxis = (current: Drag, e: PointerEvent<HTMLDivElement>) => {
    const dx = e.clientX - current.startX;
    const dy = e.clientY - current.startY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) {
      return;
    }
    // Vertical wins ties: the page scroll is what most people are after.
    current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (current.axis === "x") {
      // Catch the panel mid-flight, and keep the swipe alive when the
      // pointer leaves the panel.
      anim.current?.stop();
      current.startProgress = progress.get();
      current.startX = e.clientX;
      current.samples = [{ x: e.clientX, t: e.timeStamp }];
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.dragging = "";
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId) {
      return;
    }
    if (current.axis === null) {
      lockAxis(current, e);
    }
    if (current.axis !== "x") {
      return;
    }
    current.samples.push({ x: e.clientX, t: e.timeStamp });
    while (
      current.samples.length > 2 &&
      e.timeStamp - current.samples[0].t > VELOCITY_WINDOW
    ) {
      current.samples.shift();
    }
    const raw =
      current.startProgress - (e.clientX - current.startX) / current.width;
    progress.set(rubberBand(raw, count - 1));
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId) {
      return;
    }
    drag.current = null;
    delete e.currentTarget.dataset.dragging;
    if (current.axis !== "x") {
      return;
    }
    suppressClick.current = !cancelled;
    const first = current.samples[0];
    // px per ms; negative is a swipe towards the next tab.
    const vx = (e.clientX - first.x) / Math.max(e.timeStamp - first.t, 1);
    const p = progress.get();
    let next = Math.round(p);
    if (!cancelled && Math.abs(vx) > SWIPE_VELOCITY) {
      next = vx < 0 ? Math.floor(p) + 1 : Math.ceil(p) - 1;
    }
    // The spring starts at the finger's speed, so the hand-off is seamless.
    select(next, { velocity: (-vx * 1000) / current.width });
  };

  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = (i: number) => `${baseId}-panel-${i}`;

  return (
    <div className={cn("flex w-full max-w-md flex-col gap-3", className)}>
      <div className="flex justify-center">
        <div
          aria-label={label}
          className="relative inline-flex max-w-full rounded-full bg-zinc-100 p-1 dark:bg-zinc-900"
          ref={tablistRef}
          role="tablist"
        >
          {items.map((item, i) => {
            const Icon = item.icon;
            const isSelected = i === selected;
            return (
              <button
                aria-controls={panelId(i)}
                aria-selected={isSelected}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium text-sm",
                  "text-zinc-500 transition-colors duration-150 ease-out hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                  "outline-none focus-visible:outline-2 focus-visible:outline-zinc-400 focus-visible:outline-offset-2"
                )}
                id={tabId(i)}
                key={item.id}
                onClick={() => select(i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                type="button"
              >
                {Icon && <Icon aria-hidden="true" className="size-4" />}
                <span className="whitespace-nowrap">{item.title}</span>
              </button>
            );
          })}
          {/* The same labels in the active color, clipped to the indicator,
              so each label is exactly right at every point of the slide with
              no color tween. */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 flex p-1",
              activeColor
            )}
            ref={overlayRef}
            style={{ clipPath: "inset(0 100% 0 0)" }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 font-medium text-sm",
                    activeTextColor
                  )}
                  key={item.id}
                >
                  {Icon && <Icon className="size-4" />}
                  <span className="whitespace-nowrap">{item.title}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="relative touch-pan-y select-none overflow-hidden rounded-2xl border border-zinc-200 bg-white data-dragging:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950"
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onLostPointerCapture={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
      >
        <div
          className="flex will-change-transform"
          ref={trackRef}
          style={{
            width: `${count * 100}%`,
            transform: `translate3d(${(-initial * 100) / count}%, 0, 0)`,
          }}
        >
          {items.map((item, i) => (
            <div
              aria-labelledby={tabId(i)}
              className="min-h-[220px] p-5 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
              id={panelId(i)}
              inert={i !== selected}
              key={item.id}
              ref={(el) => {
                panelRefs.current[i] = el;
              }}
              role="tabpanel"
              style={{
                width: `${100 / count}%`,
                opacity: i === initial ? 1 : NEIGHBOUR_OPACITY,
              }}
              tabIndex={i === selected ? 0 : -1}
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
