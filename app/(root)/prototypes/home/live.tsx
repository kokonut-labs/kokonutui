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
 * Every component that can run on the homepage, loaded on demand. Each entry
 * renders the docs demo (same props), so what you try here is what the docs
 * show and what the CLI installs.
 */
export interface LiveEntry {
  Component: LazyExoticComponent<ComponentType>;
  load: () => Promise<unknown>;
  /** One line telling people what to do with it. */
  hint: string;
  /**
   * How it sits in a frame. Default: centered, scaled down to fit.
   * "cover": a full-viewport background, shown edge to edge at a smaller
   * scale. "section": a page-wide section, laid out at desktop width and
   * scaled down whole.
   */
  frame?: "cover" | "section";
}

function live<M extends { default: unknown }>(
  load: () => Promise<M>,
  render: (mod: M) => ReactNode,
  hint: string,
  frame?: LiveEntry["frame"]
): LiveEntry {
  return {
    load,
    hint,
    frame,
    Component: lazy(async () => {
      const mod = await load();
      return { default: () => render(mod) };
    }),
  };
}

const SCROLL_TEXTS = [
  "TailwindCSS",
  "Kokonut UI",
  "shadcn/ui",
  "Next.js",
  "Vercel",
  "Motion",
  "React",
  "Resend",
  "TypeScript",
  "Fumadocs",
  "Supabase",
];

