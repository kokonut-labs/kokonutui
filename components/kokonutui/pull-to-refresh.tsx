"use client";

/**
 * @author: @dorianbaffier
 * @description: Pull to Refresh
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AnimatePresence,
  animate,
  MotionConfig,
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface FeedItem {
  id: string;
  name: string;
  /** What they did, after their name. */
  action: string;
  time: string;
  /** Avatar background. */
  color: string;
}

export interface PullToRefreshProps {
  title?: string;
  items?: FeedItem[];
  /**
   * Called when a pull or the refresh button asks for new items. Resolve with
   * the items to put on top. Leave out to use the demo feed.
   */
  onRefresh?: () => Promise<FeedItem[]>;
  className?: string;
}

/** How far the list moves before the drop tears and the refresh starts. */
const THRESHOLD = 78;
/** Where the list rests while it loads. */
const HOLD = 54;
/** The list has moved this far when the drop starts to stretch. */
const STRETCH_FROM = 30;
/** Rubber band: the farther you pull, the less the list follows. */
const BAND = 260;
const SETTLE = { type: "spring", duration: 0.45, bounce: 0 } as const;
const TEAR = { type: "spring", duration: 0.5, bounce: 0.45 } as const;

const DEFAULT_ITEMS: FeedItem[] = [
  {
    id: "f-1",
    name: "Maya Chen",
    action: "left a comment on Onboarding v3",
    time: "4m",
    color: "#7c6f9b",
  },
  {
    id: "f-2",
    name: "Tomás Rivera",
    action: "shared Q4 roadmap with you",
    time: "18m",
    color: "#4f7a6a",
  },
  {
    id: "f-3",
    name: "Ines Park",
    action: "approved your expense report",
    time: "1h",
    color: "#a0613f",
  },
  {
    id: "f-4",
    name: "Leo Brandt",
    action: "moved Billing page to In review",
    time: "2h",
    color: "#56677f",
  },
  {
    id: "f-5",
    name: "Ava Lindqvist",
    action: "invited you to Design crit",
    time: "3h",
    color: "#8a5a6e",
  },
  {
    id: "f-6",
    name: "Sam Okafor",
    action: "replied to your thread in #launch",
    time: "5h",
    color: "#6b7350",
  },
];

const INCOMING: Omit<FeedItem, "id" | "time">[][] = [
  [
    {
      name: "Nadia Haddad",
      action: "mentioned you in Pricing notes",
      color: "#9b5c4f",
    },
    { name: "Maya Chen", action: "resolved your comment", color: "#7c6f9b" },
  ],
  [{ name: "Jun Watanabe", action: "starred Icon set 2.0", color: "#4d6f86" }],
  [
    {
      name: "Ines Park",
      action: "added you to Finance review",
      color: "#a0613f",
    },
    {
      name: "Leo Brandt",
      action: "pushed 3 commits to main",
      color: "#56677f",
    },
  ],
];

let batch = 0;
const demoRefresh = () =>
  new Promise<FeedItem[]>((resolve) => {
    const next = INCOMING[batch % INCOMING.length];
    batch += 1;
    setTimeout(
      () =>
        resolve(
          next.map((item, i) => ({
            ...item,
            id: `n-${batch}-${i}`,
            time: "now",
          }))
        ),
      1300
    );
  });

const rubber = (distance: number) =>
  distance <= 0 ? 0 : BAND * (1 - 1 / ((distance * 0.55) / BAND + 1));

/** Undo `rubber`, so a wheel or a held finger can pick up where the list is. */
const unrubber = (offset: number) =>
  offset <= 0 ? 0 : (BAND / 0.55) * (1 / (1 - offset / BAND) - 1);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * A drop that hangs from the header: the top stays round, the bottom thins
 * and falls away as `s` goes from 0 to 1.
 */
const dropPath = (s: number) => {
  const cx = 20;
  const top = 17;
  const r1 = 13 - 3.5 * s;
  const r2 = r1 - (r1 - 3.5) * s;
  const bottom = top + 33 * s;
  if (s < 0.01) {
    return `M ${cx - r1} ${top} A ${r1} ${r1} 0 1 1 ${cx + r1} ${top} A ${r1} ${r1} 0 1 1 ${cx - r1} ${top} Z`;
  }
  const k = (bottom - top) * 0.45;
  return [
    `M ${cx - r1} ${top}`,
    `A ${r1} ${r1} 0 0 1 ${cx + r1} ${top}`,
    `C ${cx + r1} ${top + k} ${cx + r2} ${bottom - k} ${cx + r2} ${bottom}`,
    `A ${r2} ${r2} 0 0 1 ${cx - r2} ${bottom}`,
    `C ${cx - r2} ${bottom - k} ${cx - r1} ${top + k} ${cx - r1} ${top}`,
    "Z",
  ].join(" ");
};

