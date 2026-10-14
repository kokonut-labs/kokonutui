// biome-ignore-all lint/suspicious/noBitwiseOperators: the noise hash is bit arithmetic.
"use client";

/**
 * @author: @dorianbaffier
 * @description: Dot Field
 * @version: 1.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface DotFieldProps {
  className?: string;
  /** Content shown over the field. Pass `null` for a bare background. */
  children?: ReactNode;
  /** Distance between dots, in px. */
  spacing?: number;
  /** Let a swipe push the dots and a click send a shockwave. */
  interactive?: boolean;
  /** Seed for the halftone pattern, so a page always opens on the same one. */
  seed?: number;
}

// Width of a light or dark patch in the idle halftone, in px.
const NOISE_SCALE = 240;
// How fast the halftone pattern drifts through time.
const NOISE_SPEED = 0.07;
// The noise is sampled on every third dot and blended in between.
const TONE_STEP = 3;
// The idle drift is slow; a frame every 33ms is plenty for it.
const IDLE_FRAME_MS = 33;
// The membrane. Each dot is pulled back to its rest point (ANCHOR), towards
// its four neighbours (COUPLING, which makes a disturbance travel as a wave)
// and loses speed to DAMPING. Units are per second squared.
const ANCHOR = 26;
const COUPLING = 340;
const DAMPING = 2.4;
// Physics runs in fixed steps so the springs behave the same at any refresh
// rate.
const STEP = 1 / 120;
// The pointer: radius it reaches (px), how much of its velocity it hands to
// the dots it passes (per second), and the fastest swipe it counts (px/s).
const POINTER_RADIUS = 72;
const POINTER_GAIN = 14;
const POINTER_MAX_SPEED = 2600;
// Share of the swipe speed that also pushes dots sideways, out of its path,
// so the wake opens into a V like water behind a boat.
const POINTER_PART = 0.45;
// A click: how fast the ring travels (px/s), how thick it is (px), how hard
// it shoves (px/s²) and how long it lives (s).
const SHOCK_SPEED = 620;
const SHOCK_WIDTH = 34;
const SHOCK_FORCE = 5200;
const SHOCK_LIFE = 1.3;
// Squeezed dots grow and stretched ones shrink, so the wake reads as a band
// of darker and lighter tone, like ink in a halftone print.
const COMPRESSION_GAIN = 3;
// Dot sizes are snapped to this many steps; each step is one path.
const BUCKETS = 10;
// Below these the field counts as settled and the physics sleeps.
const REST_SPEED = 2;
const REST_OFFSET = 0.15;

interface Shock {
  x: number;
  y: number;
  age: number;
}

interface Pointer {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  inside: boolean;
}

/** Seeded 3D gradient noise (Ken Perlin's improved noise), about -1 to 1. */
function createNoise(seed: number) {
  const p = Array.from({ length: 256 }, (_, i) => i);
  let state = seed >>> 0 || 1;
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const grad = (hash: number, x: number, y: number, z: number) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    let v = z;
    if (h < 4) {
      v = y;
    } else if (h === 12 || h === 14) {
      v = x;
    }
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };

  return (x: number, y: number, z: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const fz = z - Math.floor(z);
    const u = fade(fx);
    const v = fade(fy);
    const w = fade(fz);
    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;
    return lerp(
      lerp(
        lerp(grad(perm[AA], fx, fy, fz), grad(perm[BA], fx - 1, fy, fz), u),
        lerp(
          grad(perm[AB], fx, fy - 1, fz),
          grad(perm[BB], fx - 1, fy - 1, fz),
          u
        ),
        v
      ),
      lerp(
        lerp(
          grad(perm[AA + 1], fx, fy, fz - 1),
          grad(perm[BA + 1], fx - 1, fy, fz - 1),
          u
        ),
        lerp(
          grad(perm[AB + 1], fx, fy - 1, fz - 1),
          grad(perm[BB + 1], fx - 1, fy - 1, fz - 1),
          u
        ),
        v
      ),
      w
    );
  };
}

/** The grid of dots and the state of every spring, in flat arrays. */
interface Field {
  cols: number;
  rows: number;
  spacing: number;
  originX: number;
  originY: number;
  /** Idle size of each dot from the noise, 0 to 1. */
  tone: Float32Array;
  /** The noise on a coarser grid, blended into `tone`. */
  coarse: Float32Array;
  ox: Float32Array;
  oy: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  ax: Float32Array;
  ay: Float32Array;
}

