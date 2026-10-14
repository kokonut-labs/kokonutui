"use client";

/**
 * @author: @dorianbaffier
 * @description: Extruded Text
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type HTMLAttributes, type RefObject, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SwooshTextProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  text?: string;
  /** Element to render, e.g. "h1" for a heading. */
  as?: "div" | "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** Stacked layers behind each letter (clamped to 6-16). */
  depth?: number;
  /** Total extrusion length, in em. */
  length?: number;
  /** Optional color for the deepest layer only, e.g. "#f97316". */
  accent?: string;
}

// Spring for the light direction. Under-damped on purpose: a fast flick
// swings the extrusion past its target before it settles.
const LIGHT_STIFFNESS = 170;
const LIGHT_DAMPING = 13;
// How much of the pointer's velocity is carried into the spring.
const LIGHT_KICK = 9;
const LIGHT_MAX_SPEED = 30;
const LIGHT_MAX_LENGTH = 1.35;
// Spring for each keycap, close to critical so letters sink without wobble.
const KEY_STIFFNESS = 420;
const KEY_DAMPING = 34;
// How far a fully pressed key sinks into its extrusion (fraction of depth).
const MAX_SINK = 0.72;
// Falloff radius of the press wave, in multiples of the font size.
const PRESS_RADIUS = 0.75;
// Rest: light from the top-left, extrusion toward the bottom-right (45°).
const REST = Math.SQRT1_2;
const EPSILON = 0.0008;
const WHITESPACE = /\s+/;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Splits into user-perceived characters, so emoji and accents stay whole. */
function splitGraphemes(value: string): string[] {
  return segmenter
    ? Array.from(segmenter.segment(value), (s) => s.segment)
    : Array.from(value);
}

interface Key {
  x: number;
  y: number;
  p: number;
  v: number;
  // Layers deepest first, then the face (index 0) last.
  layers: HTMLSpanElement[];
  // Last value written, so unchanged keys are skipped.
  drawn: string;
}

