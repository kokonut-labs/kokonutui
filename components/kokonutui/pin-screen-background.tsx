"use client";

/**
 * @author: @dorianbaffier
 * @description: Pin Screen Background
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface PinScreenBackgroundProps {
  className?: string;
  /** Content shown over the pins. Pass `null` for a bare background. */
  children?: ReactNode;
  /** Distance between pins, in px. */
  spacing?: number;
  /** How long a pressed shape holds, 0 to 1. Higher settles slower. */
  hold?: number;
  /** Press the pins with the cursor. */
  interactive?: boolean;
}

/** Depth is drawn from this many pre-rendered pins. */
const LEVELS = 24;
/** Reach of the hand, in px, and how far a press goes. */
const HAND = 74;
const PRESS_HAND = 120;
/** Below this the board is flat and the loop sleeps. */
const REST = 0.004;

interface Palette {
  pin: string;
  lit: string;
  shade: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** "rgb(…)" from any CSS color, via a 1px canvas. */
function toRgb(color: string, probe: CanvasRenderingContext2D) {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b] as const;
}

/**
 * One pin at each depth: a round head, lit from the top left, that rides up
 * and away from its shadow as it's pushed out.
 */
function makeSprites(
  size: number,
  dpr: number,
  palette: Palette,
  probe: CanvasRenderingContext2D
) {
  const pin = toRgb(palette.pin, probe);
  const lit = toRgb(palette.lit, probe);
  const shade = toRgb(palette.shade, probe);
  const ink = (alpha: number) =>
    `rgba(${shade[0]},${shade[1]},${shade[2]},${alpha})`;
  // Twice the cell, so a pin standing proud can lean out of its own square.
  const box = size * 2;
  const px = Math.ceil(box * dpr);
  const sprites: HTMLCanvasElement[] = [];
  for (let level = 0; level < LEVELS; level++) {
    const d = level / (LEVELS - 1);
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      continue;
    }
    ctx.scale(dpr, dpr);
    const c = box / 2;
    const r = size * 0.18;
    const lift = d * size * 0.42;
    const head = r * (1 + d * 0.35);
    const hx = c - lift * 0.6;
    const hy = c - lift * 0.8;
    // The hole it sits in.
    ctx.fillStyle = ink(0.1);
    ctx.beginPath();
    ctx.arc(c, c, r + 0.8, 0, Math.PI * 2);
    ctx.fill();
    if (d > 0) {
      // Shadow, thrown down and right, longer and softer the further out.
      ctx.filter = `blur(${(d * 1.6).toFixed(2)}px)`;
      ctx.fillStyle = ink(0.1 + d * 0.22);
      ctx.beginPath();
      ctx.ellipse(
        c + lift * 0.9,
        c + lift * 1.1,
        head,
        head * 0.9,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.filter = "none";
      // The shaft, from the hole up to the head.
      ctx.strokeStyle = ink(0.18 + d * 0.2);
      ctx.lineWidth = r * 0.45;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
    // The head, lighter as it comes toward the light, with a rim to hold it.
    const t = d ** 0.7;
    const color = [0, 1, 2].map((k) => Math.round(lerp(pin[k], lit[k], t)));
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.beginPath();
    ctx.arc(hx, hy, head, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink(0.06 + d * 0.16);
    ctx.lineWidth = 0.75;
    ctx.stroke();
    // A glint on the shoulder.
    ctx.fillStyle = `rgba(${lit[0]},${lit[1]},${lit[2]},${d})`;
    ctx.beginPath();
    ctx.arc(hx - head * 0.35, hy - head * 0.35, head * 0.3, 0, Math.PI * 2);
    ctx.fill();
    sprites.push(canvas);
  }
  return sprites;
}

/**
 * A pin-art board. Move across it and the pins push out under your hand,
 * then sink back slowly, so every pass leaves a trace that fades. Press and
 * hold to push a wider, deeper print. When nobody's touching it, a soft
 * shape drifts underneath.
 */
export default function PinScreenBackground({
  className,
  children,
  spacing = 16,
  hold = 0.6,
  interactive = true,
}: PinScreenBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pinRef = useRef<HTMLSpanElement>(null);
  const litRef = useRef<HTMLSpanElement>(null);
  const shadeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const probe = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    if (!(root && canvas && ctx && probe)) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // Per frame, a pin sinks back by this share of its height.
    const sink = lerp(0.03, 0.004, Math.min(1, Math.max(0, hold)));

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let depth = new Float32Array(0);
    let sprites: HTMLCanvasElement[] = [];
    let colors = "";
    let raf = 0;
    let running = false;
    let visible = true;
    let time = 0;
    const hand = { x: 0, y: 0, on: false, down: false, idle: 0 };

    const readPalette = (): Palette => ({
      pin: getComputedStyle(pinRef.current ?? root).color,
      lit: getComputedStyle(litRef.current ?? root).color,
      shade: getComputedStyle(shadeRef.current ?? root).color,
    });

    const refreshSprites = () => {
      const palette = readPalette();
      const key = `${palette.pin}|${palette.lit}|${palette.shade}`;
      if (key === colors) {
        return false;
      }
      colors = key;
      sprites = makeSprites(
        spacing,
        window.devicePixelRatio || 1,
        palette,
        probe
      );
      return true;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const ox = (width - (cols - 1) * spacing) / 2 - spacing;
      const oy = (height - (rows - 1) * spacing) / 2 - spacing;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const d = depth[j * cols + i];
          const sprite =
            sprites[Math.min(LEVELS - 1, Math.round(d * (LEVELS - 1)))];
          if (sprite) {
            ctx.drawImage(
              sprite,
              ox + i * spacing,
              oy + j * spacing,
              spacing * 2,
              spacing * 2
            );
          }
        }
      }
    };

    /** Push out every pin under a soft round tool; pins never get pulled in. */
    const press = (x: number, y: number, radius: number, strength: number) => {
      const ox = (width - (cols - 1) * spacing) / 2;
      const oy = (height - (rows - 1) * spacing) / 2;
      const i0 = Math.max(0, Math.floor((x - radius - ox) / spacing));
      const i1 = Math.min(cols - 1, Math.ceil((x + radius - ox) / spacing));
      const j0 = Math.max(0, Math.floor((y - radius - oy) / spacing));
      const j1 = Math.min(rows - 1, Math.ceil((y + radius - oy) / spacing));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dist = Math.hypot(ox + i * spacing - x, oy + j * spacing - y);
          if (dist >= radius) {
            continue;
          }
          const t = 1 - dist / radius;
          const target = strength * t * t * (3 - 2 * t);
          const k = j * cols + i;
          if (target > depth[k]) {
            depth[k] += (target - depth[k]) * 0.45;
          }
        }
      }
    };

    const step = () => {
      time += 1 / 60;
      hand.idle += 1 / 60;
      if (hand.on) {
        press(
          hand.x,
          hand.y,
          hand.down ? PRESS_HAND : HAND,
          hand.down ? 1 : 0.7
        );
      } else if (hand.idle > 1.5) {
        // Nobody here: a palm drifts slowly underneath.
        const x = width * (0.5 + 0.34 * Math.sin(time * 0.23));
        const y = height * (0.5 + 0.3 * Math.sin(time * 0.31 + 1.2));
        press(x, y, Math.min(width, height) * 0.2, 0.75);
      }
      let peak = 0;
      for (let k = 0; k < depth.length; k++) {
        depth[k] = Math.max(0, depth[k] - depth[k] * sink - 0.0004);
        peak = Math.max(peak, depth[k]);
      }
      return peak;
    };

    const frame = () => {
      raf = 0;
      const peak = step();
      draw();
      // The drift keeps it awake; with nothing pressing, it sleeps flat.
      if (visible && (peak > REST || hand.on || hand.idle > 1.5)) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    };

    const start = () => {
      if (!(running || reduceMotion) && visible) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / spacing) + 1;
      rows = Math.ceil(height / spacing) + 1;
      depth = new Float32Array(cols * rows);
      if (reduceMotion) {
        // A still print instead of the drift.
        press(width * 0.72, height * 0.38, Math.min(width, height) * 0.24, 0.6);
        press(
          width * 0.28,
          height * 0.66,
          Math.min(width, height) * 0.16,
          0.45
        );
      }
      colors = "";
      refreshSprites();
      draw();
      canvas.style.opacity = "1";
      start();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    });
    intersection.observe(root);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Follow the theme without wiring into one.
    const colorTimer = window.setInterval(() => {
      if (refreshSprites()) {
        draw();
      }
    }, 500);

    const local = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onMove = (event: PointerEvent) => {
      const p = local(event);
      hand.x = p.x;
      hand.y = p.y;
      hand.on = event.pointerType === "mouse" || hand.down;
      hand.idle = 0;
      start();
    };
    const onLeave = () => {
      hand.on = false;
      hand.down = false;
    };
    const onDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("a, button, input, textarea")) {
        return;
      }
      const p = local(event);
      hand.x = p.x;
      hand.y = p.y;
      hand.on = true;
      hand.down = true;
      hand.idle = 0;
      start();
    };
    const onUp = (event: PointerEvent) => {
      hand.down = false;
      hand.on = event.pointerType === "mouse";
    };
    if (interactive && !reduceMotion) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
      root.addEventListener("pointerdown", onDown);
      root.addEventListener("pointerup", onUp);
      root.addEventListener("pointercancel", onUp);
    }

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(colorTimer);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
    };
  }, [spacing, hold, interactive]);

  return (
    <div
      className={cn(
        "relative flex min-h-[560px] w-full touch-pan-y items-center justify-center overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      ref={rootRef}
    >
      {/* Theme colors for the pins: at rest, pushed out, and their shadow. */}
      <span className="hidden text-zinc-200 dark:text-zinc-800" ref={pinRef} />
      <span className="hidden text-white dark:text-zinc-300" ref={litRef} />
      <span className="hidden text-zinc-900 dark:text-black" ref={shadeRef} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <canvas
          className="h-full w-full opacity-0 transition-opacity duration-700 ease-out"
          ref={canvasRef}
        />
      </div>
      {children === undefined ? <DefaultContent /> : children}
    </div>
  );
}

function DefaultContent() {
  return (
    <div className="pointer-events-none relative flex max-w-xl flex-col items-center gap-4 px-6 text-center">
      <h1 className="font-semibold text-4xl tracking-tight sm:text-5xl">
        Leave an impression
      </h1>
      <p className="max-w-sm text-base text-zinc-500 dark:text-zinc-400">
        A board of pins that push out under your hand and sink back slowly.
        Press and hold to make a deeper print.
      </p>
    </div>
  );
}