type Phase = "idle" | "pulling" | "refreshing";

export default function PullToRefresh({
  title = "Activity",
  items: initialItems = DEFAULT_ITEMS,
  onRefresh = demoRefresh,
  className,
}: PullToRefreshProps) {
  const reduceMotion = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const offset = useMotionValue(0);
  const stretch = useMotionValue(0);
  const phaseRef = useRef<Phase>("idle");
  const holdingRef = useRef(false);
  /** Set once a pull has started a refresh, until that finger lets go. */
  const spentRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [items, setItems] = useState(initialItems);
  const [fresh, setFresh] = useState<string[]>([]);
  const [announce, setAnnounce] = useState("");

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const settle = useCallback(
    (to: number) => {
      animate(offset, to, reduceMotion ? { duration: 0 } : SETTLE);
    },
    [offset, reduceMotion]
  );

  const refresh = useCallback(async () => {
    if (phaseRef.current === "refreshing") {
      return;
    }
    setPhaseBoth("refreshing");
    // The drop tears off and its tail springs back into the ball.
    animate(stretch, 0, reduceMotion ? { duration: 0 } : TEAR);
    if (!holdingRef.current) {
      settle(HOLD);
    }
    let added: FeedItem[] = [];
    try {
      added = await onRefresh();
    } catch {
      // Nothing new; the list just settles back.
    }
    setItems((current) => [...added, ...current]);
    setFresh(added.map((item) => item.id));
    setAnnounce(
      added.length === 1 ? "1 new update" : `${added.length} new updates`
    );
    setPhaseBoth("idle");
    if (!holdingRef.current) {
      settle(0);
    }
  }, [onRefresh, reduceMotion, setPhaseBoth, settle, stretch]);

  /** Follow a pull of `distance` px past the top of the list. */
  const pullTo = useCallback(
    (distance: number) => {
      const next = rubber(distance);
      offset.set(next);
      if (phaseRef.current === "refreshing" || spentRef.current) {
        return;
      }
      if (phaseRef.current === "idle" && next > 0) {
        setPhaseBoth("pulling");
      }
      stretch.set(clamp01((next - STRETCH_FROM) / (THRESHOLD - STRETCH_FROM)));
      if (next >= THRESHOLD) {
        spentRef.current = true;
        refresh();
      }
    },
    [offset, refresh, setPhaseBoth, stretch]
  );

  const release = useCallback(() => {
    holdingRef.current = false;
    spentRef.current = false;
    if (phaseRef.current === "refreshing") {
      settle(HOLD);
      return;
    }
    setPhaseBoth("idle");
    animate(stretch, 0, reduceMotion ? { duration: 0 } : SETTLE);
    settle(0);
  }, [reduceMotion, setPhaseBoth, settle, stretch]);

  useEffect(() => {
    if (fresh.length === 0) {
      return;
    }
    const id = setTimeout(() => setFresh([]), 2400);
    return () => clearTimeout(id);
  }, [fresh]);

  // Touch and the wheel need non-passive listeners to stop the page scrolling.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    let startY = 0;
    let base = 0;
    let tracking = false;
    let wheelDistance = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;

    const onTouchStart = (event: TouchEvent) => {
      tracking = scroller.scrollTop <= 0;
      startY = event.touches[0].clientY;
      base = unrubber(offset.get());
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!tracking) {
        return;
      }
      const distance = base + event.touches[0].clientY - startY;
      if (distance <= 0 && !holdingRef.current) {
        return;
      }
      event.preventDefault();
      holdingRef.current = true;
      pullTo(Math.max(0, distance));
    };
    const onTouchEnd = () => {
      if (tracking && holdingRef.current) {
        release();
      }
      tracking = false;
    };
    const onWheel = (event: WheelEvent) => {
      if (scroller.scrollTop > 0 || (event.deltaY > 0 && offset.get() <= 0)) {
        return;
      }
      event.preventDefault();
      if (!holdingRef.current) {
        holdingRef.current = true;
        wheelDistance = unrubber(offset.get());
      }
      wheelDistance = Math.max(0, wheelDistance - event.deltaY);
      pullTo(wheelDistance);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(release, 160);
    };

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      clearTimeout(wheelTimer);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
      scroller.removeEventListener("wheel", onWheel);
    };
  }, [offset, pullTo, release]);

  // A mouse can drag the list down too.
  const mouse = useRef<{ y: number; base: number } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      !scroller ||
      scroller.scrollTop > 0
    ) {
      return;
    }
    mouse.current = { y: event.clientY, base: unrubber(offset.get()) };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = mouse.current;
    if (!start) {
      return;
    }
    const distance = start.base + event.clientY - start.y;
    if (!holdingRef.current) {
      if (distance < 4) {
        return;
      }
      holdingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pullTo(Math.max(0, distance));
  };
  const onPointerUp = () => {
    const wasHolding = holdingRef.current;
    mouse.current = null;
    if (wasHolding) {
      release();
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "flex h-[440px] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
      >
        <header className="relative z-10 flex items-center justify-between border-black/[0.06] border-b bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-zinc-900">
          <div>
            <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
              {title}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {phase === "refreshing"
                ? "Checking for updates…"
                : "Pull to refresh"}
            </p>
          </div>
          <button
            aria-label="Refresh"
            className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900/30 disabled:opacity-50 dark:text-zinc-400 dark:focus-visible:ring-white/30 dark:hover:bg-white/5 dark:hover:text-white"
            disabled={phase === "refreshing"}
            onClick={refresh}
            type="button"
          >
            <svg
              aria-hidden="true"
              className={cn(
                "size-4",
                phase === "refreshing" &&
                  "animate-spin motion-reduce:animate-none"
              )}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={1.8}
              viewBox="0 0 16 16"
            >
              <path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1" />
              <path d="M12.2 1.6v2.8H9.4" strokeLinejoin="round" />
            </svg>
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            className={cn(
              "h-full select-none overflow-y-auto overscroll-y-contain [scrollbar-width:thin]"
            )}
            onPointerCancel={onPointerUp}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            ref={scrollerRef}
          >
            <motion.ul
              className="relative bg-white dark:bg-zinc-900"
              style={{ y: offset }}
            >
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <FeedRow
                    fresh={fresh.includes(item.id)}
                    item={item}
                    key={item.id}
                  />
                ))}
              </AnimatePresence>
            </motion.ul>
          </div>
          <Drop
            offset={offset}
            refreshing={phase === "refreshing"}
            stretch={stretch}
          />
        </div>
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
      </div>
    </MotionConfig>
  );
}

