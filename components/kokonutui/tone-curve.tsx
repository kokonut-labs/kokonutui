"use client";

/**
 * @author: @dorianbaffier
 * @description: Tone Curve
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { RotateCcw } from "lucide-react";
import { animate } from "motion/react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type CurveChannel = "rgb" | "r" | "g" | "b";

/** Points from 0 to 1 on both axes, sorted by x, ends at x = 0 and x = 1. */
export type Curve = [number, number][];

export type Curves = Record<CurveChannel, Curve>;

export interface ToneCurveProps {
  src?: string;
  alt?: string;
  defaultCurves?: Partial<Curves>;
  /** Called on every change with each channel's points. */
  onChange?: (curves: Curves) => void;
  className?: string;
}

const LINEAR: Curve = [
  [0, 0],
  [1, 1],
];

const CHANNELS: { id: CurveChannel; label: string; color: string }[] = [
  { id: "rgb", label: "RGB", color: "currentColor" },
  { id: "r", label: "Red", color: "#ef4444" },
  { id: "g", label: "Green", color: "#22c55e" },
  { id: "b", label: "Blue", color: "#3b82f6" },
];

const PRESET_XS = [0, 0.25, 0.5, 0.75, 1];

/** Presets as output values at PRESET_XS, per channel. */
const PRESETS: {
  id: string;
  label: string;
  curves: Record<CurveChannel, number[]>;
}[] = [
  {
    id: "linear",
    label: "Linear",
    curves: {
      rgb: [0, 0.25, 0.5, 0.75, 1],
      r: [0, 0.25, 0.5, 0.75, 1],
      g: [0, 0.25, 0.5, 0.75, 1],
      b: [0, 0.25, 0.5, 0.75, 1],
    },
  },
  {
    id: "contrast",
    label: "Contrast",
    curves: {
      rgb: [0, 0.17, 0.5, 0.84, 1],
      r: [0, 0.25, 0.5, 0.75, 1],
      g: [0, 0.25, 0.5, 0.75, 1],
      b: [0, 0.25, 0.5, 0.75, 1],
    },
  },
  {
    id: "matte",
    label: "Matte",
    curves: {
      rgb: [0.12, 0.3, 0.52, 0.76, 0.94],
      r: [0, 0.25, 0.5, 0.75, 1],
      g: [0, 0.25, 0.5, 0.75, 1],
      b: [0, 0.25, 0.5, 0.75, 1],
    },
  },
  {
    id: "warm",
    label: "Warm",
    curves: {
      rgb: [0, 0.23, 0.5, 0.78, 1],
      r: [0.02, 0.3, 0.57, 0.8, 1],
      g: [0, 0.26, 0.51, 0.76, 1],
      b: [0, 0.2, 0.43, 0.7, 0.94],
    },
  },
  {
    id: "teal",
    label: "Teal & orange",
    curves: {
      rgb: [0, 0.2, 0.5, 0.8, 1],
      r: [0, 0.2, 0.5, 0.8, 1],
      g: [0.02, 0.27, 0.51, 0.75, 0.98],
      b: [0.1, 0.33, 0.5, 0.66, 0.9],
    },
  },
];

const DEFAULT_SRC =
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=900&fit=crop&auto=format&q=80";

// The graph's drawing size; the SVG scales to fit.
const SIZE = 256;
const BINS = 64;
// Points closer than this on x can't be added or dragged past each other.
const MIN_GAP = 0.03;
// Drag a middle point this far outside the graph and letting go removes it.
const REMOVE_BEYOND = 0.12;
// Pressing on the line within this distance grabs it rather than adding.
const GRAB = 0.045;
const KEY_STEP = 1 / 64;
const TABLE_SAMPLES = 33;

/**
 * Monotone cubic interpolation (Fritsch–Carlson): a smooth curve through
 * every point that never overshoots between them, so a gentle S never
 * wraps below black or above white.
 */
