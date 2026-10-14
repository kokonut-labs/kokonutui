// biome-ignore-all lint/suspicious/noBitwiseOperators: the noise hash is bit arithmetic.
"use client";

/**
 * @author: @dorianbaffier
 * @description: Wind. Streamlines that part around the cursor, swirl in its wake and scatter on click.
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface FlowFieldProps {
  className?: string;
  /** Content drawn over the wind, such as a hero's heading. */
  children?: ReactNode;
  /** Multiplies the number of particles (about 700 at 1). */
  density?: number;
  /** How fast the wind blows. 0 holds a still frame. */
  speed?: number;
  /** The cursor parts the streams and stirs a wake; a click sends a gust. */
  interactive?: boolean;
}

// Particles at density 1. Narrow screens get fewer.
const BASE_COUNT = 700;
// Wind speed in px/s at speed 1, and the size of its bends (px).
const WIND = 64;
const NOISE_SCALE = 340;
// How far the wind may turn from left-to-right, in radians.
const TURN = 1.15;
// How quickly a particle takes up the local wind (per second). Lower values
// give them more momentum.
const RESPONSE = 9;
// Trails fade with this time constant (seconds).
const TRAIL_TAU = 0.22;
// The cursor is a disc of this radius (px) that the air flows around.
const DISC_RADIUS = 64;
const DISC_FOLLOW = 18;
const DISC_RISE = 7;
// Moving faster than this (px/s) sheds vortices behind the disc.
const SHED_SPEED = 150;
const SHED_MS = 42;
const MAX_VORTICES = 30;
// Each shed vortex: core radius (px), strength per px/s of cursor speed,
// how fast it weakens (s) and how fast its core spreads (s).
const VORTEX_CORE = 30;
const VORTEX_GAIN = 0.62 * Math.PI * 2 * VORTEX_CORE * 0.5;
const VORTEX_TAU = 1.1;
const VORTEX_SPREAD = 0.5;
const MAX_CURSOR_SPEED = 1600;
// A click sends a ring of wind outwards.
const GUST_MS = 1300;
const GUST_SPEED = 0.62; // px per ms
const GUST_WIDTH = 64;
const GUST_STRENGTH = 560; // px/s at the crest
// Four alpha levels: each is one stroked path, so a frame is four draw calls.
const BUCKETS = [0.18, 0.34, 0.54, 0.8] as const;
// Segments longer than this are a wrap or a push, not motion.
const MAX_SEGMENT = 40;
// The drift alone is slow; half the frame rate looks the same and costs
// half as much. Anything following the hand gets every frame.
const IDLE_FRAME_MS = 33;
// Destination-out can't fade the last few alpha levels in small steps, so
// while frames are short a stronger pass clears that residue once a second.
const CLEANUP_MS = 1000;
const CLEANUP_ALPHA = 0.24;
// The still frame used for reduced motion and speed 0.
const STILL_LINES = 340;
const STILL_STEPS = 18;
const STILL_DT = 0.05;

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

type Noise = ReturnType<typeof createNoise>;

/** The cursor, as a solid disc the air has to go around. */
interface Disc {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  /** 0 to 1: grows when the cursor arrives, shrinks when it leaves. */
  amount: number;
  on: boolean;
  lastShed: number;
  side: number;
}

/** A Lamb-Oseen vortex shed by the moving disc. */
interface Vortex {
  x: number;
  y: number;
  gamma: number;
  age: number;
}

interface Gust {
  x: number;
  y: number;
  start: number;
}

interface Air {
  noise: Noise;
  time: number;
  wind: number;
  disc: Disc;
  vortices: Vortex[];
  gusts: Gust[];
  now: number;
}

// Scratch vector the field functions write into, so a frame allocates
// nothing per particle.
const out = { x: 0, y: 0 };

/** The undisturbed wind: left to right, turned by slowly drifting noise. */
function baseWind(air: Air, x: number, y: number) {
  const t = air.time;
  const angle =
    air.noise((x - t * WIND * 0.6) / NOISE_SCALE, y / NOISE_SCALE, t * 0.06) *
    TURN;
  out.x = Math.cos(angle) * air.wind;
  out.y = Math.sin(angle) * air.wind;
}

