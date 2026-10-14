"use client";

/**
 * @author: @dorianbaffier
 * @description: Shape Hero
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

export interface HeroFragment {
  id: string;
  /** Any element: a card, a screenshot, a piece of your product. */
  node: ReactNode;
  /** Center of the fragment, in percent of the hero's width. */
  x: number;
  /** Center of the fragment, in percent of the hero's height. */
  y: number;
  /** 0 sits far back and barely moves, 1 sits close and moves the most. */
  depth?: number;
  /** Tilt in degrees. */
  rotate?: number;
  /** Bob gently while idle. */
  float?: boolean;
  /**
   * Leave the fragment out when the hero is narrower than this Tailwind
   * container size (3xl 768px, 4xl 896px, 5xl 1024px), instead of letting it
   * cover the text. Measured on the hero, not the viewport.
   */
  hideBelow?: "3xl" | "4xl" | "5xl";
}

export interface ShapeHeroProps {
  className?: string;
  /** Small line above the title, such as a badge or a link. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Call-to-action buttons under the description. */
  actions?: ReactNode;
  /** Heading element for the title, so the page decides where its `h1` is. */
  as?: "h1" | "h2" | "h3" | "p";
  /** Fragments floating around the headline. */
  items?: HeroFragment[];
  /** Shift the fragments by depth as the mouse moves. */
  interactive?: boolean;
}

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
/** Parallax travel in px for a fragment at depth 1, at the hero's edge. */
const PARALLAX = 28;

const HIDE_BELOW = {
  "3xl": "hidden @3xl:block",
  "4xl": "hidden @4xl:block",
  "5xl": "hidden @5xl:block",
} as const;

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Settle the fragments in once, staggered, while the text is already there. */
function useEntrance(
  nodes: RefObject<(HTMLDivElement | null)[]>,
  signature: string
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-runs when the set of fragments changes, to bring in new ones.
  useLayoutEffect(() => {
    const reduce = reducedMotion();
    nodes.current.forEach((node, index) => {
      if (!node || node.style.opacity !== "0") {
        return;
      }
      node.style.opacity = "1";
      node.animate(
        reduce
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: "translate3d(0, 12px, 0)" },
              { opacity: 1, transform: "translate3d(0, 0, 0)" },
            ],
        {
          duration: reduce ? 200 : 460,
          delay: 120 + index * 40,
          easing: EASE_OUT,
          fill: "backwards",
        }
      );
    });
  }, [nodes, signature]);
}

/** A slow bob on the compositor, paused while the hero is offscreen. */
function useFloat(
  root: RefObject<HTMLElement | null>,
  nodes: RefObject<(HTMLDivElement | null)[]>,
  items: RefObject<HeroFragment[]>,
  signature: string
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `items` is read through a ref; `signature` says when it changed.
  useEffect(() => {
    const element = root.current;
    if (!element || reducedMotion()) {
      return;
    }
    const animations = items.current.map((item, index) => {
      const node = nodes.current[index];
      if (!(node && item.float)) {
        return null;
      }
      const lift = 4 + (item.depth ?? 0.5) * 5;
      return node.animate(
        [
          { transform: "translate3d(0, 0, 0)" },
          { transform: `translate3d(0, ${-lift}px, 0)` },
        ],
        {
          duration: 4200 + (index % 4) * 700,
          // Out of step with each other, so they never bob in unison.
          delay: -index * 900,
          iterations: Number.POSITIVE_INFINITY,
          direction: "alternate",
          easing: "ease-in-out",
        }
      );
    });
    let onScreen = true;
    const sync = () => {
      for (const animation of animations) {
        if (onScreen && !document.hidden) {
          animation?.play();
        } else {
          animation?.pause();
        }
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      for (const animation of animations) {
        animation?.cancel();
      }
    };
  }, [root, nodes, items, signature]);
}

/** Lean every fragment towards the mouse by its depth. Runs only while moving. */
function useParallax(
  root: RefObject<HTMLElement | null>,
  nodes: RefObject<(HTMLDivElement | null)[]>,
  items: RefObject<HeroFragment[]>,
  enabled: boolean
) {
  useEffect(() => {
    const element = root.current;
    if (!(element && enabled) || reducedMotion()) {
      return;
    }
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;
    let rect = element.getBoundingClientRect();

    const tick = () => {
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      const settled =
        Math.abs(target.x - current.x) < 0.001 &&
        Math.abs(target.y - current.y) < 0.001;
      if (settled) {
        current.x = target.x;
        current.y = target.y;
      }
      items.current.forEach((item, index) => {
        const node = nodes.current[index];
        if (node) {
          const travel = (item.depth ?? 0.5) * PARALLAX;
          node.style.transform = `translate3d(${(current.x * travel).toFixed(2)}px, ${(current.y * travel).toFixed(2)}px, 0)`;
        }
      });
      frame = settled ? 0 : requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame) {
        frame = requestAnimationFrame(tick);
      }
    };
    const measure = () => {
      rect = element.getBoundingClientRect();
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      target.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      target.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      start();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      start();
    };
    element.addEventListener("pointerenter", measure);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointerenter", measure);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", measure);
    };
  }, [root, nodes, items, enabled]);
}

