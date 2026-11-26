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
 * The components that run live on the homepage (and in the OG lab frames),
 * each loaded on demand. Every entry renders the docs demo, so what you try
 * here is what the docs show and what the CLI installs; the few props set
 * here only tune it for the page.
 */
export interface LiveEntry {
  Component: LazyExoticComponent<ComponentType>;
  /** One line telling people what to do with it. */
  hint: string;
}

function live<M extends { default: unknown }>(
  load: () => Promise<M>,
  render: (mod: M) => ReactNode,
  hint: string
): LiveEntry {
  return {
    hint,
    Component: lazy(async () => {
      const mod = await load();
      return { default: () => render(mod) };
    }),
  };
}

export const LIVE: Record<string, LiveEntry> = {
  "slide-to-confirm": live(
    () => import("@/components/kokonutui/slide-to-confirm"),
    ({ default: C }) => <C className="w-[320px]" />,
    "Slide all the way to pay"
  ),
  "ai-loading": live(
    () => import("@/components/kokonutui/ai-loading"),
    ({ default: C }) => <C className="w-full max-w-[400px]" />,
    "An agent working through its steps"
  ),
  "ai-input-search": live(
    () => import("@/components/kokonutui/ai-input-search"),
    // Its toolbar needs the width, so in a third of the cover it's laid out
    // wide and Fit reduces it. Stacked, below lg, it takes the cell's width.
    ({ default: C }) => (
      <C className="w-full max-w-[480px] lg:w-[480px] lg:max-w-none" />
    ),
    "Pick a tool with /, then ask"
  ),
  "ai-tool-calls": live(
    () => import("@/components/kokonutui/ai-tool-calls"),
    ({ default: C }) => <C />,
    "Calls stream in, then fold away"
  ),
  "ai-checkout": live(
    () => import("@/components/kokonutui/ai-checkout"),
    ({ default: C }) => <C />,
    "Pay without leaving the chat"
  ),
  "ai-order-status": live(
    () => import("@/components/kokonutui/ai-order-status"),
    // Slower than the docs demo, so the courier is still on the road once
    // you've read the headline.
    ({ default: C }) => <C minuteMs={2400} />,
    "Watch the courier arrive"
  ),
  "receipt-printer": live(
    () => import("@/components/kokonutui/receipt-printer"),
    // The order AI Checkout takes in the chat, so the receipt adds up to the
    // same $41.04.
    ({ default: C }) => (
      <C
        date="26 Nov 2026 · 09:14"
        items={[{ name: "Ethiopia Guji", quantity: 2, price: 19 }]}
        merchant="Northside Roasters"
        order="#2207"
      />
    ),
    "Pull the receipt to tear it off"
  ),
  "spending-ring": live(
    () => import("@/components/kokonutui/spending-ring"),
    ({ default: C }) => <C />,
    "Flick the ring and let it settle"
  ),
  "boarding-pass": live(
    () => import("@/components/kokonutui/boarding-pass"),
    ({ default: C }) => <C />,
    "Changed details roll over"
  ),
  "stay-picker": live(
    () => import("@/components/kokonutui/stay-picker"),
    ({ default: C }) => <C />,
    "Pick check-in, then check-out"
  ),
  "ai-handoff": live(
    () => import("@/components/kokonutui/ai-handoff"),
    ({ default: C }) => <C className="w-full max-w-[360px]" />,
    "The queue counts down to a person"
  ),
  "amount-pad": live(
    () => import("@/components/kokonutui/amount-pad"),
    ({ default: C }) => <C />,
    "Type an amount; it shrinks to fit"
  ),
  "ai-schedule": live(
    () => import("@/components/kokonutui/ai-schedule"),
    ({ default: C }) => <C className="w-full max-w-[360px]" />,
    "Pick a time, then book it"
  ),
  "ai-send": live(
    () => import("@/components/kokonutui/ai-send"),
    ({ default: C }) => <C className="w-full max-w-[360px]" />,
    "Edit the draft, then send or undo"
  ),
  "metric-card": live(
    () => import("@/components/kokonutui/metric-card"),
    ({ default: C }) => <C />,
    "Scrub a day, or drag a range"
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
    <span className="text-[12px] text-black/55 dark:text-white/50">
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
}: {
  children: ReactNode;
  className?: string;
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
        1,
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
  }, []);

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
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