function interpolator(points: Curve) {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  if (n < 2) {
    return () => ys[0] ?? 0;
  }
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]));
  }
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) {
    m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  }
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
  }
  return (x: number) => {
    if (x <= xs[0]) {
      return ys[0];
    }
    if (x >= xs[n - 1]) {
      return ys[n - 1];
    }
    let i = 0;
    while (x > xs[i + 1]) {
      i++;
    }
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

/** 256 output levels for one channel: its own curve, then the master. */
function lut(channel: Curve, master: Curve) {
  const c = interpolator(channel);
  const all = interpolator(master);
  const out = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    out[i] = Math.min(
      1,
      Math.max(0, all(Math.min(1, Math.max(0, c(i / 255)))))
    );
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function curvePath(points: Curve) {
  const f = interpolator(points);
  let d = "";
  for (let i = 0; i <= 64; i++) {
    const x = i / 64;
    const y = Math.min(1, Math.max(0, f(x)));
    d += `${i ? "L" : "M"}${r2(x * SIZE)} ${r2((1 - y) * SIZE)}`;
  }
  return d;
}

/** Moves each input level's pixel count to where the curve sends it. */
function remap(hist: Uint32Array, table: Float32Array) {
  const out = new Float32Array(BINS);
  for (let i = 0; i < 256; i++) {
    out[Math.min(BINS - 1, Math.floor(table[i] * BINS))] += hist[i];
  }
  // A light blur so the shape reads as a histogram, not a comb.
  const smooth = new Float32Array(BINS);
  for (let i = 0; i < BINS; i++) {
    const a = out[Math.max(0, i - 1)];
    const b = out[Math.min(BINS - 1, i + 1)];
    smooth[i] = (a + 2 * out[i] + b) / 4;
  }
  return smooth;
}

function histPath(bins: Float32Array, peak: number) {
  let d = `M0 ${SIZE}`;
  bins.forEach((v, i) => {
    const h = peak ? Math.sqrt(v / peak) * SIZE * 0.9 : 0;
    d += `L${r2(((i + 0.5) / BINS) * SIZE)} ${r2(SIZE - h)}`;
  });
  return `${d}L${SIZE} ${SIZE}Z`;
}

function samplePreset(values: number[]): Curve {
  return PRESET_XS.map((x, i) => [x, values[i]]);
}

export default function ToneCurve({
  src = DEFAULT_SRC,
  alt = "Sun setting over a valley",
  defaultCurves,
  onChange,
  className,
}: ToneCurveProps) {
  const [curves, setCurves] = useState<Curves>(() => ({
    rgb: defaultCurves?.rgb ?? LINEAR,
    r: defaultCurves?.r ?? LINEAR,
    g: defaultCurves?.g ?? LINEAR,
    b: defaultCurves?.b ?? LINEAR,
  }));
  const [channel, setChannel] = useState<CurveChannel>("rgb");
  const [active, setActive] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [preset, setPreset] = useState<string | null>(
    defaultCurves ? null : "linear"
  );
  const [comparing, setComparing] = useState(false);
  const [hist, setHist] = useState<Record<"r" | "g" | "b", Uint32Array> | null>(
    null
  );
  const filterId = `tone-${useId().replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const morph = useRef<{ stop: () => void } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const update = (next: Curves) => {
    setCurves(next);
    onChangeRef.current?.(next);
  };

  // Read the photo's levels once. The preview works without them (a CSS
  // filter), but the histogram needs pixels, so the image must allow CORS.
  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx || cancelled) {
        return;
      }
      ctx.drawImage(img, 0, 0, 160, 120);
      try {
        const data = ctx.getImageData(0, 0, 160, 120).data;
        const r = new Uint32Array(256);
        const g = new Uint32Array(256);
        const b = new Uint32Array(256);
        for (let i = 0; i < data.length; i += 4) {
          r[data[i]]++;
          g[data[i + 1]]++;
          b[data[i + 2]]++;
        }
        setHist({ r, g, b });
      } catch {
        setHist(null);
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  const tables = useMemo(
    () => ({
      r: lut(curves.r, curves.rgb),
      g: lut(curves.g, curves.rgb),
      b: lut(curves.b, curves.rgb),
    }),
    [curves]
  );

  const tableValues = (t: Float32Array) =>
    Array.from({ length: TABLE_SAMPLES }, (_, i) =>
      t[Math.round((i / (TABLE_SAMPLES - 1)) * 255)].toFixed(4)
    ).join(" ");

  const histograms = useMemo(() => {
    if (!hist) {
      return null;
    }
    const out = {
      r: remap(hist.r, tables.r),
      g: remap(hist.g, tables.g),
      b: remap(hist.b, tables.b),
    };
    const peak = Math.max(...out.r, ...out.g, ...out.b);
    return {
      r: histPath(out.r, peak),
      g: histPath(out.g, peak),
      b: histPath(out.b, peak),
    };
  }, [hist, tables]);

  const points = curves[channel];
  const current = CHANNELS.find((c) => c.id === channel) ?? CHANNELS[0];

  const toGraph = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return [0, 0] as const;
    }
    return [
      (clientX - rect.left) / rect.width,
      1 - (clientY - rect.top) / rect.height,
    ] as const;
  };

  const setPoints = (next: Curve) => {
    setPreset(null);
    update({ ...curves, [channel]: next });
  };

  const drag = useRef<{ id: number; index: number } | null>(null);

  const moveTo = (index: number, gx: number, gy: number, live: Curve) => {
    const next = live.map((p) => [...p] as [number, number]);
    const last = next.length - 1;
    const y = Math.min(1, Math.max(0, gy));
    if (index === 0 || index === last) {
      next[index] = [next[index][0], y];
    } else {
      const lo = next[index - 1][0] + MIN_GAP;
      const hi = next[index + 1][0] - MIN_GAP;
      next[index] = [Math.min(hi, Math.max(lo, gx)), y];
    }
    return next;
  };

  const onGraphDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }
    morph.current?.stop();
    const [gx, gy] = toGraph(event.clientX, event.clientY);
    const f = interpolator(points);
    // Grab the nearest point if the press is on it, otherwise add one on
    // the line under the pointer (the way photo editors do).
    let index = points.findIndex(
      ([px, py]) => Math.hypot(px - gx, py - gy) < GRAB
    );
    let next = points;
    if (index === -1) {
      const tooClose = points.some(([px]) => Math.abs(px - gx) < MIN_GAP);
      if (tooClose || gx <= 0 || gx >= 1) {
        return;
      }
      const y = Math.abs(f(gx) - gy) < GRAB * 2 ? f(gx) : gy;
      next = [...points, [gx, y] as [number, number]].sort(
        (a, b) => a[0] - b[0]
      );
      index = next.findIndex(([px]) => px === gx);
      setPoints(next);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, index };
    setActive(index);
  };

  const onGraphMove = (event: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) {
      return;
    }
    const [gx, gy] = toGraph(event.clientX, event.clientY);
    const middle = d.index > 0 && d.index < points.length - 1;
    const outside =
      gx < -REMOVE_BEYOND ||
      gx > 1 + REMOVE_BEYOND ||
      gy < -REMOVE_BEYOND ||
      gy > 1 + REMOVE_BEYOND;
    setRemoving(middle && outside);
    setPoints(moveTo(d.index, gx, gy, points));
  };

  const onGraphUp = (event: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) {
      return;
    }
    drag.current = null;
    if (removing) {
      setPoints(points.filter((_, i) => i !== d.index));
      setActive(null);
    }
    setRemoving(false);
  };

  const onPointKey = (
    event: KeyboardEvent<SVGCircleElement>,
    index: number
  ) => {
    const p = points[index];
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setPoints(moveTo(index, p[0] + move[0], p[1] + move[1], points));
      return;
    }
    const middle = index > 0 && index < points.length - 1;
    if ((event.key === "Delete" || event.key === "Backspace") && middle) {
      event.preventDefault();
      setPoints(points.filter((_, i) => i !== index));
      setActive(null);
    }
  };

  // Presets morph: every channel is resampled at the preset's x positions
  // and slides to its values, so you see the curve bend into shape.
  const applyPreset = (id: string) => {
    const target = PRESETS.find((p) => p.id === id);
    if (!target) {
      return;
    }
    morph.current?.stop();
    setPreset(id);
    setActive(null);
    const from = (Object.keys(curves) as CurveChannel[]).reduce(
      (acc, key) => {
        const f = interpolator(curves[key]);
        acc[key] = PRESET_XS.map((x) => f(x));
        return acc;
      },
      {} as Record<CurveChannel, number[]>
    );
    morph.current = animate(0, 1, {
      type: "spring",
      duration: 0.5,
      bounce: 0,
      onUpdate: (t) => {
        const next = {} as Curves;
        for (const key of Object.keys(from) as CurveChannel[]) {
          next[key] = samplePreset(
            from[key].map((v, i) => v + (target.curves[key][i] - v) * t)
          );
        }
        update(next);
      },
    });
  };

  const reset = () => applyPreset("linear");

  const readout =
    active !== null && points[active]
      ? `${Math.round(points[active][0] * 255)} → ${Math.round(points[active][1] * 255)}`
      : null;

  return (
    <div
      className={cn(
        "@container w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-3 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <svg aria-hidden="true" className="absolute size-0">
        <filter colorInterpolationFilters="sRGB" id={filterId}>
          <feComponentTransfer>
            <feFuncR tableValues={tableValues(tables.r)} type="table" />
            <feFuncG tableValues={tableValues(tables.g)} type="table" />
            <feFuncB tableValues={tableValues(tables.b)} type="table" />
          </feComponentTransfer>
        </filter>
      </svg>

      <div className="grid @[620px]:grid-cols-[1fr_272px] gap-3">
        <div className="relative @[620px]:aspect-auto aspect-[3/2] @[620px]:min-h-80 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
          <Image
            alt={alt}
            className="absolute inset-0 size-full object-cover"
            draggable={false}
            height={900}
            src={src}
            style={{ filter: comparing ? undefined : `url(#${filterId})` }}
            unoptimized
            width={1200}
          />
          <button
            className="absolute bottom-2.5 left-2.5 h-8 select-none rounded-full bg-zinc-950/70 px-3 font-medium text-[12px] text-white outline-none backdrop-blur-sm transition-colors duration-150 hover:bg-zinc-950/85 focus-visible:ring-2 focus-visible:ring-white/70"
            onBlur={() => setComparing(false)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setComparing(true);
              }
            }}
            onKeyUp={() => setComparing(false)}
            onPointerCancel={() => setComparing(false)}
            onPointerDown={() => setComparing(true)}
            onPointerLeave={() => setComparing(false)}
            onPointerUp={() => setComparing(false)}
            type="button"
          >
            {comparing ? "Original" : "Hold to compare"}
          </button>
        </div>

        <div className="@container/panel">
          <div className="grid @[400px]/panel:grid-cols-[minmax(0,1fr)_148px] @[400px]/panel:grid-rows-[auto_1fr] gap-2.5 @[400px]/panel:[grid-template-areas:'graph_tabs'_'graph_presets']">
            <div
              className="grid @[400px]/panel:grid-cols-2 grid-cols-4 gap-1 @[400px]/panel:[grid-area:tabs]"
              role="tablist"
            >
              {CHANNELS.map((c) => (
                <button
                  aria-selected={channel === c.id}
                  className={cn(
                    "flex h-8 items-center justify-center gap-1.5 rounded-lg font-medium text-[12.5px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400",
                    channel === c.id
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  )}
                  key={c.id}
                  onClick={() => {
                    setChannel(c.id);
                    setActive(null);
                  }}
                  role="tab"
                  type="button"
                >
                  {c.id === "rgb" ? null : (
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                  )}
                  {c.id === "rgb" ? "RGB" : c.id.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="relative @[400px]/panel:[grid-area:graph]">
              <svg
                className="block aspect-square w-full touch-none select-none overflow-visible rounded-lg"
                onPointerCancel={onGraphUp}
                onPointerDown={onGraphDown}
                onPointerMove={onGraphMove}
                onPointerUp={onGraphUp}
                ref={svgRef}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
              >
                <title>{`${current.label} curve. Press on the line to add a point, drag a point to bend it, drag it off the graph to remove it.`}</title>
                <rect
                  className="fill-zinc-50 dark:fill-zinc-900"
                  height={SIZE}
                  rx="8"
                  width={SIZE}
                />
                {histograms ? (
                  <g className="mix-blend-multiply dark:mix-blend-screen">
                    {(["r", "g", "b"] as const).map((k) => (
                      <path
                        d={histograms[k]}
                        fill={CHANNELS.find((c) => c.id === k)?.color}
                        key={k}
                        opacity={
                          channel === "rgb" || channel === k ? 0.16 : 0.05
                        }
                      />
                    ))}
                  </g>
                ) : null}
                {[1, 2, 3].map((i) => (
                  <g className="stroke-zinc-200 dark:stroke-zinc-800" key={i}>
                    <line
                      x1={(i * SIZE) / 4}
                      x2={(i * SIZE) / 4}
                      y1="0"
                      y2={SIZE}
                    />
                    <line
                      x1="0"
                      x2={SIZE}
                      y1={(i * SIZE) / 4}
                      y2={(i * SIZE) / 4}
                    />
                  </g>
                ))}
                <line
                  className="stroke-zinc-300 dark:stroke-zinc-700"
                  strokeDasharray="3 4"
                  x1="0"
                  x2={SIZE}
                  y1={SIZE}
                  y2="0"
                />
                {channel === "rgb"
                  ? null
                  : (["r", "g", "b"] as const)
                      .filter((k) => k !== channel)
                      .map((k) => (
                        <path
                          d={curvePath(curves[k])}
                          fill="none"
                          key={k}
                          opacity={0.35}
                          stroke={CHANNELS.find((c) => c.id === k)?.color}
                          strokeWidth="1"
                        />
                      ))}
                <path
                  className={cn(
                    channel === "rgb" && "stroke-zinc-900 dark:stroke-zinc-100"
                  )}
                  d={curvePath(points)}
                  fill="none"
                  stroke={channel === "rgb" ? undefined : current.color}
                  strokeLinecap="round"
                  strokeWidth="2"
                />
                {points.map(([x, y], i) => (
                  <circle
                    aria-label={`Point ${i + 1}: input ${Math.round(x * 255)}, output ${Math.round(y * 255)}`}
                    aria-valuemax={255}
                    aria-valuemin={0}
                    aria-valuenow={Math.round(y * 255)}
                    className={cn(
                      "cursor-grab fill-white outline-none transition-[opacity,r] duration-150 focus-visible:stroke-[3] dark:fill-zinc-950",
                      channel === "rgb" &&
                        "stroke-zinc-900 dark:stroke-zinc-100",
                      removing && active === i && "opacity-30"
                    )}
                    cx={r2(x * SIZE)}
                    cy={r2((1 - y) * SIZE)}
                    // biome-ignore lint/suspicious/noArrayIndexKey: points are ordered by x; the index is their identity
                    key={i}
                    onFocus={() => setActive(i)}
                    onKeyDown={(e) => onPointKey(e, i)}
                    r={active === i ? 6 : 4.5}
                    role="slider"
                    stroke={channel === "rgb" ? undefined : current.color}
                    strokeWidth="2"
                    tabIndex={0}
                  />
                ))}
              </svg>
              <span
                className={cn(
                  "pointer-events-none absolute top-2 right-2 rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 tabular-nums transition-opacity duration-150 dark:bg-zinc-950/90 dark:text-zinc-300",
                  readout ? "opacity-100" : "opacity-0"
                )}
              >
                {removing ? "Release to remove" : readout}
              </span>
            </div>

            <div className="flex @[400px]/panel:flex-col flex-wrap content-start items-center @[400px]/panel:items-stretch gap-1 @[400px]/panel:[grid-area:presets]">
              {PRESETS.filter((p) => p.id !== "linear").map((p) => (
                <button
                  aria-pressed={preset === p.id}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-left font-medium text-[12px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400",
                    preset === p.id
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
                  )}
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
              <button
                className="@[400px]/panel:mt-1 @[400px]/panel:ml-0 ml-auto flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium text-[12px] text-zinc-500 outline-none transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                onClick={reset}
                type="button"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
