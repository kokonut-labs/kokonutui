"use client";

/**
 * @author: @dorianbaffier
 * @description: Drape Background
 * @version: 1.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface DrapeBackgroundProps {
  className?: string;
  /** Content shown over the curtain. Pass `null` for a bare background. */
  children?: ReactNode;
  /** Strength of the breeze. 0 lets the curtain hang still. */
  wind?: number;
  /** Depth of the pleats along the top, in px. */
  pleat?: number;
  /** Push the fabric with the cursor and grab it to drag it around. */
  interactive?: boolean;
}

// Simulation, in px and seconds, stepped at a fixed rate so it behaves the
// same at any refresh rate.
const STEP = 1 / 60;
const GRAVITY = 980;
const DAMPING = 0.986;
const ITERATIONS = 4;
// Roughly this many columns across the surface, never finer than MIN_CELL.
const COLUMNS = 46;
const MIN_CELL = 16;
// The top edge is gathered onto a rod: pins sit closer than the cloth
// between them, and the slack falls into folds.
const GATHER = 0.8;
const PLEAT_PERIOD = 4;
// How far the hand reaches into the cloth, and how hard it pushes.
const HAND_RADIUS = 120;
const HAND_PUSH = 7;
const HAND_DRAG = 2.4;
// Stiffness of the skip-one links that keep folds round instead of creased.
const BEND = 0.35;
// Perspective: distance from the eye to the screen plane, in px.
const FOCAL = 1400;
// Below this much movement per step, with no wind, the cloth is asleep.
const REST = 0.02;

interface Cloth {
  cols: number;
  rows: number;
  rest: number;
  pos: Float32Array;
  prev: Float32Array;
  pinned: Uint8Array;
  pins: Float32Array;
  links: Uint32Array;
  lengths: Float32Array;
  stiffness: Float32Array;
}

/**
 * Links between neighbours hold the weave; skip-one links give it a little
 * body, so it folds in curves instead of creasing.
 */
function createLinks(cols: number, rows: number, rest: number) {
  const links: number[] = [];
  const lengths: number[] = [];
  const stiffness: number[] = [];
  const link = (a: number, b: number, length: number, stiff: number) => {
    links.push(a, b);
    lengths.push(length);
    stiffness.push(stiff);
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * cols + i;
      if (i + 1 < cols && j > 0) {
        link(a, a + 1, rest, 1);
      }
      if (j + 1 < rows) {
        link(a, a + cols, rest, 1);
      }
      if (i + 2 < cols && j > 0) {
        link(a, a + 2, rest * 2, BEND);
      }
      if (j + 2 < rows) {
        link(a, a + cols * 2, rest * 2, BEND);
      }
    }
  }
  return { links, lengths, stiffness };
}

function createCloth(width: number, height: number, pleat: number): Cloth {
  const rest = Math.max(MIN_CELL, (width * 1.16) / COLUMNS / GATHER);
  const spacing = rest * GATHER;
  const cols = Math.ceil((width * 1.16) / spacing) + 1;
  const rows = Math.ceil((height * 1.12) / rest) + 1;
  const left = (width - (cols - 1) * spacing) / 2;
  const top = -rest * 0.5;
  const count = cols * rows;
  const pos = new Float32Array(count * 3);
  const pinned = new Uint8Array(count);
  const pins = new Float32Array(cols * 3);

  // Folds a little uneven, as a hand-gathered curtain hangs.
  const folds = Array.from({ length: cols }, (_, i) => {
    let phase = 0;
    for (let c = 0; c < i; c++) {
      phase += ((Math.PI * 2) / PLEAT_PERIOD) * (1 + 0.3 * Math.sin(c * 0.9));
    }
    return pleat * Math.sin(phase) * (0.8 + 0.2 * Math.cos(i * 0.37));
  });
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 3;
      const z = folds[i];
      pos[k] = left + i * spacing;
      pos[k + 1] = top + j * rest;
      pos[k + 2] = z;
      if (j === 0) {
        pinned[i] = 1;
        pins.set([pos[k], pos[k + 1], z], i * 3);
      }
    }
  }

  const { links, lengths, stiffness } = createLinks(cols, rows, rest);

  return {
    cols,
    rows,
    rest,
    pos,
    prev: pos.slice(),
    pinned,
    pins,
    links: Uint32Array.from(links),
    lengths: Float32Array.from(lengths),
    stiffness: Float32Array.from(stiffness),
  };
}

interface Forces {
  time: number;
  wind: number;
  hand: { x: number; y: number; vx: number; vy: number; on: boolean };
  grab: { index: number; x: number; y: number } | null;
}

const accel: [number, number, number] = [0, 0, 0];

