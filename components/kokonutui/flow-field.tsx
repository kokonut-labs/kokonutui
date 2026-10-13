"use client";

/**
 * @name: FlowField
 * @description: Canvas particle flow field background — organic noise-driven streams of glowing light.
 * @version: 1.0.0
 * @author: @dorian_baffier
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { MotionConfig, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type ColorTheme = "aurora" | "ember" | "ocean";
type ParticleDensity = "sparse" | "medium" | "dense";

interface Particle {
  x: number;
  y: number;
  speed: number;
  hue: number;
  life: number;
  maxLife: number;
}

interface ThemeConfig {
  hueStart: number;
  hueRange: number;
  saturation: number;
  lightness: number;
  bg: string;
  trailAlpha: number;
}

export interface FlowFieldProps {
  className?: string;
  children?: ReactNode;
  theme?: ColorTheme;
  density?: ParticleDensity;
}

const PARTICLE_COUNTS: Record<ParticleDensity, number> = {
  sparse: 600,
  medium: 1200,
  dense: 2000,
};

const THEMES: Record<ColorTheme, ThemeConfig> = {
  aurora: {
    hueStart: 120,
    hueRange: 200,
    saturation: 90,
    lightness: 62,
    bg: "5, 5, 8",
    trailAlpha: 0.06,
  },
  ember: {
    hueStart: 0,
    hueRange: 55,
    saturation: 95,
    lightness: 58,
    bg: "8, 4, 2",
    trailAlpha: 0.07,
  },
  ocean: {
    hueStart: 180,
    hueRange: 90,
    saturation: 88,
    lightness: 60,
    bg: "2, 6, 10",
    trailAlpha: 0.06,
  },
};

/** Simulated steps drawn up front for the still frame shown with reduced motion. */
const STILL_FRAME_STEPS = 40;

/** The field steps at 60 Hz whatever the display's refresh rate. */
const STEP_MS = 1000 / 60;
/** A step is taken this early, so frame jitter at 60 Hz never skips one. */
const STEP_TOLERANCE_MS = 2;
const MAX_STEPS_PER_FRAME = 3;

// Particle colours are quantised to whole hue degrees and 1% alpha steps, and
// each colour string is built once, instead of one new string per particle
// per frame.
const fillStyles = new Map<number, string>();
const getFillStyle = (
  hue: number,
  saturation: number,
  lightness: number,
  alpha: number
) => {
  const h = Math.round(hue) % 360;
  const a = Math.round(alpha * 100);
  const key = ((h * 101 + a) * 101 + saturation) * 101 + lightness;
  let style = fillStyles.get(key);
  if (!style) {
    style = `hsla(${h}, ${saturation}%, ${lightness}%, ${a / 100})`;
    fillStyles.set(key, style);
  }
  return style;
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Smooth organic 2D noise via a multi-octave trigonometric series.
 * Returns an angle in radians that evolves continuously with time `t`.
 */
function fieldAngle(x: number, y: number, t: number): number {
  const s = 0.0025;
  return (
    Math.sin(x * s + t * 0.0007) * Math.PI +
    Math.cos(y * s + t * 0.0005) * Math.PI +
    Math.sin((x + y) * s * 0.6 + t * 0.0009) * Math.PI * 0.6 +
    Math.cos((x - y) * s * 0.4 + t * 0.0006) * Math.PI * 0.4
  );
}

const wrap = (value: number, max: number) => {
  if (value < 0) {
    return value + max;
  }
  if (value > max) {
    return value - max;
  }
  return value;
};

/** Advances one particle along the field and draws it. */
function stepParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  time: number,
  width: number,
  height: number,
  cfg: ThemeConfig
) {
  const angle = fieldAngle(p.x, p.y, time);

  p.x += Math.cos(angle) * p.speed;
  p.y += Math.sin(angle) * p.speed;
  p.life++;

  // Respawn aged-out particles at a random position
  if (p.life > p.maxLife) {
    p.x = Math.random() * width;
    p.y = Math.random() * height;
    p.life = 0;
    p.hue = cfg.hueStart + Math.random() * cfg.hueRange;
    return;
  }

  p.x = wrap(p.x, width);
  p.y = wrap(p.y, height);

  // Fade in / out over particle lifetime
  const progress = p.life / p.maxLife;
  const fadeIn = Math.min(progress * 8, 1);
  const fadeOut = Math.min((1 - progress) * 6, 1);
  const alpha = fadeIn * fadeOut * 0.9;

  // Hue shifts subtly with field direction for color variety
  const hueMod = (p.hue + (angle / (Math.PI * 2)) * 70 + 360) % 360;

  ctx.beginPath();
  ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
  ctx.fillStyle = getFillStyle(hueMod, cfg.saturation, cfg.lightness, alpha);
  ctx.fill();
}

/** Keeps each particle at the same relative position in a resized field. */
function rescaleParticles(
  particles: Particle[],
  scaleX: number,
  scaleY: number
) {
  for (const p of particles) {
    p.x *= scaleX;
    p.y *= scaleY;
  }
  return particles;
}

