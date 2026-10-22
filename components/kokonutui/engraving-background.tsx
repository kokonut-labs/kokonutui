"use client";

/**
 * @author: @dorianbaffier
 * @description: Engraving Background
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface EngravingBackgroundProps {
  title?: string;
  /** Content under the headline. */
  children?: ReactNode;
  /** Set false and the light stays put. */
  interactive?: boolean;
  className?: string;
}

const VERTEX = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// A ring drawn the way banknotes are: no fills, only hairlines that swell
// where the surface turns from the light, and cross-hatch in the deepest
// shade. The paper around it is ruled with fine wavy lines.
const FRAGMENT = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec2 uCenter;
uniform float uRadius;
uniform vec2 uLight;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec4 uClear;
// 1 on dark paper, where the lines are light: they trace light, not shade.
uniform float uNight;

const float PI = 3.14159265359;
const float MAJOR = 0.6;
const float MINOR = 0.27;

mat3 spin(float t) {
  float a = t * 0.18;
  float b = 0.95 + sin(t * 0.11) * 0.18;
  mat3 ry = mat3(cos(a), 0.0, -sin(a), 0.0, 1.0, 0.0, sin(a), 0.0, cos(a));
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cos(b), sin(b), 0.0, -sin(b), cos(b));
  return rx * ry;
}

float ring(vec3 p) {
  vec2 q = vec2(length(p.xz) - MAJOR, p.y);
  return length(q) - MINOR;
}