/**
 * Potential flow around a disc: the local wind (relative to the moving disc)
 * plus a doublet, so streams split ahead of it, speed up round its sides and
 * close up behind. In complex form, u - iv = conj(w) - (w - V) R^2 / z^2.
 */
function addDisc(disc: Disc, x: number, y: number) {
  const radius = DISC_RADIUS * disc.amount;
  const dx = x - disc.x;
  const dy = y - disc.y;
  const r2 = Math.max(dx * dx + dy * dy, radius * radius);
  const k = (radius * radius) / (r2 * r2);
  const rx = out.x - disc.vx;
  const ry = out.y - disc.vy;
  const p = dx * dx - dy * dy;
  const q = -2 * dx * dy;
  out.x -= k * (rx * p - ry * q);
  out.y += k * (rx * q + ry * p);
}

function addVortices(vortices: Vortex[], x: number, y: number) {
  for (const v of vortices) {
    const dx = x - v.x;
    const dy = y - v.y;
    const r2 = dx * dx + dy * dy + 1;
    const core = VORTEX_CORE * VORTEX_CORE * (1 + v.age / VORTEX_SPREAD);
    const swirl =
      ((v.gamma * Math.exp(-v.age / VORTEX_TAU)) / (2 * Math.PI * r2)) *
      (1 - Math.exp(-r2 / core));
    out.x -= swirl * dy;
    out.y += swirl * dx;
  }
}

function addGusts(gusts: Gust[], now: number, x: number, y: number) {
  for (const g of gusts) {
    const age = now - g.start;
    const dx = x - g.x;
    const dy = y - g.y;
    const r = Math.hypot(dx, dy) + 0.001;
    const d = r - age * GUST_SPEED;
    const fadeOut = 1 - age / GUST_MS;
    const push =
      GUST_STRENGTH *
      fadeOut *
      fadeOut *
      Math.exp(-(d * d) / (2 * GUST_WIDTH * GUST_WIDTH));
    out.x += (push * dx) / r;
    out.y += (push * dy) / r;
  }
}

/** The air's velocity at one point, written into `out`. */
function velocityAt(air: Air, x: number, y: number) {
  baseWind(air, x, y);
  if (air.disc.amount > 0.002) {
    addDisc(air.disc, x, y);
  }
  if (air.vortices.length > 0) {
    addVortices(air.vortices, x, y);
  }
  if (air.gusts.length > 0) {
    addGusts(air.gusts, air.now, x, y);
  }
}

/** Glide the disc after the cursor and shed vortices off its sides. */
function stepDisc(disc: Disc, vortices: Vortex[], dt: number, now: number) {
  const px = disc.x;
  const py = disc.y;
  const follow = 1 - Math.exp(-DISC_FOLLOW * dt);
  disc.x += (disc.targetX - disc.x) * follow;
  disc.y += (disc.targetY - disc.y) * follow;
  const goal = disc.on ? 1 : 0;
  disc.amount += (goal - disc.amount) * (1 - Math.exp(-DISC_RISE * dt));
  if (disc.amount < 0.002 && !disc.on) {
    disc.amount = 0;
  }
  const smooth = 1 - Math.exp(-14 * dt);
  disc.vx += ((disc.x - px) / dt - disc.vx) * smooth;
  disc.vy += ((disc.y - py) / dt - disc.vy) * smooth;

  const speed = Math.hypot(disc.vx, disc.vy);
  if (
    speed < SHED_SPEED ||
    disc.amount < 0.5 ||
    now - disc.lastShed < SHED_MS
  ) {
    return;
  }
  disc.lastShed = now;
  disc.side = -disc.side;
  const ux = disc.vx / speed;
  const uy = disc.vy / speed;
  const radius = DISC_RADIUS * disc.amount;
  // Alternate sides, like the vortex street behind a cylinder. The air
  // dragged along the disc's flank sets which way each one spins.
  vortices.push({
    x: disc.x - ux * radius * 0.9 - uy * disc.side * radius * 0.55,
    y: disc.y - uy * radius * 0.9 + ux * disc.side * radius * 0.55,
    gamma: disc.side * VORTEX_GAIN * Math.min(speed, MAX_CURSOR_SPEED),
    age: 0,
  });
  if (vortices.length > MAX_VORTICES) {
    vortices.shift();
  }
}