function createField(width: number, height: number, spacing: number): Field {
  // One extra dot past each edge, so the membrane has no visible border.
  const cols = Math.ceil(width / spacing) + 3;
  const rows = Math.ceil(height / spacing) + 3;
  const size = cols * rows;
  return {
    cols,
    rows,
    spacing,
    originX: (width - (cols - 1) * spacing) / 2,
    originY: (height - (rows - 1) * spacing) / 2,
    tone: new Float32Array(size),
    coarse: new Float32Array(
      (Math.ceil((cols - 1) / TONE_STEP) + 1) *
        (Math.ceil((rows - 1) / TONE_STEP) + 1)
    ),
    ox: new Float32Array(size),
    oy: new Float32Array(size),
    vx: new Float32Array(size),
    vy: new Float32Array(size),
    ax: new Float32Array(size),
    ay: new Float32Array(size),
  };
}

/**
 * The idle halftone. The noise is smooth over a few hundred px, so it is
 * sampled on every TONE_STEP-th dot and blended in between, which costs a
 * ninth of sampling every dot.
 */
function sampleTone(
  field: Field,
  noise: (x: number, y: number, z: number) => number,
  time: number
) {
  const { cols, rows, spacing, originX, originY, tone, coarse } = field;
  const z = time * NOISE_SPEED;
  const step = spacing * TONE_STEP;
  const coarseCols = Math.ceil((cols - 1) / TONE_STEP) + 1;
  const coarseRows = Math.ceil((rows - 1) / TONE_STEP) + 1;
  for (let j = 0; j < coarseRows; j++) {
    const ny = (originY + j * step) / NOISE_SCALE;
    for (let i = 0; i < coarseCols; i++) {
      const nx = (originX + i * step) / NOISE_SCALE;
      const n =
        noise(nx, ny, z) * 0.75 +
        noise(nx * 2.1 + 9.3, ny * 2.1 + 3.7, z * 1.3) * 0.25;
      coarse[j * coarseCols + i] = Math.min(1, Math.max(0, 0.5 + n * 1.1));
    }
  }
  for (let j = 0; j < rows; j++) {
    const cj = Math.min(Math.floor(j / TONE_STEP), coarseRows - 2);
    const fy = j / TONE_STEP - cj;
    for (let i = 0; i < cols; i++) {
      const ci = Math.min(Math.floor(i / TONE_STEP), coarseCols - 2);
      const fx = i / TONE_STEP - ci;
      const a = cj * coarseCols + ci;
      const top = coarse[a] + (coarse[a + 1] - coarse[a]) * fx;
      const bottom =
        coarse[a + coarseCols] +
        (coarse[a + coarseCols + 1] - coarse[a + coarseCols]) * fx;
      tone[j * cols + i] = top + (bottom - top) * fy;
    }
  }
}

/** Sum of the four neighbours; past the border counts as a still dot. */
function neighbours(
  values: Float32Array,
  field: Field,
  i: number,
  j: number
): number {
  const { cols, rows } = field;
  const k = j * cols + i;
  let sum = 0;
  if (i > 0) {
    sum += values[k - 1];
  }
  if (i < cols - 1) {
    sum += values[k + 1];
  }
  if (j > 0) {
    sum += values[k - cols];
  }
  if (j < rows - 1) {
    sum += values[k + cols];
  }
  return sum;
}

/** Spring force on every dot: back to rest, towards neighbours, damping. */
function accelerate(field: Field) {
  const { cols, rows, ox, oy, vx, vy, ax, ay } = field;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const sx = neighbours(ox, field, i, j);
      const sy = neighbours(oy, field, i, j);
      ax[k] += -ANCHOR * ox[k] + COUPLING * (sx - 4 * ox[k]) - DAMPING * vx[k];
      ay[k] += -ANCHOR * oy[k] + COUPLING * (sy - 4 * oy[k]) - DAMPING * vy[k];
    }
  }
}

