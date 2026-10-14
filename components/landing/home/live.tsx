"use client";

import {
  type ComponentType,
  type LazyExoticComponent,
  lazy,
  type MouseEvent,
  type ReactNode,
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
  "apple-activity-card": live(
    () => import("@/components/kokonutui/apple-activity-card"),
    ({ default: C }) => <C />,
    "Rings fill as it mounts"
  ),
  "ai-prompt": live(
    () => import("@/components/kokonutui/ai-prompt"),
    ({ default: C }) => <C className="w-full max-w-[520px]" />,
    "Type, switch models, press Enter"
  ),
  "team-selector": live(
    () => import("@/components/kokonutui/team-selector"),
    ({ default: C }) => <C />,
    "Use − and +"
  ),
  "particle-button": live(
    () => import("@/components/kokonutui/particle-button"),
    ({ default: C }) => <C>Send</C>,
    "Click it"
  ),
  "currency-transfer": live(
    () => import("@/components/kokonutui/currency-transfer"),
    ({ default: C }) => <C />,
    "Completes once as it mounts"
  ),
  "smooth-tab": live(
    () => import("@/components/kokonutui/smooth-tab"),
    ({ default: C }) => <C />,
    "Switch tabs both ways"
  ),
  "hold-button": live(
    () => import("@/components/kokonutui/hold-button"),
    ({ default: C }) => <C />,
    "Press and hold"
  ),
  "card-flip": live(
    () => import("@/components/kokonutui/card-flip"),
    ({ default: C }) => <C />,
    "Hover to flip"
  ),
  "file-upload": live(
    () => import("@/components/kokonutui/file-upload"),
    ({ default: C }) => <C className="w-full max-w-[360px]" />,
    "Drop any image"
  ),
  "dynamic-text": live(
    () => import("@/components/kokonutui/dynamic-text"),
    ({ default: C }) => (
      <C
        className="font-medium text-3xl text-zinc-900 dark:text-zinc-100"
        mode="cycle"
      />
    ),
    "Plays once as it mounts"
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
