"use client";

/**
 * @author: @dorianbaffier
 * @description: Halftone Background
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface HalftoneBackgroundProps {
  className?: string;
  /** Content shown over the dots. Pass `null` for a bare background. */
  children?: ReactNode;
  /**
   * An image to print as dots. It must be same-origin or served with CORS
   * headers. Without one, a lit sphere is drawn.
   */
  src?: string;
  /** Distance between dots, in px. */
  cell?: number;
  /** Screen angle in degrees; 45 is the classic print angle. */
  angle?: number;
  /** Show a loupe under the cursor that prints at twice the resolution. */
  loupe?: boolean;
}

// The loupe's radius in px, and how much finer its screen is.
const LOUPE = 110;
const LOUPE_DETAIL = 2.2;
// The loupe trails the cursor with this time constant, in seconds.
const LOUPE_LAG = 0.08;
// Paper texture: the faintest tone printed everywhere.
const PAPER = 0.025;
const INTRO_MS = 900;

/** How much ink (0 to 1) a point takes, in px. */
type Field = (x: number, y: number) => number;

/**
 * A sphere lit from the upper left, with a soft shadow on the ground. With
 * `light` ink (a dark page) the lit side is printed instead of the shade.
 */
function sphereField(width: number, height: number, light: boolean): Field {
  // Matches the @3xl breakpoint: beside the copy when wide, above it when not.
  const wide = width >= 768;
  const r = wide
    ? Math.min(width, height) * 0.34
    : Math.min(width * 0.34, height * 0.2);
  const cx = wide ? width * 0.7 : width * 0.54;
  const cy = height * (wide ? 0.48 : 0.27);
  const sun = { x: -0.55, y: -0.6, z: 0.58 };
  const shadow = {
    x: cx + r * 0.35,
    y: cy + r * 1.02,
    rx: r * 1.15,
    ry: r * 0.24,
  };
  return (x, y) => {
    const nx = (x - cx) / r;
    const ny = (y - cy) / r;
    const d2 = nx * nx + ny * ny;
    if (d2 < 1) {
      const nz = Math.sqrt(1 - d2);
      const lambert = Math.max(nx * sun.x + ny * sun.y + nz * sun.z, 0);
      const brightness = 0.12 + 0.88 * lambert;
      return Math.max(light ? brightness : 1 - brightness, PAPER);
    }
    if (light) {
      return PAPER;
    }
    const sx = (x - shadow.x) / shadow.rx;
    const sy = (y - shadow.y) / shadow.ry;
    const s = 1 - Math.sqrt(sx * sx + sy * sy);
    return s > 0 ? Math.max(PAPER, 0.55 * s * s) : PAPER;
  };
}

/**
 * An image drawn to cover the box, sampled for its darkness, or for its
 * brightness when printing light ink on a dark page.
 */
function imageField(
  image: HTMLImageElement,
  width: number,
  height: number,
  light: boolean
): Field | null {
  const scale = 0.5;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const ctx = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.canvas.width = w;
  ctx.canvas.height = h;
  const fit = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * fit;
  const dh = image.naturalHeight * fit;
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    // A cross-origin image without CORS can't be read.
    return null;
  }
  return (x, y) => {
    const i = Math.min(Math.max(Math.round(x * scale), 0), w - 1);
    const j = Math.min(Math.max(Math.round(y * scale), 0), h - 1);
    const k = (j * w + i) * 4;
    const lum =
      (0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2]) / 255;
    return Math.max(light ? lum : 1 - lum, PAPER);
  };
}

/**
 * Add a rotated grid of dots to the current path, sized by `field`.
 * `grow` scales each dot (0 to 1) for the intro.
 */
function screen(
  ctx: CanvasRenderingContext2D,
  field: Field,
  options: {
    width: number;
    height: number;
    cell: number;
    angle: number;
    grow?: (x: number, y: number) => number;
  }
) {
  const { width, height, cell, angle, grow } = options;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const reach = Math.hypot(width, height) / 2 + cell;
  const n = Math.ceil(reach / cell);
  const ox = width / 2;
  const oy = height / 2;
  const max = cell * 0.5 * 1.18;
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const x = ox + (i * c - j * s) * cell;
      const y = oy + (i * s + j * c) * cell;
      if (x < -cell || y < -cell || x > width + cell || y > height + cell) {
        continue;
      }
      const r = max * Math.sqrt(field(x, y)) * (grow ? grow(x, y) : 1);
      if (r > 0.25) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
  }
}

