"use client";

/**
 * @author: @dorianbaffier
 * @description: Notification Stack
 * @version: 1.1.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { CalendarDays, CreditCard, Mail, MessageCircle, X } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface StackNotification {
  id: string;
  app: string;
  title: string;
  body: string;
  time: string;
  icon?: ReactNode;
}

const DEFAULT_NOTIFICATIONS: StackNotification[] = [
  {
    id: "n-1",
    app: "Messages",
    title: "Maya Chen",
    body: "Pushed the fix. Can you take a look before standup?",
    time: "now",
    icon: (
      <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
        <MessageCircle className="size-4" />
      </span>
    ),
  },
  {
    id: "n-2",
    app: "Calendar",
    title: "Design review in 10 min",
    body: "Room 4B · Kokonut UI roadmap",
    time: "9:50",
    icon: (
      <span className="flex size-8 items-center justify-center rounded-lg bg-red-500 text-white">
        <CalendarDays className="size-4" />
      </span>
    ),
  },
  {
    id: "n-3",
    app: "Mail",
    title: "Invoice #2041 paid",
    body: "Acme Inc. paid $1,280.00. The receipt is attached.",
    time: "9:12",
    icon: (
      <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500 text-white">
        <Mail className="size-4" />
      </span>
    ),
  },
  {
    id: "n-4",
    app: "Wallet",
    title: "Card payment",
    body: "$4.50 at Blue Bottle Coffee",
    time: "8:31",
    icon: (
      <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
        <CreditCard className="size-4" />
      </span>
    ),
  },
];

// Collapsed: how much of each card behind the front one peeks out.
const PEEK = 10;
const VISIBLE_BEHIND = 2;
const GAP = 8;
// Used until a card has been measured, so server and client agree.
const FALLBACK_HEIGHT = 76;

// A swipe dismisses when it travels this far, or when it is a quick flick
// (px per ms), whichever comes first. A flick shouldn't need to go far.
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 0.11;
// Movement before we decide whether the gesture is a horizontal swipe or a
// vertical scroll.
const AXIS_LOCK = 6;
// Snap-back spring (critically damped, so it never wobbles past rest but
// still carries the release momentum a little further before it turns).
const SPRING_STIFFNESS = 520;
const SPRING_DAMPING = 2 * Math.sqrt(SPRING_STIFFNESS);
// Dismiss flight: a released card keeps its own speed (px/s), never slower
// than this, and picks up a little speed as it goes.
const FLIGHT_MIN_SPEED = 1400;
const FLIGHT_ACCEL = 4200;
// Velocity is read from the last stretch of the gesture, not the average.
const VELOCITY_WINDOW_MS = 80;
const EXIT_MS = 200;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  /** Where the card already was when grabbed (mid snap-back). */
  originX: number;
  dx: number;
  axis: "x" | "y" | null;
  samples: { t: number; x: number }[];
}

const opacityFor = (x: number) => Math.max(1 - Math.abs(x) / 240, 0.3);

