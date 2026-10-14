"use client";

/**
 * @author: @dorianbaffier
 * @description: Background Paths
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
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface BackgroundPathsProps {
  className?: string;
  /** Content shown over the lines. Pass `null` for a bare background. */
  children?: ReactNode;
  /** Number of lines, shared across the three depth layers. */
  count?: number;
  /** How far the ribbon fans out, as a share of the height. */
  spread?: number;
  /** Tilt of the ribbon, in degrees. */
  angle?: number;
  /** How fast the layers drift. 0 holds them still. */
  speed?: number;
  /** Shift the layers by depth as the mouse moves. */
  interactive?: boolean;
}

/** Each layer is drawn this much larger than the container on every side, so drift and parallax never show an edge. */
const OVERSCAN = 0.08;
const SAMPLES = 28;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

interface Layer {
  /** 0 is the back layer, 1 the front one. */
  depth: number;
  width: number;
  opacity: number;
  /** Phase offset, so the layers don't sit exactly on top of each other. */
  phase: number;
  /** Drift path, as a translate in percent of the layer, and seconds per leg. */
  drift: [number, number];
  duration: number;
  /** Parallax travel in px at the edge of the container. */
  parallax: number;
}

const LAYERS: Layer[] = [
  {
    depth: 0,
    width: 1,
    opacity: 0.14,
    phase: 0.5,
    drift: [-1.4, 1],
    duration: 26,
    parallax: 6,
  },
  {
    depth: 0.5,
    width: 1.25,
    opacity: 0.22,
    phase: 0.25,
    drift: [1.2, -1.4],
    duration: 20,
    parallax: 12,
  },
  {
    depth: 1,
    width: 1.5,
    opacity: 0.34,
    phase: 0,
    drift: [-1.8, -0.8],
    duration: 15,
    parallax: 20,
  },
];

interface Line {
  id: string;
  d: string;
  opacity: number;
}

// Fades the lines at the top and bottom edges and quiets them behind
// centered content.
const MASK = {
  maskImage:
    "linear-gradient(to bottom, transparent, #000 15%, #000 85%, transparent), radial-gradient(ellipse 40% 32% at 50% 50%, rgb(0 0 0 / 0.25), #000)",
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
} as const;

const round = (n: number) => Math.round(n * 10) / 10;

