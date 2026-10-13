"use client";

/**
 * @author: @dorianbaffier
 * @description: Notification Stack
 * @version: 1.0.0
 * @date: 2026-10-13
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
const EXIT_MS = 200;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  dx: number;
  axis: "x" | "y" | null;
}

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

  const swipeRefs = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const timers = useRef<number[]>([]);
  // Where each card last sat, so a leaving card slides out from there.
  const lastY = useRef(new Map<string, number>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of pending) {
        window.clearTimeout(id);
      }
    };
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

  const dismiss = (id: string, direction: 1 | -1) => {
    const node = swipeRefs.current.get(id);
    if (node) {
      node.style.transition = `transform ${EXIT_MS}ms ${EASE_OUT}, opacity ${EXIT_MS}ms ${EASE_OUT}`;
      node.style.transform = `translateX(${direction * 110}%)`;
      node.style.opacity = "0";
    }
    setLeaving((prev) => new Set(prev).add(id));
    const timer = window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      lastY.current.delete(id);
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onDismiss?.(id);
    }, EXIT_MS);
    timers.current.push(timer);
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    index: number
  ) => {
    // Only the front card can be swiped while the stack is collapsed, and a
    // second finger never takes over a drag that is already running.
    if (drag.current || (!expanded && index > 0)) {
      return;
    }
    suppressClick.current = false;
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      dx: 0,
      axis: null,
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

    current.dx = dx;
    const node = swipeRefs.current.get(id);
    if (node) {
      // Written straight to the element: no re-render per pointer move.
      node.style.transition = "none";
      node.style.transform = `translateX(${dx}px)`;
      node.style.opacity = `${Math.max(1 - Math.abs(dx) / 240, 0.3)}`;
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>, id: string) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    drag.current = null;
    if (current.axis !== "x") {
      return;
    }
    suppressClick.current = true;

    const elapsed = Math.max(performance.now() - current.startTime, 1);
    const velocity = Math.abs(current.dx) / elapsed;
    if (
      Math.abs(current.dx) >= DISMISS_DISTANCE ||
      velocity > DISMISS_VELOCITY
    ) {
      dismiss(id, current.dx > 0 ? 1 : -1);
      return;
    }

    const node = swipeRefs.current.get(id);
    if (node) {
      node.style.transition = `transform 200ms ${EASE_OUT}, opacity 200ms ${EASE_OUT}`;
      node.style.transform = "";
      node.style.opacity = "";
    }
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
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
        className="relative transition-[height] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        style={{ height: stackHeight }}
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
              key={item.id}
              ref={(node) => {
                if (!node) {
                  return;
                }
                const height = node.offsetHeight;
                if (height && heights[item.id] !== height) {
                  setHeights((prev) => ({ ...prev, [item.id]: height }));
                }
              }}
              style={{
                transform: `translateY(${y}px) scale(${scale})`,
                opacity: hiddenBehind ? 0 : 1,
                zIndex: items.length - depth,
                pointerEvents: hiddenBehind ? "none" : undefined,
              }}
            >
              <div
                className="touch-pan-y"
                onLostPointerCapture={(event) =>
                  handlePointerUp(event, item.id)
                }
                onPointerCancel={(event) => handlePointerUp(event, item.id)}
                onPointerDown={(event) => handlePointerDown(event, depth)}
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
