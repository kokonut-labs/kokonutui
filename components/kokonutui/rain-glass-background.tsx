"use client";

/**
 * @author: @dorianbaffier
 * @description: Rain Glass Background
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface RainGlassBackgroundProps {
  /** The view behind the window. Served with CORS so WebGL can read it. */
  src?: string;
  title?: string;
  /** Content under the headline. */
  children?: ReactNode;
  /** How hard it rains, from 0 (a few drops) to 1 (a downpour). */
  rain?: number;
  /** Set false for a window you can't wipe. */
  interactive?: boolean;
  className?: string;
}

const DEFAULT_SRC =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1800&q=80&auto=format&fit=crop";

// The drop map is drawn at three quarter size, the fog map at half.
const WATER_SCALE = 0.75;
const FOG_SCALE = 0.5;
// The most drops on the pane at once.
const MAX_DROPS = 140;
// A drop this big (css px) gets heavy enough to run.
const RUN_AT = 7.5;
// How long a wiped patch takes to fog over again, in seconds.
const FOG_BACK = 9;
const FOG_STEP = 0.25;
// How much the fog hides the view, 0 to 1.
const FOG = 0.6;
const WIPE_WIDTH = 64;

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
uniform sampler2D uScene;
uniform sampler2D uWater;
uniform sampler2D uClear;
uniform vec4 uCover;
uniform vec2 uRes;
uniform vec3 uFog;
uniform float uFogAmount;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Fine mist on the pane, one droplet per small cell, drawn here so it stays
// sharp at any size.
float mist(vec2 px, out vec2 normal) {
  vec2 cell = floor(px / 7.0);
  if (hash(cell + 7.7).x > 0.55) {
    normal = vec2(0.0);
    return 0.0;
  }
  vec2 h = hash(cell);
  vec2 center = (cell + 0.2 + 0.6 * h) * 7.0;
  float r = 0.6 + 1.7 * pow(hash(cell + 3.1).x, 3.0);
  vec2 d = (px - center) / r;
  normal = d;
  return sqrt(max(0.0, 1.0 - dot(d, d)));
}

vec3 scene(vec2 uv, float lod) {
  return textureLod(uScene, uv * uCover.xy + uCover.zw, lod).rgb;
}

float shine(vec2 n, float thick) {
  vec3 l = normalize(vec3(-0.45, 0.55, 0.7));
  return pow(max(dot(normalize(vec3(n.x, -n.y, thick + 0.15)), l), 0.0), 36.0);
}

void main() {
  vec2 uv = vUv;
  vec4 w = texture(uWater, uv);
  vec2 n = w.rg * 2.0 - 1.0;
  float thick = w.b;
  float clear = texture(uClear, uv).r;

  // Fogged glass: the view goes soft and pale. Wiped glass is clear.
  vec3 soft = mix(scene(uv, 5.0), uFog, uFogAmount);
  vec3 glass = mix(soft, scene(uv, 0.6), clear);

  // A drop is a tiny lens: it shows the view sharp and upside down.
  vec2 aspect = vec2(uRes.y / uRes.x, 1.0);
  vec2 bent = uv + vec2(-n.x, n.y) * aspect * 0.07 * (0.5 + thick);
  vec3 drop = mix(scene(bent, 0.4), soft, 0.18);
  drop *= mix(0.8, 1.05, smoothstep(0.0, 0.6, thick));
  drop += shine(n, thick) * 0.55;
  float a = smoothstep(0.02, 0.18, thick);
  vec3 col = mix(glass, drop, a);

  // Fine mist: beads too small to show the view, they just catch light.
  // Wiping takes them off, and they come back with the fog.
  vec2 mn;
  float m = mist(vec2(uv.x, 1.0 - uv.y) * uRes, mn) * (1.0 - clear);
  vec3 bead = mix(glass, scene(uv - mn * 0.004, 1.0), 0.5);
  bead = bead * mix(0.92, 1.06, m) + shine(mn, m) * 0.35;
  col = mix(col, bead, smoothstep(0.05, 0.4, m) * (1.0 - a) * 0.75);

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

/**
 * One drop as a normal map: red and green tilt the surface, blue is how
 * thick the water is. Drawn once, stamped for every drop.
 */
function dropSprite() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = ((x + 0.5) / size) * 2 - 1;
      const dy = ((y + 0.5) / size) * 2 - 1;
      const d = Math.hypot(dx, dy);
      const i = (y * size + x) * 4;
      const edge = Math.min(1, Math.max(0, (1 - d) / 0.12));
      image.data[i] = 128 + dx * 127;
      image.data[i + 1] = 128 + dy * 127;
      image.data[i + 2] = Math.sqrt(Math.max(0, 1 - d * d)) * 255;
      image.data[i + 3] = edge * 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

interface Drop {
  x: number;
  y: number;
  r: number;
  vy: number;
  /** Sideways drift while running, so the path isn't a ruler line. */
  drift: number;
  /** Distance run since the last trail droplet. */
  trail: number;
}

interface Pane {
  resize: (w: number, h: number, cssW: number, cssH: number) => void;
  setScene: (image: HTMLImageElement, cssW: number, cssH: number) => void;
  setCover: (cssW: number, cssH: number) => void;
  setFog: (rgb: number[], amount: number) => void;
  upload: (water: HTMLCanvasElement, clear: HTMLCanvasElement) => void;
  draw: () => void;
  destroy: () => void;
}

function texture(gl: WebGL2RenderingContext, unit: number) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([128, 128, 0, 255])
  );
  return tex;
}

