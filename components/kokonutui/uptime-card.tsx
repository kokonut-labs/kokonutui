"use client";

/**
 * @author: @dorianbaffier
 * @description: Uptime Card
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { CircleCheck, TriangleAlert, X } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// How much wider the bar under the pointer gets, and how far the swell
// spreads, in bars.
const MAGNIFY = 5;
const SPREAD = 2.4;
// Bars ease toward their width at this rate, per second.
const EASE = 18;
const DAY = 86_400_000;

export type DayStatus = "up" | "degraded" | "down" | "none";

export interface IncidentUpdate {
  /** HH:MM, local to the status page. */
  time: string;
  label: string;
  note?: string;
}

export interface Incident {
  title: string;
  status: Exclude<DayStatus, "up" | "none">;
  /** Minutes of impact that day. */
  minutes: number;
  updates: IncidentUpdate[];
}

export interface UptimeService {
  name: string;
  /** Incidents by day index, 0 being the oldest day shown. */
  incidents?: Record<number, Incident>;
  /** Days with no data (before the service existed), from the start. */
  missing?: number;
}

export interface UptimeCardProps {
  title?: string;
  services?: UptimeService[];
  days?: number;
  /** The last day shown, as YYYY-MM-DD. */
  endDate?: string;
  className?: string;
}

const DEFAULT_SERVICES: UptimeService[] = [
  {
    name: "API",
    incidents: {
      19: {
        title: "Elevated error rates on writes",
        status: "degraded",
        minutes: 18,
        updates: [
          {
            time: "14:02",
            label: "Investigating",
            note: "5xx on POST rose to 2%.",
          },
          {
            time: "14:11",
            label: "Identified",
            note: "A bad config push to one region.",
          },
          {
            time: "14:20",
            label: "Resolved",
            note: "Rolled back; error rates normal.",
          },
        ],
      },
      84: {
        title: "Slow responses in eu-west",
        status: "degraded",
        minutes: 23,
        updates: [
          {
            time: "09:41",
            label: "Investigating",
            note: "p95 latency up 3x in eu-west.",
          },
          {
            time: "09:52",
            label: "Monitoring",
            note: "Added capacity to the pool.",
          },
          { time: "10:04", label: "Resolved" },
        ],
      },
    },
  },
  {
    name: "Dashboard",
    incidents: {
      43: {
        title: "Charts failed to load",
        status: "degraded",
        minutes: 12,
        updates: [
          { time: "18:30", label: "Investigating" },
          {
            time: "18:42",
            label: "Resolved",
            note: "A CDN cache rule was reverted.",
          },
        ],
      },
    },
  },
  {
    name: "Webhooks",
    incidents: {
      69: {
        title: "Deliveries delayed",
        status: "down",
        minutes: 48,
        updates: [
          {
            time: "02:15",
            label: "Investigating",
            note: "The delivery queue stopped draining.",
          },
          {
            time: "02:38",
            label: "Identified",
            note: "A worker deploy failed health checks.",
          },
          {
            time: "03:03",
            label: "Resolved",
            note: "Backlog delivered in order.",
          },
        ],
      },
    },
  },
  {
    name: "Database",
    missing: 6,
    incidents: {
      27: {
        title: "Failover to replica",
        status: "down",
        minutes: 9,
        updates: [
          {
            time: "22:07",
            label: "Investigating",
            note: "Primary stopped accepting writes.",
          },
          {
            time: "22:16",
            label: "Resolved",
            note: "Promoted the replica; no data lost.",
          },
        ],
      },
    },
  },
];

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

const formatDay = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function statusOf(service: UptimeService, day: number): DayStatus {
  if (day < (service.missing ?? 0)) {
    return "none";
  }
  return service.incidents?.[day]?.status ?? "up";
}

/** Downtime counts in full, degraded time at half. */
function uptimeOf(service: UptimeService, days: number) {
  const tracked = days - (service.missing ?? 0);
  let lost = 0;
  for (const incident of Object.values(service.incidents ?? {})) {
    lost += incident.minutes * (incident.status === "down" ? 1 : 0.5);
  }
  return 100 * (1 - lost / (tracked * 1440));
}

/** Target widths: a swell around the focus, flat without one. */
function swell(count: number, focus: number | null, out: Float64Array) {
  for (let i = 0; i < count; i++) {
    out[i] =
      focus === null
        ? 1
        : 1 + MAGNIFY * Math.exp(-(((i - focus) / SPREAD) ** 2));
  }
  return out;
}