/** Gravity, the breeze and the hand, acting on a point at (x, y). */
function accelerate(x: number, y: number, forces: Forces) {
  const { time, wind, hand } = forces;
  accel[0] = 0;
  accel[1] = GRAVITY;
  accel[2] = 0;
  if (wind > 0) {
    // Gusts: slow sine waves that roll across the curtain and swell.
    const gust =
      Math.sin(x * 0.006 + time * 0.9) * 0.6 +
      Math.sin(x * 0.013 - time * 1.7 + y * 0.004) * 0.4;
    const swell = 0.6 + 0.4 * Math.sin(time * 0.35);
    accel[2] += gust * swell * wind * 260 * (y / 600);
    accel[0] += Math.sin(time * 0.5 + y * 0.003) * wind * 30;
  }
  if (hand.on) {
    const dx = x - hand.x;
    const dy = y - hand.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < HAND_RADIUS * HAND_RADIUS) {
      const fall = 1 - Math.sqrt(d2) / HAND_RADIUS;
      const f = fall * fall;
      // Press the fabric back, and drag it a little along with the hand.
      accel[2] += f * HAND_PUSH * 1000;
      accel[0] += f * hand.vx * HAND_DRAG * 60;
      accel[1] += f * hand.vy * HAND_DRAG * 60;
    }
  }
  return accel;
}

/** Verlet step: move every free point under its forces. */
function integrate(cloth: Cloth, forces: Forces) {
  const { pos, prev, pinned } = cloth;
  const dt2 = STEP * STEP;
  let motion = 0;
  for (let n = 0; n < pinned.length; n++) {
    if (pinned[n]) {
      continue;
    }
    const k = n * 3;
    const x = pos[k];
    const y = pos[k + 1];
    const z = pos[k + 2];
    const [ax, ay, az] = accelerate(x, y, forces);
    const vx = (x - prev[k]) * DAMPING;
    const vy = (y - prev[k + 1]) * DAMPING;
    const vz = (z - prev[k + 2]) * DAMPING;
    prev[k] = x;
    prev[k + 1] = y;
    prev[k + 2] = z;
    pos[k] = x + vx + ax * dt2;
    pos[k + 1] = y + vy + ay * dt2;
    pos[k + 2] = z + vz + az * dt2;
    motion += Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
  }
  return motion / pinned.length;
}

function relax(cloth: Cloth, grab: Forces["grab"]) {
  const { pos, pinned, links, lengths, stiffness, pins } = cloth;
  for (let it = 0; it < ITERATIONS; it++) {
    for (let l = 0; l < lengths.length; l++) {
      const a = links[l * 2];
      const b = links[l * 2 + 1];
      const ka = a * 3;
      const kb = b * 3;
      const dx = pos[kb] - pos[ka];
      const dy = pos[kb + 1] - pos[ka + 1];
      const dz = pos[kb + 2] - pos[ka + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const diff = (d - lengths[l]) / d;
      // Bend links only resist being squeezed, so folds stay soft.
      if (stiffness[l] < 1 && diff > 0) {
        continue;
      }
      // Pinned points don't move; links between two pins aren't made.
      const wa = 1 - pinned[a];
      const wb = 1 - pinned[b];
      const s = (diff * stiffness[l]) / (wa + wb);
      pos[ka] += dx * s * wa;
      pos[ka + 1] += dy * s * wa;
      pos[ka + 2] += dz * s * wa;
      pos[kb] -= dx * s * wb;
      pos[kb + 1] -= dy * s * wb;
      pos[kb + 2] -= dz * s * wb;
    }
    if (grab) {
      const k = grab.index * 3;
      pos[k] = grab.x;
      pos[k + 1] = grab.y;
    }
    for (let i = 0; i < cloth.cols; i++) {
      pos.set(pins.subarray(i * 3, i * 3 + 3), i * 3);
    }
  }
}

/** Interleaved position and normal for every point, for the GPU. */
function writeVertices(cloth: Cloth, out: Float32Array) {
  const { cols, rows, pos } = cloth;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const n = j * cols + i;
      const l = (j * cols + Math.max(i - 1, 0)) * 3;
      const r = (j * cols + Math.min(i + 1, cols - 1)) * 3;
      const u = (Math.max(j - 1, 0) * cols + i) * 3;
      const d = (Math.min(j + 1, rows - 1) * cols + i) * 3;
      const ax = pos[r] - pos[l];
      const ay = pos[r + 1] - pos[l + 1];
      const az = pos[r + 2] - pos[l + 2];
      const bx = pos[d] - pos[u];
      const by = pos[d + 1] - pos[u + 1];
      const bz = pos[d + 2] - pos[u + 2];
      // Down × across points out of the screen, towards the viewer.
      let nx = by * az - bz * ay;
      let ny = bz * ax - bx * az;
      let nz = bx * ay - by * ax;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const o = n * 6;
      out[o] = pos[n * 3];
      out[o + 1] = pos[n * 3 + 1];
      out[o + 2] = pos[n * 3 + 2];
      out[o + 3] = nx;
      out[o + 4] = ny;
      out[o + 5] = nz;
    }
  }
}