/** A ring travelling out from each click, shoving the dots it crosses. */
function applyShocks(field: Field, shocks: Shock[]) {
  const { cols, rows, spacing, originX, originY, ax, ay } = field;
  for (const shock of shocks) {
    const reach = shock.age * SHOCK_SPEED;
    const fade = 1 - shock.age / SHOCK_LIFE;
    const force = SHOCK_FORCE * fade * fade;
    const outer = reach + SHOCK_WIDTH;
    const inner = Math.max(0, reach - SHOCK_WIDTH);
    // Only the rows and columns the ring's box touches.
    const i0 = Math.max(0, Math.floor((shock.x - outer - originX) / spacing));
    const i1 = Math.min(
      cols - 1,
      Math.ceil((shock.x + outer - originX) / spacing)
    );
    const j0 = Math.max(0, Math.floor((shock.y - outer - originY) / spacing));
    const j1 = Math.min(
      rows - 1,
      Math.ceil((shock.y + outer - originY) / spacing)
    );
    for (let j = j0; j <= j1; j++) {
      const dy = originY + j * spacing - shock.y;
      for (let i = i0; i <= i1; i++) {
        const dx = originX + i * spacing - shock.x;
        const dist = Math.hypot(dx, dy);
        if (dist < inner || dist > outer || dist === 0) {
          continue;
        }
        const band = 1 - Math.abs(dist - reach) / SHOCK_WIDTH;
        const k = j * cols + i;
        ax[k] += (dx / dist) * force * band;
        ay[k] += (dy / dist) * force * band;
      }
    }
  }
}

/**
 * The pointer hands part of its velocity to the dots near the path it took
 * since the last frame. A slow drift barely stirs them; a fast swipe drags
 * a strip of the membrane along, and the springs turn that into a wake.
 */
function applyPointer(field: Field, pointer: Pointer, dt: number) {
  const segX = pointer.x - pointer.lastX;
  const segY = pointer.y - pointer.lastY;
  pointer.lastX = pointer.x;
  pointer.lastY = pointer.y;
  const length = Math.hypot(segX, segY);
  if (!pointer.inside || length < 0.5 || dt <= 0) {
    return false;
  }
  const speed = Math.min(length / dt, POINTER_MAX_SPEED);
  const pvx = (segX / length) * speed;
  const pvy = (segY / length) * speed;
  const { cols, rows, spacing, originX, originY, vx, vy } = field;
  const startX = pointer.x - segX;
  const startY = pointer.y - segY;
  const minX = Math.min(startX, pointer.x) - POINTER_RADIUS;
  const maxX = Math.max(startX, pointer.x) + POINTER_RADIUS;
  const minY = Math.min(startY, pointer.y) - POINTER_RADIUS;
  const maxY = Math.max(startY, pointer.y) + POINTER_RADIUS;
  const i0 = Math.max(0, Math.floor((minX - originX) / spacing));
  const i1 = Math.min(cols - 1, Math.ceil((maxX - originX) / spacing));
  const j0 = Math.max(0, Math.floor((minY - originY) / spacing));
  const j1 = Math.min(rows - 1, Math.ceil((maxY - originY) / spacing));
  const lengthSq = length * length;
  const gain = Math.min(1, POINTER_GAIN * dt);
  for (let j = j0; j <= j1; j++) {
    const py = originY + j * spacing;
    for (let i = i0; i <= i1; i++) {
      const px = originX + i * spacing;
      // Distance from the dot to the swipe segment.
      const t = Math.min(
        1,
        Math.max(0, ((px - startX) * segX + (py - startY) * segY) / lengthSq)
      );
      const awayX = px - startX - segX * t;
      const awayY = py - startY - segY * t;
      const dist = Math.hypot(awayX, awayY);
      if (dist >= POINTER_RADIUS) {
        continue;
      }
      const falloff = 1 - dist / POINTER_RADIUS;
      const k = j * cols + i;
      const amount = gain * falloff * falloff;
      const side = dist > 0 ? (speed * POINTER_PART) / dist : 0;
      vx[k] += (pvx + awayX * side - vx[k]) * amount;
      vy[k] += (pvy + awayY * side - vy[k]) * amount;
    }
  }
  return true;
}