interface Sim {
  lx: number;
  ly: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  // Pointer in client coordinates, or null when it is away.
  px: number | null;
  py: number | null;
  pressed: number;
  fontSize: number;
  depth: number;
  step: number;
  keys: Key[];
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function clamp(value: number, max: number) {
  return Math.max(-max, Math.min(max, value));
}

function lightTarget(sim: Sim, rect: DOMRect): [number, number] {
  if (sim.px === null || sim.py === null) {
    return [REST, REST];
  }
  // The extrusion points away from the light (the pointer). Near the centre
  // the light is overhead, so the extrusion shortens instead of flipping.
  const dx = rect.left + rect.width / 2 - sim.px;
  const dy = rect.top + rect.height / 2 - sim.py;
  const reach = Math.max(Math.hypot(dx, dy), sim.fontSize * 0.9);
  return [dx / reach, dy / reach];
}

function stepLight(sim: Sim, dt: number) {
  sim.vx += ((sim.tx - sim.lx) * LIGHT_STIFFNESS - sim.vx * LIGHT_DAMPING) * dt;
  sim.vy += ((sim.ty - sim.ly) * LIGHT_STIFFNESS - sim.vy * LIGHT_DAMPING) * dt;
  sim.lx += sim.vx * dt;
  sim.ly += sim.vy * dt;
  // Keep a wild flick from stretching the extrusion too far.
  const length = Math.hypot(sim.lx, sim.ly);
  if (length > LIGHT_MAX_LENGTH) {
    sim.lx = (sim.lx / length) * LIGHT_MAX_LENGTH;
    sim.ly = (sim.ly / length) * LIGHT_MAX_LENGTH;
  }
  const moving =
    Math.abs(sim.tx - sim.lx) > EPSILON ||
    Math.abs(sim.ty - sim.ly) > EPSILON ||
    Math.hypot(sim.vx, sim.vy) > EPSILON;
  if (!moving) {
    sim.lx = sim.tx;
    sim.ly = sim.ty;
    sim.vx = 0;
    sim.vy = 0;
  }
  return moving;
}

function keyTarget(sim: Sim, index: number, dx: number, dy: number) {
  if (index === sim.pressed) {
    return 1;
  }
  if (sim.px === null) {
    return 0;
  }
  const distance = Math.hypot(dx, dy) / (sim.fontSize * PRESS_RADIUS);
  return distance > 2.5 ? 0 : Math.exp(-distance * distance);
}

function stepKeys(sim: Sim, dt: number, rect: DOMRect) {
  let moving = false;
  const x = (sim.px ?? 0) - rect.left;
  const y = (sim.py ?? 0) - rect.top;
  for (let i = 0; i < sim.keys.length; i++) {
    const key = sim.keys[i];
    const target = keyTarget(sim, i, x - key.x, y - key.y) * MAX_SINK;
    key.v += ((target - key.p) * KEY_STIFFNESS - key.v * KEY_DAMPING) * dt;
    key.p += key.v * dt;
    if (Math.abs(target - key.p) < EPSILON && Math.abs(key.v) < EPSILON) {
      key.p = target;
      key.v = 0;
    } else {
      moving = true;
    }
  }
  return moving;
}

// Layer `index` sits `index` steps deep. As the key sinks (p → 1) the
// column compresses toward the deepest layer, which never moves.
function layerTransform(
  index: number,
  depth: number,
  step: number,
  light: [number, number],
  p: number
) {
  const offset = (index + (depth - index) * p) * step;
  return `translate3d(${round(light[0] * offset)}em, ${round(light[1] * offset)}em, 0)`;
}

// Writes transforms straight onto each layer. Changing a custom property on
// the root instead would restyle every descendant each frame (~10x slower).
function drawKeys(sim: Sim) {
  const light: [number, number] = [round(sim.lx), round(sim.ly)];
  for (const key of sim.keys) {
    const p = round(Math.max(0, key.p));
    const signature = `${light[0]},${light[1]},${p}`;
    if (signature === key.drawn) {
      continue;
    }
    key.drawn = signature;
    const count = key.layers.length;
    for (let j = 0; j < count; j++) {
      key.layers[j].style.transform = layerTransform(
        count - 1 - j,
        sim.depth,
        sim.step,
        light,
        p
      );
    }
  }
}

const REST_LIGHT: [number, number] = [REST, REST];

function layerColor(index: number, depth: number, accent?: string) {
  if (index === depth && accent) {
    return accent;
  }
  const t = Math.round(((index - 1) / Math.max(1, depth - 1)) * 100);
  return `color-mix(in oklab, var(--ex-far) ${t}%, var(--ex-near))`;
}

function Letter({
  char,
  depth,
  step,
  accent,
}: {
  char: string;
  depth: number;
  step: number;
  accent?: string;
}) {
  // Deepest layer first so the face paints on top.
  const layers = Array.from({ length: depth }, (_, i) => depth - i);
  return (
    <span className="relative inline-block" data-key="">
      {layers.map((i) => (
        <span
          className="absolute inset-0"
          key={i}
          style={{
            color: layerColor(i, depth, accent),
            transform: layerTransform(i, depth, step, REST_LIGHT, 0),
          }}
        >
          {char}
        </span>
      ))}
      <span
        className="relative inline-block text-[var(--ex-face)]"
        style={{ transform: layerTransform(0, depth, step, REST_LIGHT, 0) }}
      >
        {char}
      </span>
    </span>
  );
}

function measureKeys(root: HTMLElement, sim: Sim) {
  const rect = root.getBoundingClientRect();
  sim.fontSize = Number.parseFloat(getComputedStyle(root).fontSize) || 16;
  const els = root.querySelectorAll<HTMLSpanElement>("[data-key]");
  sim.keys = Array.from(els, (el, i) => {
    const r = el.getBoundingClientRect();
    const previous = sim.keys[i];
    return {
      layers: Array.from(el.children) as HTMLSpanElement[],
      drawn: "",
      x: r.left - rect.left + r.width / 2,
      y: r.top - rect.top + r.height / 2,
      p: previous?.p ?? 0,
      v: previous?.v ?? 0,
    };
  });
}

function nearestKey(sim: Sim, x: number, y: number) {
  let best = -1;
  let bestDistance = sim.fontSize * 0.8;
  for (let i = 0; i < sim.keys.length; i++) {
    const d = Math.hypot(sim.keys[i].x - x, sim.keys[i].y - y);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  }
  return best;
}

function createSim(depth: number, step: number): Sim {
  return {
    lx: REST,
    ly: REST,
    vx: 0,
    vy: 0,
    tx: REST,
    ty: REST,
    px: null,
    py: null,
    pressed: -1,
    fontSize: 16,
    depth,
    step,
    keys: [],
  };
}

function useExtrusion(
  rootRef: RefObject<HTMLElement | null>,
  text: string,
  depth: number,
  step: number
) {
  useEffect(() => {
    const root = rootRef.current;
    // `text` is read so the effect re-runs (and re-measures) when it changes.
    if (!root || text === "") {
      return;
    }
    // Reduced motion keeps the fixed 45° extrusion from the first render.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const sim = createSim(depth, step);
    let frame = 0;
    let last = 0;
    let visible = true;
    let onScreen = true;

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const rect = root.getBoundingClientRect();
      [sim.tx, sim.ty] = lightTarget(sim, rect);
      const lightMoving = stepLight(sim, dt);
      const keysMoving = stepKeys(sim, dt, rect);
      drawKeys(sim);
      // Sleep once everything has settled, or while offscreen.
      if ((lightMoving || keysMoving) && visible) {
        frame = requestAnimationFrame(tick);
      } else {
        last = 0;
      }
    };

    const wake = () => {
      if (!frame && visible) {
        frame = requestAnimationFrame(tick);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (!visible) {
        return;
      }
      const rect = root.getBoundingClientRect();
      const [ax, ay] = lightTarget(sim, rect);
      sim.px = event.clientX;
      sim.py = event.clientY;
      const [bx, by] = lightTarget(sim, rect);
      // Carry the pointer's velocity into the spring so a flick swings it.
      sim.vx = clamp(sim.vx + (bx - ax) * LIGHT_KICK, LIGHT_MAX_SPEED);
      sim.vy = clamp(sim.vy + (by - ay) * LIGHT_KICK, LIGHT_MAX_SPEED);
      wake();
    };

    const onLeave = () => {
      sim.px = null;
      sim.py = null;
      sim.pressed = -1;
      wake();
    };

    const onDown = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      sim.pressed = nearestKey(
        sim,
        event.clientX - rect.left,
        event.clientY - rect.top
      );
      sim.px = event.clientX;
      sim.py = event.clientY;
      wake();
    };

    const onUp = (event: PointerEvent) => {
      sim.pressed = -1;
      // Touch has no hover: once the finger lifts, the light goes home.
      if (event.pointerType !== "mouse") {
        sim.px = null;
        sim.py = null;
      }
      wake();
    };

    const onVisibility = () => {
      visible = onScreen && !document.hidden;
      wake();
    };

    const measure = () => measureKeys(root, sim);
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    document.fonts?.ready.then(measure).catch(() => undefined);

    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      visible = onScreen && !document.hidden;
      wake();
    });
    intersection.observe(root);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [rootRef, text, depth, step]);
}

