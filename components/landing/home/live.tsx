"use client";

import {
  type ComponentType,
  type LazyExoticComponent,
  lazy,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/**
 * The components that run live on the homepage, each loaded on demand. Every
 * entry renders the docs demo (same props), so what you try here is what the
 * docs show and what the CLI installs.
 */
export interface LiveEntry {
  Component: LazyExoticComponent<ComponentType>;
  /** One line telling people what to do with it. */
  hint: string;
  /**
   * Fills a two-column plate edge to edge instead of being fitted into one,
   * for backgrounds.
   */
  wide?: boolean;
}

function live<M extends { default: unknown }>(
  load: () => Promise<M>,
  render: (mod: M) => ReactNode,
  hint: string,
  options: { wide?: boolean } = {}
): LiveEntry {
  return {
    hint,
    ...options,
    Component: lazy(async () => {
      const mod = await load();
      return { default: () => render(mod) };
    }),
  };
}

export const LIVE: Record<string, LiveEntry> = {
  "apple-activity-card": live(
    () => import("@/components/kokonutui/apple-activity-card"),
    // The cover tile is narrower than the card's side-by-side breakpoint, so
    // the card is laid out at that width with its title hidden (the plate
    // names it), and the wrapper hands Fit only the rings and legend.
    ({ default: C }) => (
      <div className="flex w-[384px] justify-center">
        <C className="w-[448px] max-w-none shrink-0 p-0 [&_h2]:hidden" />
      </div>
    ),
    "Rings fill as it mounts"
  ),
  "ai-prompt": live(
    () => import("@/components/kokonutui/ai-prompt"),
    ({ default: C }) => <C className="w-full max-w-[520px]" />,
    "Type / for commands, drop a file"
  ),
  "detent-dial": live(
    () => import("@/components/kokonutui/detent-dial"),
    ({ default: C }) => <C />,
    "Turn it, or flick and let it coast"
  ),
  "ai-loading": live(
    () => import("@/components/kokonutui/ai-loading"),
    ({ default: C }) => <C className="w-full max-w-[400px]" />,
    "An agent working through its steps"
  ),
  "tear-button": live(
    () => import("@/components/kokonutui/tear-button"),
    ({ default: C }) => <C />,
    "Tear the stub off to confirm"
  ),
  "drape-background": live(
    () => import("@/components/kokonutui/drape-background"),
    // Edge to edge, with no headline: the cloth is the demo.
    ({ default: C }) => <C className="absolute inset-0 min-h-0">{null}</C>,
    "Sweep through it, or grab a fold",
    { wide: true }
  ),
  "wheel-picker": live(
    () => import("@/components/kokonutui/wheel-picker"),
    ({ default: C }) => <C />,
    "Flick a wheel"
  ),
  "plucked-text": live(
    () => import("@/components/kokonutui/plucked-text"),
    ({ default: C }) => <C />,
    "Pluck the string under the words"
  ),
  "pull-cord": live(
    () => import("@/components/kokonutui/pull-cord"),
    ({ default: C }) => <C />,
    "Pull the cord"
  ),
  "activity-terrain": live(
    () => import("@/components/kokonutui/activity-terrain"),
    ({ default: C }) => <C />,
    "Drag to turn the terrain"
  ),
  "bell-button": live(
    () => import("@/components/kokonutui/bell-button"),
    ({ default: C }) => <C />,
    "Click it to ring the bell"
  ),
  "liquid-gauge": live(
    () => import("@/components/kokonutui/liquid-gauge"),
    ({ default: C }) => <C />,
    "Drag sideways to slosh it"
  ),
};

/**
 * Demo links point at "#". Inside a frame, following one would jump the page
 * to the top (or open a blank tab), so frames swallow those clicks.
 */
function stayOnPage(e: MouseEvent<HTMLElement>) {
  const link = (e.target as HTMLElement).closest("a");
  if (link?.getAttribute("href") === "#") {
    e.preventDefault();
  }
}

/**
 * True once the element comes within a screen of the viewport, and stays
 * true. Plates mount their demo then, so a dozen simulations don't all load
 * and run while the cover is on screen.
 */
export function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);
  return { ref, near };
}

/** Shown for the moment a component's chunk is loading. */
export function LiveFallback() {
  return (
    <span className="text-[12px] text-black/35 dark:text-white/35">
      Loading…
    </span>
  );
}

/**
 * Centers a live component in a fixed box and scales it down (never up) when
 * it's taller or wider than the box, so every component fits its frame at
 * its own proportions. The scale is set without a transition: it only changes
 * when the box or the component changes size.
 */
export function Fit({
  children,
  className,
  maxScale = 1,
}: {
  children: ReactNode;
  className?: string;
  /** Above 1 lets a small part grow to fill the box, for still images. */
  maxScale?: number;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!(box && content)) {
      return;
    }
    const measure = () => {
      const style = getComputedStyle(box);
      const availableWidth =
        box.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);
      const availableHeight =
        box.clientHeight -
        Number.parseFloat(style.paddingTop) -
        Number.parseFloat(style.paddingBottom);
      // Layout sizes ignore the transform, so this is the natural size.
      let width = 0;
      for (const child of content.children) {
        width = Math.max(width, (child as HTMLElement).offsetWidth);
      }
      const height = content.offsetHeight;
      if (width === 0 || height === 0) {
        return;
      }
      const next = Math.min(
        maxScale,
        availableWidth / width,
        availableHeight / height
      );
      setScale(Math.floor(next * 100) / 100);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, [maxScale]);

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center overflow-hidden",
        className
      )}
      onClickCapture={stayOnPage}
      ref={outer}
    >
      <div
        className="flex w-full shrink-0 justify-center"
        ref={inner}
        style={scale === 1 ? undefined : { transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
