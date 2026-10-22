"use client";

/**
 * @author: @dorianbaffier
 * @description: Caustics Background
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface CausticsBackgroundProps {
  /** The headline. It floats on the water and casts a shadow on the floor. */
  title?: string;
  /**
   * Content under the headline. Give an element `data-shadow="box"` and it
   * casts a shadow too.
   */
  children?: ReactNode;
  /** Set false for water you can't touch. */
  interactive?: boolean;
  className?: string;
}

// Ripples alive at once. A new one replaces the oldest.
const RIPPLES = 12;
// How far apart the caustic cells are, in px.
const CELL = 150;
// Where the floor shadow lands, from the thing that casts it, in px.
const SHADOW_X = 16;
const SHADOW_Y = 30;
const SHADOW_BLUR = 7;
// Moving the pointer faster than this (px/ms) leaves a wake.
const WAKE_SPEED = 0.25;
const WAKE_EVERY = 70;

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uRipples[${RIPPLES}];
uniform sampler2D uMask;
uniform vec3 uWater;
uniform vec3 uLight;
uniform vec2 uShadow;

const float TAU = 6.28318530718;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// The bright web of light on a pool floor: the edges between drifting
// cells, where the waves focus the sun.
float caustic(vec2 p, float t) {
  vec2 q = p;
  p += 0.34 * vec2(sin(p.y * 1.3 + t * 0.9), cos(p.x * 1.1 - t * 0.7));
  p += 0.12 * vec2(sin(p.y * 3.1 - t), cos(p.x * 2.7 + t * 1.2));
  vec2 n = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.5 + 0.42 * sin(t + TAU * hash(n + g));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  float edge = sqrt(f2) - sqrt(f1);
  // A sharp core and a soft halo, brighter in some patches than others.
  float line = pow(1.0 - smoothstep(0.0, 0.14, edge), 2.0);
  float halo = 1.0 - smoothstep(0.0, 0.32, edge);
  float glint = 0.6 + 0.4 * sin(q.x * 0.55 + t * 0.6) * cos(q.y * 0.45 - t * 0.5);
  return (line * 0.85 + halo * 0.18) * glint;
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 bend = vec2(0.0);
  float focus = 0.0;
  for (int k = 0; k < ${RIPPLES}; k++) {
    vec4 r = uRipples[k];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 4.0) {
      continue;
    }
    vec2 d = px - r.xy;
    float dist = length(d);
    float x = dist - age * 240.0;
    float env = r.w * exp(-age * 0.8) * exp(-x * x / 2600.0) / (1.0 + dist * 0.002);
    bend += (d / max(dist, 1.0)) * sin(x * 0.085) * env * 26.0;
    focus += cos(x * 0.085) * env;
  }
  vec2 uv = (px + bend) / ${CELL}.0;
  float t = uTime * 0.5;
  float c = caustic(uv, t);
  // A fainter, finer web drifting under the first gives the floor depth.
  c = max(c, caustic(uv * 1.9 + 7.3, t * 0.8 + 3.0) * 0.22);
  // A ring's crest focuses light like a lens and its trough spreads it, so
  // each ring shows as a bright band with a dim one beside it.
  c = clamp(c * (1.0 + focus * 1.2) + focus * 0.4, 0.0, 1.0);

  // Whatever floats on the surface blocks the light under it. The water
  // bends the shadow the same way it bends the light.
  vec2 sway = vec2(sin(uTime * 0.7), cos(uTime * 0.55)) * 2.5;
  vec2 s = (px - uShadow - bend * 1.4 - sway) / uRes;
  float shade = texture(uMask, s).r;

  vec3 floor = uWater * (1.0 - shade * 0.08);
  vec3 col = mix(floor, uLight, c * (1.0 - shade * 0.9));
  o = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Parses any CSS color, oklch included, by painting it into one pixel. */