/** Catmull-Rom through the points, written as cubic Béziers. */
function smoothPath(points: [number, number][]) {
  let d = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p2[0])} ${round(p2[1])}`;
  }
  return d;
}

/**
 * One twisting ribbon of lines across a `width` by `height` box. Lines fan
 * out, cross over where the ribbon turns and fan out again, each crossing at
 * a slightly different point so the twist reads as depth.
 */
function buildLayer(
  layer: Layer,
  layerIndex: number,
  lineCount: number,
  width: number,
  height: number,
  spread: number,
  angle: number
): Line[] {
  const slope = Math.tan((angle * Math.PI) / 180);
  // On tall, narrow screens a full-height ribbon turns too steeply to read,
  // so its height is capped relative to the width.
  const band = Math.min(height, width * 1.1);
  const lines: Line[] = [];
  for (let i = 0; i < lineCount; i++) {
    // -0.5 to 0.5 across the ribbon.
    const s = lineCount === 1 ? 0 : i / (lineCount - 1) - 0.5;
    const points: [number, number][] = [];
    for (let k = 0; k <= SAMPLES; k++) {
      const u = k / SAMPLES;
      const x = u * width;
      const center =
        height * 0.5 +
        slope * (x - width / 2) +
        band * 0.1 * Math.sin(Math.PI * 2 * (0.75 * u + 0.1) + layer.phase);
      // The ribbon turns over once, right of center, clear of a centered
      // headline.
      const twist = Math.cos(Math.PI * (u - 0.22) + s * 0.6 + layer.phase);
      points.push([x, center + s * spread * band * twist]);
    }
    lines.push({
      id: `${layerIndex}-${i}`,
      d: smoothPath(points),
      // The ribbon's edges fade, its middle carries the weight.
      opacity: layer.opacity * (0.45 + 0.55 * (1 - Math.abs(s) * 2)),
    });
  }
  return lines;
}

function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null
  );
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = Math.round(entry.contentRect.width);
        const height = Math.round(entry.contentRect.height);
        setSize((prev) =>
          prev &&
          Math.abs(prev.width - width) < 2 &&
          Math.abs(prev.height - height) < 2
            ? prev
            : { width, height }
        );
      });
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref]);
  return size;
}

export default function BackgroundPaths({
  className,
  children,
  count = 42,
  spread = 1,
  angle = -8,
  speed = 1,
  interactive = true,
}: BackgroundPathsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const driftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const size = useSize(rootRef);
  const drawn = useRef(false);

  const layerWidth = size ? size.width * (1 + OVERSCAN * 2) : 0;
  const layerHeight = size ? size.height * (1 + OVERSCAN * 2) : 0;
  const perLayer = Math.max(1, Math.round(count / LAYERS.length));

  const layers = useMemo(
    () =>
      layerWidth
        ? LAYERS.map((layer, index) =>
            buildLayer(
              layer,
              index,
              perLayer,
              layerWidth,
              layerHeight,
              spread,
              angle
            )
          )
        : [],
    [layerWidth, layerHeight, perLayer, spread, angle]
  );

  // Draw the lines on once, the first time they exist. Later resizes only
  // change `d`, so they never redraw.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!(root && layers.length) || drawn.current) {
      return;
    }
    drawn.current = true;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    root.dataset.ready = "";
    if (reduceMotion) {
      return;
    }
    const paths = root.querySelectorAll<SVGPathElement>("path");
    paths.forEach((path, index) => {
      path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: 900,
        delay: (index % perLayer) * 12,
        easing: EASE_OUT,
        fill: "backwards",
      });
    });
  }, [layers, perLayer]);

  // Drift: one compositor-only transform loop per layer. The SVG inside is
  // rasterized once and only moved, never redrawn. Paused offscreen.
  useEffect(() => {
    const root = rootRef.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!(root && size) || reduceMotion || speed <= 0) {
      return;
    }
    const animations = LAYERS.map((layer, index) =>
      driftRefs.current[index]?.animate(
        [
          { transform: "translate3d(0, 0, 0)" },
          {
            transform: `translate3d(${layer.drift[0]}%, ${layer.drift[1]}%, 0)`,
          },
        ],
        {
          duration: (layer.duration * 1000) / speed,
          iterations: Number.POSITIVE_INFINITY,
          direction: "alternate",
          easing: "ease-in-out",
        }
      )
    );
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
    observer.observe(root);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      for (const animation of animations) {
        animation?.cancel();
      }
    };
  }, [size, speed]);

  // Parallax: each layer leans towards the mouse by its depth. Eased in a
  // frame loop that only runs while it is still moving.
  useEffect(() => {
    const root = rootRef.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!root || reduceMotion || !interactive) {
      return;
    }
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;
    let rect = root.getBoundingClientRect();

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
      LAYERS.forEach((layer, index) => {
        const node = layerRefs.current[index];
        if (node) {
          node.style.transform = `translate3d(${(current.x * layer.parallax).toFixed(2)}px, ${(current.y * layer.parallax).toFixed(2)}px, 0)`;
        }
      });
      frame = settled ? 0 : requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame) {
        frame = requestAnimationFrame(tick);
      }
    };
    const onEnter = () => {
      rect = root.getBoundingClientRect();
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      // -1 to 1 from the center of the container.
      target.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      target.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      start();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      start();
    };
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onEnter, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onEnter);
    };
  }, [interactive]);

  return (
    <div
      className={cn(
        "group/paths relative flex min-h-[560px] w-full items-center justify-center overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      ref={rootRef}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out group-data-ready/paths:opacity-100"
        style={MASK}
      >
        {LAYERS.map((layer, index) => (
          <div
            className="absolute will-change-transform"
            key={layer.depth}
            ref={(node) => {
              layerRefs.current[index] = node;
            }}
            style={{
              inset: `-${OVERSCAN * 100}%`,
            }}
          >
            <div
              className="h-full w-full will-change-transform"
              ref={(node) => {
                driftRefs.current[index] = node;
              }}
            >
              {size ? (
                <svg
                  className="h-full w-full"
                  fill="none"
                  role="presentation"
                  viewBox={`0 0 ${round(layerWidth)} ${round(layerHeight)}`}
                >
                  {layers[index]?.map((line) => (
                    <path
                      d={line.d}
                      key={line.id}
                      opacity={line.opacity}
                      pathLength={1}
                      stroke="currentColor"
                      strokeDasharray="1 1"
                      strokeLinecap="round"
                      strokeWidth={layer.width}
                    />
                  ))}
                </svg>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {children === undefined ? <DefaultContent /> : children}
    </div>
  );
}

function DefaultContent() {
  return (
    <div className="relative flex max-w-xl flex-col items-center gap-4 px-6 text-center">
      <h1 className="font-semibold text-4xl tracking-tight sm:text-5xl">
        Calm by default
      </h1>
      <p className="max-w-sm text-base text-zinc-500 dark:text-zinc-400">
        One color, any size, next to no cost. The lines drift on their own
        layers and lean with the cursor.
      </p>
    </div>
  );
}