export default function ShapeHero({
  className,
  eyebrow = <DefaultEyebrow />,
  title = "Components people remember",
  description = "Copy-paste components for React, built with Tailwind CSS and Motion. Put your own cards and screenshots around the headline.",
  actions = <DefaultActions />,
  as: Heading = "h1",
  items = DEFAULT_ITEMS,
  interactive = true,
}: ShapeHeroProps) {
  const rootRef = useRef<HTMLElement>(null);
  const parallaxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const entranceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const floatRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Hooks read the latest fragments through a ref and restart only when
  // this changes, not on every render that passes a new array.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const signature = items
    .map((item) => `${item.id}:${item.depth}:${item.float}`)
    .join("|");

  useEntrance(entranceRefs, signature);
  useFloat(rootRef, floatRefs, itemsRef, signature);
  useParallax(rootRef, parallaxRefs, itemsRef, interactive);

  return (
    <section
      className={cn(
        "@container relative flex min-h-[640px] w-full items-center justify-center overflow-hidden bg-white px-6 py-28 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      ref={rootRef}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {items.map((item, index) => (
          <div
            className={cn(
              "absolute",
              item.hideBelow && HIDE_BELOW[item.hideBelow]
            )}
            key={item.id}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: `translate(-50%, -50%) rotate(${item.rotate ?? 0}deg)`,
            }}
          >
            <div
              className="will-change-transform"
              ref={(node) => {
                parallaxRefs.current[index] = node;
              }}
            >
              <div
                ref={(node) => {
                  entranceRefs.current[index] = node;
                }}
                style={{ opacity: 0 }}
              >
                <div
                  ref={(node) => {
                    floatRefs.current[index] = node;
                  }}
                >
                  {item.node}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative flex max-w-2xl flex-col items-center text-center">
        {eyebrow ? <div className="mb-6">{eyebrow}</div> : null}
        <Heading className="text-balance font-semibold text-4xl tracking-tight sm:text-6xl">
          {title}
        </Heading>
        {description ? (
          <p className="mt-5 max-w-md text-pretty text-base text-zinc-500 sm:text-lg dark:text-zinc-400">
            {description}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DefaultEyebrow() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      Now with 100+ components
    </span>
  );
}

function DefaultActions() {
  return (
    <>
      <button
        className="h-10 rounded-full bg-zinc-900 px-5 font-medium text-sm text-white transition-colors duration-150 ease-out hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        type="button"
      >
        Browse components
      </button>
      <button
        className="h-10 rounded-full border border-zinc-200 px-5 font-medium text-sm text-zinc-700 transition-colors duration-150 ease-out hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
        type="button"
      >
        Read the docs
      </button>
    </>
  );
}

/* Demo fragments. Swap them for pieces of your own product. */

const CARD =
  "rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)]";

function NotificationFragment() {
  return (
    <div className={cn(CARD, "flex w-64 items-center gap-3 p-3")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="min-w-0 text-left">
        <span className="block font-medium text-sm">Deploy ready</span>
        <span className="block truncate text-xs text-zinc-500">
          kokonutui.com · just now
        </span>
      </span>
    </div>
  );
}

function ToggleFragment() {
  return (
    <div className={cn(CARD, "flex w-52 items-center justify-between p-3")}>
      <span className="font-medium text-sm">Reduce motion</span>
      <span className="flex h-6 w-10 items-center rounded-full bg-zinc-900 p-0.5 dark:bg-white">
        <span className="ml-auto size-5 rounded-full bg-white shadow-sm dark:bg-zinc-900" />
      </span>
    </div>
  );
}

const AVATARS = ["AK", "MJ", "SL", "RT"];

function AvatarsFragment() {
  return (
    <div className={cn(CARD, "flex items-center gap-3 py-2 pr-4 pl-2")}>
      <span className="flex -space-x-2">
        {AVATARS.map((initials, index) => (
          <span
            className="flex size-8 items-center justify-center rounded-full border-2 border-white font-medium text-[10px] text-zinc-700 dark:border-zinc-900 dark:text-zinc-200"
            key={initials}
            style={{
              backgroundColor: `color-mix(in oklab, currentColor ${8 + index * 6}%, transparent)`,
            }}
          >
            {initials}
          </span>
        ))}
      </span>
      <span className="text-left text-xs text-zinc-500">
        <span className="block font-medium text-sm text-zinc-900 dark:text-zinc-100">
          +128
        </span>
        joined this week
      </span>
    </div>
  );
}

const BARS = [32, 44, 38, 56, 50, 68, 62, 80, 74, 92];

function ChartFragment() {
  return (
    <div className={cn(CARD, "w-56 p-4 text-left")}>
      <div className="text-xs text-zinc-500">Weekly installs</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-semibold text-2xl tabular-nums tracking-tight">
          12.4k
        </span>
        <span className="font-medium text-emerald-600 text-xs dark:text-emerald-400">
          +18%
        </span>
      </div>
      <div className="mt-3 flex h-12 items-end gap-1">
        {BARS.map((height, index) => (
          <span
            className={cn(
              "flex-1 rounded-sm",
              index === BARS.length - 1
                ? "bg-zinc-900 dark:bg-zinc-100"
                : "bg-zinc-200 dark:bg-zinc-700"
            )}
            key={height}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function CodeFragment() {
  return (
    <div
      className={cn(
        CARD,
        "whitespace-nowrap px-4 py-2.5 font-mono text-xs text-zinc-600 dark:text-zinc-300"
      )}
    >
      <span className="text-zinc-400 dark:text-zinc-500">$ </span>
      npx shadcn add @kokonutui/pull-cord
    </div>
  );
}

const TICKS = Array.from({ length: 31 }, (_, index) => index);

function DialFragment() {
  return (
    <div className={cn(CARD, "flex size-32 items-center justify-center")}>
      <div className="relative size-24">
        {TICKS.map((tick) => (
          <span
            className={cn(
              "absolute top-0 left-1/2 h-1/2 w-px origin-bottom",
              tick <= 22
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-zinc-300 dark:text-zinc-700"
            )}
            key={tick}
            style={{ transform: `rotate(${-135 + tick * 9}deg)` }}
          >
            <span className="block h-2 w-px bg-current dark:opacity-80" />
          </span>
        ))}
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-semibold text-xl tabular-nums">72</span>
          <span className="text-[10px] text-zinc-500">volume</span>
        </span>
      </div>
    </div>
  );
}

const DEFAULT_ITEMS: HeroFragment[] = [
  {
    id: "avatars",
    node: <AvatarsFragment />,
    x: 18,
    y: 16,
    depth: 0.4,
    rotate: -4,
    float: true,
    hideBelow: "3xl",
  },
  {
    id: "chart",
    node: <ChartFragment />,
    x: 13,
    y: 58,
    depth: 0.9,
    rotate: -3,
    float: true,
    hideBelow: "4xl",
  },
  {
    id: "code",
    node: <CodeFragment />,
    x: 26,
    y: 90,
    depth: 0.3,
    rotate: 2,
    hideBelow: "5xl",
  },
  {
    id: "notification",
    node: <NotificationFragment />,
    x: 82,
    y: 20,
    depth: 0.8,
    rotate: 3,
    float: true,
    hideBelow: "4xl",
  },
  {
    id: "dial",
    node: <DialFragment />,
    x: 89,
    y: 60,
    depth: 0.5,
    rotate: 6,
    float: true,
    hideBelow: "4xl",
  },
  {
    id: "toggle",
    node: <ToggleFragment />,
    x: 74,
    y: 88,
    depth: 0.6,
    rotate: -2,
    float: true,
    hideBelow: "3xl",
  },
];