/** Release velocity in px/ms from the most recent pointer samples. */
function releaseVelocity(samples: { t: number; x: number }[]) {
  const last = samples.at(-1);
  if (!last) {
    return 0;
  }
  let first = last;
  for (let i = samples.length - 1; i >= 0; i--) {
    const sample = samples[i];
    if (last.t - sample.t > VELOCITY_WINDOW_MS) {
      break;
    }
    first = sample;
  }
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

/**
 * Which way a released card leaves, or 0 to spring back. A flick counts
 * only when it moves away from rest; flicking a dragged card back toward
 * the middle returns it.
 */
function dismissDirection(dx: number, velocity: number): 1 | -1 | 0 {
  const flick =
    Math.abs(velocity) > DISMISS_VELOCITY &&
    Math.sign(velocity) === Math.sign(dx);
  if (Math.abs(dx) < DISMISS_DISTANCE && !flick) {
    return 0;
  }
  return (dx === 0 ? velocity : dx) > 0 ? 1 : -1;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface NotificationStackProps {
  /** Initial notifications, newest first. The stack tracks dismissals itself. */
  notifications?: StackNotification[];
  /** Called after a notification has been swiped or clicked away. */
  onDismiss?: (id: string) => void;
  className?: string;
}

export default function NotificationStack({
  notifications = DEFAULT_NOTIFICATIONS,
  onDismiss,
  className,
}: NotificationStackProps) {
  const [items, setItems] = useState(notifications);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());

  const listRef = useRef<HTMLOListElement>(null);
  const swipeRefs = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const timers = useRef<number[]>([]);
  // Where each card last sat, so a leaving card slides out from there.
  const lastY = useRef(new Map<string, number>());
  // Live horizontal offset of each card, and its running animation frame.
  const swipeX = useRef(new Map<string, number>());
  const frames = useRef(new Map<string, number>());
  // Cards already on their way out, so a repeated Delete or a double click
  // can't dismiss (and report) the same card twice.
  const dismissed = useRef(new Set<string>());
  // Ends a gesture whose pointer was released off the card before it was
  // captured (a vertical drag that left the card).
  const stopListening = useRef<(() => void) | null>(null);

  useEffect(() => {
    const pending = timers.current;
    const running = frames.current;
    return () => {
      for (const id of pending) {
        window.clearTimeout(id);
      }
      for (const frame of running.values()) {
        cancelAnimationFrame(frame);
      }
      stopListening.current?.();
    };
  }, []);

  // Measure each card once on mount, then only when it actually resizes
  // (text rewrapping), instead of reading layout on every render. Cards are
  // only ever removed, so the initial set is all there is to observe.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const measure = (entries: { id?: string; height: number }[]) => {
      setHeights((prev) => {
        let next = prev;
        for (const { id, height } of entries) {
          if (id && height && prev[id] !== height) {
            next = next === prev ? { ...prev } : next;
            next[id] = height;
          }
        }
        return next;
      });
    };
    const cards = Array.from(list.children) as HTMLElement[];
    measure(
      cards.map((card) => ({ id: card.dataset.id, height: card.offsetHeight }))
    );
    const observer = new ResizeObserver((entries) => {
      measure(
        entries.map((entry) => ({
          id: (entry.target as HTMLElement).dataset.id,
          height: Math.round(entry.borderBoxSize[0]?.blockSize ?? 0),
        }))
      );
    });
    for (const card of cards) {
      observer.observe(card);
    }
    return () => observer.disconnect();
  }, []);

  const expanded = (hovered || focused || pinned) && items.length > 1;
  const heightOf = (id: string) => heights[id] ?? FALLBACK_HEIGHT;

  // Cards that are on their way out no longer take up room, so the rest
  // close the gap while the leaving card slides away.
  const laidOut = items.filter((item) => !leaving.has(item.id));
  const frontHeight = laidOut[0] ? heightOf(laidOut[0].id) : 0;
  const stackHeight = expanded
    ? laidOut.reduce((sum, item) => sum + heightOf(item.id), 0) +
      Math.max(laidOut.length - 1, 0) * GAP
    : frontHeight + Math.min(laidOut.length - 1, VISIBLE_BEHIND) * PEEK;

  const offsets: number[] = [];
  let running = 0;
  for (const item of laidOut) {
    offsets.push(running);
    running += heightOf(item.id) + GAP;
  }

  const stopFrame = (id: string) => {
    const frame = frames.current.get(id);
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frames.current.delete(id);
    }
  };

  const paint = (id: string, x: number) => {
    swipeX.current.set(id, x);
    const node = swipeRefs.current.get(id);
    if (node) {
      node.style.transition = "none";
      node.style.transform = x === 0 ? "" : `translateX(${x}px)`;
      node.style.opacity = x === 0 ? "" : `${opacityFor(x)}`;
    }
  };

  /** Step a per-card simulation on rAF until it reports it is done. */
  const run = (
    id: string,
    step: (dt: number) => boolean,
    onDone?: () => void
  ) => {
    stopFrame(id);
    let last = performance.now();
    const tick = (now: number) => {
      // Clamp the step so a dropped frame or a background tab can't fling
      // the simulation.
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (step(dt)) {
        frames.current.delete(id);
        onDone?.();
        return;
      }
      frames.current.set(id, requestAnimationFrame(tick));
    };
    frames.current.set(id, requestAnimationFrame(tick));
  };

  /** Spring back to rest, starting with the speed the finger let go at. */
  const snapBack = (id: string, velocity: number) => {
    let x = swipeX.current.get(id) ?? 0;
    let v = velocity * 1000;
    if (prefersReducedMotion()) {
      paint(id, 0);
      return;
    }
    run(id, (dt) => {
      const force = -SPRING_STIFFNESS * x - SPRING_DAMPING * v;
      v += force * dt;
      x += v * dt;
      if (Math.abs(x) < 0.5 && Math.abs(v) < 10) {
        paint(id, 0);
        return true;
      }
      paint(id, x);
      return false;
    });
  };

  const finishDismiss = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    lastY.current.delete(id);
    swipeX.current.delete(id);
    setLeaving((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    onDismiss?.(id);
  };

  /**
   * Throw the card off the side. A swipe keeps the speed it was released
   * at (so a hard flick leaves faster than a slow drag past the threshold);
   * a button or keyboard dismiss starts from rest at the minimum speed.
   */
  const dismiss = (id: string, direction: 1 | -1, velocity = 0) => {
    if (dismissed.current.has(id)) {
      return;
    }
    dismissed.current.add(id);
    setLeaving((prev) => new Set(prev).add(id));
    const node = swipeRefs.current.get(id);

    // Keyboard and button dismissals keep focus in the stack: it moves to
    // the next card (or the previous one, or the list once it is empty)
    // instead of dropping to the page when this card unmounts.
    if (node?.contains(document.activeElement)) {
      const at = laidOut.findIndex((item) => item.id === id);
      const next = laidOut[at + 1] ?? laidOut[at - 1];
      const target = next
        ? swipeRefs.current.get(next.id)?.querySelector("article")
        : listRef.current;
      target?.focus();
    }

    if (!node || prefersReducedMotion()) {
      stopFrame(id);
      if (node) {
        node.style.transition = `opacity ${EXIT_MS}ms ${EASE_OUT}`;
        node.style.opacity = "0";
      }
      const timer = window.setTimeout(() => finishDismiss(id), EXIT_MS);
      timers.current.push(timer);
      return;
    }

    const distance = node.offsetWidth * 1.1;
    let x = swipeX.current.get(id) ?? 0;
    let speed = Math.max(Math.abs(velocity) * 1000, FLIGHT_MIN_SPEED);
    run(
      id,
      (dt) => {
        speed += FLIGHT_ACCEL * dt;
        x += direction * speed * dt;
        const done = Math.abs(x) >= distance;
        paint(id, done ? direction * distance : x);
        node.style.opacity = `${Math.max(1 - Math.abs(x) / distance, 0)}`;
        return done;
      },
      () => finishDismiss(id)
    );
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    index: number,
    id: string
  ) => {
    // Only the front card can be swiped while the stack is collapsed, and a
    // second finger never takes over a drag that is already running.
    if (drag.current || leaving.has(id) || (!expanded && index > 0)) {
      return;
    }
    suppressClick.current = false;
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    // Catch a card that is still springing back from the last swipe.
    stopFrame(id);
    const { pointerId } = event;
    const release = (up: globalThis.PointerEvent) => {
      if (up.pointerId !== pointerId) {
        return;
      }
      stopListening.current?.();
      // The card's own handlers run first; this only clears a gesture that
      // ended off the card, which would otherwise block the next one.
      if (drag.current?.pointerId === pointerId) {
        drag.current = null;
        if (swipeX.current.get(id)) {
          snapBack(id, 0);
        }
      }
    };
    stopListening.current?.();
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    stopListening.current = () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      stopListening.current = null;
    };
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: swipeX.current.get(id) ?? 0,
      dx: 0,
      axis: null,
      samples: [],
    };
  };

  const handlePointerMove = (
    event: PointerEvent<HTMLDivElement>,
    id: string
  ) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;

    if (current.axis === null) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) {
        return;
      }
      current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (current.axis === "x") {
        // Keep the swipe alive when the pointer leaves the card.
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    if (current.axis !== "x") {
      return;
    }

    current.dx = current.originX + dx;
    current.samples.push({ t: event.timeStamp, x: current.dx });
    if (current.samples.length > 12) {
      current.samples.shift();
    }
    // Written straight to the element: no re-render per pointer move.
    paint(id, current.dx);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>, id: string) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    drag.current = null;
    if (current.axis !== "x") {
      // A tap or scroll that caught a card mid spring lets it finish.
      if (swipeX.current.get(id)) {
        snapBack(id, 0);
      }
      return;
    }
    suppressClick.current = true;

    const velocity = releaseVelocity(current.samples);
    const direction = dismissDirection(current.dx, velocity);
    if (direction === 0) {
      snapBack(id, velocity);
      return;
    }
    // Never carry speed that points back toward the stack into the flight.
    dismiss(id, direction, Math.sign(velocity) === direction ? velocity : 0);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      // A held key would clear the next card too, now that focus moves to it.
      if (event.repeat) {
        return;
      }
      dismiss(id, 1);
    }
  };

  return (
    // biome-ignore lint/a11y: hover and focus only widen the stack; every action has its own button.
    <div
      className={cn("w-full max-w-sm", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setFocused(false);
        }
      }}
      onFocus={() => setFocused(true)}
      onPointerEnter={(event) => {
        // Touch screens fire pointerenter on tap; only a real hover expands.
        if (event.pointerType === "mouse") {
          setHovered(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          setHovered(false);
        }
      }}
    >
      <div className="mb-3 flex h-7 items-center justify-between px-1">
        <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
          Notifications
          <span className="ml-2 text-zinc-500 tabular-nums dark:text-zinc-400">
            {laidOut.length}
          </span>
        </p>
        {laidOut.length > 1 && (
          <button
            aria-expanded={expanded}
            className="rounded-md px-2 py-1 text-sm text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={() => setPinned((prev) => !prev)}
            type="button"
          >
            {expanded ? "Show less" : "Show all"}
          </button>
        )}
      </div>

      <ol
        aria-label="Notifications"
        className="relative outline-none transition-[height] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        ref={listRef}
        style={{ height: stackHeight }}
        // Focus lands here when the last card is dismissed from the keyboard.
        tabIndex={-1}
      >
        {items.map((item) => {
          const index = laidOut.findIndex((card) => card.id === item.id);
          const isLeaving = index === -1;
          const depth = Math.max(index, 0);
          const hiddenBehind = !(expanded || depth <= VISIBLE_BEHIND);
          const scale = expanded || isLeaving ? 1 : 1 - depth * 0.05;
          // Bottom-align the cards behind so a strip of each peeks out below
          // the front card, whatever their own heights.
          const restingY = expanded
            ? offsets[depth]
            : frontHeight + depth * PEEK - heightOf(item.id) * scale;
          const y = isLeaving ? (lastY.current.get(item.id) ?? 0) : restingY;
          if (!isLeaving) {
            lastY.current.set(item.id, restingY);
          }

          return (
            <li
              className="absolute inset-x-0 top-0 origin-top transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity"
              data-id={item.id}
              key={item.id}
              style={{
                transform: `translateY(${y}px) scale(${scale})`,
                opacity: hiddenBehind ? 0 : 1,
                zIndex: items.length - depth,
                pointerEvents: hiddenBehind ? "none" : undefined,
              }}
            >
              <div
                className="touch-pan-y"
                onLostPointerCapture={(event) => {
                  // Touch starts with an implicit capture on the element
                  // under the finger; moving it to this card fires a
                  // bubbling lostpointercapture that is not the end of the
                  // swipe.
                  if (event.target === event.currentTarget) {
                    handlePointerUp(event, item.id);
                  }
                }}
                onPointerCancel={(event) => handlePointerUp(event, item.id)}
                onPointerDown={(event) =>
                  handlePointerDown(event, depth, item.id)
                }
                onPointerMove={(event) => handlePointerMove(event, item.id)}
                onPointerUp={(event) => handlePointerUp(event, item.id)}
                ref={(node) => {
                  if (node) {
                    swipeRefs.current.set(item.id, node);
                  } else {
                    swipeRefs.current.delete(item.id);
                  }
                }}
              >
                {/* biome-ignore lint/a11y: the card is focusable so Delete can dismiss it, and tapping it fans out the stack; both also have buttons. */}
                <article
                  aria-label={`${item.app}: ${item.title}. ${item.body}`}
                  className={cn(
                    "group/card relative flex select-none gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm outline-none dark:border-zinc-800 dark:bg-zinc-900",
                    "focus-visible:ring-2 focus-visible:ring-zinc-400",
                    !expanded &&
                      depth === 0 &&
                      laidOut.length > 1 &&
                      "cursor-pointer"
                  )}
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    if (!expanded) {
                      setPinned(true);
                    }
                  }}
                  onKeyDown={(event) => handleCardKeyDown(event, item.id)}
                  tabIndex={hiddenBehind ? -1 : 0}
                >
                  <NotificationContent
                    item={item}
                    muted={!expanded && depth > 0}
                    onDismiss={() => dismiss(item.id, 1)}
                    tabbable={!hiddenBehind}
                  />
                </article>
              </div>
            </li>
          );
        })}
      </ol>

      {laidOut.length === 0 && (
        <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          You're all caught up.
        </p>
      )}
    </div>
  );
}

function NotificationContent({
  item,
  muted,
  tabbable,
  onDismiss,
}: {
  item: StackNotification;
  /** Cards behind the front one show only their edge, so their content
   * fades out instead of poking through. */
  muted: boolean;
  tabbable: boolean;
  onDismiss: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "flex min-w-0 flex-1 gap-3 transition-opacity duration-200",
          muted && "opacity-0"
        )}
      >
        <div className="shrink-0">{item.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-medium text-sm text-zinc-900 dark:text-zinc-100">
              {item.title}
            </p>
            <span className="shrink-0 text-xs text-zinc-400 tabular-nums">
              {item.time}
            </span>
          </div>
          <p className="line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
            {item.body}
          </p>
        </div>
      </div>
      <button
        aria-label={`Dismiss ${item.title}`}
        className={cn(
          "absolute -top-2 -left-2 flex size-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 opacity-0 transition-opacity duration-150 hover:text-zinc-900 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 group-hover/card:opacity-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100",
          muted && "hidden"
        )}
        onClick={(event) => {
          event.stopPropagation();
          onDismiss();
        }}
        tabIndex={tabbable ? 0 : -1}
        type="button"
      >
        <X className="size-3" />
      </button>
    </>
  );
}