/** Age the wake: vortices drift downwind and weaken until they're gone. */
function stepWake(air: Air, dt: number) {
  for (const v of air.vortices) {
    baseWind(air, v.x, v.y);
    v.x += out.x * 0.85 * dt;
    v.y += out.y * 0.85 * dt;
    v.age += dt;
  }
  while (air.vortices.length > 0 && air.vortices[0].age > VORTEX_TAU * 3.5) {
    air.vortices.shift();
  }
  while (air.gusts.length > 0 && air.now - air.gusts[0].start > GUST_MS) {
    air.gusts.shift();
  }
}

/** Particle state as flat arrays: cheap to walk 700 times a frame. */
class Particles {
  count = 0;
  x = new Float32Array(0);
  y = new Float32Array(0);
  vx = new Float32Array(0);
  vy = new Float32Array(0);
  life = new Float32Array(0);
  maxLife = new Float32Array(0);
  pace = new Float32Array(0);

  resize(count: number, width: number, height: number) {
    if (count === this.count) {
      return;
    }
    this.count = count;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.pace = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.spawn(i, width, height);
      // Start part way through their lives so they don't all fade together.
      this.life[i] = Math.random() * this.maxLife[i];
    }
  }

  spawn(i: number, width: number, height: number) {
    this.x[i] = Math.random() * width;
    this.y[i] = Math.random() * height;
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.life[i] = 0;
    this.maxLife[i] = 3 + Math.random() * 5;
    this.pace[i] = 0.75 + Math.random() * 0.5;
  }
}

/** Fade in at birth and out before respawning, so nothing pops. */
function envelope(life: number, maxLife: number) {
  return Math.min(1, life / 0.6, (maxLife - life) / 0.6);
}

function bucketOf(intensity: number) {
  return Math.max(0, Math.min(BUCKETS.length - 1, Math.floor(intensity * 4)));
}

/** Wrap a particle that blew off one edge back in on the opposite one. */
function wrap(v: number, size: number) {
  if (v < -8) {
    return v + size + 16;
  }
  if (v > size + 8) {
    return v - size - 16;
  }
  return v;
}

interface StepContext {
  air: Air;
  particles: Particles;
  paths: Path2D[];
  width: number;
  height: number;
  dt: number;
}

/** Push a particle the disc swept over back out to its surface. */
function keepOutOfDisc(p: Particles, i: number, disc: Disc) {
  if (disc.amount === 0) {
    return;
  }
  const radius = DISC_RADIUS * disc.amount;
  const dx = p.x[i] - disc.x;
  const dy = p.y[i] - disc.y;
  const r2 = dx * dx + dy * dy;
  if (r2 >= radius * radius || r2 < 0.0001) {
    return;
  }
  const r = Math.sqrt(r2);
  p.x[i] = disc.x + (dx / r) * radius;
  p.y[i] = disc.y + (dy / r) * radius;
}

function stepParticle(c: StepContext, i: number) {
  const { air, particles: p, dt } = c;
  p.life[i] += dt;
  if (p.life[i] > p.maxLife[i]) {
    p.spawn(i, c.width, c.height);
    return;
  }
  const x0 = p.x[i];
  const y0 = p.y[i];
  velocityAt(air, x0, y0);
  const take = 1 - Math.exp(-RESPONSE * dt);
  p.vx[i] += (out.x * p.pace[i] - p.vx[i]) * take;
  p.vy[i] += (out.y * p.pace[i] - p.vy[i]) * take;
  p.x[i] = wrap(x0 + p.vx[i] * dt, c.width);
  p.y[i] = wrap(y0 + p.vy[i] * dt, c.height);
  keepOutOfDisc(p, i, air.disc);

  const sx = p.x[i] - x0;
  const sy = p.y[i] - y0;
  if (sx * sx + sy * sy > MAX_SEGMENT * MAX_SEGMENT) {
    return;
  }
  // Faster air draws darker, so the wake and the flanks of the disc stand
  // out against the drift.
  const pace = Math.hypot(p.vx[i], p.vy[i]) / (air.wind * 2.4 + 1);
  const intensity = envelope(p.life[i], p.maxLife[i]) * Math.min(1, 0.4 + pace);
  const path = c.paths[bucketOf(intensity)];
  path.moveTo(x0, y0);
  path.lineTo(p.x[i], p.y[i]);
}