/** One fixed physics step. Returns whether anything is still moving. */
function integrate(field: Field, shocks: Shock[], h: number) {
  const { ox, oy, vx, vy, ax, ay } = field;
  ax.fill(0);
  ay.fill(0);
  applyShocks(field, shocks);
  accelerate(field);
  let moving = false;
  for (let k = 0; k < ox.length; k++) {
    vx[k] += ax[k] * h;
    vy[k] += ay[k] * h;
    ox[k] += vx[k] * h;
    oy[k] += vy[k] * h;
    if (
      !moving &&
      (Math.abs(vx[k]) > REST_SPEED ||
        Math.abs(vy[k]) > REST_SPEED ||
        Math.abs(ox[k]) > REST_OFFSET ||
        Math.abs(oy[k]) > REST_OFFSET)
    ) {
      moving = true;
    }
  }
  return moving;
}

/** How much the membrane is squeezed (+) or stretched (-) at one dot. */
function compression(field: Field, i: number, j: number) {
  const { cols, rows, spacing, ox, oy } = field;
  const k = j * cols + i;
  const left = i > 0 ? ox[k - 1] : 0;
  const right = i < cols - 1 ? ox[k + 1] : 0;
  const up = j > 0 ? oy[k - cols] : 0;
  const down = j < rows - 1 ? oy[k + cols] : 0;
  return -(right - left + down - up) / (2 * spacing);
}

/**
 * Draw every dot. Sizes are snapped to a few steps and each step is one
 * path, so the whole field is a handful of fills instead of thousands.
 */
function draw(
  ctx: CanvasRenderingContext2D,
  field: Field,
  size: { width: number; height: number; color: string },
  moving: boolean
) {
  const { cols, rows, spacing, originX, originY, tone, ox, oy } = field;
  const maxRadius = spacing * 0.42;
  const paths = Array.from({ length: BUCKETS }, () => new Path2D());
  const filled = new Uint8Array(BUCKETS);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      let amount = 0.12 + 0.6 * tone[k];
      if (moving) {
        amount *= 1 + COMPRESSION_GAIN * compression(field, i, j);
      }
      const bucket = Math.round(
        Math.min(1, Math.max(0, amount)) * (BUCKETS - 1)
      );
      if (bucket === 0) {
        continue;
      }
      const radius = (maxRadius * bucket) / (BUCKETS - 1);
      const x = originX + i * spacing + ox[k];
      const y = originY + j * spacing + oy[k];
      const path = paths[bucket];
      path.moveTo(x + radius, y);
      path.arc(x, y, radius, 0, Math.PI * 2);
      filled[bucket] = 1;
    }
  }
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = size.color;
  for (let b = 1; b < BUCKETS; b++) {
    if (filled[b]) {
      // Larger dots are a touch more opaque, which deepens the tone range.
      ctx.globalAlpha = 0.2 + (0.32 * b) / (BUCKETS - 1);
      ctx.fill(paths[b]);
    }
  }
  ctx.globalAlpha = 1;
}

