"use client";

/**
 * @author: @dorianbaffier
 * @description: Shape Hero
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface HeroShape {
  id: string;
  /** Text or an icon inside the shape. Leave empty for a plain shape. */
  content?: ReactNode;
  /**
   * Size, color and rounding. Every shape is treated as a pill: as wide as
   * it renders, with fully round ends, so a square box becomes a circle.
   */
  className?: string;
}

export interface ShapeHeroProps {
  className?: string;
  /** Small line above the title, such as a badge or a link. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Call-to-action buttons under the description. */
  actions?: ReactNode;
  /** Heading element for the title, so the page decides where its `h1` is. */
  as?: "h1" | "h2" | "h3" | "p";
  /** Shapes that drop into the hero, pile up and can be thrown around. */
  shapes?: HeroShape[];
  /** Share of the hero's area the pile may fill; extra shapes are left out. */
  fill?: number;
}

/* ---------------------------------------------------------------------------
 * A small rigid-body solver for pills (capsules): a segment with a radius.
 * Fixed 120Hz steps, sequential impulses with friction, and the whole pile
 * sleeps once it settles, so a resting hero costs nothing.
 * ------------------------------------------------------------------------ */

const STEP = 1 / 120;
const GRAVITY = 2600;
const ITERATIONS = 16;
const FRICTION = 0.5;
const RESTITUTION = 0.22;
const BOUNCE_THRESHOLD = 140;
const SLOP = 0.4;
const CORRECTION = 0.3;
const MAX_SPEED = 3200;
const MAX_SPIN = 18;
const SLEEP_SPEED = 9;
const SLEEP_STEPS = 40;
/** Below this speed a body is nearly at rest: damp it so a pile can't creep. */
const REST_SPEED = 30;
const DRAG_REACH = 0.28;

interface Body {
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  w: number;
  /** Half the length of the pill's spine. 0 for a circle. */
  half: number;
  r: number;
  invMass: number;
  invInertia: number;
  width: number;
  height: number;
  el: HTMLElement;
}

interface Contact {
  a: Body;
  b: Body | null;
  /** Normal pointing from `b` towards `a`. */
  nx: number;
  ny: number;
  rax: number;
  ray: number;
  rbx: number;
  rby: number;
  depth: number;
  correct: boolean;
  target: number;
  kn: number;
  kt: number;
  jn: number;
  jt: number;
}

interface Drag {
  body: Body;
  /** Grab point in the body's own frame. */
  lx: number;
  ly: number;
  tx: number;
  ty: number;
  id: number;
}

type Point = [number, number];

function ends(body: Body): Point[] {
  if (body.half === 0) {
    return [[body.x, body.y]];
  }
  const c = Math.cos(body.a) * body.half;
  const s = Math.sin(body.a) * body.half;
  return [
    [body.x - c, body.y - s],
    [body.x + c, body.y + s],
  ];
}

function closest(p: Point, seg: Point[]): Point {
  const [a, b = a] = seg;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.min(
          Math.max(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length, 0),
          1
        );
  return [a[0] + dx * t, a[1] + dy * t];
}

function contact(
  a: Body,
  b: Body | null,
  nx: number,
  ny: number,
  px: number,
  py: number,
  depth: number
): Contact {
  return {
    a,
    b,
    nx,
    ny,
    rax: px - a.x,
    ray: py - a.y,
    rbx: b ? px - b.x : 0,
    rby: b ? py - b.y : 0,
    depth,
    correct: true,
    target: 0,
    kn: 0,
    kt: 0,
    jn: 0,
    jt: 0,
  };
}

