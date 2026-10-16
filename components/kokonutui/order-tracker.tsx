"use client";

/**
 * @author: @dorianbaffier
 * @description: Order Tracker
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, ChevronDown, Copy, Package } from "lucide-react";
import {
  LayoutGroup,
  motion,
  type Transition,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface TrackingEvent {
  title: string;
  /** When it happened, or when it is expected for upcoming steps. */
  time: string;
  place?: string;
  /** Set on the steps shown on the compact rail, e.g. "Shipped". */
  milestone?: string;
  done: boolean;
}

export interface OrderTrackerProps {
  orderId?: string;
  item?: string;
  /** The headline, e.g. "Arriving Thursday". */
  status?: string;
  eta?: string;
  carrier?: string;
  trackingNumber?: string;
  /** Oldest first. Done events must come before upcoming ones. */
  events?: TrackingEvent[];
  defaultOpen?: boolean;
  className?: string;
}

const DEFAULT_EVENTS: TrackingEvent[] = [
  {
    title: "Order placed",
    time: "Oct 12, 9:14 AM",
    milestone: "Ordered",
    done: true,
  },
  {
    title: "Label created",
    time: "Oct 12, 4:40 PM",
    place: "Brooklyn, NY",
    done: true,
  },
  {
    title: "Picked up by carrier",
    time: "Oct 13, 8:02 AM",
    place: "Brooklyn, NY",
    milestone: "Shipped",
    done: true,
  },
  {
    title: "Departed sorting hub",
    time: "Oct 14, 6:48 AM",
    place: "Philadelphia, PA",
    done: true,
  },
  {
    title: "Arrived at local facility",
    time: "Oct 15, 6:12 AM",
    place: "Arlington, VA",
    done: true,
  },
  {
    title: "Out for delivery",
    time: "Expected Oct 16",
    milestone: "Out for delivery",
    done: false,
  },
  {
    title: "Delivered",
    time: "Expected by 8 PM",
    milestone: "Delivered",
    done: false,
  },
];

// Where each event sits on the compact rail: milestones are spread evenly
// and the scans between two milestones share the gap, so the fill can stop
// part way to the next milestone.
function railPositions(events: TrackingEvent[]) {
  const milestones = events.flatMap((event, i) => (event.milestone ? [i] : []));
  const segments = Math.max(1, milestones.length - 1);
  return events.map((_, i) => {
    const next = milestones.findIndex((m) => m >= i);
    if (next === -1) {
      return 1;
    }
    if (milestones[next] === i || next === 0) {
      return next / segments;
    }
    const from = milestones[next - 1];
    const to = milestones[next];
    return (next - 1 + (i - from) / (to - from)) / segments;
  });
}