function Drop({
  offset,
  stretch,
  refreshing,
}: {
  offset: MotionValue<number>;
  stretch: MotionValue<number>;
  refreshing: boolean;
}) {
  const d = useTransform(stretch, dropPath);
  const opacity = useTransform(offset, [8, 30], [0, 1]);
  const scale = useTransform(offset, [8, 30], [0.4, 1]);
  const arrowRef = useRef<SVGGElement>(null);
  // The arrow winds round as the drop stretches.
  useMotionValueEvent(stretch, "change", (s) => {
    arrowRef.current?.setAttribute("transform", `rotate(${s * 220} 20 17)`);
  });
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
      style={{ opacity }}
    >
      <motion.svg
        aria-hidden="true"
        className="mt-1 h-16 w-10 origin-top text-zinc-800 dark:text-zinc-200"
        style={{ scale }}
        viewBox="0 0 40 64"
      >
        <motion.path d={d} fill="currentColor" />
        <g className="text-white dark:text-zinc-900">
          {refreshing ? (
            <g className="origin-[20px_17px] animate-spin motion-reduce:animate-none">
              <path
                d="M20 11.5a5.5 5.5 0 1 1-5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth={1.8}
              />
            </g>
          ) : (
            <g ref={arrowRef}>
              <path
                d="M25 17a5 5 0 1 1-1.5-3.55"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth={1.8}
              />
              <path
                d="M24.2 10.8v3h-3"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
              />
            </g>
          )}
        </g>
      </motion.svg>
    </motion.div>
  );
}

function FeedRow({ item, fresh }: { item: FeedItem; fresh: boolean }) {
  const initials = item.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <motion.li
      animate={{ height: "auto", opacity: 1 }}
      className="overflow-hidden"
      exit={{ height: 0, opacity: 0 }}
      initial={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
    >
      <div
        className={cn(
          "flex items-start gap-3 border-black/[0.05] border-b px-4 py-3 transition-colors duration-700 dark:border-white/[0.06]",
          fresh && "bg-violet-50 dark:bg-violet-500/[0.08]"
        )}
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full font-medium text-[11px] text-white"
          style={{ backgroundColor: item.color }}
        >
          {initials}
        </span>
        <p className="min-w-0 flex-1 text-[13px] text-zinc-600 leading-snug dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {item.name}
          </span>{" "}
          {item.action}
        </p>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
          {fresh && <span className="size-1.5 rounded-full bg-violet-500" />}
          {item.time}
        </span>
      </div>
    </motion.li>
  );
}