export const LIVE: Record<string, LiveEntry> = {
  "ai-prompt": live(
    () => import("@/components/kokonutui/ai-prompt"),
    ({ default: C }) => <C className="w-full max-w-[520px]" />,
    "Type, switch models, press Enter"
  ),
  "ai-input-search": live(
    () => import("@/components/kokonutui/ai-input-search"),
    ({ default: C }) => <C />,
    "Type, then toggle Search"
  ),
  "ai-loading": live(
    () => import("@/components/kokonutui/ai-loading"),
    ({ default: C }) => <C />,
    "Plays on its own"
  ),
  "ai-text-loading": live(
    () => import("@/components/kokonutui/ai-text-loading"),
    ({ default: C }) => <C />,
    "Plays on its own"
  ),
  "ai-voice": live(
    () => import("@/components/kokonutui/ai-voice"),
    ({ default: C }) => <C />,
    "Click the mic"
  ),
  "beams-background": live(
    () => import("@/components/kokonutui/beams-background"),
    ({ default: C }) => <C />,
    "Plays on its own",
    "cover"
  ),
  "background-paths": live(
    () => import("@/components/kokonutui/background-paths"),
    ({ default: C }) => <C />,
    "Plays on its own",
    "cover"
  ),
  "shape-hero": live(
    () => import("@/components/kokonutui/shape-hero"),
    ({ default: C }) => <C />,
    "Plays on its own",
    "cover"
  ),
  "flow-field": live(
    () => import("@/components/kokonutui/flow-field"),
    ({ default: C }) => <C />,
    "Plays on its own",
    "cover"
  ),
  "particle-button": live(
    () => import("@/components/kokonutui/particle-button"),
    ({ default: C }) => <C>Send</C>,
    "Click it"
  ),
  "v0-button": live(
    () => import("@/components/kokonutui/v0-button"),
    ({ default: C }) => <C size="lg" />,
    "Hover it"
  ),
  "gradient-button": live(
    () => import("@/components/kokonutui/gradient-button"),
    ({ default: C }) => (
      <div className="flex flex-col gap-2">
        <C label="Gradient Button" />
        <C label="Gradient Button" variant="orange" />
      </div>
    ),
    "Hover it"
  ),
  "attract-button": live(
    () => import("@/components/kokonutui/attract-button"),
    ({ default: C }) => <C />,
    "Hover it"
  ),
  "hold-button": live(
    () => import("@/components/kokonutui/hold-button"),
    ({ default: C }) => <C />,
    "Press and hold"
  ),
  "social-button": live(
    () => import("@/components/kokonutui/social-button"),
    ({ default: C }) => <C />,
    "Hover to share"
  ),
  "command-button": live(
    () => import("@/components/kokonutui/command-button"),
    ({ default: C }) => <C />,
    "Hover it"
  ),
  "switch-button": live(
    () => import("@/components/kokonutui/switch-button"),
    ({ default: C }) => <C />,
    "Click to switch the theme"
  ),
  "slide-text-button": live(
    () => import("@/components/kokonutui/slide-text-button"),
    ({ default: C }) => <C hoverText="Click to see more" />,
    "Hover it"
  ),
  "card-flip": live(
    () => import("@/components/kokonutui/card-flip"),
    ({ default: C }) => <C />,
    "Hover to flip"
  ),
  "card-stack": live(
    () => import("@/components/kokonutui/card-stack"),
    ({ default: C }) => <C />,
    "Click to fan the cards"
  ),
  "liquid-glass-card": live(
    () => import("@/components/kokonutui/liquid-glass-card"),
    ({ default: C }) => <C />,
    "Play, pause, seek"
  ),
  "apple-activity-card": live(
    () => import("@/components/kokonutui/apple-activity-card"),
    ({ default: C }) => <C />,
    "Rings fill as it mounts"
  ),
  "mouse-effect-card": live(
    () => import("@/components/kokonutui/mouse-effect-card"),
    ({ default: C }) => <C />,
    "Move your pointer over it"
  ),
  "tweet-card": live(
    () => import("@/components/kokonutui/tweet-card"),
    ({ default: C }) => <C />,
    "A post, as a component"
  ),
  "bento-grid": live(
    () => import("@/components/kokonutui/bento-grid"),
    ({ default: C }) => <C />,
    "Hover the tiles",
    "section"
  ),
  "spotlight-cards": live(
    () => import("@/components/kokonutui/spotlight-cards"),
    ({ default: C }) => <C />,
    "Hover a card"
  ),
  "currency-transfer": live(
    () => import("@/components/kokonutui/currency-transfer"),
    ({ default: C }) => <C />,
    "Completes once as it mounts"
  ),
  "carousel-cards": live(
    () => import("@/components/kokonutui/carousel-cards"),
    ({ default: C }) => <C />,
    "Scroll the rows",
    "section"
  ),
  "file-upload": live(
    () => import("@/components/kokonutui/file-upload"),
    ({ default: C }) => <C className="w-full max-w-[360px]" />,
    "Drop any image"
  ),
  "avatar-picker": live(
    () => import("@/components/kokonutui/avatar-picker"),
    ({ default: C }) => <C />,
    "Pick an avatar, type a name"
  ),
  "team-selector": live(
    () => import("@/components/kokonutui/team-selector"),
    ({ default: C }) => <C />,
    "Use − and +"
  ),
  loader: live(
    () => import("@/components/kokonutui/loader"),
    ({ default: C }) => <C />,
    "Plays on its own"
  ),
  "morphic-navbar": live(
    () => import("@/components/kokonutui/morphic-navbar"),
    ({ default: C }) => <C />,
    "Click a link"
  ),
  toolbar: live(
    () => import("@/components/kokonutui/toolbar"),
    ({ default: C }) => <C />,
    "Pick a tool"
  ),
  "smooth-tab": live(
    () => import("@/components/kokonutui/smooth-tab"),
    ({ default: C }) => <C />,
    "Switch tabs both ways"
  ),
  "profile-dropdown": live(
    () => import("@/components/kokonutui/profile-dropdown"),
    ({ default: C }) => <C />,
    "Open the menu"
  ),
  "action-search-bar": live(
    () => import("@/components/kokonutui/action-search-bar"),
    ({ default: C }) => (
      <div className="w-full max-w-[400px] self-start">
        <C />
      </div>
    ),
    "Click into it and type"
  ),
  "smooth-drawer": live(
    () => import("@/components/kokonutui/smooth-drawer"),
    ({ default: C }) => <C />,
    "Open the drawer"
  ),
  "scroll-text": live(
    () => import("@/components/kokonutui/scroll-text"),
    // The default list has "Vercel" twice, which React warns about as a
    // duplicate key; the same list minus the repeat.
    ({ default: C }) => <C texts={SCROLL_TEXTS} />,
    "Scroll inside it"
  ),
  "type-writer": live(
    () => import("@/components/kokonutui/type-writer"),
    ({ default: C }) => <C />,
    "Plays on its own"
  ),
  "matrix-text": live(
    () => import("@/components/kokonutui/matrix-text"),
    ({ default: C }) => <C className="min-h-[200px]" text="Hello World!" />,
    "Plays once as it mounts"
  ),
  "dynamic-text": live(
    () => import("@/components/kokonutui/dynamic-text"),
    ({ default: C }) => <C />,
    "Plays once as it mounts"
  ),
  "glitch-text": live(
    () => import("@/components/kokonutui/glitch-text"),
    ({ default: C }) => <C size="2xl" />,
    "Hover it"
  ),
  "shimmer-text": live(
    () => import("@/components/kokonutui/shimmer-text"),
    ({ default: C }) => <C className="text-5xl" text="Text Shimmer" />,
    "Plays on its own"
  ),
  "sliced-text": live(
    () => import("@/components/kokonutui/sliced-text"),
    ({ default: C }) => <C className="text-5xl" text="Sliced Text" />,
    "Hover it"
  ),
  "swoosh-text": live(
    () => import("@/components/kokonutui/swoosh-text"),
    ({ default: C }) => <C className="text-6xl" text="Hover" />,
    "Hover it"
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

/** Warm a component's chunk before it's picked (on hover or focus). */
export function preload(name: string) {
  LIVE[name]?.load().catch(() => {
    // A failed preload retries on render, where Suspense shows the error.
  });
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

/** Lays a page-wide section out at desktop width, then fits it. */
const SECTION_WIDTH = 1120;

/**
 * Shows a full-viewport background edge to edge in a smaller box: it lays the
 * component out at the box's aspect ratio with the real viewport height, then
 * scales the whole thing down to the box.
 */
export function Cover({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ scale: number; width: number } | null>(
    null
  );

  useLayoutEffect(() => {
    const box = outer.current;
    if (!box) {
      return;
    }
    const measure = () => {
      const scale = box.clientHeight / window.innerHeight;
      setSize({ scale, width: box.clientWidth / scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden", className)}
      onClickCapture={stayOnPage}
      ref={outer}
    >
      {size ? (
        <div
          className="h-screen origin-top-left overflow-hidden"
          style={{ width: size.width, transform: `scale(${size.scale})` }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Renders a live component in whichever frame its entry asks for. */
export function Framed({
  name,
  children,
  padding,
}: {
  name: string;
  children: ReactNode;
  /** Padding for the default (fit) frame. */
  padding?: string;
}) {
  const frame = LIVE[name]?.frame;
  if (frame === "cover") {
    return <Cover>{children}</Cover>;
  }
  if (frame === "section") {
    return (
      <Fit className={padding}>
        <div className="shrink-0" style={{ width: SECTION_WIDTH }}>
          {children}
        </div>
      </Fit>
    );
  }
  return <Fit className={padding}>{children}</Fit>;
}