/** The bar under x (0 to 1) when bars have these widths. */
function barAt(weights: Float64Array, x: number) {
  let total = 0;
  for (const w of weights) {
    total += w;
  }
  let at = x * total;
  for (let i = 0; i < weights.length; i++) {
    at -= weights[i];
    if (at <= 0) {
      return i;
    }
  }
  return weights.length - 1;
}

const BAR_COLOR: Record<DayStatus, string> = {
  up: "bg-emerald-500 dark:bg-emerald-400",
  degraded: "bg-amber-400 dark:bg-amber-300",
  down: "bg-rose-500 dark:bg-rose-400",
  none: "bg-zinc-200 dark:bg-zinc-800",
};

const STATUS_TEXT: Record<DayStatus, string> = {
  up: "Operational",
  degraded: "Degraded",
  down: "Outage",
  none: "No data",
};

export default function UptimeCard({
  title = "System status",
  services = DEFAULT_SERVICES,
  days = 90,
  endDate = "2026-10-14",
  className,
}: UptimeCardProps) {
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const sim = useRef({
    weights: new Float64Array(days).fill(1),
    target: new Float64Array(days).fill(1),
    focus: null as number | null,
    raf: 0,
    last: 0,
    reduceMotion: false,
  });
  if (sim.current.weights.length !== days) {
    sim.current.weights = new Float64Array(days).fill(1);
    sim.current.target = new Float64Array(days).fill(1);
  }

  const end = Date.parse(`${endDate}T00:00:00Z`);
  const dateOf = useCallback(
    (day: number) => end - (days - 1 - day) * DAY,
    [end, days]
  );
  const uptimes = useMemo(
    () => services.map((s) => uptimeOf(s, days)),
    [services, days]
  );
  const openIssues = services.filter(
    (s) => statusOf(s, days - 1) !== "up" && statusOf(s, days - 1) !== "none"
  );

  // Widths are written straight to the bars, one flex-grow per bar.
  const paint = useCallback(() => {
    const rows = barsRef.current?.querySelectorAll<HTMLElement>("[data-row]");
    const { weights } = sim.current;
    for (const row of rows ?? []) {
      const bars = row.children;
      for (let i = 0; i < bars.length; i++) {
        (bars[i] as HTMLElement).style.flexGrow = weights[i].toFixed(3);
      }
    }
  }, []);

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const dt = s.last ? Math.min((now - s.last) / 1000, 1 / 30) : 1 / 60;
      s.last = now;
      const k = 1 - Math.exp(-EASE * dt);
      let moving = false;
      for (let i = 0; i < s.weights.length; i++) {
        const gap = s.target[i] - s.weights[i];
        if (Math.abs(gap) > 0.002) {
          s.weights[i] += gap * k;
          moving = true;
        } else {
          s.weights[i] = s.target[i];
        }
      }
      paint();
      if (moving) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.last = 0;
      }
    },
    [paint]
  );

  const focusOn = useCallback(
    (focus: number | null) => {
      const s = sim.current;
      s.focus = focus;
      swell(s.weights.length, focus, s.target);
      if (s.reduceMotion) {
        s.weights.set(s.target);
        paint();
      } else if (!s.raf) {
        s.raf = requestAnimationFrame(tick);
      }
    },
    [paint, tick]
  );

  useEffect(() => {
    const s = sim.current;
    s.reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    return () => cancelAnimationFrame(s.raf);
  }, []);

  /** The day under the pointer, found against the swollen layout. */
  const dayAt = (clientX: number) => {
    const rect = barsRef.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const probe = new Float64Array(days);
    let day = Math.round(x * (days - 1));
    // Centre the swell on the bar that ends up under the pointer.
    for (let pass = 0; pass < 3; pass++) {
      day = barAt(swell(days, day, probe), x);
    }
    return day;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType !== "mouse" &&
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      return;
    }
    const day = dayAt(event.clientX);
    setActive(day);
    focusOn(day);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (event.pointerType !== "mouse") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const day = dayAt(event.clientX);
    setActive(day);
    focusOn(day);
  };

  const handleClick = () => {
    if (active !== null) {
      setPinned((p) => (p === active ? null : active));
    }
  };

  const leave = () => {
    setActive(null);
    focusOn(pinned);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = active ?? pinned ?? days - 1;
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -days,
      End: days,
    };
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPinned((p) => (p === from ? null : from));
      return;
    }
    if (event.key === "Escape") {
      setPinned(null);
      leave();
      return;
    }
    const move = moves[event.key];
    if (move === undefined) {
      return;
    }
    event.preventDefault();
    const day = clamp(from + move, 0, days - 1);
    setActive(day);
    focusOn(day);
  };

  const shownDay = active ?? pinned;
  const shownIncidents =
    shownDay === null
      ? []
      : services.flatMap((s) => {
          const incident = s.incidents?.[shownDay];
          return incident ? [{ service: s.name, incident }] : [];
        });
  let summary = "Hover a day to see what happened";
  if (shownDay !== null) {
    const first = shownIncidents[0];
    const what = first
      ? `${first.service} ${first.incident.status === "down" ? "down" : "degraded"} for ${first.incident.minutes} min${shownIncidents.length > 1 ? `, +${shownIncidents.length - 1} more` : ""}`
      : "No incidents";
    summary = `${formatDay(dateOf(shownDay))} · ${what}`;
  }
  const pinnedIncidents =
    pinned === null
      ? []
      : services.flatMap((s) => {
          const incident = s.incidents?.[pinned];
          return incident ? [{ service: s.name, incident }] : [];
        });

  return (
    <div
      className={cn(
        "w-full max-w-xl select-none rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium text-sm">{title}</p>
        {openIssues.length ? (
          <p className="flex items-center gap-1.5 text-amber-600 text-sm dark:text-amber-400">
            <TriangleAlert aria-hidden className="size-4" />
            {openIssues.length} service{openIssues.length > 1 ? "s" : ""}{" "}
            affected
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-emerald-600 text-sm dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-4" />
            All systems operational
          </p>
        )}
      </div>
      <p
        aria-live="polite"
        className="mt-1 truncate text-sm text-zinc-500 tabular-nums dark:text-zinc-400"
      >
        {summary}
      </p>

      <div
        aria-label={`Daily status for the last ${days} days. Use the arrow keys to move between days and Enter to open one.`}
        aria-valuemax={days}
        aria-valuemin={1}
        aria-valuenow={(shownDay ?? days - 1) + 1}
        aria-valuetext={summary}
        className="mt-4 cursor-pointer touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-zinc-950"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={leave}
        onPointerDown={handlePointerDown}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") {
            leave();
          }
        }}
        onPointerMove={handlePointerMove}
        ref={barsRef}
        role="slider"
        tabIndex={0}
      >
        {services.map((service, row) => (
          <div className={cn(row > 0 && "mt-3")} key={service.name}>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="font-medium">{service.name}</span>
              <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
                {uptimes[row].toFixed(2)}%
              </span>
            </div>
            <div className="flex h-7 gap-px sm:gap-[2px]" data-row>
              {Array.from({ length: days }, (_, day) => {
                const status = statusOf(service, day);
                const lit = day === shownDay;
                return (
                  <div
                    className={cn(
                      "min-w-0 basis-0 rounded-[2px] transition-opacity duration-150 ease-out",
                      BAR_COLOR[status],
                      shownDay !== null && !lit && "opacity-60"
                    )}
                    // biome-ignore lint/suspicious/noArrayIndexKey: one bar per day, never reordered
                    key={day}
                    style={{ flexGrow: 1 }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-2 flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span>{days} days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* A pinned day opens its incident log. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          pinned === null
            ? "grid-rows-[0fr] opacity-0"
            : "grid-rows-[1fr] opacity-100"
        )}
      >
        <div className="overflow-hidden">
          {pinned !== null && (
            <div className="mt-4 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">
                  {formatDay(dateOf(pinned))}
                </p>
                <button
                  aria-label="Close day"
                  className="rounded-full p-1 text-zinc-500 outline-none transition-colors duration-150 ease-out hover:bg-zinc-200 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  onClick={() => {
                    setPinned(null);
                    focusOn(null);
                  }}
                  type="button"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </div>
              {pinnedIncidents.length === 0 && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  No incidents recorded. Every service was operational.
                </p>
              )}
              {pinnedIncidents.map(({ service, incident }) => (
                <div className="mt-3" key={service}>
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium text-[11px]",
                        incident.status === "down"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"
                      )}
                    >
                      {STATUS_TEXT[incident.status]}
                    </span>
                    <span className="font-medium">{service}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {incident.title} · {incident.minutes} min
                    </span>
                  </p>
                  <ol className="mt-2.5 ml-1 border-zinc-200 border-l dark:border-zinc-800">
                    {incident.updates.map((update) => (
                      <li
                        className="relative pb-2.5 pl-4 text-sm last:pb-0"
                        key={`${update.time}-${update.label}`}
                      >
                        <span className="absolute top-[7px] -left-[3.5px] size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                        <span className="text-zinc-400 tabular-nums dark:text-zinc-500">
                          {update.time}
                        </span>{" "}
                        <span className="font-medium">{update.label}</span>
                        {update.note && (
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {" "}
                            {update.note}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
