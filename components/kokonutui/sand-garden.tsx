"use client";

/**
 * @author: @dorianbaffier
 * @description: Sand Garden
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface SandGardenProps {
  className?: string;
  /** Content shown over the sand. Pass `null` for a bare background. */
  children?: ReactNode;
  /** Rake the sand by dragging, and let the light follow the cursor. */
  interactive?: boolean;
  /** Draw one slow stroke across the garden when it first comes into view. */
  intro?: boolean;
  /** Distance between grooves, in px. */
  spacing?: number;
}

// The sand is a height field, one sample every CELL px, lit in a shader so
// grooves read by their shading alone.
const CELL = 2;
// Groove depth, as a share of the height range.
const DEPTH = 0.16;
// A rake has this many tines, one groove apart.
const TINES = 5;
// How strongly slopes catch the light.
const RELIEF = 7;
// Light eases toward the cursor with this time constant, in seconds.
const LIGHT_LAG = 0.14;
const INTRO_MS = 2400;

interface Stone {
  x: number;
  y: number;
  r: number;
}

/** Stones as fractions of the width and height, sized by the shorter side. */
const STONES = [
  { x: 0.15, y: 0.3, r: 0.075 },
  { x: 0.86, y: 0.72, r: 0.058 },
  { x: 0.77, y: 0.85, r: 0.03 },
];

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Height in the red channel, stone in alpha. The light direction is in
// screen terms (x right, y down) with z toward the viewer.
const FRAGMENT = `
precision mediump float;
uniform sampler2D uField;
uniform vec2 uTexel;
uniform vec3 uLight;
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uStone;
varying vec2 vUv;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
  vec4 here = texture2D(uField, vUv);
  float hl = texture2D(uField, vUv - vec2(uTexel.x, 0.0)).r;
  float hr = texture2D(uField, vUv + vec2(uTexel.x, 0.0)).r;
  float hu = texture2D(uField, vUv - vec2(0.0, uTexel.y)).r;
  float hd = texture2D(uField, vUv + vec2(0.0, uTexel.y)).r;
  vec3 n = normalize(vec3((hl - hr) * ${RELIEF.toFixed(1)}, (hu - hd) * ${RELIEF.toFixed(1)}, 1.0));
  vec3 l = normalize(uLight);
  float level = l.z;
  float lit = clamp(0.55 + (dot(n, l) - level) * 1.7, 0.0, 1.0);
  // Stones cast a short shadow away from the light.
  vec2 away = l.xy * uTexel * (1.0 - l.z) * 22.0;
  float shadow = texture2D(uField, vUv + away).a * 0.5
    + texture2D(uField, vUv + away * 0.5).a * 0.5;
  shadow *= 1.0 - here.a;
  float grain = hash(floor(gl_FragCoord.xy)) - 0.5;
  vec3 sand = mix(uShade, uLit, lit) * (1.0 - shadow * 0.28) + grain * 0.025;
  vec3 stone = uStone * (0.55 + lit * 0.7) + grain * 0.02;
  gl_FragColor = vec4(mix(sand, stone, smoothstep(0.35, 0.65, here.a)), 1.0);
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
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  return {
    uTexel: gl.getUniformLocation(program, "uTexel"),
    uLight: gl.getUniformLocation(program, "uLight"),
    uLit: gl.getUniformLocation(program, "uLit"),
    uShade: gl.getUniformLocation(program, "uShade"),
    uStone: gl.getUniformLocation(program, "uStone"),
    destroy() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(quad);
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

interface Field {
  cols: number;
  rows: number;
  height: Float32Array;
  stone: Uint8Array;
  bytes: Uint8Array;
}

/**
 * A freshly raked garden: straight lines across, and rings around each
 * stone that stop where the lines take over, the way they're drawn by hand.
 */
function createField(
  width: number,
  height: number,
  period: number,
  stones: Stone[]
): Field {
  const cols = Math.max(2, Math.ceil(width / CELL));
  const rows = Math.max(2, Math.ceil(height / CELL));
  const field: Field = {
    cols,
    rows,
    height: new Float32Array(cols * rows),
    stone: new Uint8Array(cols * rows),
    bytes: new Uint8Array(cols * rows * 2),
  };
  const k = (2 * Math.PI) / period;
  for (let j = 0; j < rows; j++) {
    const y = (j + 0.5) * CELL;
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * CELL;
      const n = j * cols + i;
      // Raked by hand: the lines drift a little, never ruler-straight.
      const drift =
        period *
        (0.35 * Math.sin(x * 0.0041 + y * 0.0013) +
          0.2 * Math.sin(x * 0.011 - y * 0.0027 + 1.7));
      let h = 0.5 - DEPTH * Math.cos(k * (y + drift));
      for (const s of stones) {
        const d = Math.hypot(x - s.x, y - s.y);
        if (d < s.r) {
          // A rounded stone, higher than the sand.
          const q = d / s.r;
          h = 0.55 + 0.4 * Math.sqrt(1 - q * q);
          field.stone[n] = Math.round(255 * Math.min((1 - q) * 6, 1));
          break;
        }
        if (d < s.r + period * 4) {
          h = 0.5 - DEPTH * Math.cos(k * (d - s.r - period / 2));
          break;
        }
      }
      field.height[n] = h;
    }
  }
  return field;
}

/** One sample under the rake head, `across` px from its middle. */
function comb(
  height: Float32Array,
  n: number,
  across: number,
  half: number,
  reach: number,
  k: number,
  period: number
) {
  const side = Math.abs(across);
  if (side > reach) {
    return false;
  }
  if (side <= half) {
    // Tines sit in the troughs, half a groove in from each end.
    height[n] = 0.5 - DEPTH * Math.cos(k * (across + half - period / 2));
  } else {
    // Sand pushed out past the last tine, fading into what was there.
    const t = (side - half) / (reach - half);
    height[n] = height[n] * t + (0.5 + DEPTH * 0.9) * (1 - t);
  }
  return true;
}

/**
 * Drag a rake from (x0, y0) to (x1, y1): its tines comb parallel grooves
 * along the path, and sand piles up a little at either end of the head.
 */
function rake(
  field: Field,
  period: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  if (length < 0.5) {
    return false;
  }
  const dx = (x1 - x0) / length;
  const dy = (y1 - y0) / length;
  const nx = -dy;
  const ny = dx;
  const half = (TINES * period) / 2;
  const reach = half + period * 0.8;
  const k = (2 * Math.PI) / period;
  const { cols, rows, height, stone } = field;
  let changed = false;
  for (let travelled = 0; travelled <= length; travelled += CELL * 0.75) {
    const px = x0 + dx * travelled;
    const py = y0 + dy * travelled;
    const i0 = Math.max(0, Math.floor((px - reach) / CELL));
    const i1 = Math.min(cols - 1, Math.ceil((px + reach) / CELL));
    const j0 = Math.max(0, Math.floor((py - reach) / CELL));
    const j1 = Math.min(rows - 1, Math.ceil((py + reach) / CELL));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const n = j * cols + i;
        if (stone[n]) {
          continue;
        }
        const cx = (i + 0.5) * CELL - px;
        const cy = (j + 0.5) * CELL - py;
        if (Math.abs(cx * dx + cy * dy) <= CELL) {
          changed =
            comb(height, n, cx * nx + cy * ny, half, reach, k, period) ||
            changed;
        }
      }
    }
  }
  return changed;
}

/** Where the intro stroke is at `t`: a slow arc across the lower garden. */
function introPath(t: number, width: number, height: number) {
  const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  return {
    x: width * (0.05 + 0.62 * e),
    y: height * (0.86 - 0.16 * Math.sin(Math.PI * e)),
  };
}

export default function SandGarden({
  className,
  children,
  interactive = true,
  intro = true,
  spacing = 12,
}: SandGardenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const litRef = useRef<HTMLSpanElement>(null);
  const shadeRef = useRef<HTMLSpanElement>(null);
  const stoneRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: false });
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
    const period = Math.max(spacing, 6);

    let width = 0;
    let height = 0;
    let field: Field | null = null;
    let dirty = true;
    let raf = 0;
    let last = 0;
    let visible = true;
    let colorKey = "";
    // Light from the top left until the cursor moves it.
    const restLight = { x: -0.55, y: -0.6 };
    const light = { ...restLight };
    const target = { ...restLight };
    let hand: {
      id: number;
      x: number;
      y: number;
      tx: number;
      ty: number;
    } | null = null;
    let introStart = 0;
    let introDone = !intro || reduceMotion;
    let introPrev: { x: number; y: number } | null = null;

    const readColors = () => {
      const colors = [litRef, shadeRef, stoneRef].map(
        (ref) => getComputedStyle(ref.current as Element).color
      );
      const key = colors.join("|");
      if (key === colorKey) {
        return false;
      }
      colorKey = key;
      gl.uniform3fv(renderer.uLit, toRgb(colors[0], probe));
      gl.uniform3fv(renderer.uShade, toRgb(colors[1], probe));
      gl.uniform3fv(renderer.uStone, toRgb(colors[2], probe));
      return true;
    };

    const upload = () => {
      if (!field) {
        return;
      }
      const { height: h, stone, bytes } = field;
      for (let n = 0; n < h.length; n++) {
        bytes[n * 2] = Math.max(0, Math.min(255, Math.round(h[n] * 255)));
        bytes[n * 2 + 1] = stone[n];
      }
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE_ALPHA,
        field.cols,
        field.rows,
        0,
        gl.LUMINANCE_ALPHA,
        gl.UNSIGNED_BYTE,
        bytes
      );
      dirty = false;
    };

    const draw = () => {
      if (!field) {
        return;
      }
      if (dirty) {
        upload();
      }
      // The light never sits straight overhead, or the grooves vanish.
      const lift = Math.hypot(light.x, light.y);
      const z = Math.max(0.35, 1 - lift * 0.6);
      gl.uniform3f(renderer.uLight, light.x, light.y, z);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (rect.width < 2 || rect.height < 2) {
        return;
      }
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      const short = Math.min(width, height);
      const stones = STONES.map((s) => ({
        x: s.x * width,
        y: s.y * height,
        r: Math.max(s.r * short, period * 1.2),
      }));
      field = createField(width, height, period, stones);
      gl.uniform2f(renderer.uTexel, 1 / field.cols, 1 / field.rows);
      dirty = true;
      if (!introDone && introStart) {
        // Resized mid-stroke: start the stroke again on the new garden.
        introStart = performance.now();
        introPrev = null;
      }
      draw();
    };

    const stepIntro = (now: number) => {
      if (introDone || !introStart || !field) {
        return false;
      }
      const t = Math.min(Math.max((now - introStart) / INTRO_MS, 0), 1);
      const p = introPath(t, width, height);
      if (
        introPrev &&
        rake(field, period, introPrev.x, introPrev.y, p.x, p.y)
      ) {
        dirty = true;
      }
      introPrev = p;
      if (t >= 1) {
        introDone = true;
      }
      return !introDone;
    };

    const stepHand = () => {
      if (!(hand && field)) {
        return;
      }
      // The rake trails the hand a little, which rounds off jittery input.
      const x = hand.x + (hand.tx - hand.x) * 0.5;
      const y = hand.y + (hand.ty - hand.y) * 0.5;
      if (rake(field, period, hand.x, hand.y, x, y)) {
        dirty = true;
      }
      hand.x = x;
      hand.y = y;
    };

    const frame = (now: number) => {
      raf = 0;
      if (!(visible && field)) {
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
      last = now;
      const drawing = stepIntro(now);
      stepHand();
      const k = 1 - Math.exp(-dt / LIGHT_LAG);
      light.x += (target.x - light.x) * k;
      light.y += (target.y - light.y) * k;
      const moving =
        Math.abs(target.x - light.x) + Math.abs(target.y - light.y) > 0.002;
      if (!moving) {
        light.x = target.x;
        light.y = target.y;
      }
      draw();
      if (drawing || hand || moving) {
        raf = requestAnimationFrame(frame);
      }
    };

    const start = () => {
      if (!raf && visible) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    readColors();
    gl.clearColor(0, 0, 0, 0);
    build();
    canvas.style.opacity = "1";

    let size = "";
    const resizeObserver = new ResizeObserver(() => {
      const next = `${canvas.clientWidth}x${canvas.clientHeight}`;
      if (next === size) {
        return;
      }
      size = next;
      build();
      start();
    });
    resizeObserver.observe(canvas);

    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible =
          entry.isIntersecting && document.visibilityState === "visible";
        if (
          visible &&
          !introDone &&
          !introStart &&
          entry.intersectionRatio > 0.4
        ) {
          introStart = performance.now() + 300;
        }
        start();
      },
      { threshold: [0, 0.4] }
    );
    intersection.observe(root);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Follow light and dark mode without asking the app for a theme.
    const colorTimer = window.setInterval(() => {
      if (readColors() && !raf) {
        draw();
      }
    }, 500);

    const local = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onMove = (event: PointerEvent) => {
      const p = local(event);
      if (hand && event.pointerId === hand.id) {
        hand.tx = p.x;
        hand.ty = p.y;
        start();
      }
      if (event.pointerType === "mouse" && !reduceMotion) {
        // The light comes from wherever the cursor is.
        const s = 1.6 / Math.max(width, height);
        let lx = (p.x - width / 2) * s;
        let ly = (p.y - height / 2) * s;
        const len = Math.hypot(lx, ly);
        if (len > 0.85) {
          lx *= 0.85 / len;
          ly *= 0.85 / len;
        }
        target.x = lx;
        target.y = ly;
        start();
      }
    };
    const onLeave = () => {
      target.x = restLight.x;
      target.y = restLight.y;
      start();
    };
    const onDown = (event: PointerEvent) => {
      // Clicks on the content (links, buttons) are not meant for the sand.
      if (
        hand ||
        event.button !== 0 ||
        (event.target as HTMLElement).closest("a, button, input, textarea")
      ) {
        return;
      }
      const p = local(event);
      event.preventDefault();
      root.setPointerCapture(event.pointerId);
      introDone = true;
      hand = { id: event.pointerId, x: p.x, y: p.y, tx: p.x, ty: p.y };
      root.dataset.raking = "";
      start();
    };
    const onUp = (event: PointerEvent) => {
      if (hand && event.pointerId === hand.id) {
        // Finish the stroke where the hand let go.
        hand.x = hand.tx;
        if (field) {
          rake(field, period, hand.x, hand.y, hand.tx, hand.ty);
          dirty = true;
        }
        hand = null;
        delete root.dataset.raking;
        start();
      }
    };
    if (interactive) {
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
  }, [interactive, intro, spacing]);

  return (
    <div
      className={cn(
        "relative flex min-h-[560px] w-full touch-pan-y select-none items-center justify-center overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
        className
      )}
      ref={rootRef}
    >
      {/* Theme colors for the shader: lit sand, sand in shade, and stone. */}
      <span className="hidden text-zinc-50 dark:text-zinc-700" ref={litRef} />
      <span
        className="hidden text-zinc-300 dark:text-zinc-900"
        ref={shadeRef}
      />
      <span
        className="hidden text-zinc-500 dark:text-zinc-600"
        ref={stoneRef}
      />
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
        Slow down
      </h1>
      <p className="max-w-sm text-base text-zinc-600 dark:text-zinc-300">
        A raked sand garden. Drag anywhere to comb new lines, and move the
        cursor to move the light.
      </p>
    </div>
  );
}