export default function OrderTracker({
  orderId = "KO-4821",
  item = "Ceramic pour-over set",
  status = "Arriving Thursday",
  eta = "Oct 16, by 8 PM",
  carrier = "UPS",
  trackingNumber = "1Z 999 AA1 01 2345 6784",
  events = DEFAULT_EVENTS,
  defaultOpen = false,
  className,
}: OrderTrackerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [toggled, setToggled] = useState(false);
  const [height, setHeight] = useState<number>();
  const innerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const group = useId();
  const detailsId = `${group}-details`;

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(inner.offsetHeight));
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const current = events.findLastIndex((event) => event.done);
  const positions = railPositions(events);
  const latest = events[current];
  const transition: Transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.42, ease: EASE_OUT };

  return (
    <motion.div
      animate={{ height: height ?? "auto" }}
      className={cn(
        "w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      initial={false}
      transition={transition}
    >
      <div className="p-5" ref={innerRef}>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800">
            <Package aria-hidden className="size-5 text-zinc-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {item} · #{orderId}
            </p>
            <p className="mt-0.5 font-semibold text-lg leading-6">{status}</p>
            <p className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
              {eta}
            </p>
          </div>
          <button
            aria-controls={detailsId}
            aria-expanded={open}
            className="-mr-1.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 font-medium text-sm text-zinc-600 outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 active:bg-zinc-200 dark:text-zinc-400 dark:active:bg-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            onClick={() => {
              setOpen((value) => !value);
              setToggled(true);
            }}
            type="button"
          >
            {open ? "Hide" : "Details"}
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 transition-transform duration-300 ease-out",
                open && "rotate-180"
              )}
            />
          </button>
        </div>

        <LayoutGroup id={group}>
          <div id={detailsId}>
            {open ? (
              <Timeline
                animateIn={toggled}
                current={current}
                events={events}
                group={group}
                reduceMotion={!!reduceMotion}
                transition={transition}
              />
            ) : (
              <Rail
                animateIn={toggled}
                current={current}
                events={events}
                group={group}
                positions={positions}
                transition={transition}
              />
            )}
          </div>
        </LayoutGroup>

        {open ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="mt-5 flex items-center justify-between gap-3 border-zinc-200 border-t pt-4 dark:border-zinc-800"
            initial={{ opacity: 0 }}
            transition={{ ...transition, delay: reduceMotion ? 0 : 0.12 }}
          >
            <div className="min-w-0">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {carrier} tracking
              </p>
              <p className="truncate font-medium text-sm tabular-nums">
                {trackingNumber}
              </p>
            </div>
            <CopyButton text={trackingNumber.replace(/\s/g, "")} />
          </motion.div>
        ) : (
          latest && (
            <p className="mt-4 truncate text-sm text-zinc-500 dark:text-zinc-400">
              <span className="text-zinc-900 dark:text-zinc-100">
                {latest.title}
              </span>
              {latest.place && ` · ${latest.place}`}
            </p>
          )
        )}
      </div>
    </motion.div>
  );
}

function Dot({
  event,
  isCurrent,
  index,
  group,
  transition,
  small,
}: {
  event: TrackingEvent;
  isCurrent: boolean;
  index: number;
  group: string;
  transition: Transition;
  small?: boolean;
}) {
  let tone = "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950";
  if (isCurrent) {
    tone = "border-zinc-900 bg-white dark:border-zinc-100 dark:bg-zinc-950";
  } else if (event.done) {
    tone = "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100";
  }
  return (
    <motion.span
      className={cn(
        "block rounded-full border-2",
        small ? "size-2" : "size-3",
        tone
      )}
      layoutId={`${group}-dot-${index}`}
      transition={transition}
    />
  );
}