/** Contacts between two pills: each end of one against the other's spine. */
function collidePair(a: Body, b: Body, out: Contact[]) {
  const reach = a.r + b.r;
  const spineA = ends(a);
  const spineB = ends(b);
  const found: Contact[] = [];
  const test = (p: Point, q: Point, fromB: boolean) => {
    const dx = fromB ? q[0] - p[0] : p[0] - q[0];
    const dy = fromB ? q[1] - p[1] : p[1] - q[1];
    const distance = Math.hypot(dx, dy);
    if (distance >= reach + 0.5) {
      return;
    }
    const nx = distance > 1e-6 ? dx / distance : 0;
    const ny = distance > 1e-6 ? dy / distance : -1;
    // Contact point halfway between the two surfaces.
    const [ax, ay] = fromB ? q : p;
    const px = ax - nx * (a.r - (reach - distance) / 2);
    const py = ay - ny * (a.r - (reach - distance) / 2);
    found.push(contact(a, b, nx, ny, px, py, reach - distance));
  };
  for (const p of spineA) {
    test(p, closest(p, spineB), false);
  }
  for (const p of spineB) {
    test(p, closest(p, spineA), true);
  }
  if (found.length === 0) {
    // Spines that cross in the middle: compare their centers' closest points.
    const p = closest([b.x, b.y], spineA);
    test(p, closest(p, spineB), false);
  }
  // Only the deepest contact pushes the pair apart, so they don't overshoot.
  let deepest: Contact | null = null;
  for (const c of found) {
    c.correct = false;
    if (!deepest || c.depth > deepest.depth) {
      deepest = c;
    }
    out.push(c);
  }
  if (deepest) {
    deepest.correct = true;
  }
}

function collideWalls(
  body: Body,
  width: number,
  height: number,
  out: Contact[]
) {
  let deepest: Contact | null = null;
  const add = (c: Contact) => {
    c.correct = false;
    if (!deepest || c.depth > deepest.depth) {
      deepest = c;
    }
    out.push(c);
  };
  for (const [x, y] of ends(body)) {
    if (y + body.r - height > -0.5) {
      add(contact(body, null, 0, -1, x, height, y + body.r - height));
    }
    if (body.r - x > -0.5) {
      add(contact(body, null, 1, 0, 0, y, body.r - x));
    }
    if (x + body.r - width > -0.5) {
      add(contact(body, null, -1, 0, width, y, x + body.r - width));
    }
  }
  if (deepest) {
    (deepest as Contact).correct = true;
  }
}

function relativeVelocity(c: Contact): Point {
  const { a, b } = c;
  let vx = a.vx - a.w * c.ray;
  let vy = a.vy + a.w * c.rax;
  if (b) {
    vx -= b.vx - b.w * c.rby;
    vy -= b.vy + b.w * c.rbx;
  }
  return [vx, vy];
}

function applyImpulse(c: Contact, jx: number, jy: number) {
  const { a, b } = c;
  a.vx += jx * a.invMass;
  a.vy += jy * a.invMass;
  a.w += a.invInertia * (c.rax * jy - c.ray * jx);
  if (b) {
    b.vx -= jx * b.invMass;
    b.vy -= jy * b.invMass;
    b.w -= b.invInertia * (c.rbx * jy - c.rby * jx);
  }
}

function effectiveMass(c: Contact, nx: number, ny: number) {
  const { a, b } = c;
  const ra = c.rax * ny - c.ray * nx;
  let k = a.invMass + a.invInertia * ra * ra;
  if (b) {
    const rb = c.rbx * ny - c.rby * nx;
    k += b.invMass + b.invInertia * rb * rb;
  }
  return k;
}

function prepare(c: Contact) {
  c.kn = effectiveMass(c, c.nx, c.ny);
  c.kt = effectiveMass(c, -c.ny, c.nx);
  const [vx, vy] = relativeVelocity(c);
  const vn = vx * c.nx + vy * c.ny;
  if (c.depth < 0) {
    // Not touching yet: allow it to close the gap this step, no more.
    c.target = c.depth / STEP;
  } else {
    c.target = vn < -BOUNCE_THRESHOLD ? -RESTITUTION * vn : 0;
  }
}

function solve(c: Contact) {
  let [vx, vy] = relativeVelocity(c);
  const vn = vx * c.nx + vy * c.ny;
  const jn = Math.max(c.jn + (c.target - vn) / c.kn, 0);
  const dn = jn - c.jn;
  c.jn = jn;
  applyImpulse(c, c.nx * dn, c.ny * dn);

  [vx, vy] = relativeVelocity(c);
  const tx = -c.ny;
  const ty = c.nx;
  const limit = FRICTION * c.jn;
  const jt = Math.min(
    Math.max(c.jt - (vx * tx + vy * ty) / c.kt, -limit),
    limit
  );
  const dt = jt - c.jt;
  c.jt = jt;
  applyImpulse(c, tx * dt, ty * dt);
}

function correct(c: Contact) {
  if (!c.correct || c.depth <= SLOP) {
    return;
  }
  const { a, b } = c;
  const total = a.invMass + (b ? b.invMass : 0);
  const push = ((c.depth - SLOP) * CORRECTION) / total;
  a.x += c.nx * push * a.invMass;
  a.y += c.ny * push * a.invMass;
  if (b) {
    b.x -= c.nx * push * b.invMass;
    b.y -= c.ny * push * b.invMass;
  }
}