function strokeBuckets(ctx: CanvasRenderingContext2D, paths: Path2D[]) {
  for (let b = 0; b < BUCKETS.length; b++) {
    ctx.globalAlpha = BUCKETS[b];
    ctx.stroke(paths[b]);
  }
  ctx.globalAlpha = 1;
}

/** Streamlines traced from random seeds: a still picture of the wind. */
function drawStill(
  ctx: CanvasRenderingContext2D,
  air: Air,
  size: { width: number; height: number },
  lines: number
) {
  const paths = BUCKETS.map(() => new Path2D());
  for (let n = 0; n < lines; n++) {
    let x = Math.random() * size.width;
    let y = Math.random() * size.height;
    for (let s = 0; s < STILL_STEPS; s++) {
      baseWind(air, x, y);
      const nx = x + out.x * STILL_DT;
      const ny = y + out.y * STILL_DT;
      // Each line darkens towards its head, like a trail.
      const path = paths[bucketOf((s / STILL_STEPS) * 0.75)];
      path.moveTo(x, y);
      path.lineTo(nx, ny);
      x = nx;
      y = ny;
    }
  }
  strokeBuckets(ctx, paths);
}

function createAir(speed: number): Air {
  return {
    noise: createNoise(7),
    time: 0,
    // A still frame (speed 0) is still traced with the default wind.
    wind: WIND * (speed > 0 ? speed : 1),
    disc: {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      vx: 0,
      vy: 0,
      amount: 0,
      on: false,
      lastShed: 0,
      side: 1,
    },
    vortices: [],
    gusts: [],
    now: 0,
  };
}

/** Pointer events (on the window) mapped onto the disc and gusts. */
function bindPointer(
  root: HTMLElement,
  air: Air,
  wake: () => void,
  isVisible: () => boolean
) {
  const local = (event: PointerEvent) => {
    const rect = root.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    return { x, y, inside };
  };
  const onLeave = () => {
    air.disc.on = false;
  };
  const onMove = (event: PointerEvent) => {
    // A finger only stirs the air while it's down.
    if (
      !isVisible() ||
      (event.pointerType === "touch" && event.buttons === 0)
    ) {
      return;
    }
    const point = local(event);
    const disc = air.disc;
    if (!point.inside) {
      disc.on = false;
      return;
    }
    if (disc.amount < 0.05) {
      // Appear where the cursor came in rather than sliding over from the
      // last place it left.
      disc.x = point.x;
      disc.y = point.y;
      disc.vx = 0;
      disc.vy = 0;
    }
    disc.targetX = point.x;
    disc.targetY = point.y;
    disc.on = true;
    wake();
  };
  const onOut = (event: PointerEvent) => {
    if (!event.relatedTarget) {
      onLeave();
    }
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerType === "touch") {
      onLeave();
    }
  };
  const onDown = (event: PointerEvent) => {
    if (!isVisible() || event.button !== 0) {
      return;
    }
    // Clicks on the content (links, buttons, fields) are not gusts.
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest(
        "a, button, input, textarea, select, label, [role='button']"
      )
    ) {
      return;
    }
    const point = local(event);
    if (!point.inside) {
      return;
    }
    air.gusts.push({ x: point.x, y: point.y, start: performance.now() });
    if (air.gusts.length > 4) {
      air.gusts.shift();
    }
    onMove(event);
    wake();
  };

  const options = { passive: true };
  window.addEventListener("pointermove", onMove, options);
  window.addEventListener("pointerdown", onDown, options);
  window.addEventListener("pointerup", onUp, options);
  window.addEventListener("pointercancel", onLeave, options);
  document.addEventListener("pointerout", onOut, options);
  window.addEventListener("blur", onLeave);
  return () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onLeave);
    document.removeEventListener("pointerout", onOut);
    window.removeEventListener("blur", onLeave);
  };
}

