"use client";

/**
 * @author: @dorianbaffier
 * @description: Pixel Sort Image
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface PixelSortImageProps {
  src?: string;
  alt?: string;
  /** Shown on the image, bottom left. */
  caption?: string;
  /** Credit, bottom right. */
  credit?: string;
  /** Half-width of the brush, in px. */
  brush?: number;
  /** Pixels darker than this (0 to 1) break a streak, so edges survive. */
  threshold?: number;
  className?: string;
}

/** How much of the way back to the photo each frame goes. */
const MELT = 0.03;
/** Longest streak one stroke can pour, in px. */
const MAX_POUR = 240;

const lum = (d: Uint8ClampedArray, i: number) =>
  (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Eases the touched pixels a step back toward the photo. True once they're home. */
function melt(
  data: Uint8ClampedArray,
  work: Float32Array,
  original: Uint8ClampedArray,
  width: number,
  { x0, y0, x1, y1 }: Rect
) {
  let settled = true;
  for (let y = y0; y < y1; y++) {
    const rowEnd = (y * width + x1) * 4;
    for (let i = (y * width + x0) * 4; i < rowEnd; i++) {
      if (i % 4 === 3) {
        continue;
      }
      const diff = original[i] - work[i];
      const done = diff < 0.5 && diff > -0.5;
      work[i] = done ? original[i] : work[i] + diff * MELT;
      settled &&= done;
      data[i] = work[i];
    }
  }
  return settled;
}

/** Sorts each run of bright enough pixels in one column, between two rows. */
function sortColumn(
  data: Uint8ClampedArray,
  work: Float32Array,
  width: number,
  x: number,
  from: number,
  to: number,
  threshold: number
) {
  const bright = (y: number) => lum(data, (y * width + x) * 4) >= threshold;
  let y = from;
  while (y < to) {
    while (y < to && !bright(y)) {
      y++;
    }
    const start = y;
    const run: number[][] = [];
    while (y < to && bright(y)) {
      const i = (y * width + x) * 4;
      run.push([data[i], data[i + 1], data[i + 2], lum(data, i)]);
      y++;
    }
    // Bright first: highlights pour down over what was under them.
    run.sort((a, b) => b[3] - a[3]);
    run.forEach((px, k) => {
      const i = ((start + k) * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        data[i + c] = px[c];
        work[i + c] = px[c];
      }
    });
  }
}

/**
 * A photo that pours. Drag or sweep across it and the pixels under the
 * pointer sort by brightness into streaks that run down the image, then
 * melt back into the photo on their own.
 */
export default function PixelSortImage({
  src = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600&q=80&auto=format&fit=crop",
  alt = "A mountain lake at sunrise",
  caption = "Lago di Braies, 6:12am",
  credit = "Photo, Unsplash",
  brush = 34,
  threshold = 0.22,
  className,
}: PixelSortImageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!(root && canvas && ctx)) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";

    let width = 0;
    let height = 0;
    let scale = 1;
    let original: Uint8ClampedArray | null = null;
    // Working copy in floats, so the melt can move by less than one level.
    let work: Float32Array | null = null;
    let frame: ImageData | null = null;
    let dirty: Rect | null = null;
    let raf = 0;
    let alive = true;
    const hand = { x: 0, y: 0, t: 0 };
    const intro: number[] = [];

    const draw = () => {
      raf = 0;
      if (!(frame && original && work && dirty)) {
        return;
      }
      // Ease every touched pixel back toward the photo.
      const data = frame.data;
      const { x0, y0, x1, y1 } = dirty;
      const settled = melt(data, work, original, width, dirty);
      ctx.putImageData(frame, 0, 0, x0, y0, x1 - x0, y1 - y0);
      if (settled) {
        dirty = null;
        return;
      }
      raf = requestAnimationFrame(draw);
    };

    const touch = (rect: Rect) => {
      dirty = dirty
        ? {
            x0: Math.min(dirty.x0, rect.x0),
            y0: Math.min(dirty.y0, rect.y0),
            x1: Math.max(dirty.x1, rect.x1),
            y1: Math.max(dirty.y1, rect.y1),
          }
        : rect;
      if (!raf) {
        raf = requestAnimationFrame(draw);
      }
    };

    /**
     * Sorts the columns under the brush, from the pointer down. Each column
     * pours further the nearer it is to the middle of the brush and the
     * faster the pointer moves; dark pixels break the run.
     */
    const pour = (cx: number, cy: number, speed: number) => {
      if (!(frame && work)) {
        return;
      }
      const data = frame.data;
      const r = Math.round(brush * scale);
      const reach = Math.min(MAX_POUR, 50 + speed * 180) * scale;
      const x0 = Math.max(0, Math.round(cx) - r);
      const x1 = Math.min(width, Math.round(cx) + r);
      const y0 = Math.max(0, Math.round(cy));
      let yMax = y0;
      for (let x = x0; x < x1; x++) {
        const falloff = 1 - Math.abs(x - cx) / r;
        // A little ragged at the bottom, like paint running.
        const seed = (x * 7919 + Math.round(cy) * 31) % 97;
        const jitter = 0.3 + (seed / 97) * 0.9;
        // Ragged at the top too, so the stroke doesn't leave a ruled edge.
        const top = Math.min(height, y0 + ((seed * 13) % 17) * scale);
        const y1 = Math.min(height, top + Math.round(reach * falloff * jitter));
        yMax = Math.max(yMax, y1);
        sortColumn(data, work, width, x, top, y1, threshold);
      }
      ctx.putImageData(frame, 0, 0, x0, y0, x1 - x0, yMax - y0);
      touch({ x0, y0, x1, y1: yMax });
    };

    const build = () => {
      const rect = root.getBoundingClientRect();
      if (!(image.complete && image.naturalWidth) || rect.width < 2) {
        return;
      }
      scale = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.round(rect.width * scale);
      height = Math.round(rect.height * scale);
      canvas.width = width;
      canvas.height = height;
      // Cover, like object-fit.
      const fit = Math.max(
        width / image.naturalWidth,
        height / image.naturalHeight
      );
      const w = image.naturalWidth * fit;
      const h = image.naturalHeight * fit;
      ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      try {
        frame = ctx.getImageData(0, 0, width, height);
        original = new Uint8ClampedArray(frame.data);
        work = new Float32Array(frame.data);
      } catch {
        // A host without CORS headers: show the photo, skip the effect.
        frame = null;
        original = null;
        work = null;
      }
      dirty = null;
    };

    image.onload = () => {
      if (!alive) {
        return;
      }
      build();
      setReady(true);
      // One sweep when it first shows, so it's clear the photo can be touched.
      if (!reduceMotion) {
        const steps = 22;
        for (let s = 0; s <= steps; s++) {
          intro.push(
            window.setTimeout(
              () => {
                const p = s / steps;
                pour(
                  width * (0.18 + p * 0.64),
                  height * (0.28 + Math.sin(p * Math.PI) * 0.12),
                  0.9
                );
              },
              450 + s * 28
            )
          );
        }
      }
    };
    image.src = src;

    const resizeObserver = new ResizeObserver(() => build());
    resizeObserver.observe(root);

    const onMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const x = (event.clientX - rect.left) * scale;
      const y = (event.clientY - rect.top) * scale;
      const now = event.timeStamp;
      if (hand.t) {
        const dt = Math.max(1, now - hand.t);
        const dist = Math.hypot(x - hand.x, y - hand.y) / scale;
        // Fill the gap between events so a fast stroke doesn't skip.
        const steps = Math.max(1, Math.ceil(dist / (brush * 0.6)));
        for (let s = 1; s <= steps; s++) {
          const p = s / steps;
          pour(hand.x + (x - hand.x) * p, hand.y + (y - hand.y) * p, dist / dt);
        }
      }
      hand.x = x;
      hand.y = y;
      hand.t = now;
    };
    const onLeave = () => {
      hand.t = 0;
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      for (const id of intro) {
        window.clearTimeout(id);
      }
      resizeObserver.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      image.onload = null;
    };
  }, [src, brush, threshold]);

  return (
    <figure
      className={cn(
        "relative aspect-[4/3] w-full max-w-2xl touch-pan-y overflow-hidden rounded-2xl bg-zinc-100 sm:aspect-[16/10] dark:bg-zinc-900",
        className
      )}
      ref={rootRef}
    >
      <canvas
        aria-label={alt}
        className={cn(
          "absolute inset-0 h-full w-full transition-opacity duration-500 ease-out",
          ready ? "opacity-100" : "opacity-0"
        )}
        ref={canvasRef}
        role="img"
      />
      {(caption || credit) && (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 text-white text-xs [text-shadow:0_1px_2px_rgb(0_0_0/0.45)]">
          <span className="font-medium">{caption}</span>
          <span className="text-white/75">{credit}</span>
        </figcaption>
      )}
    </figure>
  );
}