function createPane(gl: WebGL2RenderingContext): Pane | null {
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

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const sceneTex = texture(gl, 0);
  const waterTex = texture(gl, 1);
  const clearTex = texture(gl, 2);
  let imageAspect = 1;

  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook.
  gl.useProgram(program);
  gl.uniform1i(at("uScene"), 0);
  gl.uniform1i(at("uWater"), 1);
  gl.uniform1i(at("uClear"), 2);
  gl.uniform4f(at("uCover"), 1, 1, 0, 0);

  const setCover = (cssW: number, cssH: number) => {
    // Cover the pane, like object-fit: cover.
    const ratio = cssW / cssH / imageAspect;
    const sx = ratio > 1 ? 1 : ratio;
    const sy = ratio > 1 ? 1 / ratio : 1;
    gl.uniform4f(at("uCover"), sx, sy, 0.5 - sx / 2, 0.5 - sy / 2);
  };

  return {
    resize: (w, h, cssW, cssH) => {
      gl.viewport(0, 0, w, h);
      gl.uniform2f(at("uRes"), cssW, cssH);
    },
    setScene: (image, cssW, cssH) => {
      imageAspect = image.naturalWidth / image.naturalHeight;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR
      );
      setCover(cssW, cssH);
    },
    setCover,
    setFog: (rgb, amount) => {
      gl.uniform3f(at("uFog"), rgb[0], rgb[1], rgb[2]);
      gl.uniform1f(at("uFogAmount"), amount);
    },
    upload: (water, clear) => {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, waterTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        water
      );
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, clearTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        clear
      );
    },
    draw: () => {
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy: () => {
      gl.deleteTexture(sceneTex);
      gl.deleteTexture(waterTex);
      gl.deleteTexture(clearTex);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}

function rainDrop(width: number, height: number): Drop {
  return {
    x: Math.random() * width,
    y: Math.random() * height * 0.95,
    r: 2.5 + Math.random() ** 2 * 6,
    vy: 0,
    drift: (Math.random() - 0.5) * 0.6,
    trail: 0,
  };
}

/** A running drop takes in whatever it runs into. */
function swallow(d: Drop, drops: Drop[]) {
  for (const other of drops) {
    if (other === d || other.r <= 0) {
      continue;
    }
    const reach = (d.r + other.r) * 0.8;
    if (
      Math.abs(other.x - d.x) < reach &&
      Math.abs(other.y - d.y) < reach &&
      Math.hypot(other.x - d.x, other.y - d.y) < reach
    ) {
      d.r = Math.min(16, Math.hypot(d.r, other.r * 0.9));
      other.r = 0;
    }
  }
}

/** Moves the drops on: heavy ones run, leave a trail and swallow others. */
function stepDrops(
  drops: Drop[],
  dt: number,
  height: number,
  clear: CanvasRenderingContext2D
) {
  const fresh: Drop[] = [];
  for (const d of drops) {
    if (d.r < RUN_AT) {
      continue;
    }
    // Heavier drops run faster; friction makes them stutter.
    const pull = 140 + d.r * 22;
    d.vy += (pull - d.vy) * Math.min(1, dt * (Math.random() < 0.06 ? 0.4 : 3));
    const dy = d.vy * dt;
    d.y += dy;
    d.x += d.drift * dy * 0.25 + (Math.random() - 0.5) * 0.4;
    d.trail += dy;
    // Running water wipes the fog in a thin line behind it.
    clear.beginPath();
    clear.arc(d.x * FOG_SCALE, d.y * FOG_SCALE, d.r * 0.7 * FOG_SCALE, 0, 7);
    clear.fill();
    // Now and then it leaves a droplet behind, a little water lost.
    if (d.trail > d.r * 3) {
      d.trail = -Math.random() * d.r * 4;
      d.r *= 0.985;
      fresh.push({
        x: d.x + (Math.random() - 0.5) * 2,
        y: d.y - d.r * 1.2,
        r: d.r * (0.14 + Math.random() * 0.14),
        vy: 0,
        drift: 0,
        trail: 0,
      });
    }
    swallow(d, drops);
    if (d.y - d.r > height) {
      d.r = 0;
    }
  }
  return fresh;
}

/** Stamps every drop into the water map. */
function paintWater(
  ctx: CanvasRenderingContext2D,
  drops: Drop[],
  sprite: HTMLCanvasElement,
  width: number,
  height: number
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgb(128, 128, 0)";
  ctx.fillRect(0, 0, width * WATER_SCALE, height * WATER_SCALE);
  ctx.setTransform(WATER_SCALE, 0, 0, WATER_SCALE, 0, 0);
  for (const d of drops) {
    // A running drop pulls into a teardrop.
    const tall = d.vy > 20 ? 1.25 : 1;
    ctx.drawImage(sprite, d.x - d.r, d.y - d.r * tall, d.r * 2, d.r * 2 * tall);
  }
}

export default function RainGlassBackground({
  src = DEFAULT_SRC,
  title = "Stay in when it rains.",
  children,
  rain = 0.6,
  interactive = true,
  className,
}: RainGlassBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fogRef = useRef<HTMLSpanElement>(null);

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
    const pane = gl ? createPane(gl) : null;
    const waterCanvas = document.createElement("canvas");
    const clearCanvas = document.createElement("canvas");
    const water = waterCanvas.getContext("2d");
    const clear = clearCanvas.getContext("2d");
    if (!(root && canvas && probe && pane && water && clear)) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const sprite = dropSprite();
    let drops: Drop[] = [];
    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    let visible = true;
    let spawn = 0;
    let fogClock = 0;
    let colorKey = "";
    const hand = { down: false, x: 0, y: 0 };

    const readFog = () => {
      const color = getComputedStyle(fogRef.current as Element).color;
      if (color === colorKey) {
        return false;
      }
      colorKey = color;
      pane.setFog(toRgb(color, probe), FOG);
      return true;
    };

    const render = () => {
      paintWater(water, drops, sprite, width, height);
      pane.upload(waterCanvas, clearCanvas);
      pane.draw();
    };

    const build = () => {
      const rect = root.getBoundingClientRect();
      const resized =
        Math.abs(rect.width - width) > 1 || Math.abs(rect.height - height) > 1;
      width = rect.width;
      height = rect.height;
      if (width < 2 || height < 2) {
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      pane.resize(canvas.width, canvas.height, width, height);
      pane.setCover(width, height);
      waterCanvas.width = Math.round(width * WATER_SCALE);
      waterCanvas.height = Math.round(height * WATER_SCALE);
      clearCanvas.width = Math.round(width * FOG_SCALE);
      clearCanvas.height = Math.round(height * FOG_SCALE);
      clear.fillStyle = "black";
      clear.fillRect(0, 0, clearCanvas.width, clearCanvas.height);
      if (resized || drops.length === 0) {
        drops = [];
        const settled = Math.round(20 + rain * 40);
        for (let i = 0; i < settled; i++) {
          const d = rainDrop(width, height);
          d.r = Math.min(d.r, RUN_AT - 0.5);
          drops.push(d);
        }
      }
      render();
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible) {
        return;
      }
      const dt = Math.min((now - (last || now - 16)) / 1000, 1 / 20);
      last = now;
      // New drops land; now and then one lands on another and gets heavy.
      spawn += dt * (4 + rain * 22);
      while (spawn > 1) {
        spawn -= 1;
        if (drops.length < MAX_DROPS) {
          drops.push(rainDrop(width, height));
        } else {
          const d = drops[Math.floor(Math.random() * drops.length)];
          d.r = Math.min(14, d.r + 1.2);
        }
      }
      const fresh = stepDrops(drops, dt, height, clear);
      drops = drops.filter((d) => d.r > 0.6).concat(fresh);
      // Wiped glass fogs over again, slowly. In steps, so the 8-bit fog
      // map keeps fading instead of getting stuck at a faint grey.
      fogClock += dt;
      if (fogClock > FOG_STEP) {
        clear.fillStyle = `rgba(0, 0, 0, ${(fogClock / FOG_BACK) * 2.4})`;
        clear.fillRect(0, 0, clearCanvas.width, clearCanvas.height);
        clear.fillStyle = "white";
        fogClock = 0;
      }
      render();
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !reduceMotion) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    readFog();
    build();
    canvas.style.opacity = "1";
    start();

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      pane.setScene(image, width, height);
      root.dataset.loaded = "true";
      if (reduceMotion) {
        render();
      }
    };
    image.src = src;

    const resizeObserver = new ResizeObserver(() => build());
    resizeObserver.observe(root);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && document.visibilityState === "visible";
      start();
    });
    intersection.observe(root);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const colorTimer = window.setInterval(() => {
      if (readFog() && reduceMotion) {
        render();
      }
    }, 500);

    const local = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    // Dragging wipes the glass like the side of a hand: the fog and the
    // drops under it go.
    const wipe = (x: number, y: number) => {
      clear.strokeStyle = "white";
      clear.lineCap = "round";
      clear.lineWidth = WIPE_WIDTH * FOG_SCALE;
      clear.filter = "blur(3px)";
      clear.beginPath();
      clear.moveTo(hand.x * FOG_SCALE, hand.y * FOG_SCALE);
      clear.lineTo(x * FOG_SCALE, y * FOG_SCALE);
      clear.stroke();
      clear.filter = "none";
      const reach = WIPE_WIDTH / 2;
      for (const d of drops) {
        if (Math.hypot(d.x - x, d.y - y) < reach + d.r * 0.5) {
          d.r = 0;
        }
      }
      hand.x = x;
      hand.y = y;
      if (reduceMotion) {
        render();
      }
    };
    const onDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("a, button, input, textarea")) {
        return;
      }
      const p = local(event);
      hand.down = true;
      hand.x = p.x;
      hand.y = p.y;
      wipe(p.x, p.y);
    };
    const onMove = (event: PointerEvent) => {
      if (hand.down) {
        const p = local(event);
        wipe(p.x, p.y);
      }
    };
    const onUp = () => {
      hand.down = false;
    };
    if (interactive) {
      root.addEventListener("pointerdown", onDown);
      root.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    }

    return () => {
      cancelAnimationFrame(raf);
      image.onload = null;
      window.clearInterval(colorTimer);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      pane.destroy();
    };
  }, [src, rain, interactive]);

  return (
    <div
      className={cn(
        "relative min-h-[560px] w-full touch-pan-y select-none overflow-hidden bg-zinc-200 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50",
        className
      )}
      ref={rootRef}
    >
      {/* Theme color for the shader: the fog on the glass. */}
      <span
        className="hidden text-[#e9edef] dark:text-[#14181b]"
        ref={fogRef}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <canvas
          className="h-full w-full opacity-0 transition-opacity duration-700 ease-out"
          ref={canvasRef}
        />
      </div>
      <div className="relative flex min-h-[560px] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h2 className="max-w-3xl text-balance font-semibold text-5xl tracking-[-0.045em] sm:text-7xl">
          {title}
        </h2>
        {children === undefined ? <DefaultContent /> : children}
      </div>
    </div>
  );
}

function DefaultContent() {
  return (
    <>
      <p className="max-w-md text-balance text-base text-zinc-700 leading-relaxed dark:text-zinc-300">
        Cabins two hours from the city, with a wood stove, a deep bath and no
        signal. Wipe the glass to look outside.
      </p>
      <div className="flex items-center gap-2">
        <a
          className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 font-medium text-sm text-white transition-colors duration-150 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          href="#book"
        >
          Find a weekend
        </a>
        <a
          className="inline-flex h-10 items-center rounded-full px-4 font-medium text-sm text-zinc-700 transition-colors duration-150 hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-50"
          href="#cabins"
        >
          See the cabins
        </a>
      </div>
    </>
  );
}