// Ink coverage for a set of lines with coordinate u and darkness d.
float lines(float u, float d) {
  float a = abs(fract(u) - 0.5) * 2.0;
  float w = clamp(d, 0.0, 1.0);
  float fw = fwidth(u) * 1.6;
  return smoothstep(1.0 - w - fw, 1.0 - w + fw, a) * smoothstep(0.0, 0.04, w);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 p = (px - uCenter) / uRadius;
  mat3 r = spin(uTime);

  vec3 ro = vec3(p.x, -p.y, 3.0);
  vec3 rd = vec3(0.0, 0.0, -1.0);
  float t = 0.0;
  float closest = 9.0;
  bool hit = false;
  for (int i = 0; i < 64; i++) {
    vec3 q = r * (ro + rd * t);
    float d = ring(q);
    closest = min(closest, d);
    if (d < 0.001) {
      hit = true;
      break;
    }
    t += d;
    if (t > 6.0) {
      break;
    }
  }

  float ink = 0.0;
  vec3 light = normalize(vec3(uLight, 0.85));

  if (hit) {
    vec3 pos = ro + rd * t;
    vec2 e = vec2(0.0015, 0.0);
    vec3 n = normalize(vec3(
      ring(r * (pos + e.xyy)) - ring(r * (pos - e.xyy)),
      ring(r * (pos + e.yxy)) - ring(r * (pos - e.yxy)),
      ring(r * (pos + e.yyx)) - ring(r * (pos - e.yyx))
    ));
    float diffuse = max(dot(n, light), 0.0);
    // The inner face of the ring sits in its own shade.
    vec3 q = r * pos;
    float inner = smoothstep(0.1, -0.25, length(q.xz) - MAJOR);
    float bright = 0.12 + 0.88 * diffuse - inner * 0.18;
    float dark = 1.0 - clamp(bright, 0.0, 1.0);
    dark = mix(dark, clamp(bright, 0.0, 1.0) * 0.85, uNight);

    // Lines wrap the tube, like the turns of a coil, and a second set runs
    // along the ring where the shade gets deep.
    float around = atan(q.z, q.x);
    float tube = atan(q.y, length(q.xz) - MAJOR);
    float a = lines(around / (2.0 * PI) * 120.0, dark * 0.95);
    float b = lines(tube / (2.0 * PI) * 46.0, (dark - 0.52) * 1.8);
    ink = max(a, b);
  } else {
    // Ruled paper with a gentle wave, darker in the ring's cast shadow.
    float wave = sin(px.x * 0.012 + px.y * 0.004) * 1.6;
    float u = (px.y + wave) / 6.0;
    vec2 s = (p - vec2(-uLight.x * 0.32, 0.86 - uLight.y * 0.1)) * vec2(0.9, 3.2);
    float shadow = smoothstep(1.0, 0.0, length(s)) * 0.55;
    float vignette = smoothstep(0.55, 1.15, px.y / uRes.y) * 0.18;
    // The rule thins to nothing behind the copy, so it reads cleanly.
    vec2 c = max(uClear.xy - px, px - uClear.zw);
    float clear = smoothstep(140.0, 0.0, max(c.x, c.y)) * 0.8;
    float base = (0.07 + vignette) * (1.0 - clear);
    ink = lines(u, mix(base + shadow, base * (1.0 - shadow * 1.8), uNight));
    // A contour hugs the silhouette.
    float edge = 1.0 - smoothstep(0.004, 0.016, closest);
    ink = max(ink, edge);
  }

  o = vec4(mix(uPaper, uInk, ink), 1.0);
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

interface Plate {
  resize: (
    w: number,
    h: number,
    cssW: number,
    cssH: number,
    dpr: number
  ) => void;
  setForm: (x: number, y: number, radius: number) => void;
  setClear: (left: number, top: number, right: number, bottom: number) => void;
  setLight: (x: number, y: number) => void;
  setColors: (ink: number[], paper: number[]) => void;
  draw: (time: number) => void;
  destroy: () => void;
}

function createPlate(gl: WebGL2RenderingContext): Plate | null {
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
    dpr: at("uDpr"),
    time: at("uTime"),
    center: at("uCenter"),
    radius: at("uRadius"),
    light: at("uLight"),
    ink: at("uInk"),
    paper: at("uPaper"),
    clear: at("uClear"),
    night: at("uNight"),
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
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook.
  gl.useProgram(program);

  return {
    resize: (w, h, cssW, cssH, dpr) => {
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, cssW, cssH);
      gl.uniform1f(u.dpr, dpr);
    },
    setForm: (x, y, radius) => {
      gl.uniform2f(u.center, x, y);
      gl.uniform1f(u.radius, radius);
    },
    setClear: (left, top, right, bottom) => {
      gl.uniform4f(u.clear, left, top, right, bottom);
    },
    setLight: (x, y) => {
      gl.uniform2f(u.light, x, y);
    },
    setColors: (ink, paper) => {
      gl.uniform3f(u.ink, ink[0], ink[1], ink[2]);
      gl.uniform3f(u.paper, paper[0], paper[1], paper[2]);
      const lum = 0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2];
      gl.uniform1f(u.night, lum < 0.5 ? 1 : 0);
    },
    draw: (time) => {
      gl.uniform1f(u.time, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy: () => {
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}

/** Where the light rests when nobody is pointing: high on the left. */
const REST = { x: -0.65, y: 0.6 };

/**
 * A hero printed like a banknote. A ring turns slowly, drawn only in
 * hairlines that thicken in its shade and cross-hatch where it's darkest,
 * and the pointer carries the light around it.
 */
export default function EngravingBackground({
  title = "Money that keeps its word.",
  children,
  interactive = true,
  className,
}: EngravingBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);
  const paperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const form = formRef.current;
    const gl = canvas?.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
    });
    const probe = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    const plate = gl ? createPlate(gl) : null;
    if (!(root && canvas && form && probe && plate)) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const born = performance.now();
    // Start a few seconds in so the ring is already at a good angle.
    const clock = () => 6 + (performance.now() - born) / 1000;
    const light = { x: REST.x, y: REST.y, tx: REST.x, ty: REST.y };
    let raf = 0;
    let visible = true;
    let colorKey = "";
    let center = { x: 0, y: 0, r: 1 };

    const readColors = () => {
      const ink = getComputedStyle(inkRef.current as Element).color;
      const paper = getComputedStyle(paperRef.current as Element).color;
      const key = `${ink}|${paper}`;
      if (key === colorKey) {
        return false;
      }
      colorKey = key;
      plate.setColors(toRgb(ink, probe), toRgb(paper, probe));
      return true;
    };

    const build = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      plate.resize(canvas.width, canvas.height, rect.width, rect.height, dpr);
      const box = form.getBoundingClientRect();
      center = {
        x: box.left - rect.left + box.width / 2,
        y: box.top - rect.top + box.height / 2,
        r: Math.min(box.width, box.height) / 2,
      };
      plate.setForm(center.x, center.y, center.r);
      const copy = copyRef.current?.getBoundingClientRect();
      if (copy) {
        plate.setClear(
          copy.left - rect.left,
          copy.top - rect.top,
          copy.right - rect.left,
          copy.bottom - rect.top
        );
      }
      plate.setLight(light.x, light.y);
      plate.draw(clock());
    };

    const frame = () => {
      raf = 0;
      if (!visible) {
        return;
      }
      // The light eases toward the pointer instead of snapping to it.
      light.x += (light.tx - light.x) * 0.06;
      light.y += (light.ty - light.y) * 0.06;
      plate.setLight(light.x, light.y);
      plate.draw(clock());
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !reduceMotion) {
        raf = requestAnimationFrame(frame);
      }
    };

    readColors();
    build();
    canvas.style.opacity = "1";
    start();

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

    // Follow light and dark mode without asking the app for a theme.
    const colorTimer = window.setInterval(() => {
      if (readColors() && (reduceMotion || !raf)) {
        plate.draw(clock());
      }
    }, 500);

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }
      const rect = root.getBoundingClientRect();
      const x = (event.clientX - rect.left - center.x) / (rect.width / 2);
      const y = -(event.clientY - rect.top - center.y) / (rect.height / 2);
      light.tx = Math.max(-1.4, Math.min(1.4, x * 1.4));
      light.ty = Math.max(-1.4, Math.min(1.4, y * 1.4));
    };
    const onLeave = () => {
      light.tx = REST.x;
      light.ty = REST.y;
    };
    if (interactive && !reduceMotion) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(colorTimer);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      plate.destroy();
    };
  }, [interactive]);

  return (
    <div
      className={cn(
        "relative min-h-[560px] w-full overflow-hidden bg-[#f6f4ee] text-zinc-900 dark:bg-[#0c0c0b] dark:text-zinc-50",
        className
      )}
      ref={rootRef}
    >
      {/* Theme colors for the shader: ink and paper. */}
      <span
        className="hidden text-[#1d1c1a] dark:text-[#d9d5ca]"
        ref={inkRef}
      />
      <span
        className="hidden text-[#f6f4ee] dark:text-[#0c0c0b]"
        ref={paperRef}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <canvas
          className="h-full w-full opacity-0 transition-opacity duration-700 ease-out"
          ref={canvasRef}
        />
      </div>
      <div className="relative mx-auto grid min-h-[560px] max-w-5xl items-center gap-4 px-6 py-12 sm:grid-cols-[1.1fr_1fr] sm:gap-8 sm:px-10">
        <div
          className="relative z-10 flex flex-col items-start gap-5"
          ref={copyRef}
        >
          <h2 className="max-w-md text-balance font-semibold text-4xl tracking-[-0.04em] sm:text-6xl">
            {title}
          </h2>
          {children === undefined ? <DefaultContent /> : children}
        </div>
        {/* The ring is drawn into this box. */}
        <div
          aria-hidden="true"
          className="pointer-events-none order-first mx-auto aspect-square w-full max-w-[16rem] sm:order-none sm:max-w-[26rem]"
          ref={formRef}
        />
      </div>
    </div>
  );
}

function DefaultContent() {
  return (
    <>
      <p className="max-w-sm text-pretty text-base text-zinc-600 leading-relaxed dark:text-zinc-400">
        A current account with no fees, no minimums and interest paid daily.
        Open one in four minutes.
      </p>
      <div className="flex items-center gap-2">
        <a
          className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 font-medium text-sm text-white transition-colors duration-150 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          href="#open"
        >
          Open an account
        </a>
        <a
          className="inline-flex h-10 items-center rounded-full px-4 font-medium text-sm text-zinc-700 transition-colors duration-150 hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-50"
          href="#rates"
        >
          See rates
        </a>
      </div>
    </>
  );
}