/** Pull the grabbed point towards the pointer, through the body's mass. */
function applyDrag(drag: Drag) {
  const { body } = drag;
  const cos = Math.cos(body.a);
  const sin = Math.sin(body.a);
  const rx = drag.lx * cos - drag.ly * sin;
  const ry = drag.lx * sin + drag.ly * cos;
  const handle = contact(body, null, 0, 0, body.x + rx, body.y + ry, 0);
  const [vx] = relativeVelocity(handle);
  const wantX = ((drag.tx - body.x - rx) / STEP) * DRAG_REACH;
  const wantY = ((drag.ty - body.y - ry) / STEP) * DRAG_REACH;
  applyImpulse(handle, (wantX - vx) / effectiveMass(handle, 1, 0), 0);
  const [, vy] = relativeVelocity(handle);
  applyImpulse(handle, 0, (wantY - vy) / effectiveMass(handle, 0, 1));
  // Hang calmly from the grab point rather than spin.
  body.w *= 0.96;
}

function clampSpeed(body: Body) {
  const speed = Math.hypot(body.vx, body.vy);
  if (speed > MAX_SPEED) {
    body.vx *= MAX_SPEED / speed;
    body.vy *= MAX_SPEED / speed;
  }
  body.w = Math.min(Math.max(body.w, -MAX_SPIN), MAX_SPIN);
}

interface World {
  bodies: Body[];
  width: number;
  height: number;
  drag: Drag | null;
  still: number;
}

/** Advance one fixed step. Returns true once everything has come to rest. */
function step(world: World) {
  const { bodies, width, height, drag } = world;
  for (const body of bodies) {
    body.vy += GRAVITY * STEP;
    body.vx *= 0.999;
    body.w *= 0.995;
  }
  if (drag) {
    applyDrag(drag);
  }
  const contacts: Contact[] = [];
  for (let i = 0; i < bodies.length; i++) {
    collideWalls(bodies[i], width, height, contacts);
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const near = a.half + a.r + b.half + b.r;
      if (Math.abs(a.x - b.x) < near && Math.abs(a.y - b.y) < near) {
        collidePair(a, b, contacts);
      }
    }
  }
  for (const c of contacts) {
    prepare(c);
  }
  for (let k = 0; k < ITERATIONS; k++) {
    for (const c of contacts) {
      solve(c);
    }
  }
  let fastest = 0;
  for (const body of bodies) {
    clampSpeed(body);
    if (
      body !== drag?.body &&
      Math.hypot(body.vx, body.vy) + Math.abs(body.w) * body.r < REST_SPEED
    ) {
      body.vx *= 0.8;
      body.vy *= 0.8;
      body.w *= 0.8;
    }
    body.x += body.vx * STEP;
    body.y += body.vy * STEP;
    body.a += body.w * STEP;
    fastest = Math.max(
      fastest,
      Math.hypot(body.vx, body.vy) + Math.abs(body.w) * (body.half + body.r)
    );
  }
  for (const c of contacts) {
    correct(c);
  }
  world.still = fastest < SLEEP_SPEED && !drag ? world.still + 1 : 0;
  return world.still > SLEEP_STEPS;
}

function render(bodies: Body[]) {
  for (const body of bodies) {
    body.el.style.transform = `translate3d(${(body.x - body.width / 2).toFixed(2)}px, ${(body.y - body.height / 2).toFixed(2)}px, 0) rotate(${body.a.toFixed(4)}rad)`;
  }
}

/** Deterministic scatter, so the drop looks the same on every visit. */
const scatter = (n: number) => (Math.sin(n * 12.9898) * 43_758.5453) % 1;

function createBodies(
  elements: HTMLElement[],
  width: number,
  height: number,
  fill: number
) {
  const bodies: Body[] = [];
  let area = 0;
  for (const [index, el] of elements.entries()) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (area + w * h > width * height * fill) {
      el.style.visibility = "hidden";
      continue;
    }
    area += w * h;
    const r = Math.min(w, h) / 2;
    const mass = (w * h) / 1000;
    bodies.push({
      x: width * (0.2 + 0.6 * Math.abs(scatter(index + 1))),
      // Dropped in from above, one after another.
      y: -h - index * 64,
      a: scatter(index + 7) * 0.9,
      vx: scatter(index + 3) * 120,
      vy: 0,
      w: scatter(index + 5) * 2,
      half: Math.max(w - h, 0) / 2,
      r,
      invMass: 1 / mass,
      invInertia: 12 / (mass * (w * w + h * h)),
      width: w,
      height: h,
      el,
    });
    el.style.visibility = "visible";
  }
  return bodies;
}