const VERTEX = `
attribute vec3 aPos;
attribute vec3 aNormal;
uniform vec2 uSize;
uniform float uFocal;
varying vec3 vNormal;
void main() {
  float s = uFocal / (uFocal + aPos.z);
  vec2 p = uSize * 0.5 + (aPos.xy - uSize * 0.5) * s;
  gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, clamp(aPos.z / 4000.0, -1.0, 1.0), 1.0);
  vNormal = aNormal;
}`;

// Soft wrapped light from the top left and a satin sheen, blended between
// two theme colors so the curtain sits in the page in light and dark mode.
const FRAGMENT = `
precision mediump float;
uniform vec3 uLit;
uniform vec3 uShade;
varying vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  if (n.z > 0.0) n = -n;
  vec3 light = normalize(vec3(-0.45, -0.55, -0.7));
  float diffuse = max(dot(n, light), 0.0);
  float wrap = diffuse * 0.8 + 0.2;
  float sheen = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, -1.0)), 0.0), 18.0);
  float t = clamp(wrap * wrap + sheen * 0.15, 0.0, 1.0);
  gl_FragColor = vec4(mix(uShade, uLit, t), 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function createRenderer(gl: WebGLRenderingContext) {
  const program = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  if (!(program && vs && fs)) {
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return null;
  }
  // biome-ignore lint/correctness/useHookAtTopLevel: a WebGL call, not a React hook.
  gl.useProgram(program);
  const vertexBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  const aPos = gl.getAttribLocation(program, "aPos");
  const aNormal = gl.getAttribLocation(program, "aNormal");
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aNormal);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 24, 12);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  return {
    uSize: gl.getUniformLocation(program, "uSize"),
    uFocal: gl.getUniformLocation(program, "uFocal"),
    uLit: gl.getUniformLocation(program, "uLit"),
    uShade: gl.getUniformLocation(program, "uShade"),
    setMesh(cols: number, rows: number) {
      const indices = new Uint16Array((cols - 1) * (rows - 1) * 6);
      let o = 0;
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = j * cols + i;
          indices.set([a, a + 1, a + cols, a + 1, a + cols + 1, a + cols], o);
          o += 6;
        }
      }
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      return indices.length;
    },
    destroy() {
      gl.deleteBuffer(vertexBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}

/** Any CSS color (oklch included) as 0-1 RGB, via a 1px canvas. */
function toRgb(color: string, probe: CanvasRenderingContext2D) {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255] as const;
}

export default function DrapeBackground({
  className,
  children,
  wind = 1,
  pleat = 34,
  interactive = true,
}: DrapeBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const litRef = useRef<HTMLSpanElement>(null);
  const shadeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: true });
    const probe = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    if (!(root && canvas && gl && probe)) {
      return;
    }
    const renderer = createRenderer(gl);
    if (!renderer) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const forces: Forces = {
      time: 0,
      wind: reduceMotion ? 0 : wind,
      hand: { x: 0, y: 0, vx: 0, vy: 0, on: false },
      grab: null,
    };

    let width = 0;
    let height = 0;
    let cloth: Cloth | null = null;
    let vertices = new Float32Array(0);
    let indexCount = 0;
    let raf = 0;
    let last = 0;
    let carry = 0;
    let quiet = 0;
    let visible = true;
    let colorKey = "";

    const readColors = () => {
      const lit = getComputedStyle(litRef.current as Element).color;
      const shade = getComputedStyle(shadeRef.current as Element).color;
      if (`${lit}|${shade}` === colorKey) {
        return false;
      }
      colorKey = `${lit}|${shade}`;
      gl.uniform3fv(renderer.uLit, toRgb(lit, probe));
      gl.uniform3fv(renderer.uShade, toRgb(shade, probe));
      return true;
    };

    const draw = () => {
      if (!cloth) {
        return;
      }
      writeVertices(cloth, vertices);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
      // biome-ignore lint/suspicious/noBitwiseOperators: WebGL clear flags.
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      if (width < 2 || height < 2) {
        return;
      }
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(renderer.uSize, width, height);
      gl.uniform1f(renderer.uFocal, FOCAL);
      cloth = createCloth(width, height, pleat);
      vertices = new Float32Array(cloth.cols * cloth.rows * 6);
      indexCount = renderer.setMesh(cloth.cols, cloth.rows);
      // Let it fall and settle before the first frame, so it opens hanging.
      const settleForces = { ...forces, hand: { ...forces.hand, on: false } };
      for (let i = 0; i < 180; i++) {
        settleForces.time = forces.time + i * STEP;
        integrate(cloth, settleForces);
        relax(cloth, null);
      }
      draw();
    };

    const frame = (now: number) => {
      raf = 0;
      if (!(visible && cloth)) {
        return;
      }
      carry += last ? Math.min((now - last) / 1000, 0.1) : STEP;
      last = now;
      let moved = 0;
      let steps = 0;
      while (carry >= STEP && steps < 3) {
        forces.time += STEP;
        moved = integrate(cloth, forces);
        relax(cloth, forces.grab);
        carry -= STEP;
        steps++;
      }
      carry = Math.min(carry, STEP);
      forces.hand.vx *= 0.8;
      forces.hand.vy *= 0.8;
      draw();
      quiet = moved < REST ? quiet + 1 : 0;
      const awake =
        forces.wind > 0 || forces.hand.on || forces.grab || quiet < 30;
      if (awake) {
        raf = requestAnimationFrame(frame);
      }
    };

    const start = () => {
      if (!raf && visible && !reduceMotion) {
        last = 0;
        quiet = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    readColors();
    gl.clearColor(0, 0, 0, 0);
    build();
    canvas.style.opacity = "1";
    start();

    const resizeObserver = new ResizeObserver(() => {
      build();
      start();
    });
    resizeObserver.observe(canvas);

    // A tab coming back must not wake a background that's scrolled away.
    let onScreen = true;
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      visible = onScreen && document.visibilityState === "visible";
      start();
    });
    intersection.observe(root);
    const onVisibility = () => {
      visible = onScreen && document.visibilityState === "visible";
      start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Follow light and dark mode without asking the app for a theme. Only
    // checked while the background is on screen.
    const colorTimer = window.setInterval(() => {
      if (!visible) {
        return;
      }
      if (readColors() && !raf) {
        draw();
      }
    }, 500);

    const local = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    /** The point drawn nearest the pointer, within reach. */
    const nearest = (x: number, y: number) => {
      if (!cloth) {
        return -1;
      }
      let best = -1;
      let bestD = 70 * 70;
      for (let n = cloth.cols; n < cloth.pinned.length; n++) {
        const k = n * 3;
        const s = FOCAL / (FOCAL + cloth.pos[k + 2]);
        const px = width / 2 + (cloth.pos[k] - width / 2) * s;
        const py = height / 2 + (cloth.pos[k + 1] - height / 2) * s;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    };

    const onMove = (event: PointerEvent) => {
      const p = local(event);
      const hand = forces.hand;
      if (forces.grab) {
        forces.grab.x = p.x;
        forces.grab.y = p.y;
      } else if (event.pointerType === "mouse") {
        if (hand.on) {
          hand.vx = hand.vx * 0.5 + (p.x - hand.x) * 0.5;
          hand.vy = hand.vy * 0.5 + (p.y - hand.y) * 0.5;
        }
        hand.on = true;
      }
      hand.x = p.x;
      hand.y = p.y;
      start();
    };
    const onLeave = () => {
      forces.hand.on = false;
    };
    const onDown = (event: PointerEvent) => {
      // Clicks on the content (links, buttons) are not meant for the cloth.
      if ((event.target as HTMLElement).closest("a, button, input, textarea")) {
        return;
      }
      const p = local(event);
      const index = nearest(p.x, p.y);
      if (index < 0) {
        return;
      }
      event.preventDefault();
      root.setPointerCapture(event.pointerId);
      forces.grab = { index, ...p };
      forces.hand.on = false;
      root.dataset.grabbing = "";
      start();
    };
    const onUp = () => {
      forces.grab = null;
      delete root.dataset.grabbing;
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
      renderer.destroy();
    };
  }, [wind, pleat, interactive]);

  return (
    <div
      className={cn(
        "relative flex min-h-[560px] w-full touch-pan-y items-center justify-center overflow-hidden bg-zinc-100 text-zinc-900 data-[grabbing]:cursor-grabbing dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      ref={rootRef}
    >
      {/* Theme colors for the shader: the lit face and the deepest fold. */}
      <span className="hidden text-white dark:text-zinc-800" ref={litRef} />
      <span className="hidden text-zinc-300 dark:text-black" ref={shadeRef} />
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
        Behind the curtain
      </h1>
      <p className="max-w-sm text-base text-zinc-500 dark:text-zinc-400">
        A pleated curtain in a light breeze. Sweep the cursor through it, or
        grab a fold and pull.
      </p>
    </div>
  );
}