function Rail({
  animateIn,
  events,
  positions,
  current,
  group,
  transition,
}: {
  events: TrackingEvent[];
  positions: number[];
  current: number;
  group: string;
  transition: Transition;
  animateIn: boolean;
}) {
  const fill = current < 0 ? 0 : positions[current];
  const lastMilestone = events.findLastIndex((event) => event.milestone);
  return (
    <div className="mt-6 px-1.5">
      <div className="relative h-3">
        <motion.div
          animate={{ opacity: 1 }}
          className="absolute inset-x-0 top-[5px] h-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800"
          initial={animateIn ? { opacity: 0 } : false}
          transition={transition}
        />
        <motion.div
          animate={{ opacity: 1 }}
          className="absolute top-[5px] left-0 h-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
          initial={animateIn ? { opacity: 0 } : false}
          style={{ width: `${fill * 100}%` }}
          transition={transition}
        />
        {events.map((event, i) =>
          event.milestone || i === current ? (
            <div
              className="absolute top-0 -translate-x-1/2"
              key={`${event.title}-${event.time}`}
              style={{ left: `${positions[i] * 100}%` }}
            >
              <Dot
                event={event}
                group={group}
                index={i}
                isCurrent={i === current && !event.milestone}
                transition={transition}
              />
            </div>
          ) : null
        )}
      </div>
      <div className="relative mt-2 h-8">
        {events.map((event, i) => {
          if (!event.milestone) {
            return null;
          }
          const first = positions[i] === 0;
          const last = i === lastMilestone;
          return (
            <span
              className={cn(
                "absolute top-0 w-20 text-xs leading-4",
                event.done
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 dark:text-zinc-500",
                first && "-ml-1.5 text-left",
                last && "-mr-1.5 text-right",
                !(first || last) && "-translate-x-1/2 text-center"
              )}
              key={event.milestone}
              style={
                last
                  ? { right: 0 }
                  : { left: first ? 0 : `${positions[i] * 100}%` }
              }
            >
              {event.milestone}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Row({
  event,
  index,
  current,
  group,
  transition,
  reduceMotion,
}: {
  event: TrackingEvent;
  index: number;
  current: number;
  group: string;
  transition: Transition;
  reduceMotion: boolean;
}) {
  const onRail = Boolean(event.milestone) || index === current;
  const dot = (
    <Dot
      event={event}
      group={group}
      index={index}
      isCurrent={index === current && !event.milestone}
      small={!onRail}
      transition={transition}
    />
  );
  return (
    <li className="relative flex gap-3 pb-5">
      <div className="flex h-5 w-3 shrink-0 items-center justify-center">
        {onRail ? (
          dot
        ) : (
          <motion.span
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: reduceMotion ? 0 : 0.18 }}
          >
            {dot}
          </motion.span>
        )}
      </div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="min-w-0 flex-1"
        initial={reduceMotion ? false : { opacity: 0, y: -4 }}
        transition={{
          duration: 0.28,
          ease: EASE_OUT,
          delay: reduceMotion ? 0 : 0.08 + index * 0.025,
        }}
      >
        <p
          className={cn(
            "text-sm leading-5",
            event.done
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-400 dark:text-zinc-500",
            event.milestone && "font-medium"
          )}
        >
          {event.title}
        </p>
        <p className="truncate text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {event.time}
          {event.place && ` · ${event.place}`}
        </p>
      </motion.div>
    </li>
  );
}

function Timeline({
  animateIn,
  events,
  current,
  group,
  transition,
  reduceMotion,
}: {
  events: TrackingEvent[];
  current: number;
  group: string;
  transition: Transition;
  reduceMotion: boolean;
  animateIn: boolean;
}) {
  const row = (event: TrackingEvent, index: number) => (
    <Row
      current={current}
      event={event}
      group={group}
      index={index}
      key={`${event.title}-${event.time}`}
      reduceMotion={reduceMotion}
      transition={transition}
    />
  );
  const last = events.length - 1;
  const reached = Math.max(0, current);

  // Each line runs from the first dot to the dot of the row right after
  // its group: the rows sit flush, and every dot is 10px below its row's
  // top, so a group's bottom plus 10px lands on the next dot.
  // The lines draw down while the dots travel, rather than morphing from
  // the horizontal rail, which smears a 2px line into a block mid-flight.
  const line = (className: string, children: ReactNode) => (
    <div className="relative">
      <motion.div
        animate={{ scaleY: 1 }}
        className={cn(
          "absolute top-2.5 -bottom-2.5 left-[5px] w-0.5 origin-top rounded-full",
          className
        )}
        initial={animateIn ? { scaleY: 0 } : false}
        transition={transition}
      />
      {children}
    </div>
  );

  return (
    <ol className="mt-6 [&>li:last-child]:pb-0">
      {line(
        "bg-zinc-200 dark:bg-zinc-800",
        <>
          {line(
            "bg-zinc-900 dark:bg-zinc-100",
            events.slice(0, reached).map(row)
          )}
          {events
            .slice(reached, last)
            .map((event, i) => row(event, reached + i))}
        </>
      )}
      {row(events[last], last)}
    </ol>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      aria-label={copied ? "Copied" : "Copy tracking number"}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 active:bg-zinc-200 dark:active:bg-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false)
        );
      }}
      type="button"
    >
      {copied ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <Copy aria-hidden className="size-4" />
      )}
    </button>
  );
}