function hitTest(bodies: Body[], x: number, y: number) {
  for (let i = bodies.length - 1; i >= 0; i--) {
    const body = bodies[i];
    const [qx, qy] = closest([x, y], ends(body));
    if (Math.hypot(x - qx, y - qy) <= body.r) {
      return body;
    }
  }
  return null;
}

export default function ShapeHero({
  className,
  eyebrow,
  title = "Components with a little gravity",
  description = "Copy-paste components for React, built with Tailwind CSS and Motion. Grab a shape and throw it.",
  actions = <DefaultActions />,
  as: Heading = "h1",
  shapes = DEFAULT_SHAPES,
  fill = 0.3,
}: ShapeHeroProps) {
  const rootRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: restarts the drop when the set of shapes changes, not on every new array.
  useEffect(() => {
    const root = rootRef.current;
    const layer = layerRef.current;
    if (!(root && layer)) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const elements = [...layer.querySelectorAll<HTMLElement>("[data-shape]")];
    const world: World = {
      bodies: [],
      width: layer.clientWidth,
      height: layer.clientHeight,
      drag: null,
      still: 0,
    };
    let raf = 0;
    let last = 0;
    let carry = 0;
    let started = false;
    let visible = false;
    let cancelled = false;

    const loop = (now: number) => {
      raf = 0;
      carry += Math.min((now - last) / 1000, 0.05);
      last = now;
      let asleep = false;
      while (carry >= STEP) {
        asleep = step(world);
        carry -= STEP;
      }
      render(world.bodies);
      if (!asleep && visible) {
        raf = requestAnimationFrame(loop);
      }
    };
    const wake = () => {
      world.still = 0;
      if (!raf && started && visible) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const begin = () => {
      if (started || cancelled) {
        return;
      }
      started = true;
      world.bodies = createBodies(elements, world.width, world.height, fill);
      if (reduceMotion) {
        // Settle the pile up front and show it at rest.
        let steps = 0;
        while (steps < 2400 && !step(world)) {
          steps++;
        }
        render(world.bodies);
        return;
      }
      render(world.bodies);
      wake();
    };

    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && !document.hidden;
        if (visible) {
          // Wait for fonts, so each shape is measured at its final width.
          document.fonts.ready.then(begin);
          wake();
        }
      },
      { threshold: 0.3 }
    );
    intersection.observe(root);
    const onVisibility = () => {
      visible = !document.hidden;
      wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const resizeObserver = new ResizeObserver(() => {
      world.width = layer.clientWidth;
      world.height = layer.clientHeight;
      wake();
    });
    resizeObserver.observe(layer);

    const local = (event: PointerEvent): Point => {
      const rect = layer.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };
    const onDown = (event: PointerEvent) => {
      if (!started || world.drag || event.button !== 0) {
        return;
      }
      const [x, y] = local(event);
      const body = hitTest(world.bodies, x, y);
      if (!body) {
        return;
      }
      event.preventDefault();
      const dx = x - body.x;
      const dy = y - body.y;
      const cos = Math.cos(-body.a);
      const sin = Math.sin(-body.a);
      world.drag = {
        body,
        lx: dx * cos - dy * sin,
        ly: dx * sin + dy * cos,
        tx: x,
        ty: y,
        id: event.pointerId,
      };
      layer.setPointerCapture(event.pointerId);
      layer.dataset.dragging = "";
      wake();
    };
    const onMove = (event: PointerEvent) => {
      if (world.drag?.id === event.pointerId) {
        [world.drag.tx, world.drag.ty] = local(event);
        wake();
      }
    };
    const onUp = (event: PointerEvent) => {
      if (world.drag?.id === event.pointerId) {
        world.drag = null;
        delete layer.dataset.dragging;
        wake();
      }
    };
    layer.addEventListener("pointerdown", onDown);
    layer.addEventListener("pointermove", onMove);
    layer.addEventListener("pointerup", onUp);
    layer.addEventListener("pointercancel", onUp);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      intersection.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      layer.removeEventListener("pointerdown", onDown);
      layer.removeEventListener("pointermove", onMove);
      layer.removeEventListener("pointerup", onUp);
      layer.removeEventListener("pointercancel", onUp);
    };
  }, [shapes.map((shape) => shape.id).join("|"), fill]);

  return (
    <section
      className={cn(
        "relative flex min-h-[720px] w-full flex-col items-center overflow-hidden bg-white px-6 pt-24 pb-24 text-zinc-900 sm:pt-28 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      ref={rootRef}
    >
      <div
        aria-hidden="true"
        className="group/shapes absolute inset-0 touch-pan-y"
        ref={layerRef}
      >
        {shapes.map((shape) => (
          <div
            className={cn(
              "absolute top-0 left-0 flex cursor-grab touch-none select-none items-center justify-center whitespace-nowrap rounded-full will-change-transform group-data-dragging/shapes:cursor-grabbing",
              shape.className
            )}
            data-shape=""
            key={shape.id}
            style={{ visibility: "hidden" }}
          >
            {shape.content}
          </div>
        ))}
      </div>

      <div className="pointer-events-none relative flex max-w-2xl flex-col items-center text-center">
        {eyebrow ? (
          <div className="pointer-events-auto mb-6">{eyebrow}</div>
        ) : null}
        <Heading className="text-balance font-semibold text-4xl tracking-tight sm:text-6xl">
          {title}
        </Heading>
        {description ? (
          <p className="mt-5 max-w-md text-pretty text-base text-zinc-500 sm:text-lg dark:text-zinc-400">
            {description}
          </p>
        ) : null}
        {actions ? (
          <div className="pointer-events-auto mt-8 flex flex-wrap items-center justify-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DefaultActions() {
  return (
    <>
      <button
        className="h-10 rounded-full bg-zinc-900 px-5 font-medium text-sm text-white transition-colors duration-150 ease-out hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        type="button"
      >
        Browse components
      </button>
      <button
        className="h-10 rounded-full border border-zinc-200 bg-white px-5 font-medium text-sm text-zinc-700 transition-colors duration-150 ease-out hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        type="button"
      >
        Read the docs
      </button>
    </>
  );
}

const PILL = "h-14 px-7 font-medium text-lg tracking-tight";
const OUTLINE =
  "border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100";
const SOLID = "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";
const ACCENT = "bg-orange-500 text-white";

const DEFAULT_SHAPES: HeroShape[] = [
  { id: "pull-cord", content: "Pull Cord", className: cn(PILL, SOLID) },
  { id: "detent-dial", content: "Detent Dial", className: cn(PILL, OUTLINE) },
  { id: "dot-1", className: cn("size-16", ACCENT) },
  { id: "wheel-picker", content: "Wheel Picker", className: cn(PILL, OUTLINE) },
  { id: "topo", content: "Topo", className: cn(PILL, ACCENT) },
  { id: "split-flap", content: "Split Flap", className: cn(PILL, OUTLINE) },
  { id: "dot-2", className: cn("size-12", SOLID) },
  {
    id: "notification-stack",
    content: "Notification Stack",
    className: cn(PILL, OUTLINE),
  },
  { id: "paper-fold", content: "Paper Fold", className: cn(PILL, SOLID) },
  { id: "dot-3", className: cn("size-20", OUTLINE) },
  { id: "toss-board", content: "Toss Board", className: cn(PILL, OUTLINE) },
  { id: "react", content: "React", className: cn(PILL, OUTLINE) },
  { id: "motion", content: "Motion", className: cn(PILL, SOLID) },
  { id: "dot-4", className: cn("size-14", OUTLINE) },
  { id: "tailwind", content: "Tailwind CSS", className: cn(PILL, OUTLINE) },
  { id: "shadcn", content: "shadcn/ui", className: cn(PILL, OUTLINE) },
  { id: "peel-sticker", content: "Peel Sticker", className: cn(PILL, SOLID) },
  { id: "dot-5", className: cn("size-12", ACCENT) },
  {
    id: "background-paths",
    content: "Background Paths",
    className: cn(PILL, OUTLINE),
  },
  { id: "flow-field", content: "Flow Field", className: cn(PILL, OUTLINE) },
  { id: "dot-6", className: cn("size-16", SOLID) },
  { id: "typescript", content: "TypeScript", className: cn(PILL, OUTLINE) },
];