export default function DotField({
  className,
  children,
  spacing = 16,
  interactive = true,
  seed = 7,
}: DotFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(root && canvas && ctx)) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const noise = createNoise(seed);
    const gap = Math.max(6, spacing);
    const size = { width: 0, height: 0, color: "" };
    let field = createField(0, 0, gap);

    const pointer: Pointer = {
      x: 0,
      y: 0,
      lastX: 0,
      lastY: 0,
      inside: false,
    };
    const shocks: Shock[] = [];
    let time = 0;
    let last = 0;
    let lastTone = 0;
    let carry = 0;
    let awake = false;
    let raf = 0;
    let visible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size.width = rect.width;
      size.height = rect.height;
      canvas.width = Math.round(size.width * dpr);
      canvas.height = Math.round(size.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.color = getComputedStyle(canvas).color;
      field = createField(size.width, size.height, gap);
      sampleTone(field, noise, time);
      awake = false;
    };

    const physics = (dt: number) => {
      const pushed = applyPointer(field, pointer, dt);
      carry = Math.min(carry + dt, STEP * 6);
      let moving = pushed || shocks.length > 0;
      while (carry >= STEP) {
        carry -= STEP;
        for (const shock of shocks) {
          shock.age += STEP;
        }
        while (shocks.length > 0 && shocks[0].age > SHOCK_LIFE) {
          shocks.shift();
        }
        moving = integrate(field, shocks, STEP) || moving;
      }
      if (!(moving || shocks.length > 0)) {
        // Settled: put every dot exactly home and let the physics sleep.
        field.ox.fill(0);
        field.oy.fill(0);
        field.vx.fill(0);
        field.vy.fill(0);
        awake = false;
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible) {
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      time += dt;
      const wasAwake = awake;
      if (awake) {
        physics(dt);
      }
      const toneDue = now - lastTone >= IDLE_FRAME_MS;
      if (toneDue) {
        sampleTone(field, noise, time);
        lastTone = now;
      }
      // The drift alone gets about 30 frames a second; a wake gets every one.
      if (wasAwake || toneDue) {
        draw(ctx, field, size, wasAwake);
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf && visible && !reduceMotion) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    const wake = () => {
      if (!awake) {
        awake = true;
        carry = 0;
      }
      start();
    };

    resize();
    draw(ctx, field, size, false);
    canvas.style.opacity = "1";
    start();

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(ctx, field, size, false);
    });
    resizeObserver.observe(canvas);

    // Stop drawing entirely while the field is scrolled away or the tab is
    // in the background.
    let onScreen = true;
    const updateVisible = () => {
      visible = onScreen && document.visibilityState === "visible";
      if (visible) {
        start();
      }
    };
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      updateVisible();
    });
    intersection.observe(root);
    document.addEventListener("visibilitychange", updateVisible);

    // Follow light and dark mode without asking the app for a theme.
    const colorTimer = window.setInterval(() => {
      const next = getComputedStyle(canvas).color;
      if (next !== size.color) {
        size.color = next;
        if (reduceMotion) {
          draw(ctx, field, size, false);
        }
      }
    }, 500);

    const local = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onMove = (event: PointerEvent) => {
      const point = local(event);
      if (!pointer.inside) {
        // Start from where the pointer came in, not where it last left.
        pointer.lastX = point.x;
        pointer.lastY = point.y;
        pointer.inside = true;
      }
      pointer.x = point.x;
      pointer.y = point.y;
      if (
        Math.abs(pointer.x - pointer.lastX) > 0.5 ||
        Math.abs(pointer.y - pointer.lastY) > 0.5
      ) {
        wake();
      }
    };
    const onLeave = () => {
      pointer.inside = false;
    };
    const onDown = (event: PointerEvent) => {
      // Clicks on the content (links, buttons) are not meant for the field.
      if ((event.target as HTMLElement).closest("a, button, input, textarea")) {
        return;
      }
      const point = local(event);
      pointer.x = point.x;
      pointer.y = point.y;
      pointer.lastX = point.x;
      pointer.lastY = point.y;
      pointer.inside = true;
      shocks.push({ ...point, age: 0 });
      if (shocks.length > 3) {
        shocks.shift();
      }
      wake();
    };
    if (interactive && !reduceMotion) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
      root.addEventListener("pointerdown", onDown);
    }

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", updateVisible);
      window.clearInterval(colorTimer);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
    };
  }, [spacing, interactive, seed]);

  return (
    <div
      className={cn(
        "relative flex min-h-[560px] w-full items-center justify-center overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      ref={rootRef}
    >
      {/* Faded out at the edges so the field sits into the page around it. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <canvas
          className="h-full w-full opacity-0 transition-opacity duration-500 ease-out"
          ref={canvasRef}
          style={{
            // Fade at the edges, and quieter in the middle where the
            // content usually sits so text stays easy to read.
            maskImage:
              "radial-gradient(ellipse 75% 70% at 50% 50%, #000 40%, transparent 100%), radial-gradient(ellipse 34% 22% at 50% 50%, rgb(0 0 0 / 0.35), #000 100%)",
            maskComposite: "intersect",
          }}
        />
      </div>
      {children === undefined ? <DefaultContent /> : children}
    </div>
  );
}

function DefaultContent() {
  return (
    <div className="relative flex max-w-xl flex-col items-center gap-4 px-6 text-center">
      <h1 className="font-semibold text-4xl tracking-tight sm:text-5xl">
        Leave a mark
      </h1>
      <p className="max-w-sm text-base text-zinc-500 dark:text-zinc-400">
        A halftone membrane. Swipe fast to leave a wake, click to send a
        shockwave through it.
      </p>
    </div>
  );
}
