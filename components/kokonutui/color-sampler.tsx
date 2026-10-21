"use client";

/**
 * @author: @dorianbaffier
 * @description: Color Sampler
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Copy, Pipette, Upload } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import {
  type ChangeEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface SamplerImage {
  src: string;
  alt: string;
}

export interface ColorSamplerProps {
  /** Images to pick from. They must allow cross-origin reads (CORS). */
  images?: SamplerImage[];
  /** How many colors to pull out of the image. */
  count?: number;
  /** Called with a hex color whenever one is chosen. */
  onChange?: (hex: string) => void;
  className?: string;
}

interface Swatch {
  hex: string;
  rgb: [number, number, number];
  /** Where the color sits in the image, 0 to 1 on each axis. */
  at: { x: number; y: number };
  /** Share of the image, 0 to 1. Picked colors have none. */
  share: number;
  picked?: boolean;
}

interface Loupe {
  /** Pointer position in the image box, px. */
  x: number;
  y: number;
  hex: string;
  touch: boolean;
}

interface Flight {
  id: number;
  hex: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1200&h=900&fit=crop&auto=format&q=80`;

const DEFAULT_IMAGES: SamplerImage[] = [
  {
    src: unsplash("1507525428034-b723cf961d3e"),
    alt: "A beach with clear water",
  },
  {
    src: unsplash("1469474968028-56623f02e42e"),
    alt: "Sun setting over a valley",
  },
  {
    src: unsplash("1504674900247-0877df9cc836"),
    alt: "A table of small plates",
  },
];

// The loupe shows this many image pixels across, each this many px wide.
const LOUPE_CELLS = 11;
const LOUPE_CELL = 10;
const LOUPE = LOUPE_CELLS * LOUPE_CELL;
// On touch the loupe floats this far above the finger, so it stays visible.
const TOUCH_LIFT = 96;
// The palette is computed from a copy this many px wide.
const SAMPLE_WIDTH = 96;
const ITERATIONS = 12;
// Two colors closer than this (in RGB distance) count as the same color.
const MERGE = 26;
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

const toHex = (rgb: readonly number[]) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

function luminance([r, g, b]: readonly number[]) {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.039_28 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: readonly number[], b: readonly number[]) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function distance(a: readonly number[], b: readonly number[]) {
  // Weighted toward how eyes see differences, cheaper than Lab.
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db) / 3;
}

/** Deterministic, so the same image always gives the same palette. */
function seeded(seed: number) {
  let n = seed;
  return () => {
    n += 1;
    const x = Math.sin(n * 91.345) * 47_453.5453;
    return x - Math.floor(x);
  };
}

interface Pixel {
  rgb: number[];
  x: number;
  y: number;
}

interface Cluster {
  rgb: number[];
  members: Pixel[];
}

function opaquePixels(data: Uint8ClampedArray, w: number, h: number) {
  const pixels: Pixel[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 128) {
        pixels.push({ rgb: [data[i], data[i + 1], data[i + 2]], x, y });
      }
    }
  }
  return pixels;
}

/** K-means seeded with k-means++, so the starting colors are spread out. */
function kmeans(pixels: Pixel[], k: number): Cluster[] {
  const rand = seeded(pixels.length);
  const centers: number[][] = [pixels[Math.floor(rand() * pixels.length)].rgb];
  while (centers.length < k) {
    const weights = pixels.map(
      (p) => Math.min(...centers.map((c) => distance(p.rgb, c))) ** 2
    );
    let pick = rand() * weights.reduce((a, b) => a + b, 0);
    let index = 0;
    while (pick > weights[index] && index < weights.length - 1) {
      pick -= weights[index];
      index++;
    }
    centers.push([...pixels[index].rgb]);
  }

  const nearest = (rgb: number[]) => {
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    centers.forEach((c, j) => {
      const d = distance(rgb, c);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    return best;
  };

  let owner: number[] = [];
  for (let round = 0; round < ITERATIONS; round++) {
    owner = pixels.map((p) => nearest(p.rgb));
    const sums = centers.map(() => [0, 0, 0, 0]);
    pixels.forEach((p, i) => {
      const s = sums[owner[i]];
      s[0] += p.rgb[0];
      s[1] += p.rgb[1];
      s[2] += p.rgb[2];
      s[3] += 1;
    });
    sums.forEach((s, j) => {
      if (s[3]) {
        centers[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
      }
    });
  }
  return centers.map((rgb, j) => ({
    rgb,
    members: pixels.filter((_, i) => owner[i] === j),
  }));
}

/**
 * Biggest first, near duplicates folded into the bigger one. If that leaves
 * too few colors (a flat logo only has so many), the bar is loosened.
 */
function merge(clusters: Cluster[], k: number) {
  const sorted = clusters
    .filter((c) => c.members.length > 0)
    .sort((a, b) => b.members.length - a.members.length);
  let kept: Cluster[] = [];
  for (const bar of [MERGE, MERGE / 2, 0]) {
    kept = [];
    for (const cluster of sorted) {
      const twin = kept.find((c) => distance(c.rgb, cluster.rgb) < bar);
      if (twin) {
        twin.members = [...twin.members, ...cluster.members];
      } else {
        kept.push({ ...cluster });
      }
    }
    if (kept.length >= k) {
      break;
    }
  }
  return kept.slice(0, k);
}

/**
 * The member closest to the cluster's color, among the ones nearest its
 * middle, so the marker sits on a patch of that color.
 */
function anchor(cluster: Cluster) {
  const n = cluster.members.length;
  const cx = cluster.members.reduce((a, m) => a + m.x, 0) / n;
  const cy = cluster.members.reduce((a, m) => a + m.y, 0) / n;
  let best = cluster.members[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const m of cluster.members) {
    const score =
      distance(m.rgb, cluster.rgb) * 2 + Math.hypot(m.x - cx, m.y - cy);
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/** The image's main colors, biggest first, each placed where it lives. */
function extract(data: Uint8ClampedArray, w: number, h: number, k: number) {
  const pixels = opaquePixels(data, w, h);
  if (pixels.length === 0) {
    return [];
  }
  return merge(kmeans(pixels, k + 3), k).map((cluster): Swatch => {
    const at = anchor(cluster);
    const rgb = cluster.rgb.map(Math.round) as [number, number, number];
    return {
      hex: toHex(rgb),
      rgb,
      at: { x: (at.x + 0.5) / w, y: (at.y + 0.5) / h },
      share: cluster.members.length / pixels.length,
    };
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/** Draws an image into a box the way `object-fit: cover` would. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Which text color reads best on a fill, and how well, by WCAG. */
function readability(rgb: readonly number[]) {
  const onWhite = contrast(rgb, [255, 255, 255]);
  const onBlack = contrast(rgb, [0, 0, 0]);
  const ratio = Math.max(onWhite, onBlack);
  let grade = "Fail";
  if (ratio >= 7) {
    grade = "AAA";
  } else if (ratio >= 4.5) {
    grade = "AA";
  } else if (ratio >= 3) {
    grade = "AA Large";
  }
  return { label: onWhite >= onBlack ? "white" : "black", ratio, grade };
}

/**
 * Up and to the right of a mouse pointer; straight above a finger, high
 * enough to clear it. Kept inside the image box.
 */
function loupePosition(loupe: Loupe, boxWidth: number) {
  const x = loupe.touch ? loupe.x - LOUPE / 2 : loupe.x + 18;
  const y = loupe.touch
    ? loupe.y - LOUPE - TOUCH_LIFT / 2
    : loupe.y - LOUPE - 18;
  return {
    left: Math.min(Math.max(x, 4), boxWidth - LOUPE - 4),
    top: Math.max(4, y),
  };
}

/** A dot on the image where each palette color lives. */
function Markers({
  swatches,
  hovered,
  selected,
}: {
  swatches: Swatch[];
  hovered: string | null;
  selected: string | null;
}) {
  return swatches.map((s) => {
    const lit = hovered === s.hex || selected === s.hex;
    const dim = hovered !== null && hovered !== s.hex;
    return (
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.25),0_2px_6px_rgba(0,0,0,0.25)] transition-[opacity,width,height] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          lit && "size-6",
          dim && "opacity-40"
        )}
        key={`${s.hex}${s.picked ? "p" : ""}`}
        style={{
          left: `${s.at.x * 100}%`,
          top: `${s.at.y * 100}%`,
          backgroundColor: s.hex,
        }}
      />
    );
  });
}

export default function ColorSampler({
  images = DEFAULT_IMAGES,
  count = 5,
  onChange,
  className,
}: ColorSamplerProps) {
  const [sources, setSources] = useState(images);
  const [active, setActive] = useState(0);
  const [palette, setPalette] = useState<Swatch[]>([]);
  const [picked, setPicked] = useState<Swatch | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [loupe, setLoupe] = useState<Loupe | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [copied, setCopied] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const flightId = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const source = sources[active];

  // Paint the image into the visible canvas at device resolution. The loupe
  // reads from the same pixels, so what it shows is exactly what is there.
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    const img = imgRef.current;
    if (!(canvas && box && img)) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = box.clientWidth;
    const h = box.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCover(ctx, img, w, h);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setLoupe(null);
    loadImage(source.src)
      .then((img) => {
        if (cancelled) {
          return;
        }
        imgRef.current = img;
        paint();
        const box = boxRef.current;
        const sw = SAMPLE_WIDTH;
        const sh = box
          ? Math.round((SAMPLE_WIDTH * box.clientHeight) / box.clientWidth)
          : 72;
        const small = document.createElement("canvas");
        small.width = sw;
        small.height = sh;
        const ctx = small.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          return;
        }
        drawCover(ctx, img, sw, sh);
        const found = extract(
          ctx.getImageData(0, 0, sw, sh).data,
          sw,
          sh,
          count
        );
        setPalette(found);
        setPicked(null);
        setSelected(found[0]?.hex ?? null);
        if (found[0]) {
          onChangeRef.current?.(found[0].hex);
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setPalette([]);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source.src, count, paint]);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) {
      return;
    }
    const observer = new ResizeObserver(() => paint());
    observer.observe(box);
    return () => observer.disconnect();
  }, [paint]);

  // Revoke uploaded images' object URLs when the component goes away.
  const uploads = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of uploads.current) {
        URL.revokeObjectURL(url);
      }
    },
    []
  );

  const readPixel = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    const box = boxRef.current;
    if (!(canvas && ctx && box)) {
      return null;
    }
    const px = Math.floor((x / box.clientWidth) * canvas.width);
    const py = Math.floor((y / box.clientHeight) * canvas.height);
    try {
      const d = ctx.getImageData(
        Math.max(0, Math.min(canvas.width - 1, px)),
        Math.max(0, Math.min(canvas.height - 1, py)),
        1,
        1
      ).data;
      return [d[0], d[1], d[2]] as [number, number, number];
    } catch {
      // A cross-origin image without CORS headers can't be read.
      return null;
    }
  };

  // Redraw the loupe: the pixels around the pointer, blown up, with the
  // centre one outlined.
  useLayoutEffect(() => {
    const out = loupeRef.current;
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!(loupe && out && canvas && box)) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    out.width = LOUPE * dpr;
    out.height = LOUPE * dpr;
    const ctx = out.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const half = Math.floor(LOUPE_CELLS / 2);
    const px = Math.floor((loupe.x / box.clientWidth) * canvas.width);
    const py = Math.floor((loupe.y / box.clientHeight) * canvas.height);
    ctx.clearRect(0, 0, LOUPE, LOUPE);
    ctx.drawImage(
      canvas,
      px - half,
      py - half,
      LOUPE_CELLS,
      LOUPE_CELLS,
      0,
      0,
      LOUPE,
      LOUPE
    );
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    for (let i = 1; i < LOUPE_CELLS; i++) {
      const p = i * LOUPE_CELL + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, LOUPE);
      ctx.moveTo(0, p);
      ctx.lineTo(LOUPE, p);
      ctx.stroke();
    }
    const c = half * LOUPE_CELL;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeRect(c - 0.5, c - 0.5, LOUPE_CELL + 1, LOUPE_CELL + 1);
    ctx.strokeStyle = "white";
    ctx.strokeRect(c + 0.5, c + 0.5, LOUPE_CELL - 1, LOUPE_CELL - 1);
  }, [loupe]);

  const choose = (hex: string) => {
    setSelected(hex);
    onChangeRef.current?.(hex);
  };

  const pointAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height - 1, event.clientY - rect.top));
    const rgb = readPixel(x, y);
    if (!rgb) {
      return null;
    }
    return { x, y, hex: toHex(rgb), rgb, touch: event.pointerType !== "mouse" };
  };

  const showLoupe = (event: PointerEvent<HTMLDivElement>) => {
    if (status !== "ready") {
      return;
    }
    const at = pointAt(event);
    if (at) {
      setLoupe(at);
    }
  };

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    // A finger only shows the loupe while it is down; a mouse always does.
    if (event.pointerType === "mouse" || event.buttons > 0) {
      showLoupe(event);
    }
  };

  const sample = (event: PointerEvent<HTMLDivElement>) => {
    if (status !== "ready") {
      return;
    }
    const at = pointAt(event);
    const root = rootRef.current?.getBoundingClientRect();
    const box = boxRef.current?.getBoundingClientRect();
    const slot = slotRef.current?.getBoundingClientRect();
    if (!(at && root && box)) {
      return;
    }
    if (event.pointerType !== "mouse") {
      setLoupe(null);
    }
    const swatch: Swatch = {
      hex: at.hex,
      rgb: at.rgb,
      at: { x: at.x / box.width, y: at.y / box.height },
      share: 0,
      picked: true,
    };
    // The sampled color flies from the pointer into the picked slot, then
    // lands there.
    if (slot) {
      const id = ++flightId.current;
      setFlights((f) => [
        ...f,
        {
          id,
          hex: at.hex,
          from: {
            x: box.left - root.left + at.x,
            y: box.top - root.top + at.y,
          },
          to: {
            x: slot.left - root.left + slot.width / 2,
            y: slot.top - root.top + slot.height / 2,
          },
        },
      ]);
    } else {
      setPicked(swatch);
    }
    window.setTimeout(() => setPicked(swatch), slot ? 380 : 0);
    choose(at.hex);
  };

  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    uploads.current.push(url);
    setSources((s) => [...s, { src: url, alt: file.name }]);
    setActive(sources.length);
  };

  const current =
    [...palette, ...(picked ? [picked] : [])].find((s) => s.hex === selected) ??
    palette[0];
  const read = current ? readability(current.rgb) : null;

  const copy = () => {
    if (!current) {
      return;
    }
    navigator.clipboard?.writeText(current.hex).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      },
      () => undefined
    );
  };

  const place = loupe
    ? loupePosition(loupe, boxRef.current?.clientWidth ?? 0)
    : null;

  return (
    <div
      className={cn(
        "relative w-full max-w-[420px] rounded-2xl border border-zinc-200 bg-white p-3 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      ref={rootRef}
    >
      <div
        className="relative aspect-[4/3] cursor-crosshair touch-none overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900"
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") {
            showLoupe(event);
          }
        }}
        onPointerLeave={() => setLoupe(null)}
        onPointerMove={onMove}
        onPointerUp={sample}
        ref={boxRef}
      >
        <canvas
          aria-label={source.alt}
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-300",
            status === "ready" ? "opacity-100" : "opacity-0"
          )}
          ref={canvasRef}
          role="img"
        />

        {status === "error" ? (
          <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-zinc-500">
            This image can't be read. Try another one or upload your own.
          </p>
        ) : null}

        {status === "ready" ? (
          <Markers
            hovered={hovered}
            selected={selected}
            swatches={[...palette, ...(picked ? [picked] : [])]}
          />
        ) : null}

        {loupe ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 flex flex-col items-center gap-1.5"
            style={place ?? undefined}
          >
            <canvas
              className="rounded-full shadow-[0_0_0_2px_white,0_0_0_3px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.25)]"
              ref={loupeRef}
              style={{ width: LOUPE, height: LOUPE }}
            />
            <span className="flex items-center gap-1.5 rounded-full bg-zinc-950/85 py-0.5 pr-2 pl-1 font-mono text-[11px] text-white uppercase tabular-nums">
              <span
                className="size-3 rounded-full ring-1 ring-white/40"
                style={{ backgroundColor: loupe.hex }}
              />
              {loupe.hex}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {sources.map((s, i) => (
          <button
            aria-label={`Use ${s.alt}`}
            aria-pressed={i === active}
            className={cn(
              "relative size-10 shrink-0 overflow-hidden rounded-lg outline-none ring-offset-2 ring-offset-white transition-[box-shadow,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:ring-offset-zinc-950",
              i === active
                ? "ring-2 ring-zinc-900 dark:ring-zinc-100"
                : "opacity-70 hover:opacity-100"
            )}
            key={s.src}
            onClick={() => setActive(i)}
            type="button"
          >
            <Image
              alt=""
              className="size-full object-cover"
              height={80}
              src={s.src}
              unoptimized
              width={80}
            />
          </button>
        ))}
        <label className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 border-dashed px-3 text-[13px] text-zinc-600 transition-colors duration-150 focus-within:ring-2 focus-within:ring-zinc-400 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100">
          <Upload className="size-4" />
          Upload
          <input
            accept="image/*"
            className="sr-only"
            onChange={onUpload}
            type="file"
          />
        </label>
        <span className="ml-auto hidden items-center gap-1 text-[12px] text-zinc-400 sm:flex">
          <Pipette className="size-3.5" />
          Click to pick
        </span>
      </div>

      <div
        aria-label="Palette"
        className="mt-3 grid gap-1.5"
        role="radiogroup"
        style={{ gridTemplateColumns: `repeat(${count + 1}, minmax(0, 1fr))` }}
      >
        {(status === "ready"
          ? palette
          : Array.from({ length: count }, (_, i) => palette[i])
        ).map((s, i) =>
          s ? (
            <SwatchButton
              key={s.hex}
              onHover={setHovered}
              onPick={choose}
              selected={selected === s.hex}
              swatch={s}
            />
          ) : (
            <span
              className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders while loading
              key={i}
            />
          )
        )}
        <div className="relative h-14" ref={slotRef}>
          {picked ? (
            <SwatchButton
              onHover={setHovered}
              onPick={choose}
              selected={selected === picked.hex}
              swatch={picked}
            />
          ) : (
            <span className="flex h-full items-center justify-center rounded-lg border border-zinc-300 border-dashed text-zinc-400 dark:border-zinc-700">
              <Pipette className="size-4" />
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl border border-zinc-200 p-2 pl-3 dark:border-zinc-800">
        <span
          className="flex h-9 items-center rounded-lg px-3.5 font-medium text-sm transition-colors duration-300"
          style={{
            backgroundColor: current?.hex ?? "#a1a1aa",
            color: read?.label === "white" ? "#fff" : "#000",
          }}
        >
          Get started
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-mono text-[13px] uppercase tabular-nums">
            {current?.hex ?? "—"}
          </span>
          <span className="block text-[12px] text-zinc-500">
            {read
              ? `${read.ratio.toFixed(1)}:1 with ${read.label} text · ${read.grade}`
              : "Reading colors…"}
          </span>
        </span>
        <button
          aria-label={copied ? "Copied" : "Copy hex"}
          className="flex size-9 items-center justify-center rounded-lg text-zinc-500 outline-none transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          onClick={copy}
          type="button"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>

      <AnimatePresence>
        {flights.map((f) => (
          <motion.span
            animate={{ x: f.to.x, y: f.to.y, opacity: 1 }}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 z-20 -mt-2.5 -ml-2.5 size-5 rounded-full border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            initial={{ x: f.from.x, y: f.from.y, opacity: 1 }}
            key={f.id}
            onAnimationComplete={() =>
              setFlights((all) => all.filter((x) => x.id !== f.id))
            }
            style={{ backgroundColor: f.hex }}
            // x and y ease differently, so the swatch travels on an arc.
            transition={{
              x: { duration: 0.42, ease: EASE },
              y: { duration: 0.42, ease: [0.55, 0, 0.75, 0.3] },
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function SwatchButton({
  swatch,
  selected,
  onPick,
  onHover,
}: {
  swatch: Swatch;
  selected: boolean;
  onPick: (hex: string) => void;
  onHover: (hex: string | null) => void;
}) {
  const light = luminance(swatch.rgb) > 0.4;
  return (
    <motion.button
      animate={{ opacity: 1 }}
      aria-checked={selected}
      aria-label={`${swatch.hex}${
        swatch.share
          ? `, ${Math.round(swatch.share * 100)}% of the image`
          : ", picked"
      }`}
      className="relative flex h-14 w-full flex-col justify-end rounded-lg p-1.5 text-left shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] outline-none ring-offset-2 ring-offset-white focus-visible:ring-2 focus-visible:ring-zinc-400 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:ring-offset-zinc-950"
      initial={{ opacity: 0 }}
      onBlur={() => onHover(null)}
      onClick={() => onPick(swatch.hex)}
      onFocus={() => onHover(swatch.hex)}
      onMouseEnter={() => onHover(swatch.hex)}
      onMouseLeave={() => onHover(null)}
      role="radio"
      style={{ backgroundColor: swatch.hex }}
      transition={{ duration: 0.25 }}
      type="button"
    >
      <span
        className={cn(
          "font-mono text-[9.5px] uppercase tabular-nums leading-none",
          light ? "text-black/60" : "text-white/75"
        )}
      >
        {swatch.share ? `${Math.round(swatch.share * 100)}%` : "Pick"}
      </span>
      {selected ? (
        <span
          className={cn(
            "absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full",
            light ? "bg-black/80 text-white" : "bg-white text-black"
          )}
        >
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      ) : null}
    </motion.button>
  );
}