function DefaultContent() {
  return (
    // Reduced motion keeps the fade-in and drops the rise.
    <MotionConfig reducedMotion="user">
      <div className="relative z-10 flex flex-col items-center justify-center gap-6 px-6 text-center">
        <motion.h1
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl font-bold text-5xl text-white leading-[1.08] tracking-tight sm:text-6xl md:text-7xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.38, ease: EASE_OUT }}
        >
          Chaos finds its
          <br />
          <span className="bg-linear-to-r from-emerald-300 via-teal-200 to-violet-300 bg-clip-text text-transparent">
            own beauty
          </span>
        </motion.h1>

        <motion.p
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md text-base text-white/50 leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.6, delay: 0.56, ease: EASE_OUT }}
        >
          Thousands of particles drift through an organic noise field, painting
          luminous trails that shift and spiral endlessly.
        </motion.p>
      </div>
    </MotionConfig>
  );
}

export default function FlowField({
  className,
  children,
  theme = "aurora",
  density = "medium",
}: FlowFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Sized from the wrapper around the canvas, which fills the component.
    const container = canvas.parentElement;
    if (!container) {
      return;
    }

    const cfg = THEMES[theme];
    const count = PARTICLE_COUNTS[density];
    const dpr = window.devicePixelRatio ?? 1;

    let width = 0;
    let height = 0;
    let animId = 0;
    let time = 0;
    let lastFrameTime = 0;
    let pendingMs = 0;
    let particles: Particle[] = [];

    const spawnParticle = (): Particle => {
      const maxLife = 200 + Math.floor(Math.random() * 300);
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 1.1 + Math.random() * 1.8,
        hue: cfg.hueStart + Math.random() * cfg.hueRange,
        life: Math.floor(Math.random() * maxLife),
        maxLife,
      };
    };

    const step = () => {
      time++;

      // Fade previous frame — each dot persists ~16 frames, creating soft trails
      ctx.fillStyle = `rgba(${cfg.bg}, ${cfg.trailAlpha})`;
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        stepParticle(ctx, p, time, width, height, cfg);
      }
    };

    // Reduced motion: simulate a few steps up front so the still frame shows
    // short trails, then never start the loop.
    const drawStillFrame = () => {
      for (let i = 0; i < STILL_FRAME_STEPS; i++) {
        step();
      }
    };

    const resize = () => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      if (nextWidth === width && nextHeight === height) {
        return;
      }

      // An existing field is rescaled rather than re-seeded, so a resize does
      // not reshuffle every particle.
      const canRescale = particles.length > 0 && width > 0 && height > 0;
      const scaleX = nextWidth / width;
      const scaleY = nextHeight / height;
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.scale(dpr, dpr);

      // Fill dark base on resize
      ctx.fillStyle = `rgb(${cfg.bg})`;
      ctx.fillRect(0, 0, width, height);

      particles = canRescale
        ? rescaleParticles(particles, scaleX, scaleY)
        : Array.from({ length: count }, spawnParticle);

      if (shouldReduceMotion) {
        drawStillFrame();
      }
    };

    // Fixed 60 Hz steps: a 120 Hz display draws every other frame instead of
    // running the field (and fading the trails) twice as fast.
    const render = (now: number) => {
      pendingMs = lastFrameTime
        ? pendingMs + Math.min(now - lastFrameTime, 100)
        : STEP_MS;
      lastFrameTime = now;

      let steps = 0;
      while (
        pendingMs >= STEP_MS - STEP_TOLERANCE_MS &&
        steps < MAX_STEPS_PER_FRAME
      ) {
        step();
        pendingMs -= STEP_MS;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) {
        pendingMs = 0;
      }

      animId = requestAnimationFrame(render);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Only animate while the field is on screen.
    const observer = shouldReduceMotion
      ? null
      : new IntersectionObserver(([entry]) => {
          cancelAnimationFrame(animId);
          if (entry?.isIntersecting) {
            lastFrameTime = 0;
            animId = requestAnimationFrame(render);
          }
        });
    observer?.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      observer?.disconnect();
      resizeObserver.disconnect();
    };
  }, [theme, density, shouldReduceMotion]);

  const bgColor = THEMES[theme].bg;

  return (
    <div
      className={cn(
        "relative flex min-h-screen w-full items-center justify-center overflow-hidden",
        className
      )}
      style={{ background: `rgb(${bgColor})` }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <canvas className="h-full w-full" ref={canvasRef} />
      </div>

      {/* Radial vignette — focuses center, dims edges */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 65% 60% at 50% 50%, transparent 20%, rgba(${bgColor}, 0.92) 100%)`,
        }}
      />

      {/* Soft top / bottom fades */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background: `linear-gradient(to bottom, rgb(${bgColor}), transparent)`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{
          background: `linear-gradient(to top, rgb(${bgColor}), transparent)`,
        }}
      />

      {/* Pass children={null} for a bare background. */}
      {children === undefined ? <DefaultContent /> : children}
    </div>
  );
}