export default function FlowField({
  className,
  children,
  density = 1,
  speed = 1,
  interactive = true,
}: FlowFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(root && canvas && ctx)) {
      return;
    }

    const still =
      speed <= 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const air = createAir(speed);
    const particles = new Particles();
    const size = { width: 0, height: 0 };
    let color = "";
    let raf = 0;
    let lastStep = 0;
    let lastCleanup = 0;
    let visible = true;

    const countFor = (w: number) =>
      Math.round(BASE_COUNT * Math.max(density, 0) * (w < 520 ? 0.6 : 1));

    const paintStill = () => {
      ctx.clearRect(0, 0, size.width, size.height);
      ctx.strokeStyle = color;
      const lines = (countFor(size.width) * STILL_LINES) / BASE_COUNT;
      drawStill(ctx, air, size, Math.round(lines));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size.width = rect.width;
      size.height = rect.height;
      canvas.width = Math.round(size.width * dpr);
      canvas.height = Math.round(size.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "butt";
      ctx.lineWidth = 1.2;
      color = getComputedStyle(canvas).color;
      particles.resize(countFor(size.width), size.width, size.height);
      if (still) {
        paintStill();
      }
    };

    const isActive = () =>
      air.disc.on ||
      air.disc.amount > 0 ||
      air.vortices.length > 0 ||
      air.gusts.length > 0;

    // Trails fade by erasing a little alpha each frame, so the canvas stays
    // transparent over whatever background sits behind it.
    const fade = (dt: number, now: number) => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000";
      ctx.globalAlpha = 1 - Math.exp(-dt / TRAIL_TAU);
      ctx.fillRect(0, 0, size.width, size.height);
      if (dt < 0.025 && now - lastCleanup > CLEANUP_MS) {
        lastCleanup = now;
        ctx.globalAlpha = CLEANUP_ALPHA;
        ctx.fillRect(0, 0, size.width, size.height);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible) {
        return;
      }
      raf = requestAnimationFrame(frame);
      if (!isActive() && now - lastStep < IDLE_FRAME_MS - 4) {
        return;
      }
      const dt = lastStep ? Math.min((now - lastStep) / 1000, 0.05) : 1 / 60;
      lastStep = now;
      air.now = now;
      air.time += dt * speed;
      stepDisc(air.disc, air.vortices, dt, now);
      stepWake(air, dt);

      fade(dt, now);
      const paths = BUCKETS.map(() => new Path2D());
      const step: StepContext = {
        air,
        particles,
        paths,
        width: size.width,
        height: size.height,
        dt,
      };
      for (let i = 0; i < particles.count; i++) {
        stepParticle(step, i);
      }
      ctx.strokeStyle = color;
      strokeBuckets(ctx, paths);
    };

    const start = () => {
      if (!raf && visible && !still) {
        lastStep = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    canvas.style.opacity = "1";
    start();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    // Stop drawing entirely while the wind is scrolled away or the tab is
    // in the background.
    let onScreen = true;
    const update = () => {
      visible = onScreen && document.visibilityState === "visible";
      start();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    intersection.observe(root);
    document.addEventListener("visibilitychange", update);

    // Follow light and dark mode without asking the app for a theme. Only
    // checked while the wind is on screen.
    const colorTimer = window.setInterval(() => {
      if (!visible) {
        return;
      }
      const next = getComputedStyle(canvas).color;
      if (next !== color) {
        color = next;
        if (still) {
          paintStill();
        }
      }
    }, 500);

    // Listened for on the window, so content layered on top (a heading, a
    // button) still has the wind flowing round the cursor beneath it.
    const unbind =
      interactive && !still
        ? bindPointer(root, air, start, () => visible)
        : undefined;

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", update);
      window.clearInterval(colorTimer);
      unbind?.();
    };
  }, [density, speed, interactive]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      ref={rootRef}
    >
      <div aria-hidden="true" className="absolute inset-0">
        <canvas
          className="h-full w-full opacity-0 transition-opacity duration-700 ease-out"
          ref={canvasRef}
        />
      </div>
      {children === undefined || children === null ? null : (
        <div className="pointer-events-auto relative h-full w-full">
          {children}
        </div>
      )}
    </div>
  );
}