export default function HalftoneBackground({
  className,
  children,
  src,
  cell = 9,
  angle = 45,
  loupe = true,
}: HalftoneBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(root && canvas && ctx && inkRef.current)) {
      return;
    }
    const inkEl = inkRef.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const pitch = Math.max(cell, 4);
    const theta = (angle * Math.PI) / 180;

    // The full print, drawn once per size or theme, then copied each frame.
    const base = document.createElement("canvas");
    const baseCtx = base.getContext("2d");
    const probe = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    if (!(baseCtx && probe)) {
      return;
    }

    let width = 0;
    let height = 0;
    let dpr = 1;
    let field: Field | null = null;
    let image: HTMLImageElement | null = null;
    let ink = "";
    let invert = false;
    let raf = 0;
    let last = 0;
    let visible = true;
    let introStart = reduceMotion ? -1 : 0;
    const lens = { x: 0, y: 0, tx: 0, ty: 0, r: 0, target: 0, placed: false };

    const readTheme = () => {
      const color = getComputedStyle(inkEl).color;
      // Light ink means a dark page: print the light, not the shadow, so
      // the picture still reads the right way round. Read through a 1px
      // canvas, which understands any CSS color, oklch included.
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = color;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
      const key = `${color}|${light}`;
      if (key === ink) {
        return false;
      }
      ink = key;
      invert = light;
      return true;
    };

    const introGrow = (now: number) => {
      if (introStart === 0) {
        // Waiting to scroll into view: nothing printed yet.
        return () => 0;
      }
      if (introStart < 0) {
        return undefined;
      }
      const t = (now - introStart) / INTRO_MS;
      // A diagonal sweep, each dot easing out as the front passes it.
      return (x: number, y: number) => {
        const front = t * 1.5 - (x + y) / (width + height);
        const k = Math.min(Math.max(front * 3, 0), 1);
        return 1 - (1 - k) ** 3;
      };
    };

    const renderBase = (now = performance.now()) => {
      if (!field) {
        return;
      }
      baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseCtx.clearRect(0, 0, width, height);
      baseCtx.fillStyle = getComputedStyle(inkEl).color;
      baseCtx.beginPath();
      screen(baseCtx, field, {
        width,
        height,
        cell: pitch,
        angle: theta,
        grow: introGrow(now),
      });
      baseCtx.fill();
    };

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0);
      if (!field || lens.r < 1) {
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Under the loupe: clear the coarse print, then print finer.
      ctx.save();
      ctx.beginPath();
      ctx.arc(lens.x, lens.y, lens.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.clearRect(lens.x - lens.r, lens.y - lens.r, lens.r * 2, lens.r * 2);
      ctx.fillStyle = getComputedStyle(inkEl).color;
      ctx.beginPath();
      const size = lens.r * 2 + pitch;
      const fine = pitch / LOUPE_DETAIL;
      ctx.translate(lens.x - size / 2, lens.y - size / 2);
      const local: Field = (x, y) =>
        (field as Field)(x + lens.x - size / 2, y + lens.y - size / 2);
      screen(ctx, local, {
        width: size,
        height: size,
        cell: fine,
        angle: theta,
      });
      ctx.fill();
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.beginPath();
      ctx.arc(lens.x, lens.y, lens.r - 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = getComputedStyle(inkEl).color;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        return;
      }
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      base.width = canvas.width;
      base.height = canvas.height;
      field =
        (image?.complete && image.naturalWidth > 0
          ? imageField(image, width, height, invert)
          : null) ?? sphereField(width, height, invert);
      renderBase();
      draw();
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible) {
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
      last = now;
      let busy = false;
      if (introStart > 0) {
        renderBase(now);
        if (now - introStart > INTRO_MS * 1.6) {
          introStart = -1;
          renderBase(now);
        } else {
          busy = true;
        }
      }
      const k = 1 - Math.exp(-dt / LOUPE_LAG);
      lens.x += (lens.tx - lens.x) * k;
      lens.y += (lens.ty - lens.y) * k;
      // The loupe opens and closes quickly, and never from nothing.
      lens.r += (lens.target - lens.r) * (1 - Math.exp(-dt / 0.06));
      if (lens.target === 0 && lens.r < LOUPE * 0.4) {
        lens.r = 0;
      }
      busy ||=
        Math.abs(lens.tx - lens.x) + Math.abs(lens.ty - lens.y) > 0.3 ||
        Math.abs(lens.target - lens.r) > 0.3;
      draw();
      if (busy) {
        raf = requestAnimationFrame(frame);
      }
    };

    const start = () => {
      if (!raf && visible) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    readTheme();
    canvas.style.opacity = "1";

    if (src) {
      image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => {
        build();
        start();
      };
      image.src = src;
    }
    build();

    let size = "";
    const resizeObserver = new ResizeObserver(() => {
      const next = `${canvas.clientWidth}x${canvas.clientHeight}`;
      if (next !== size) {
        size = next;
        build();
      }
    });
    resizeObserver.observe(canvas);

    // A tab coming back must not wake a background that's scrolled away.
    let onScreen = true;
    const intersection = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        visible = onScreen && document.visibilityState === "visible";
        if (visible && introStart === 0 && entry.intersectionRatio > 0.3) {
          introStart = performance.now();
        }
        start();
      },
      { threshold: [0, 0.3] }
    );
    intersection.observe(root);
    const onVisibility = () => {
      visible = onScreen && document.visibilityState === "visible";
      start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Follow light and dark mode without asking the app for a theme. Only
    // checked while the background is on screen.
    const themeTimer = window.setInterval(() => {
      if (!visible) {
        return;
      }
      if (readTheme()) {
        build();
      }
    }, 500);

    const place = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      lens.tx = event.clientX - rect.left;
      lens.ty = event.clientY - rect.top;
      if (!lens.placed || reduceMotion) {
        lens.x = lens.tx;
        lens.y = lens.ty;
        lens.placed = true;
      }
      lens.target = LOUPE;
      if (reduceMotion) {
        lens.r = LOUPE;
      }
      start();
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || event.buttons) {
        place(event);
      }
    };
    const onHide = () => {
      lens.target = 0;
      lens.placed = false;
      if (reduceMotion) {
        lens.r = 0;
      }
      start();
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        onHide();
      }
    };
    if (loupe) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerdown", place);
      root.addEventListener("pointerup", onUp);
      root.addEventListener("pointercancel", onHide);
      root.addEventListener("pointerleave", onHide);
    }

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(themeTimer);
      if (image) {
        image.onload = null;
      }
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", place);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onHide);
      root.removeEventListener("pointerleave", onHide);
    };
  }, [src, cell, angle, loupe]);

  return (
    <div
      className={cn(
        "@container relative flex min-h-[560px] w-full touch-pan-y items-center overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      ref={rootRef}
    >
      {/* Ink color for the canvas, so the dots follow the theme. */}
      <span className="hidden text-zinc-900 dark:text-zinc-300" ref={inkRef} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <canvas
          className="h-full w-full opacity-0 transition-opacity duration-300 ease-out"
          ref={canvasRef}
        />
      </div>
      {children === undefined ? <DefaultContent /> : children}
    </div>
  );
}

function DefaultContent() {
  return (
    <div className="pointer-events-none relative @3xl:mx-0 mx-auto flex max-w-md flex-col @3xl:items-start items-center gap-4 self-end @3xl:self-center px-6 @3xl:pb-0 pb-16 @3xl:pl-16 @3xl:text-left text-center">
      <h1 className="font-semibold @3xl:text-5xl text-4xl tracking-tight">
        Printed in dots
      </h1>
      <p className="max-w-sm text-base text-zinc-600 dark:text-zinc-400">
        Any picture as a halftone screen. Hover or drag across it to look closer
        through the loupe.
      </p>
    </div>
  );
}