function toRgb(color: string, probe: CanvasRenderingContext2D) {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

interface Water {
  resize: (w: number, h: number, cssW: number, cssH: number) => void;
  setMask: (source: HTMLCanvasElement) => void;
  setColors: (water: number[], light: number[]) => void;
  setRipples: (data: Float32Array) => void;
  draw: (time: number) => void;
  destroy: () => void;
}

function createWater(gl: WebGL2RenderingContext): Water | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!(vertex && fragment && program)) {
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return null;
  }
  const at = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    res: at("uRes"),
    time: at("uTime"),
    ripples: at("uRipples"),
    mask: at("uMask"),
    water: at("uWater"),
    light: at("uLight"),
    shadow: at("uShadow"),
  };

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const mask = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, mask);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R8,
    1,
    1,
    0,
    gl.RED,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0])
  );

  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook.
  gl.useProgram(program);
  gl.uniform1i(u.mask, 0);
  gl.uniform2f(u.shadow, SHADOW_X, SHADOW_Y);

  return {
    resize: (w, h, cssW, cssH) => {
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, cssW, cssH);
    },
    setMask: (source) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mask);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source
      );
    },
    setColors: (water, light) => {
      gl.uniform3f(u.water, water[0], water[1], water[2]);
      gl.uniform3f(u.light, light[0], light[1], light[2]);
    },
    setRipples: (data) => {
      gl.uniform4fv(u.ripples, data);
    },
    draw: (time) => {
      gl.uniform1f(u.time, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy: () => {
      gl.deleteTexture(mask);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}

/**
 * Paints everything that floats (`data-shadow` elements) into a soft mask,
 * in the root's coordinates, for the floor shadow.
 */
function drawMask(canvas: HTMLCanvasElement, root: HTMLElement) {
  const rect = root.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `blur(${SHADOW_BLUR}px)`;
  ctx.fillStyle = "white";
  for (const el of root.querySelectorAll<HTMLElement>("[data-shadow]")) {
    const box = el.getBoundingClientRect();
    const x = box.left - rect.left;
    const y = box.top - rect.top;
    if (el.dataset.shadow === "text") {
      const style = getComputedStyle(el);
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.letterSpacing = style.letterSpacing;
      ctx.textBaseline = "alphabetic";
      const word = el.textContent ?? "";
      const m = ctx.measureText(word);
      const baseline =
        y +
        (box.height + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
      ctx.fillText(word, x, baseline);
    } else {
      const radius = Number.parseFloat(getComputedStyle(el).borderRadius) || 0;
      ctx.beginPath();
      ctx.roundRect(x, y, box.width, box.height, radius);
      ctx.fill();
    }
  }
}

export default function CausticsBackground({
  title = "Swim before work.",
  children,
  interactive = true,
  className,
}: CausticsBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waterRef = useRef<HTMLSpanElement>(null);
  const lightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
    });
    const probe = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    const water = gl ? createWater(gl) : null;
    if (!(root && canvas && probe && water)) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const maskCanvas = document.createElement("canvas");
    const ripples = new Float32Array(RIPPLES * 4);
    const born = performance.now();
    const clock = () => (performance.now() - born) / 1000;
    let next = 0;
    let raf = 0;
    let visible = true;
    let colorKey = "";
    let width = 0;
    let height = 0;
    const hand = { x: 0, y: 0, t: 0, wake: 0 };

    const drop = (x: number, y: number, strength: number) => {
      ripples.set([x, y, clock(), strength], next * 4);
      next = (next + 1) % RIPPLES;
      water.setRipples(ripples);
    };

    const readColors = () => {
      const w = getComputedStyle(waterRef.current as Element).color;
      const l = getComputedStyle(lightRef.current as Element).color;
      const key = `${w}|${l}`;
      if (key === colorKey) {
        return false;
      }
      colorKey = key;
      water.setColors(toRgb(w, probe), toRgb(l, probe));
      return true;
    };

    const build = () => {
      const rect = root.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (width < 2 || height < 2) {
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      water.resize(canvas.width, canvas.height, width, height);
      drawMask(maskCanvas, root);
      water.setMask(maskCanvas);
      water.draw(reduceMotion ? 8 : clock());
    };

    const frame = () => {
      raf = 0;
      if (!visible) {
        return;
      }
      water.draw(clock());
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !reduceMotion) {
        raf = requestAnimationFrame(frame);
      }
    };

    readColors();
    water.setRipples(ripples);
    build();
    canvas.style.opacity = "1";
    start();

    // One drop when the page opens, so the water shows it can be touched.
    const firstDrop = window.setTimeout(() => {
      if (!reduceMotion && interactive) {
        drop(width * 0.68, height * 0.3, 1.1);
      }
    }, 500);

    // Web fonts can land after the first mask; draw it again when they do.
    document.fonts?.ready.then(() => {
      if (rootRef.current) {
        build();
      }
    });

    const resizeObserver = new ResizeObserver(() => build());
    resizeObserver.observe(root);
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
      if (readColors() && (reduceMotion || !raf)) {
        water.draw(reduceMotion ? 8 : clock());
      }
    }, 500);

    const local = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onMove = (event: PointerEvent) => {
      const p = local(event);
      const now = event.timeStamp;
      const dt = Math.max(1, now - hand.t);
      const speed = Math.hypot(p.x - hand.x, p.y - hand.y) / dt;
      // A quick pass over the water leaves a trail of small rings.
      if (hand.t && speed > WAKE_SPEED && now - hand.wake > WAKE_EVERY) {
        drop(p.x, p.y, Math.min(0.45, speed * 0.25));
        hand.wake = now;
      }
      hand.x = p.x;
      hand.y = p.y;
      hand.t = now;
    };
    const onLeave = () => {
      hand.t = 0;
    };
    const onDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("a, button, input, textarea")) {
        return;
      }
      const p = local(event);
      drop(p.x, p.y, 1.4);
    };
    if (interactive && !reduceMotion) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
      root.addEventListener("pointerdown", onDown);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(firstDrop);
      window.clearInterval(colorTimer);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
      water.destroy();
    };
  }, [interactive]);

  const words = title.split(" ");

  return (
    <div
      className={cn(
        "relative min-h-[560px] w-full touch-pan-y overflow-hidden bg-[#cde5e4] text-zinc-900 dark:bg-[#06201f] dark:text-zinc-50",
        className
      )}
      ref={rootRef}
    >
      {/* Theme colors for the shader: the pool floor and its light. */}
      <span
        className="hidden text-[#cde5e4] dark:text-[#06201f]"
        ref={waterRef}
      />
      <span className="hidden text-white dark:text-[#3ea89d]" ref={lightRef} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <canvas
          className="h-full w-full opacity-0 transition-opacity duration-700 ease-out"
          ref={canvasRef}
        />
      </div>
      <div className="relative flex min-h-[560px] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h2 className="max-w-3xl text-balance font-semibold text-5xl tracking-[-0.045em] sm:text-7xl">
          {words.map((word, i) => (
            <span key={`${word}-${i.toString()}`}>
              <span data-shadow="text">{word}</span>
              {i < words.length - 1 ? " " : null}
            </span>
          ))}
        </h2>
        {children === undefined ? <DefaultContent /> : children}
      </div>
    </div>
  );
}

function DefaultContent() {
  return (
    <>
      <p className="max-w-md text-balance text-base text-zinc-600 leading-relaxed dark:text-zinc-300">
        Book a lane at any of 40 city pools. Lanes open at 6am, and the first
        swim is on us.
      </p>
      <div className="flex items-center gap-2">
        <a
          className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 font-medium text-sm text-white transition-colors duration-150 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          data-shadow="box"
          href="#book"
        >
          Book a lane
        </a>
        <a
          className="inline-flex h-10 items-center rounded-full px-4 font-medium text-sm text-zinc-700 transition-colors duration-150 hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-50"
          href="#pools"
        >
          Find a pool
        </a>
      </div>
    </>
  );
}