export default function SwooshText({
  text = "Extruded",
  as: Tag = "div",
  depth = 12,
  length = 0.2,
  accent,
  className,
  style,
  ...props
}: SwooshTextProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const layers = Math.round(Math.min(16, Math.max(6, depth)));
  const step = length / layers;
  useExtrusion(rootRef, text, layers, step);

  const words = text.split(WHITESPACE).filter(Boolean);

  return (
    <Tag
      className={cn(
        "relative touch-manipulation select-none font-bold text-5xl tracking-tight",
        "[--ex-face:var(--color-zinc-900)] [--ex-far:var(--color-zinc-600)] [--ex-near:var(--color-zinc-300)]",
        "dark:[--ex-face:var(--color-zinc-50)] dark:[--ex-far:var(--color-zinc-700)] dark:[--ex-near:var(--color-zinc-400)]",
        className
      )}
      ref={(node: HTMLElement | null) => {
        rootRef.current = node;
      }}
      style={style}
      {...props}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, w) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: words can repeat
          <span key={w}>
            {w > 0 ? " " : null}
            <span className="inline-block whitespace-nowrap">
              {splitGraphemes(word).map((char, c) => (
                <Letter
                  accent={accent}
                  char={char}
                  depth={layers}
                  // biome-ignore lint/suspicious/noArrayIndexKey: letters repeat
                  key={c}
                  step={step}
                />
              ))}
            </span>
          </span>
        ))}
      </span>
    </Tag>
  );
}
